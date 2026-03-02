"""Add verification_status to evidence_documents.

Adds a new column to track Internal Auditor POE (Portfolio of Evidence)
review status per DASH-11 requirement. Values: 'unverified', 'verified',
'insufficient'. Defaults to 'unverified' for all existing rows.

Revision ID: 20260302_evidence_verification
Revises: 2026_03_01_0001
Create Date: 2026-03-02 08:55:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260302_evidence_verification"
down_revision: Union[str, None] = "2026_03_01_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add verification_status column to evidence_documents table."""
    op.add_column(
        "evidence_documents",
        sa.Column(
            "verification_status",
            sa.String(20),
            nullable=False,
            server_default="unverified",
            comment=(
                "Internal Auditor POE review status: "
                "'unverified', 'verified', or 'insufficient'"
            ),
        ),
    )


def downgrade() -> None:
    """Remove verification_status column from evidence_documents table."""
    op.drop_column("evidence_documents", "verification_status")
