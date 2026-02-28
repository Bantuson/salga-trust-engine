"""mSCOA (Municipal Standard Chart of Accounts) reference model.

mSCOA v5.5 is the National Treasury-mandated chart of accounts for all
South African municipalities. Budget codes are standardized across 9 segments
(C, F, FX, IA, IE, IZ, IR, P, R).

This is a NonTenantModel — mSCOA codes are global reference data shared across
all municipalities (tenants). No tenant_id filtering is applied.
"""
from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import NonTenantModel


class MscoaReference(NonTenantModel):
    """mSCOA v5.5 budget code reference table.

    Stores standardized budget classification codes from National Treasury.
    Used by SDBIP KPIs to link budget allocations to measurable targets.

    Segments (mSCOA v5.5):
    - IE: Expenditure (most common for KPI budget links)
    - FX: Function (service delivery areas)
    - IA: Asset (capital expenditure types)
    - C: Cost centre, F: Fund, IZ: Special, IR: Infrastructure, P: Project, R: Regional

    NonTenantModel: no tenant_id — reference data is global.
    """

    __tablename__ = "mscoa_reference"
    __table_args__ = (
        UniqueConstraint("segment", "code", name="uq_mscoa_segment_code"),
    )

    segment: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
        index=True,
        comment="mSCOA segment (IE, FX, IA, C, F, IZ, IR, P, R)",
    )
    code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Segment-specific classification code (e.g., '0100')",
    )
    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Human-readable description of the budget code",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Set False for deprecated codes that should not be used on new KPIs",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MscoaReference {self.segment}.{self.code}: {self.description[:40]}>"
