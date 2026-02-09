"""Pydantic schemas for web portal report submission.

Schemas for GPS location data, report submission requests, and responses.
Supports direct web-based report submission with GPS coordinates, manual address,
and presigned file uploads.
"""
from pydantic import BaseModel, Field, model_validator


class LocationData(BaseModel):
    """GPS location data with accuracy metadata."""

    latitude: float = Field(ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(ge=-180, le=180, description="Longitude coordinate")
    accuracy: float = Field(gt=0, description="GPS accuracy in meters")
    source: str = Field(default="gps", description="Location source: gps or manual")


class ReportSubmitRequest(BaseModel):
    """Schema for submitting a report via web portal."""

    description: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Issue description"
    )
    category: str | None = Field(
        None,
        description="Optional pre-selected category (water/roads/electricity/waste/sanitation/gbv/other). If None, AI will classify."
    )
    location: LocationData | None = Field(
        None,
        description="GPS coordinates if available"
    )
    manual_address: str | None = Field(
        None,
        max_length=500,
        description="Manual address if GPS unavailable"
    )
    media_file_ids: list[str] = Field(
        default_factory=list,
        max_length=5,
        description="List of file_ids from presigned uploads (max 5)"
    )
    language: str = Field(
        default="en",
        description="User's language preference (en/zu/af)"
    )
    is_gbv: bool = Field(
        default=False,
        description="Whether this is a GBV report (triggers enhanced encryption and SAPS routing)"
    )

    @model_validator(mode='after')
    def require_location_or_address(self):
        """Require at least one of location or manual_address."""
        if self.location is None and not self.manual_address:
            raise ValueError("Either GPS location or manual address is required")
        return self


class ReportSubmitResponse(BaseModel):
    """Schema for report submission response."""

    ticket_id: str
    tracking_number: str
    category: str
    status: str
    message: str
    media_count: int
