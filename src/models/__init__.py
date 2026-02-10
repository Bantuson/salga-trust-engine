"""Database models package."""
from src.models.base import Base, NonTenantModel, TenantAwareModel
from src.models.municipality import Municipality
from src.models.user import User, UserRole
from src.models.consent import ConsentRecord
from src.models.audit_log import AuditLog, OperationType
from src.models.ticket import Ticket, TicketCategory, TicketStatus, TicketSeverity
from src.models.team import Team
from src.models.assignment import TicketAssignment
from src.models.sla_config import SLAConfig

__all__ = [
    "Base",
    "NonTenantModel",
    "TenantAwareModel",
    "Municipality",
    "User",
    "UserRole",
    "ConsentRecord",
    "AuditLog",
    "OperationType",
    "Ticket",
    "TicketCategory",
    "TicketStatus",
    "TicketSeverity",
    "Team",
    "TicketAssignment",
    "SLAConfig",
]
