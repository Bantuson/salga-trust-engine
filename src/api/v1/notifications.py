"""In-App Notifications API routes.

Provides REST endpoints for the notification system:
- List the current user's notifications (with optional is_read filter)
- Mark notifications as read (batch operation)
- Get unread count for badge display

All endpoints require authentication (get_current_user).
No PMS gate or tier restriction — all authenticated users can read their own notifications.

Notifications are user-scoped: each user only sees their own notifications.
The backend enforces this by filtering by current_user.id.

Endpoint prefix: /api/v1/notifications
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db
from src.models.notification import Notification
from src.models.user import User
from src.schemas.notification import NotificationMarkRead, NotificationResponse

router = APIRouter(
    prefix="/api/v1/notifications",
    tags=["Notifications"],
)


# ---------------------------------------------------------------------------
# List notifications
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response_model=list[NotificationResponse],
    summary="List current user's notifications",
)
async def list_notifications(
    is_read: bool | None = Query(
        default=None,
        description="Filter by read status. True = read only, False = unread only, None = all.",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Maximum number of notifications to return (default 50, max 200).",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    """Return the current user's notifications, newest first.

    Optionally filter by read status:
    - is_read=false: unread notifications only
    - is_read=true:  read notifications only
    - (omitted):     all notifications

    Results are ordered by created_at descending (newest first).
    """
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )

    if is_read is not None:
        query = query.where(Notification.is_read == is_read)

    result = await db.execute(query)
    notifications = list(result.scalars().all())
    return [NotificationResponse.model_validate(n) for n in notifications]


# ---------------------------------------------------------------------------
# Unread count (for badge display)
# ---------------------------------------------------------------------------


@router.get(
    "/unread-count",
    summary="Get unread notification count (for badge display)",
)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the count of unread notifications for the current user.

    Intended for frontend badge display (e.g., notification bell icon).
    Returns {"count": N}.
    """
    from sqlalchemy import func

    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    count = result.scalar() or 0
    return {"count": count}


# ---------------------------------------------------------------------------
# Mark notifications as read
# ---------------------------------------------------------------------------


@router.post(
    "/mark-read",
    status_code=status.HTTP_200_OK,
    summary="Mark notifications as read (batch)",
)
async def mark_notifications_read(
    payload: NotificationMarkRead,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark a list of notifications as read for the current user.

    Only marks notifications that belong to the current user.
    Notifications from other users are silently ignored (no 403).

    Returns the count of notifications actually marked as read.
    """
    now = datetime.now(timezone.utc)

    # Fetch notifications that belong to the current user (security check)
    result = await db.execute(
        select(Notification).where(
            Notification.id.in_(payload.notification_ids),
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    notifications = list(result.scalars().all())

    # Update each notification
    for notification in notifications:
        notification.is_read = True
        notification.read_at = now

    if notifications:
        await db.commit()

    return {
        "marked_read": len(notifications),
        "requested": len(payload.notification_ids),
    }
