"""Flow state model for tracking conversation across multiple turns.

This module defines the IntakeState Pydantic model used by the IntakeFlow
to track conversation progress, language detection, category routing,
and ticket data as it's collected through multi-turn interaction.
"""
from pydantic import BaseModel, Field


class IntakeState(BaseModel):
    """State model for intake flow orchestration.

    Tracks conversation metadata, routing decisions, and collected ticket data
    across multiple turns until intake is complete.
    """

    message_id: str = Field(default="", description="Unique message identifier")
    user_id: str = Field(default="", description="User UUID")
    tenant_id: str = Field(default="", description="Municipality tenant UUID")
    session_id: str = Field(default="", description="Conversation session identifier")
    language: str = Field(default="en", description="Detected language (en/zu/af)")
    message: str = Field(default="", description="Current user message")
    category: str | None = Field(default=None, description="Classified category (municipal/gbv)")
    subcategory: str | None = Field(
        default=None,
        description="Subcategory for municipal (water/roads/electricity/waste/sanitation)"
    )
    ticket_data: dict | None = Field(default=None, description="Completed ticket information")
    ticket_id: str | None = Field(default=None, description="Created ticket ID")
    routing_confidence: float = Field(default=0.0, description="Classification confidence score")
    turn_count: int = Field(default=0, description="Number of conversation turns")
    is_complete: bool = Field(default=False, description="Whether intake is complete")
    error: str | None = Field(default=None, description="Error message if any")

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "message_id": "msg_123",
                "user_id": "user_456",
                "tenant_id": "tenant_789",
                "session_id": "session_abc",
                "language": "en",
                "message": "There is a water pipe burst on Main Street",
                "category": "municipal",
                "subcategory": "water",
                "routing_confidence": 0.95,
                "turn_count": 1,
                "is_complete": False
            }
        }
