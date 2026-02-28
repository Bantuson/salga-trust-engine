"""Department model for municipal organizational structure.

Departments represent the organizational units within a municipality (e.g., Finance,
Infrastructure, Community Safety). They form the backbone of the PMS — SDBIP KPIs
are scoped to departments, directors are assigned per department, and ticket routing
becomes department-aware.

Key decisions:
- TenantAwareModel: automatic RLS + audit (tenant_id, created_at, updated_at, created_by, updated_by)
- Hierarchical structure: parent_department_id supports sub-department nesting
- assigned_director_id: FK to users.id; department is "invalid" if this is NULL
- DepartmentTicketCategoryMap: 1:1 mapping enforced by UniqueConstraint on (ticket_category, tenant_id)
- department_id added to teams via Alembic migration (not inline here)
"""
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class Department(TenantAwareModel):
    """Municipal department model for PMS organizational structure.

    Inherits tenant_id, created_at, updated_at, created_by, updated_by from TenantAwareModel.
    """

    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("code", "tenant_id", name="uq_dept_code_tenant"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g., "FIN", "INFRA", "COMM_SAFETY"
    parent_department_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("departments.id"),
        nullable=True
    )
    assigned_director_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<Department {self.code}: {self.name}>"


class DepartmentTicketCategoryMap(TenantAwareModel):
    """Maps ticket categories to departments (1:1 per tenant).

    Enforces a single department per ticket category within a tenant via
    UniqueConstraint on (ticket_category, tenant_id).
    """

    __tablename__ = "department_ticket_category_maps"
    __table_args__ = (
        UniqueConstraint("ticket_category", "tenant_id", name="uq_ticket_cat_tenant"),
    )

    department_id: Mapped[UUID] = mapped_column(
        ForeignKey("departments.id"),
        nullable=False,
        index=True
    )
    ticket_category: Mapped[str] = mapped_column(String(50), nullable=False)

    def __repr__(self) -> str:
        return f"<DepartmentTicketCategoryMap {self.ticket_category} -> dept {self.department_id}>"
