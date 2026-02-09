"""Authentication endpoints for user registration, login, and token refresh."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)
from src.middleware.rate_limit import AUTH_RATE_LIMIT, REGISTER_RATE_LIMIT, limiter
from src.models.consent import ConsentRecord
from src.models.municipality import Municipality
from src.models.user import User
from src.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from src.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


# Trilingual POPIA consent descriptions
CONSENT_DESCRIPTIONS = {
    "en": "I consent to SALGA Trust Engine processing my personal data for municipal service reporting, issue tracking, and communication about reported issues.",
    "zu": "Ngiyavuma ukuthi i-SALGA Trust Engine icubungule idatha yami yomuntu siqu ukuze ngibike izinkinga zikamsipala, ukulandelela izinkinga, nokuxhumana ngezinkinga ezibikiwe.",
    "af": "Ek stem in dat SALGA Trust Engine my persoonlike data verwerk vir munisipale diensverslaggewing, kwessie-opsporing en kommunikasie oor aangemelde kwessies.",
}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(REGISTER_RATE_LIMIT)
async def register(
    request: Request,
    registration: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with mandatory POPIA consent.

    Creates user account and consent record in a single transaction.
    Returns user data and authentication tokens.

    Args:
        request: FastAPI request object (for IP address)
        registration: Registration data including email, password, and consent
        db: Database session

    Returns:
        UserResponse with user data and tokens

    Raises:
        404: Municipality not found
        409: Email already registered in this municipality
        422: Invalid data or consent not given
    """
    # Validate municipality exists
    result = await db.execute(
        select(Municipality).where(Municipality.code == registration.municipality_code)
    )
    municipality = result.scalar_one_or_none()

    if not municipality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Municipality with code '{registration.municipality_code}' not found"
        )

    if not municipality.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Municipality is not currently accepting registrations"
        )

    # Check email uniqueness within tenant (same email can exist in different municipalities)
    result = await db.execute(
        select(User).where(
            User.email == registration.email,
            User.tenant_id == municipality.id
        )
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered for this municipality"
        )

    # Hash password
    hashed_password = get_password_hash(registration.password)

    # Create user record
    user = User(
        email=registration.email,
        hashed_password=hashed_password,
        full_name=registration.full_name,
        phone=registration.phone,
        preferred_language=registration.preferred_language,
        municipality_id=municipality.id,
        tenant_id=municipality.id,  # Municipality ID is the tenant ID
    )

    db.add(user)
    await db.flush()  # Flush to get user.id for consent record

    # Get IP address from request
    client_ip = request.client.host if request.client else None

    # Get consent description in user's preferred language
    consent_description = CONSENT_DESCRIPTIONS.get(
        registration.preferred_language,
        CONSENT_DESCRIPTIONS["en"]  # Default to English
    )

    # Create POPIA consent record
    consent_record = ConsentRecord(
        user_id=user.id,
        tenant_id=municipality.id,
        purpose="platform_registration",
        purpose_description=consent_description,
        language=registration.preferred_language,
        consented=registration.consent.consented,
        consented_at=datetime.now(timezone.utc),
        ip_address=client_ip,
    )

    db.add(consent_record)
    await db.commit()
    await db.refresh(user)

    # Return user response (auto-login after registration handled by client)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(
    request: Request,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT tokens.

    Uses generic error messages to prevent user enumeration attacks.

    Args:
        credentials: Login credentials (email and password)
        db: Database session

    Returns:
        TokenResponse with access and refresh tokens

    Raises:
        401: Invalid credentials (generic message for security)
    """
    # Look up user by email (across all tenants)
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()

    # Use generic error message for both wrong email and wrong password (prevent user enumeration)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check user is active
    if not user.is_active or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create token payload
    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role.value,
    }

    # Create access and refresh tokens
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_request: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token (token rotation).

    Args:
        refresh_request: Request containing refresh token
        db: Database session

    Returns:
        TokenResponse with new access and refresh tokens

    Raises:
        401: Invalid or expired refresh token
    """
    # Decode refresh token
    payload = decode_refresh_token(refresh_request.refresh_token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user_id from payload
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Look up user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create new token payload
    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role.value,
    }

    # Issue new access and refresh tokens (token rotation)
    access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )
