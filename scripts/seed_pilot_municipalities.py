"""Pilot municipality onboarding seed script.

Creates pilot municipalities with default manager users, teams, and SLA configurations
for SALGA Trust Engine rollout.

Usage:
    # Seed single municipality
    python scripts/seed_pilot_municipalities.py --municipality "City of Cape Town" --code "CPT" --province "Western Cape" --contact "cpt@example.com"

    # Seed all 5 pilot municipalities
    python scripts/seed_pilot_municipalities.py --seed-all

Features:
- Idempotent: re-running does not create duplicates (checks existing code)
- Creates municipality, manager user, 7 teams, and category-specific SLA configs
- Manager credentials: manager@{code.lower()}.gov.za / ChangeMe123!
- Teams: Water, Roads, Electricity, Waste, Sanitation, General, SAPS GBV Liaison
- SLA configs: category-specific response/resolution times

Requirements:
- PostgreSQL database running and configured in .env
- Database schema already migrated (Alembic)
- Windows asyncio compatibility (WindowsSelectorEventLoopPolicy)
"""
import argparse
import asyncio
import logging
import sys
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import AsyncSessionLocal
from src.core.security import get_password_hash
from src.models.municipality import Municipality
from src.models.sla_config import SLAConfig
from src.models.team import Team
from src.models.user import User, UserRole

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Windows asyncio compatibility
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# Pre-configured pilot municipalities
PILOT_MUNICIPALITIES = [
    {
        "name": "City of Cape Town",
        "code": "CPT",
        "province": "Western Cape",
        "contact": "manager@cpt.gov.za",
        "population": 4618000,
        "type": "metro"
    },
    {
        "name": "eThekwini Municipality",
        "code": "ETH",
        "province": "KwaZulu-Natal",
        "contact": "manager@eth.gov.za",
        "population": 3702000,
        "type": "metro"
    },
    {
        "name": "City of Tshwane",
        "code": "TSH",
        "province": "Gauteng",
        "contact": "manager@tsh.gov.za",
        "population": 3275000,
        "type": "metro"
    },
    {
        "name": "Msunduzi Local Municipality",
        "code": "MSZ",
        "province": "KwaZulu-Natal",
        "contact": "manager@msz.gov.za",
        "population": 679000,
        "type": "local"
    },
    {
        "name": "Drakenstein Municipality",
        "code": "DRK",
        "province": "Western Cape",
        "contact": "manager@drk.gov.za",
        "population": 251000,
        "type": "local"
    }
]


# Default teams per municipality
DEFAULT_TEAMS = [
    {"name": "Water Services", "category": "water", "is_saps": False},
    {"name": "Roads & Infrastructure", "category": "roads", "is_saps": False},
    {"name": "Electricity", "category": "electricity", "is_saps": False},
    {"name": "Waste Management", "category": "waste", "is_saps": False},
    {"name": "Sanitation", "category": "sanitation", "is_saps": False},
    {"name": "General Services", "category": "general", "is_saps": False},
    {"name": "SAPS GBV Liaison", "category": "gbv", "is_saps": True},
]


# Default SLA configurations (hours)
DEFAULT_SLA_CONFIGS = [
    {"category": "water", "response_hours": 2, "resolution_hours": 24, "priority": "critical"},
    {"category": "water", "response_hours": 4, "resolution_hours": 48, "priority": "high"},
    {"category": "electricity", "response_hours": 1, "resolution_hours": 12, "priority": "critical"},
    {"category": "roads", "response_hours": 8, "resolution_hours": 72, "priority": "high"},
    {"category": None, "response_hours": 24, "resolution_hours": 168, "priority": "default"},  # System default
]


async def check_municipality_exists(db: AsyncSession, code: str) -> Municipality | None:
    """Check if municipality with code already exists.

    Args:
        db: Database session
        code: Municipality code (e.g., "CPT")

    Returns:
        Municipality if exists, None otherwise
    """
    result = await db.execute(
        select(Municipality).where(Municipality.code == code.upper())
    )
    return result.scalar_one_or_none()


async def create_municipality(
    db: AsyncSession,
    name: str,
    code: str,
    province: str,
    contact_email: str,
    population: int | None = None
) -> Municipality:
    """Create municipality record.

    Args:
        db: Database session
        name: Municipality full name
        code: Municipality code (auto-uppercased)
        province: Province name
        contact_email: Manager contact email
        population: Optional population count

    Returns:
        Created Municipality instance
    """
    municipality = Municipality(
        name=name,
        code=code.upper(),
        province=province,
        contact_email=contact_email,
        population=population,
        is_active=True
    )
    db.add(municipality)
    await db.commit()
    await db.refresh(municipality)
    logger.info(f"Created municipality: {name} ({code})")
    return municipality


async def create_manager_user(
    db: AsyncSession,
    municipality: Municipality
) -> User:
    """Create default manager user for municipality.

    Credentials: manager@{code.lower()}.gov.za / ChangeMe123!

    Args:
        db: Database session
        municipality: Municipality instance

    Returns:
        Created User instance with MANAGER role
    """
    email = f"manager@{municipality.code.lower()}.gov.za"
    password = "ChangeMe123!"

    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=f"{municipality.name} Manager",
        phone=None,
        preferred_language="en",
        role=UserRole.MANAGER,
        is_active=True,
        municipality_id=municipality.id,
        tenant_id=municipality.id,  # Municipality is tenant
        verification_status="verified"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"Created manager user: {email}")
    return user


async def create_default_teams(
    db: AsyncSession,
    municipality: Municipality,
    manager: User
) -> list[Team]:
    """Create default teams for municipality.

    Creates 7 teams: Water, Roads, Electricity, Waste, Sanitation, General, SAPS GBV.

    Args:
        db: Database session
        municipality: Municipality instance
        manager: Manager user (assigned as team manager)

    Returns:
        List of created Team instances
    """
    teams = []
    for team_config in DEFAULT_TEAMS:
        team = Team(
            name=team_config["name"],
            category=team_config["category"],
            is_saps=team_config["is_saps"],
            is_active=True,
            manager_id=manager.id,
            tenant_id=municipality.id
        )
        db.add(team)
        teams.append(team)

    await db.commit()
    logger.info(f"Created {len(teams)} teams for {municipality.name}")
    return teams


async def create_sla_configs(
    db: AsyncSession,
    municipality: Municipality
) -> list[SLAConfig]:
    """Create default SLA configurations for municipality.

    Args:
        db: Database session
        municipality: Municipality instance

    Returns:
        List of created SLAConfig instances
    """
    configs = []
    for sla_config in DEFAULT_SLA_CONFIGS:
        config = SLAConfig(
            municipality_id=municipality.id,
            category=sla_config["category"],
            response_hours=sla_config["response_hours"],
            resolution_hours=sla_config["resolution_hours"],
            warning_threshold_pct=80,
            is_active=True
        )
        db.add(config)
        configs.append(config)

    await db.commit()
    logger.info(f"Created {len(configs)} SLA configs for {municipality.name}")
    return configs


async def onboard_municipality(
    name: str,
    code: str,
    province: str,
    contact_email: str,
    population: int | None = None
) -> dict:
    """Onboard single municipality with all setup.

    Idempotent: skips if municipality code already exists.

    Args:
        name: Municipality full name
        code: Municipality code
        province: Province name
        contact_email: Manager contact email
        population: Optional population count

    Returns:
        dict with municipality details, manager credentials, and summary
    """
    async with AsyncSessionLocal() as db:
        # Check if municipality already exists
        existing = await check_municipality_exists(db, code)
        if existing:
            logger.warning(f"Municipality with code {code} already exists. Skipping.")
            return {
                "status": "skipped",
                "municipality": existing.name,
                "code": existing.code,
                "reason": "Municipality already exists"
            }

        # Create municipality
        municipality = await create_municipality(
            db, name, code, province, contact_email, population
        )

        # Create manager user
        manager = await create_manager_user(db, municipality)

        # Create teams
        teams = await create_default_teams(db, municipality, manager)

        # Create SLA configs
        sla_configs = await create_sla_configs(db, municipality)

        logger.info(f"Successfully onboarded {municipality.name}")

        return {
            "status": "created",
            "municipality": {
                "id": str(municipality.id),
                "name": municipality.name,
                "code": municipality.code,
                "province": municipality.province,
                "contact_email": municipality.contact_email
            },
            "manager": {
                "email": manager.email,
                "password": "ChangeMe123!",
                "full_name": manager.full_name,
                "role": manager.role.value
            },
            "teams": [
                {"name": team.name, "category": team.category, "is_saps": team.is_saps}
                for team in teams
            ],
            "sla_configs": len(sla_configs)
        }


async def seed_all_pilots():
    """Seed all 5 pre-configured pilot municipalities."""
    logger.info("Starting pilot municipality seeding...")
    results = []

    for pilot in PILOT_MUNICIPALITIES:
        logger.info(f"\n{'='*60}")
        logger.info(f"Onboarding: {pilot['name']} ({pilot['code']})")
        logger.info(f"{'='*60}")

        result = await onboard_municipality(
            name=pilot["name"],
            code=pilot["code"],
            province=pilot["province"],
            contact_email=pilot["contact"],
            population=pilot.get("population")
        )
        results.append(result)

    return results


def print_summary(results: list[dict]):
    """Print onboarding summary with credentials."""
    created = [r for r in results if r["status"] == "created"]
    skipped = [r for r in results if r["status"] == "skipped"]

    print("\n" + "="*80)
    print("PILOT MUNICIPALITY ONBOARDING SUMMARY")
    print("="*80)

    if created:
        print(f"\nCREATED ({len(created)} municipalities):")
        print("-" * 80)
        for result in created:
            muni = result["municipality"]
            manager = result["manager"]
            teams = result["teams"]

            print(f"\n{muni['name']} ({muni['code']}) - {muni['province']}")
            print(f"  Municipality ID: {muni['id']}")
            print(f"  Contact Email:   {muni['contact_email']}")
            print(f"\n  Manager Credentials:")
            print(f"    Email:    {manager['email']}")
            print(f"    Password: {manager['password']}")
            print(f"    Role:     {manager['role']}")
            print(f"\n  Teams ({len(teams)}):")
            for team in teams:
                saps_flag = " [SAPS]" if team["is_saps"] else ""
                print(f"    - {team['name']} ({team['category']}){saps_flag}")
            print(f"\n  SLA Configs: {result['sla_configs']}")

    if skipped:
        print(f"\n\nSKIPPED ({len(skipped)} municipalities - already exist):")
        print("-" * 80)
        for result in skipped:
            print(f"  - {result['municipality']} ({result['code']})")

    print("\n" + "="*80)
    print("NEXT STEPS:")
    print("="*80)
    print("1. Share manager credentials with municipal coordinators")
    print("2. Managers should log in and change default passwords immediately")
    print("3. Managers can create additional team members via dashboard")
    print("4. Configure team service areas (geographic polygons) via admin API")
    print("5. Citizens can now register and submit service requests")
    print("\nFor support: https://github.com/your-org/salga-trust-engine/issues")
    print("="*80 + "\n")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Onboard pilot municipalities for SALGA Trust Engine"
    )

    # Seed all or single municipality
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--seed-all",
        action="store_true",
        help="Seed all 5 pre-configured pilot municipalities"
    )
    group.add_argument(
        "--municipality",
        type=str,
        help="Municipality full name (e.g., 'City of Cape Town')"
    )

    # Single municipality args
    parser.add_argument("--code", type=str, help="Municipality code (e.g., 'CPT')")
    parser.add_argument("--province", type=str, help="Province name (e.g., 'Western Cape')")
    parser.add_argument("--contact", type=str, help="Manager contact email")
    parser.add_argument("--population", type=int, help="Municipality population (optional)")

    args = parser.parse_args()

    # Validate single municipality args
    if args.municipality and not all([args.code, args.province, args.contact]):
        parser.error("--municipality requires --code, --province, and --contact")

    try:
        if args.seed_all:
            # Seed all pilots
            results = asyncio.run(seed_all_pilots())
            print_summary(results)
        else:
            # Seed single municipality
            result = asyncio.run(onboard_municipality(
                name=args.municipality,
                code=args.code,
                province=args.province,
                contact_email=args.contact,
                population=args.population
            ))
            print_summary([result])

    except Exception as e:
        logger.error(f"Onboarding failed: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
