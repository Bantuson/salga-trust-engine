"""Authentication endpoints for user registration, login, and token refresh."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.core.supabase import get_supabase_admin
from src.middleware.rate_limit import AUTH_RATE_LIMIT, REGISTER_RATE_LIMIT, limiter
from src.models.consent import ConsentRecord
from src.models.municipality import Municipality
from src.models.user import User
from src.schemas.auth import (
    LoginRequest,
    PhoneOtpRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    VerifyOtpRequest,
)
from src.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


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

    # Get Supabase admin client
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )

    # Create user in Supabase Auth
    try:
        auth_response = supabase_admin.auth.admin.create_user({
            "email": registration.email,
            "password": registration.password,
            "phone": registration.phone if registration.phone else None,
            "email_confirm": True,  # Auto-confirm for now (enable email verification later)
            "app_metadata": {
                "role": "citizen",
                "tenant_id": str(municipality.id)
            },
            "user_metadata": {
                "full_name": registration.full_name,
                "preferred_language": registration.preferred_language
            }
        })

        supabase_user_id = auth_response.user.id

    except Exception as e:
        logger.error(f"Supabase Auth user creation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account"
        )

    # Create local User record with Supabase Auth user ID
    user = User(
        id=supabase_user_id,  # Use Supabase Auth user ID as primary key
        email=registration.email,
        hashed_password="supabase_managed",  # Password managed by Supabase
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
    """Authenticate user via Supabase Auth and return JWT tokens.

    Uses generic error messages to prevent user enumeration attacks.

    Args:
        request: FastAPI request object
        credentials: Login credentials (email and password)
        db: Database session

    Returns:
        TokenResponse with Supabase access and refresh tokens

    Raises:
        401: Invalid credentials (generic message for security)
    """
    # Get Supabase admin client
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )

    # Authenticate with Supabase Auth
    try:
        auth_response = supabase_admin.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })

        # Extract tokens from response
        access_token = auth_response.session.access_token
        refresh_token = auth_response.session.refresh_token

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )

    except Exception as e:
        # Generic error message for security (don't reveal if email exists)
        logger.warning(f"Login attempt failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_request: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using Supabase Auth refresh token.

    Args:
        refresh_request: Request containing Supabase refresh token
        db: Database session

    Returns:
        TokenResponse with new access and refresh tokens

    Raises:
        401: Invalid or expired refresh token
    """
    # Get Supabase admin client
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )

    # Refresh session with Supabase Auth
    try:
        auth_response = supabase_admin.auth.refresh_session(refresh_request.refresh_token)

        # Extract new tokens from response
        access_token = auth_response.session.access_token
        new_refresh_token = auth_response.session.refresh_token

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )

    except Exception as e:
        logger.warning(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/otp/send", status_code=status.HTTP_200_OK)
@limiter.limit(AUTH_RATE_LIMIT)
async def send_phone_otp(
    request: Request,
    otp_request: PhoneOtpRequest
):
    """Send OTP code to phone number via Supabase Auth.

    This enables passwordless authentication via SMS OTP.

    Args:
        request: FastAPI request object
        otp_request: Request containing phone number

    Returns:
        Success message (OTP sent)

    Raises:
        503: Authentication service unavailable
        500: Failed to send OTP
    """
    # Get Supabase admin client
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )

    # Send OTP via Supabase Auth
    try:
        supabase_admin.auth.sign_in_with_otp({
            "phone": otp_request.phone
        })

        return {
            "message": "OTP sent successfully",
            "phone": otp_request.phone
        }

    except Exception as e:
        logger.error(f"Failed to send OTP: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP code"
        )


@router.post("/otp/verify", response_model=TokenResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def verify_phone_otp(
    request: Request,
    verify_request: VerifyOtpRequest
):
    """Verify OTP code and authenticate user via Supabase Auth.

    Args:
        request: FastAPI request object
        verify_request: Request containing phone number and OTP token

    Returns:
        TokenResponse with access and refresh tokens

    Raises:
        401: Invalid OTP code
        503: Authentication service unavailable
    """
    # Get Supabase admin client
    supabase_admin = get_supabase_admin()
    if not supabase_admin:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )

    # Verify OTP with Supabase Auth
    try:
        auth_response = supabase_admin.auth.verify_otp({
            "phone": verify_request.phone,
            "token": verify_request.token,
            "type": "sms"
        })

        # Extract tokens from response
        access_token = auth_response.session.access_token
        refresh_token = auth_response.session.refresh_token

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )

    except Exception as e:
        logger.warning(f"OTP verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP code",
            headers={"WWW-Authenticate": "Bearer"},
        )
