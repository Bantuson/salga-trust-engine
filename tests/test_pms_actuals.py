"""Unit tests for SDBIP quarterly actuals — submission, achievement calculation, and immutability.

Tests cover:
1.  test_submit_actual_computes_pct — submit actual 85 against target 100 -> pct=85, traffic=green
2.  test_achievement_pct_formula — verify (actual/target)*100 for multiple cases
3.  test_traffic_light_green — pct >= 80 -> green
4.  test_traffic_light_amber — 50 <= pct < 80 -> amber
5.  test_traffic_light_red — pct < 50 -> red
6.  test_traffic_light_zero_target — target=0 -> pct=0, red (no crash)
7.  test_validated_actual_immutable — PUT on validated actual returns 422
8.  test_validated_actual_patch_immutable — PATCH on validated actual returns 422
9.  test_correction_record_links_original — correction has corrects_actual_id set to original
10. test_correction_only_on_validated — correction on non-validated actual returns 422
11. test_list_actuals_for_kpi — returns all actuals for a KPI
12. test_submit_actual_no_target — submit without quarterly target returns 422

All tests use SQLite in-memory via the db_session fixture from conftest.py.
Tenant isolation is enforced via set_tenant_context()/clear_tenant_context() with try/finally.
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import MagicMock

from src.core.tenant import clear_tenant_context, set_tenant_context
from src.models.sdbip import (
    Quarter,
    SDBIPActual,
    SDBIPKpi,
    SDBIPLayer,
    SDBIPQuarterlyTarget,
    SDBIPScorecard,
    SDBIPStatus,
    TrafficLight,
    compute_achievement,
)
from src.models.user import User, UserRole
from src.schemas.sdbip import (
    QuarterlyTargetBulkCreate,
    QuarterlyTargetCreate,
    SDBIPActualCorrectionCreate,
    SDBIPActualCreate,
    SDBIPKpiCreate,
    SDBIPScorecardCreate,
)
from src.services.sdbip_service import SDBIPService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_mock_director(tenant_id: str | None = None) -> MagicMock:
    """Create a mock Section 56 director user for actuals submission."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "director@test.gov.za"
    user.full_name = "Section 56 Director"
    user.role = UserRole.SECTION56_DIRECTOR
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


def make_mock_pms_officer(tenant_id: str | None = None) -> MagicMock:
    """Create a mock PMS officer user for actuals validation."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "pms@test.gov.za"
    user.full_name = "PMS Officer"
    user.role = UserRole.PMS_OFFICER
    user.tenant_id = tenant_id or str(uuid4())
    user.municipality_id = uuid4()
    user.is_active = True
    user.is_deleted = False
    return user


def make_quarterly_targets_payload(
    q1: Decimal = Decimal("100"),
    q2: Decimal = Decimal("100"),
    q3: Decimal = Decimal("100"),
    q4: Decimal = Decimal("100"),
) -> QuarterlyTargetBulkCreate:
    """Create a QuarterlyTargetBulkCreate with specified per-quarter targets."""
    return QuarterlyTargetBulkCreate(
        targets=[
            QuarterlyTargetCreate(quarter=Quarter.Q1, target_value=q1),
            QuarterlyTargetCreate(quarter=Quarter.Q2, target_value=q2),
            QuarterlyTargetCreate(quarter=Quarter.Q3, target_value=q3),
            QuarterlyTargetCreate(quarter=Quarter.Q4, target_value=q4),
        ]
    )


async def _create_kpi_with_targets(
    db: AsyncSession,
    tenant_id: str,
    user: MagicMock,
    target_value: Decimal = Decimal("100"),
) -> tuple[SDBIPKpi, list[SDBIPQuarterlyTarget]]:
    """Helper: create a KPI with uniform quarterly targets and return both.

    Creates: SDBIPScorecard -> SDBIPKpi -> 4 x SDBIPQuarterlyTarget.
    tenant context MUST be set by the caller.
    """
    service = SDBIPService()

    scorecard = await service.create_scorecard(
        SDBIPScorecardCreate(
            financial_year="2025/26",
            layer=SDBIPLayer.TOP,
        ),
        user, db,
    )

    kpi = await service.create_kpi(
        scorecard.id,
        SDBIPKpiCreate(
            kpi_number="KPI-001",
            description="Percentage of households with access to clean water",
            unit_of_measurement="percentage",
            baseline=Decimal("70.00"),
            annual_target=Decimal("100.00"),
            weight=Decimal("20.00"),
        ),
        user, db,
    )

    targets = await service.set_quarterly_targets(
        kpi.id,
        make_quarterly_targets_payload(
            q1=target_value,
            q2=target_value,
            q3=target_value,
            q4=target_value,
        ),
        user, db,
    )

    return kpi, targets


# ---------------------------------------------------------------------------
# Test 1: Submit actual computes achievement pct
# ---------------------------------------------------------------------------


class TestSubmitActualComputesPct:
    """Tests for SDBIPService.submit_actual() achievement computation."""

    async def test_submit_actual_computes_pct(self, db_session: AsyncSession):
        """Submitting actual=85 against target=100 gives pct=85, traffic=green."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user, Decimal("100"))

            actual_data = SDBIPActualCreate(
                kpi_id=kpi.id,
                quarter=Quarter.Q1,
                financial_year="2025/26",
                actual_value=Decimal("85"),
            )
            actual = await service.submit_actual(actual_data, user, db_session)
        finally:
            clear_tenant_context()

        assert actual.id is not None
        assert actual.kpi_id == kpi.id
        assert actual.actual_value == Decimal("85")
        assert actual.achievement_pct == Decimal("85")
        assert actual.traffic_light_status == TrafficLight.GREEN
        assert actual.is_validated is False
        assert actual.submitted_by == str(user.id)
        assert actual.submitted_at is not None


# ---------------------------------------------------------------------------
# Test 2: Achievement pct formula verified for multiple cases
# ---------------------------------------------------------------------------


class TestAchievementPctFormula:
    """Tests for compute_achievement() arithmetic correctness."""

    def test_achievement_pct_formula(self):
        """Verify (actual / target) * 100 formula for several values."""
        cases = [
            (Decimal("85"), Decimal("100"), Decimal("85")),
            (Decimal("50"), Decimal("100"), Decimal("50")),
            (Decimal("25"), Decimal("50"), Decimal("50")),
            (Decimal("120"), Decimal("100"), Decimal("120")),  # over-achievement
            (Decimal("0"), Decimal("100"), Decimal("0")),
        ]
        for actual_val, target_val, expected_pct in cases:
            pct, _ = compute_achievement(actual_val, target_val)
            assert pct == expected_pct, (
                f"Expected {expected_pct}% for actual={actual_val}/target={target_val}, got {pct}"
            )

    def test_achievement_pct_uses_decimal_not_float(self):
        """compute_achievement returns Decimal (not float) for precision."""
        pct, tl = compute_achievement(Decimal("1"), Decimal("3"))
        assert isinstance(pct, Decimal)
        assert isinstance(tl, str)


# ---------------------------------------------------------------------------
# Test 3: Traffic light green threshold
# ---------------------------------------------------------------------------


class TestTrafficLightGreen:
    """Tests for TrafficLight green threshold in compute_achievement()."""

    def test_traffic_light_green_at_exactly_80(self):
        """80% achievement -> green (boundary)."""
        _, tl = compute_achievement(Decimal("80"), Decimal("100"))
        assert tl == TrafficLight.GREEN

    def test_traffic_light_green_above_80(self):
        """85% achievement -> green."""
        _, tl = compute_achievement(Decimal("85"), Decimal("100"))
        assert tl == TrafficLight.GREEN

    def test_traffic_light_green_at_100(self):
        """100% achievement -> green."""
        _, tl = compute_achievement(Decimal("100"), Decimal("100"))
        assert tl == TrafficLight.GREEN

    def test_traffic_light_green_over_100(self):
        """Over-achievement (120%) -> green."""
        _, tl = compute_achievement(Decimal("120"), Decimal("100"))
        assert tl == TrafficLight.GREEN


# ---------------------------------------------------------------------------
# Test 4: Traffic light amber threshold
# ---------------------------------------------------------------------------


class TestTrafficLightAmber:
    """Tests for TrafficLight amber threshold in compute_achievement()."""

    def test_traffic_light_amber_at_exactly_50(self):
        """50% achievement -> amber (lower boundary)."""
        _, tl = compute_achievement(Decimal("50"), Decimal("100"))
        assert tl == TrafficLight.AMBER

    def test_traffic_light_amber_at_60(self):
        """60% achievement -> amber."""
        _, tl = compute_achievement(Decimal("60"), Decimal("100"))
        assert tl == TrafficLight.AMBER

    def test_traffic_light_amber_at_79(self):
        """79% achievement -> amber (just below green boundary)."""
        _, tl = compute_achievement(Decimal("79"), Decimal("100"))
        assert tl == TrafficLight.AMBER


# ---------------------------------------------------------------------------
# Test 5: Traffic light red threshold
# ---------------------------------------------------------------------------


class TestTrafficLightRed:
    """Tests for TrafficLight red threshold in compute_achievement()."""

    def test_traffic_light_red_at_49(self):
        """49% achievement -> red (just below amber boundary)."""
        _, tl = compute_achievement(Decimal("49"), Decimal("100"))
        assert tl == TrafficLight.RED

    def test_traffic_light_red_at_0(self):
        """0% achievement -> red."""
        _, tl = compute_achievement(Decimal("0"), Decimal("100"))
        assert tl == TrafficLight.RED

    def test_traffic_light_red_at_25(self):
        """25% achievement -> red."""
        _, tl = compute_achievement(Decimal("25"), Decimal("100"))
        assert tl == TrafficLight.RED


# ---------------------------------------------------------------------------
# Test 6: Division by zero handled gracefully
# ---------------------------------------------------------------------------


class TestTrafficLightZeroTarget:
    """Tests for compute_achievement() division-by-zero handling."""

    def test_traffic_light_zero_target_returns_red(self):
        """target=0 -> pct=0, traffic=red (no exception raised)."""
        pct, tl = compute_achievement(Decimal("10"), Decimal("0"))
        assert pct == Decimal("0"), f"Expected pct=0, got {pct}"
        assert tl == TrafficLight.RED, f"Expected red, got {tl}"

    def test_traffic_light_zero_target_zero_actual(self):
        """actual=0, target=0 -> pct=0, red (both zero case)."""
        pct, tl = compute_achievement(Decimal("0"), Decimal("0"))
        assert pct == Decimal("0")
        assert tl == TrafficLight.RED

    async def test_submit_actual_zero_target_no_crash(self, db_session: AsyncSession):
        """Submitting actual against a KPI with target=0 returns red, no exception."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user, Decimal("0"))

            actual_data = SDBIPActualCreate(
                kpi_id=kpi.id,
                quarter=Quarter.Q1,
                financial_year="2025/26",
                actual_value=Decimal("50"),
            )
            actual = await service.submit_actual(actual_data, user, db_session)
        finally:
            clear_tenant_context()

        assert actual.achievement_pct == Decimal("0")
        assert actual.traffic_light_status == TrafficLight.RED


# ---------------------------------------------------------------------------
# Test 7: Validated actual immutable — PUT returns 422
# ---------------------------------------------------------------------------


class TestValidatedActualImmutable:
    """Tests for immutability of validated actuals via PUT endpoint."""

    async def test_validated_actual_immutable(self, db_session: AsyncSession):
        """PUT on a validated actual returns 422 via API route logic."""
        from src.api.v1.sdbip import update_actual

        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user)

            # Submit an actual
            actual = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q1,
                    financial_year="2025/26",
                    actual_value=Decimal("85"),
                ),
                user, db_session,
            )

            # Manually validate it (simulating PMS officer validation from 28-05)
            actual.is_validated = True
            db_session.add(actual)
            await db_session.commit()
            await db_session.refresh(actual)

            # Attempt PUT — should raise 422
            with pytest.raises(HTTPException) as exc_info:
                await update_actual(actual.id, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "immutable" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Test 8: Validated actual immutable — PATCH returns 422
# ---------------------------------------------------------------------------


class TestValidatedActualPatchImmutable:
    """Tests for immutability of validated actuals via PATCH endpoint."""

    async def test_validated_actual_patch_immutable(self, db_session: AsyncSession):
        """PATCH on a validated actual returns 422 via API route logic."""
        from src.api.v1.sdbip import patch_actual

        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user)

            # Submit actual and validate it
            actual = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q2,
                    financial_year="2025/26",
                    actual_value=Decimal("60"),
                ),
                user, db_session,
            )
            actual.is_validated = True
            db_session.add(actual)
            await db_session.commit()
            await db_session.refresh(actual)

            # Attempt PATCH — should raise 422
            with pytest.raises(HTTPException) as exc_info:
                await patch_actual(actual.id, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "immutable" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Test 9: Correction record links to original
# ---------------------------------------------------------------------------


class TestCorrectionRecordLinksOriginal:
    """Tests for SDBIPService.submit_correction() correction chain."""

    async def test_correction_record_links_original(self, db_session: AsyncSession):
        """Correction record has corrects_actual_id FK pointing to original."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user)

            # Submit original actual
            original = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q1,
                    financial_year="2025/26",
                    actual_value=Decimal("75"),
                ),
                user, db_session,
            )

            # Validate original (enabling correction)
            original.is_validated = True
            db_session.add(original)
            await db_session.commit()
            await db_session.refresh(original)

            # Submit correction
            correction = await service.submit_correction(
                original.id,
                SDBIPActualCorrectionCreate(
                    actual_value=Decimal("82"),
                    reason="Data entry error: wrong value submitted initially",
                ),
                user, db_session,
            )
        finally:
            clear_tenant_context()

        # Correction must link back to original
        assert correction.corrects_actual_id == original.id
        assert correction.kpi_id == original.kpi_id
        assert correction.quarter == original.quarter
        assert correction.financial_year == original.financial_year
        assert correction.actual_value == Decimal("82")
        assert correction.is_validated is False  # starts unvalidated

        # Correction achievement recomputed: 82/100 = 82% -> green
        assert correction.achievement_pct == Decimal("82")
        assert correction.traffic_light_status == TrafficLight.GREEN


# ---------------------------------------------------------------------------
# Test 10: Correction only allowed on validated actuals
# ---------------------------------------------------------------------------


class TestCorrectionOnlyOnValidated:
    """Tests for correction guard in SDBIPService.submit_correction()."""

    async def test_correction_only_on_validated(self, db_session: AsyncSession):
        """Submitting correction on non-validated actual returns 422."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user)

            # Submit actual but do NOT validate it
            actual = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q3,
                    financial_year="2025/26",
                    actual_value=Decimal("45"),
                ),
                user, db_session,
            )

            # Attempt correction on unvalidated actual — should fail
            with pytest.raises(HTTPException) as exc_info:
                await service.submit_correction(
                    actual.id,
                    SDBIPActualCorrectionCreate(
                        actual_value=Decimal("55"),
                        reason="Attempting invalid correction on unvalidated actual",
                    ),
                    user, db_session,
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "corrections" in exc_info.value.detail.lower() or "validated" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Test 11: List actuals for KPI
# ---------------------------------------------------------------------------


class TestListActualsForKpi:
    """Tests for SDBIPService.list_actuals()."""

    async def test_list_actuals_for_kpi(self, db_session: AsyncSession):
        """list_actuals returns all actuals for a KPI."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user)

            # Submit 3 actuals for different quarters
            await service.submit_actual(
                SDBIPActualCreate(kpi_id=kpi.id, quarter=Quarter.Q1, financial_year="2025/26", actual_value=Decimal("80")),
                user, db_session,
            )
            await service.submit_actual(
                SDBIPActualCreate(kpi_id=kpi.id, quarter=Quarter.Q2, financial_year="2025/26", actual_value=Decimal("90")),
                user, db_session,
            )
            await service.submit_actual(
                SDBIPActualCreate(kpi_id=kpi.id, quarter=Quarter.Q3, financial_year="2025/26", actual_value=Decimal("75")),
                user, db_session,
            )

            actuals = await service.list_actuals(kpi.id, db_session)
        finally:
            clear_tenant_context()

        assert len(actuals) == 3
        quarters = {a.quarter for a in actuals}
        assert quarters == {"Q1", "Q2", "Q3"}

    async def test_list_actuals_includes_corrections(self, db_session: AsyncSession):
        """list_actuals returns both original and correction records."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user)

            # Submit and validate original
            original = await service.submit_actual(
                SDBIPActualCreate(kpi_id=kpi.id, quarter=Quarter.Q1, financial_year="2025/26", actual_value=Decimal("70")),
                user, db_session,
            )
            original.is_validated = True
            db_session.add(original)
            await db_session.commit()
            await db_session.refresh(original)

            # Submit correction
            await service.submit_correction(
                original.id,
                SDBIPActualCorrectionCreate(
                    actual_value=Decimal("75"),
                    reason="Corrected after department verification",
                ),
                user, db_session,
            )

            actuals = await service.list_actuals(kpi.id, db_session)
        finally:
            clear_tenant_context()

        # Both original and correction should be in the list
        assert len(actuals) == 2
        correction = next(a for a in actuals if a.corrects_actual_id is not None)
        assert correction.corrects_actual_id == original.id

    async def test_list_actuals_empty_for_no_submissions(self, db_session: AsyncSession):
        """list_actuals returns empty list when no actuals have been submitted."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, user)
            actuals = await service.list_actuals(kpi.id, db_session)
        finally:
            clear_tenant_context()

        assert actuals == []


# ---------------------------------------------------------------------------
# Test 12: Submit actual without quarterly target returns 422
# ---------------------------------------------------------------------------


class TestSubmitActualNoTarget:
    """Tests for SDBIPService.submit_actual() when no quarterly target exists."""

    async def test_submit_actual_no_target(self, db_session: AsyncSession):
        """Submitting actual without quarterly target returns 422."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            # Create scorecard and KPI but do NOT set quarterly targets
            scorecard = await service.create_scorecard(
                SDBIPScorecardCreate(financial_year="2025/26", layer=SDBIPLayer.TOP),
                user, db_session,
            )
            kpi = await service.create_kpi(
                scorecard.id,
                SDBIPKpiCreate(
                    kpi_number="KPI-001",
                    description="Water supply coverage",
                    unit_of_measurement="percentage",
                    baseline=Decimal("70"),
                    annual_target=Decimal("90"),
                    weight=Decimal("25"),
                ),
                user, db_session,
            )

            # Attempt submission — should fail with 422
            with pytest.raises(HTTPException) as exc_info:
                await service.submit_actual(
                    SDBIPActualCreate(
                        kpi_id=kpi.id,
                        quarter=Quarter.Q1,
                        financial_year="2025/26",
                        actual_value=Decimal("80"),
                    ),
                    user, db_session,
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "target" in exc_info.value.detail.lower() or "Q1" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Additional: Submit actual with unknown KPI returns 404
# ---------------------------------------------------------------------------


class TestSubmitActualUnknownKpi:
    """Tests for 404 handling in SDBIPService.submit_actual()."""

    async def test_submit_actual_unknown_kpi_returns_404(self, db_session: AsyncSession):
        """Submitting actual for non-existent KPI returns 404."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        user = make_mock_director(tenant_id=tenant_id)
        fake_kpi_id = uuid4()

        set_tenant_context(tenant_id)
        try:
            with pytest.raises(HTTPException) as exc_info:
                await service.submit_actual(
                    SDBIPActualCreate(
                        kpi_id=fake_kpi_id,
                        quarter=Quarter.Q1,
                        financial_year="2025/26",
                        actual_value=Decimal("80"),
                    ),
                    user, db_session,
                )
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Schema validation tests (no DB required)
# ---------------------------------------------------------------------------


class TestActualSchemas:
    """Tests for SDBIPActualCreate and SDBIPActualCorrectionCreate schema validation."""

    def test_actual_create_valid(self):
        """SDBIPActualCreate accepts valid input."""
        create = SDBIPActualCreate(
            kpi_id=uuid4(),
            quarter=Quarter.Q1,
            financial_year="2025/26",
            actual_value=Decimal("85"),
        )
        assert create.financial_year == "2025/26"
        assert create.quarter == Quarter.Q1
        assert create.actual_value == Decimal("85")

    def test_actual_create_invalid_financial_year(self):
        """SDBIPActualCreate rejects invalid financial_year format."""
        with pytest.raises(Exception) as exc_info:
            SDBIPActualCreate(
                kpi_id=uuid4(),
                quarter=Quarter.Q1,
                financial_year="25/26",  # Missing full year
                actual_value=Decimal("85"),
            )
        assert "financial_year" in str(exc_info.value).lower() or "yyyy" in str(exc_info.value).lower()

    def test_correction_create_valid(self):
        """SDBIPActualCorrectionCreate accepts valid input with min-length reason."""
        corr = SDBIPActualCorrectionCreate(
            actual_value=Decimal("90"),
            reason="Data entry error corrected after verification",
        )
        assert corr.actual_value == Decimal("90")
        assert len(corr.reason) >= 10

    def test_correction_create_reason_too_short(self):
        """SDBIPActualCorrectionCreate rejects reason shorter than 10 characters."""
        with pytest.raises(Exception) as exc_info:
            SDBIPActualCorrectionCreate(
                actual_value=Decimal("90"),
                reason="Too short",  # 9 chars — below minimum
            )
        assert "reason" in str(exc_info.value).lower() or "min_length" in str(exc_info.value).lower() or "10" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Importability check
# ---------------------------------------------------------------------------


def test_actuals_imports():
    """SDBIPActual model, compute_achievement, TrafficLight, and schemas import cleanly."""
    from src.models.sdbip import SDBIPActual, TrafficLight, compute_achievement
    from src.schemas.sdbip import (
        SDBIPActualCreate,
        SDBIPActualResponse,
        SDBIPActualCorrectionCreate,
    )
    from src.services.sdbip_service import SDBIPService
    from src.api.v1.sdbip import router

    assert SDBIPActual is not None
    assert TrafficLight.GREEN == "green"
    assert TrafficLight.AMBER == "amber"
    assert TrafficLight.RED == "red"
    assert SDBIPService is not None
    assert router is not None

    # Verify actuals endpoints are registered
    paths = [r.path for r in router.routes]
    assert "/api/v1/sdbip/actuals" in paths
    assert "/api/v1/sdbip/actuals/{actual_id}" in paths
    assert "/api/v1/sdbip/kpis/{kpi_id}/actuals" in paths
    assert "/api/v1/sdbip/actuals/{actual_id}/correct" in paths
    # 28-05: evidence and validation endpoints
    assert "/api/v1/sdbip/actuals/{actual_id}/evidence" in paths
    assert "/api/v1/sdbip/evidence/{doc_id}/download" in paths
    assert "/api/v1/sdbip/actuals/{actual_id}/validate" in paths


# ---------------------------------------------------------------------------
# Test 13: PMS officer validates actual
# ---------------------------------------------------------------------------


class TestPmsOfficerValidatesActual:
    """Tests for SDBIPService.validate_actual() PMS officer validation."""

    async def test_pms_officer_validates_actual(self, db_session: AsyncSession):
        """PMS officer validation sets is_validated=True, validated_by, and validated_at."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        director = make_mock_director(tenant_id=tenant_id)
        pms_officer = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, director)

            # Director submits actual
            actual = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q1,
                    financial_year="2025/26",
                    actual_value=Decimal("85"),
                ),
                director, db_session,
            )

            # Pre-validation assertions
            assert actual.is_validated is False
            assert actual.validated_by is None
            assert actual.validated_at is None

            # PMS officer validates
            validated = await service.validate_actual(actual.id, pms_officer, db_session)
        finally:
            clear_tenant_context()

        # Post-validation assertions
        assert validated.is_validated is True
        assert validated.validated_by == str(pms_officer.id)
        assert validated.validated_at is not None
        # Actual values preserved after validation
        assert validated.actual_value == Decimal("85")
        assert validated.achievement_pct is not None
        assert validated.traffic_light_status is not None

    async def test_validate_preserves_achievement_data(self, db_session: AsyncSession):
        """Validation does not alter achievement_pct or traffic_light_status."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        director = make_mock_director(tenant_id=tenant_id)
        pms_officer = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, director, Decimal("100"))

            actual = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q2,
                    financial_year="2025/26",
                    actual_value=Decimal("60"),  # 60% -> amber
                ),
                director, db_session,
            )
            pre_pct = actual.achievement_pct
            pre_traffic = actual.traffic_light_status

            validated = await service.validate_actual(actual.id, pms_officer, db_session)
        finally:
            clear_tenant_context()

        assert validated.achievement_pct == pre_pct
        assert validated.traffic_light_status == pre_traffic
        assert validated.is_validated is True


# ---------------------------------------------------------------------------
# Test 14: Already-validated actual returns 422
# ---------------------------------------------------------------------------


class TestAlreadyValidatedReturns422:
    """Tests for idempotency guard in SDBIPService.validate_actual()."""

    async def test_already_validated_returns_422(self, db_session: AsyncSession):
        """Validating an already-validated actual returns 422."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        director = make_mock_director(tenant_id=tenant_id)
        pms_officer = make_mock_pms_officer(tenant_id=tenant_id)

        set_tenant_context(tenant_id)
        try:
            kpi, _ = await _create_kpi_with_targets(db_session, tenant_id, director)

            # Submit and validate
            actual = await service.submit_actual(
                SDBIPActualCreate(
                    kpi_id=kpi.id,
                    quarter=Quarter.Q3,
                    financial_year="2025/26",
                    actual_value=Decimal("90"),
                ),
                director, db_session,
            )
            # First validation — should succeed
            validated = await service.validate_actual(actual.id, pms_officer, db_session)
            assert validated.is_validated is True

            # Second validation — should fail 422
            with pytest.raises(HTTPException) as exc_info:
                await service.validate_actual(actual.id, pms_officer, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 422
        assert "already validated" in exc_info.value.detail.lower()

    async def test_validate_nonexistent_actual_returns_404(self, db_session: AsyncSession):
        """Validating a non-existent actual returns 404."""
        service = SDBIPService()
        tenant_id = str(uuid4())
        pms_officer = make_mock_pms_officer(tenant_id=tenant_id)
        fake_actual_id = uuid4()

        set_tenant_context(tenant_id)
        try:
            with pytest.raises(HTTPException) as exc_info:
                await service.validate_actual(fake_actual_id, pms_officer, db_session)
        finally:
            clear_tenant_context()

        assert exc_info.value.status_code == 404
