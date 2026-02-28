"""add evidence_documents table for portfolio of evidence (POE) uploads

Revision ID: f4g5h6i7j8k9
Revises: e3f4a5b6c7d8
Create Date: 2026-02-28 00:07:00.000000

Adds:
- evidence_documents table: Portfolio of evidence files uploaded per quarterly actual.
  Each actual may have multiple evidence documents (PDF reports, photos, spreadsheets).
  Files are virus-scanned via ClamAV before storage in per-municipality Supabase buckets.

  scan_status values:
    - 'clean':       ClamAV returned OK; document accepted
    - 'infected':    ClamAV returned FOUND; document was rejected (422), not stored
    - 'scan_failed': ClamAV unavailable (fail-open in dev, fail-closed in prod)
    - 'pending':     Initial state (overwritten synchronously during upload)

Golden thread chain after this migration:
    IDPCycle -> IDPGoal -> IDPObjective -> SDBIPScorecard -> SDBIPKpi
                                                                |
                                                    SDBIPActual <-- EvidenceDocument
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f4g5h6i7j8k9"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create evidence_documents table with indexes and RLS policies."""

    # ------------------------------------------------------------------
    # evidence_documents
    # ------------------------------------------------------------------
    op.create_table(
        "evidence_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column(
            "actual_id",
            sa.Uuid(),
            sa.ForeignKey("sdbip_actuals.id"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column(
            "scan_status",
            sa.String(20),
            nullable=False,
            server_default="clean",
        ),
        sa.Column("uploaded_by", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
    )

    op.create_index(
        "ix_evidence_documents_tenant_id",
        "evidence_documents",
        ["tenant_id"],
    )
    op.create_index(
        "ix_evidence_documents_actual_id",
        "evidence_documents",
        ["actual_id"],
    )

    # ------------------------------------------------------------------
    # RLS policy on evidence_documents (PostgreSQL only; skip on SQLite)
    # ------------------------------------------------------------------
    op.execute("ALTER TABLE evidence_documents ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE evidence_documents FORCE ROW LEVEL SECURITY;")
    op.execute(
        "CREATE POLICY evidence_documents_tenant_isolation ON evidence_documents "
        "USING (tenant_id = current_setting('app.current_tenant', true));"
    )


def downgrade() -> None:
    """Drop evidence_documents table and its RLS policy."""

    op.execute(
        "DROP POLICY IF EXISTS evidence_documents_tenant_isolation ON evidence_documents;"
    )

    op.drop_index("ix_evidence_documents_actual_id", table_name="evidence_documents")
    op.drop_index("ix_evidence_documents_tenant_id", table_name="evidence_documents")

    op.drop_table("evidence_documents")
