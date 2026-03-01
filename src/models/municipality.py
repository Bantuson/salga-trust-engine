"""Municipality model for multi-tenant registration."""
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import NonTenantModel


class Municipality(NonTenantModel):
    """Municipality model - exists above tenant scope."""

    __tablename__ = "municipalities"

    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    province: Mapped[str] = mapped_column(String, nullable=False)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)

    # PMS configuration columns (added in Phase 27)
    category: Mapped[str | None] = mapped_column(String(1), nullable=True)  # "A", "B", or "C"
    demarcation_code: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g., "WC011"
    sdbip_layers: Mapped[int] = mapped_column(Integer, default=2, nullable=False)  # top + departmental
    scoring_method: Mapped[str] = mapped_column(String(20), default="percentage", nullable=False)
    settings_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    financial_year_start_month: Mapped[int] = mapped_column(
        Integer,
        default=7,  # July per MFMA standard
        nullable=False
    )
    # Branding: used in statutory report PDF headers (REPORT-08)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
