"""API dependencies for FastAPI routes."""
# Re-export database dependency
from src.core.database import get_db

__all__ = ["get_db"]

# Auth dependencies will be added in Plan 02
