"""Data export endpoints for CSV and Excel download.

Provides server-side export of filtered ticket data. Supports both CSV
and Excel (.xlsx) formats. Uses StreamingResponse for memory efficiency.
SEC-05: GBV/sensitive tickets are always excluded from exports.
"""
import csv
import io
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db
from src.middleware.rate_limit import DATA_EXPORT_RATE_LIMIT, limiter
from src.models.ticket import Ticket
from src.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


EXPORT_COLUMNS = [
    ("Tracking Number", "tracking_number"),
    ("Category", "category"),
    ("Status", "status"),
    ("Severity", "severity"),
    ("Description", "description"),
    ("Address", "address"),
    ("Language", "language"),
    ("Created", "created_at"),
    ("SLA Response Deadline", "sla_response_deadline"),
    ("SLA Resolution Deadline", "sla_resolution_deadline"),
    ("First Responded", "first_responded_at"),
    ("Resolved At", "resolved_at"),
    ("Escalated At", "escalated_at"),
]


@router.get("/tickets/csv")
@limiter.limit(DATA_EXPORT_RATE_LIMIT)
async def export_tickets_csv(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    category: str | None = None,
    ward_id: str | None = None,
    search: str | None = None,
):
    """Export filtered tickets as CSV file.

    Applies same RBAC and filters as list_tickets endpoint.
    SEC-05: GBV/sensitive tickets always excluded.
    Max 10,000 rows per export.
    """
    allowed_roles = [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Export requires manager, admin, or ward councillor role"
        )

    tickets = await _fetch_export_tickets(
        db, current_user, status_filter, category, ward_id, search
    )

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([col[0] for col in EXPORT_COLUMNS])

    # Data rows
    for ticket in tickets:
        row = []
        for _, attr in EXPORT_COLUMNS:
            value = getattr(ticket, attr, None)
            if isinstance(value, datetime):
                value = value.strftime("%Y-%m-%d %H:%M:%S")
            elif value is None:
                value = ""
            row.append(str(value))
        writer.writerow(row)

    output.seek(0)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"tickets_export_{timestamp}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/tickets/excel")
@limiter.limit(DATA_EXPORT_RATE_LIMIT)
async def export_tickets_excel(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    category: str | None = None,
    ward_id: str | None = None,
    search: str | None = None,
):
    """Export filtered tickets as Excel (.xlsx) file.

    Applies same RBAC and filters as list_tickets endpoint.
    SEC-05: GBV/sensitive tickets always excluded.
    Max 10,000 rows per export. Uses openpyxl for .xlsx generation.
    """
    allowed_roles = [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Export requires manager, admin, or ward councillor role"
        )

    tickets = await _fetch_export_tickets(
        db, current_user, status_filter, category, ward_id, search
    )

    try:
        from openpyxl import Workbook
    except ImportError:
        # Fallback: if openpyxl not installed, return 501
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Excel export requires openpyxl. Use CSV export instead."
        )

    wb = Workbook()
    ws = wb.active
    ws.title = "Tickets"

    # Header row
    headers = [col[0] for col in EXPORT_COLUMNS]
    ws.append(headers)

    # Bold headers
    from openpyxl.styles import Font
    for cell in ws[1]:
        cell.font = Font(bold=True)

    # Data rows
    for ticket in tickets:
        row = []
        for _, attr in EXPORT_COLUMNS:
            value = getattr(ticket, attr, None)
            if isinstance(value, datetime):
                value = value.strftime("%Y-%m-%d %H:%M:%S")
            elif value is None:
                value = ""
            row.append(str(value))
        ws.append(row)

    # Auto-size columns (approximate)
    for col_idx, (header, _) in enumerate(EXPORT_COLUMNS, 1):
        ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else "A"].width = max(len(header) + 2, 15)

    # Write to bytes buffer
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"tickets_export_{timestamp}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


async def _fetch_export_tickets(
    db: AsyncSession,
    current_user: User,
    status_filter: str | None,
    category: str | None,
    ward_id: str | None,
    search: str | None,
    max_rows: int = 10000,
) -> list:
    """Fetch tickets for export with RBAC and filters.

    SEC-05: Always excludes GBV/sensitive tickets.
    """
    query = select(Ticket).where(Ticket.is_sensitive == False)

    # Tenant filter
    query = query.where(Ticket.tenant_id == current_user.tenant_id)

    # Status filter
    if status_filter:
        query = query.where(Ticket.status == status_filter.lower())

    # Category filter
    if category:
        query = query.where(Ticket.category == category.lower())

    # Ward filter
    if ward_id:
        query = query.where(Ticket.address.ilike(f"%{ward_id}%"))

    # Search
    if search:
        query = query.where(
            or_(
                Ticket.tracking_number.ilike(f"%{search}%"),
                Ticket.description.ilike(f"%{search}%"),
            )
        )

    # Order and limit
    query = query.order_by(desc(Ticket.created_at)).limit(max_rows)

    result = await db.execute(query)
    return result.scalars().all()
