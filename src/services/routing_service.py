"""Geospatial ticket routing service.

Routes tickets to appropriate municipal teams using PostGIS proximity queries,
with security firewall for GBV tickets (SAPS-only routing).

Key decisions:
- ST_DWithin for radius-based proximity search (10km default)
- ST_Distance for ordering by nearest team
- GBV tickets MUST route exclusively to SAPS teams (SEC-05)
- Municipal tickets MUST exclude SAPS teams from routing
- Fallback to category-based routing when no spatial match
"""
import logging
import os
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.team import Team
from src.models.ticket import Ticket

# Detect if we're using SQLite (tests) or PostgreSQL (production)
USE_POSTGIS = os.getenv("USE_SQLITE_TESTS") != "1"

if USE_POSTGIS:
    try:
        from geoalchemy2.functions import ST_DWithin, ST_Distance
    except ImportError:
        USE_POSTGIS = False

logger = logging.getLogger(__name__)


class RoutingService:
    """Geospatial routing service for ticket-to-team matching.

    Routes municipal tickets by location+category proximity.
    Routes GBV tickets exclusively to SAPS teams (security boundary).
    """

    async def route_ticket(self, ticket: Ticket, db: AsyncSession) -> Team | None:
        """Route ticket to appropriate team.

        Entry point for routing logic. Checks ticket type and delegates to
        specialized routing methods.

        Args:
            ticket: Ticket to route
            db: Database session

        Returns:
            Matched Team or None if no match found
        """
        logger.info(
            f"Routing ticket {ticket.tracking_number} "
            f"(category={ticket.category}, sensitive={ticket.is_sensitive})"
        )

        # Route based on ticket type
        if ticket.is_sensitive or ticket.category == "gbv":
            return await self._route_gbv_ticket(ticket, db)
        else:
            return await self._route_municipal_ticket(ticket, db)

    async def _route_municipal_ticket(
        self, ticket: Ticket, db: AsyncSession
    ) -> Team | None:
        """Route municipal ticket by location and category.

        Uses PostGIS ST_DWithin for radius-based proximity search (10km),
        ordered by ST_Distance (nearest first). Excludes SAPS teams.

        Falls back to category-based routing if no spatial match.

        Args:
            ticket: Municipal ticket to route
            db: Database session

        Returns:
            Matched Team or None
        """
        # Attempt geospatial routing if location is available
        if ticket.location is not None and USE_POSTGIS:
            logger.debug(
                f"Attempting geospatial routing for ticket {ticket.tracking_number} "
                f"within 10km radius"
            )

            query = (
                select(Team)
                .where(
                    Team.category == ticket.category,
                    Team.tenant_id == ticket.tenant_id,
                    Team.is_active == True,
                    Team.is_saps == False,  # Municipal routing excludes SAPS teams
                    ST_DWithin(Team.service_area, ticket.location, 10000)  # 10km radius
                )
                .order_by(ST_Distance(Team.service_area, ticket.location))
                .limit(1)
            )

            result = await db.execute(query)
            team = result.scalar_one_or_none()

            if team:
                logger.info(
                    f"Geospatial match: ticket {ticket.tracking_number} -> "
                    f"team {team.name} (category={team.category})"
                )
                return team

        # Fallback: category-based routing (no spatial constraint)
        logger.debug(
            f"No geospatial match for ticket {ticket.tracking_number}, "
            f"falling back to category-based routing"
        )

        query = (
            select(Team)
            .where(
                Team.category == ticket.category,
                Team.tenant_id == ticket.tenant_id,
                Team.is_active == True,
                Team.is_saps == False
            )
            .limit(1)
        )

        result = await db.execute(query)
        team = result.scalar_one_or_none()

        if team:
            logger.info(
                f"Category match: ticket {ticket.tracking_number} -> "
                f"team {team.name}"
            )
        else:
            logger.warning(
                f"No team found for ticket {ticket.tracking_number} "
                f"(category={ticket.category}, tenant={ticket.tenant_id})"
            )

        return team

    async def _route_gbv_ticket(self, ticket: Ticket, db: AsyncSession) -> Team | None:
        """Route GBV ticket exclusively to SAPS teams.

        # SEC-05: GBV tickets MUST only route to SAPS teams. This is a security boundary.
        # Municipal teams MUST NEVER receive GBV tickets to protect victim privacy
        # and ensure proper law enforcement handling.

        Uses PostGIS ST_DWithin for radius-based proximity to nearest SAPS station,
        ordered by ST_Distance. Falls back to any active SAPS team if no spatial match.

        Args:
            ticket: GBV ticket to route
            db: Database session

        Returns:
            Matched SAPS Team or None
        """
        # Security assertion: ensure this is actually a GBV ticket
        assert ticket.is_sensitive or ticket.category == "gbv", \
            "GBV routing method called for non-GBV ticket"

        # Attempt geospatial routing to nearest SAPS team
        if ticket.location is not None and USE_POSTGIS:
            logger.debug(
                f"Attempting GBV geospatial routing for ticket {ticket.tracking_number} "
                f"to nearest SAPS station within 10km"
            )

            query = (
                select(Team)
                .where(
                    Team.is_saps == True,  # SECURITY: Only SAPS teams
                    Team.is_active == True,
                    Team.tenant_id == ticket.tenant_id,
                    ST_DWithin(Team.service_area, ticket.location, 10000)
                )
                .order_by(ST_Distance(Team.service_area, ticket.location))
                .limit(1)
            )

            result = await db.execute(query)
            team = result.scalar_one_or_none()

            if team:
                logger.info(
                    f"GBV geospatial match: ticket {ticket.tracking_number} -> "
                    f"SAPS team {team.name}"
                )
                return team

        # Fallback: any active SAPS team in same tenant
        logger.debug(
            f"No geospatial SAPS match for ticket {ticket.tracking_number}, "
            f"falling back to any active SAPS team"
        )

        query = (
            select(Team)
            .where(
                Team.is_saps == True,  # SECURITY: Only SAPS teams
                Team.is_active == True,
                Team.tenant_id == ticket.tenant_id
            )
            .limit(1)
        )

        result = await db.execute(query)
        team = result.scalar_one_or_none()

        if team:
            logger.info(
                f"GBV fallback match: ticket {ticket.tracking_number} -> "
                f"SAPS team {team.name}"
            )
        else:
            logger.warning(
                f"No SAPS team configured for tenant {ticket.tenant_id} - "
                f"GBV ticket {ticket.tracking_number} cannot be routed"
            )

        return team

    async def find_teams_near_location(
        self,
        location,
        category: str,
        tenant_id: UUID,
        db: AsyncSession,
        radius_meters: int = 10000
    ) -> list[Team]:
        """Find all teams near a location within radius.

        Utility method for API endpoints. Returns list of teams ordered by distance.
        Useful for manual re-routing in Phase 5 municipal dashboard.

        Args:
            location: PostGIS Point geometry
            category: Team category to filter
            tenant_id: Municipality tenant ID
            db: Database session
            radius_meters: Search radius in meters (default 10km)

        Returns:
            List of teams within radius, ordered by distance
        """
        if not USE_POSTGIS or location is None:
            logger.warning("PostGIS not available or location is None")
            return []

        query = (
            select(Team)
            .where(
                Team.category == category,
                Team.tenant_id == tenant_id,
                Team.is_active == True,
                ST_DWithin(Team.service_area, location, radius_meters)
            )
            .order_by(ST_Distance(Team.service_area, location))
        )

        result = await db.execute(query)
        teams = result.scalars().all()

        logger.debug(
            f"Found {len(teams)} teams in category '{category}' "
            f"within {radius_meters}m radius"
        )

        return list(teams)
