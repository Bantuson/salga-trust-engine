"""Pydantic v2 schemas for In-App Notification CRUD.

These schemas validate API request/response payloads for:
- Notification listing and serialisation
- Marking notifications as read (batch operation)
- Unread count badge endpoint

All notification schemas are user-scoped — the API layer filters by
the authenticated user's ID.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    """Schema for notification API responses.

    Serialises all notifications table fields for frontend display.
    from_attributes=True enables Pydantic to read from ORM objects directly.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    link: str | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime


class NotificationMarkRead(BaseModel):
    """Schema for batch-marking notifications as read.

    notification_ids: UUIDs of notifications to mark as read.
    All listed notifications must belong to the requesting user
    (enforced at the service layer).
    """

    notification_ids: list[UUID] = Field(
        ...,
        min_length=1,
        description="List of notification IDs to mark as read",
    )
