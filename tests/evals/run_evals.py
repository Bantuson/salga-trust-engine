"""CLI entry point for running trajectory evals against live agents.

Usage:
    python -m tests.evals.run_evals --agent auth
    python -m tests.evals.run_evals --agent all
    python -m tests.evals.run_evals --agent auth --dry-run  # Show scenarios only

Requires real LLM API keys (DEEPSEEK_API_KEY, OPENAI_API_KEY).
NOT run in CI — only for manual evaluation.

The live eval runners (--agent without --dry-run) are intentionally
NotImplementedError. They require real LLM API keys and are meant to be
filled in during actual eval runs. The dry-run mode works immediately for
listing scenarios without any API keys.

Architecture:
    run_evals.py  ->  trajectory_evals.evaluate_agent()  ->  run_scenario_fn()
                                                         ->  save_eval_report()

Each eval run saves a JSON report to tests/evals/reports/{agent}_{timestamp}.json.
GBV reports are metadata_only (POPIA compliance — no conversation content logged).
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from tests.evals.trajectory_evals import evaluate_agent
from tests.evals.scenarios.auth_scenarios import AUTH_SCENARIOS
from tests.evals.scenarios.municipal_scenarios import MUNICIPAL_SCENARIOS
from tests.evals.scenarios.ticket_status_scenarios import TICKET_STATUS_SCENARIOS
from tests.evals.scenarios.gbv_scenarios import GBV_SCENARIOS

# ---------------------------------------------------------------------------
# Scenario registry
# ---------------------------------------------------------------------------

SCENARIO_MAP = {
    "auth": AUTH_SCENARIOS,
    "municipal": MUNICIPAL_SCENARIOS,
    "ticket_status": TICKET_STATUS_SCENARIOS,
    "gbv": GBV_SCENARIOS,
}


# ---------------------------------------------------------------------------
# Live eval runners (require real LLM API keys)
# ---------------------------------------------------------------------------


def _make_runner(agent_name: str):
    """Create a scenario runner for the given agent.

    Returns a callable that accepts a scenario dict and returns:
        (actual_output: str, actual_tool_calls: list[str])

    Live runners require:
    - Real DEEPSEEK_API_KEY for auth/gbv/municipal agents
    - Real OPENAI_API_KEY for intent classification (gpt-4o-mini)
    - Mocked external services (Supabase, SAPS notification, etc.)

    To implement a live runner:
    1. Import the relevant crew (AuthCrew, MunicipalIntakeCrew, etc.)
    2. Set up step_callback to capture tool calls
    3. Call crew.kickoff(inputs=scenario_inputs)
    4. Return (actual_output, actual_tool_calls)

    Example implementation (requires real LLM keys):

        from src.agents.crews.auth_crew import AuthCrew
        from tests.evals.conftest import make_step_callback

        def run_scenario(scenario):
            tool_calls = []
            crew = AuthCrew(language=scenario.get("language", "en"))
            crew_instance = crew.create_crew()
            crew_instance.step_callback = make_step_callback(tool_calls)
            result = crew_instance.kickoff(inputs={
                "message": scenario["input"],
                "phone": "+27820000000",  # Test phone
                "language": scenario.get("language", "en"),
                "session_status": scenario.get("session_status", "active"),
                "conversation_history": "(none)",
                "user_id": "test-user-uuid",
            })
            actual_output = result.raw if hasattr(result, "raw") else str(result)
            return actual_output, tool_calls

        return run_scenario
    """

    def run_scenario(scenario: dict) -> tuple[str, list[str]]:
        raise NotImplementedError(
            f"Live eval runner for '{agent_name}' requires real LLM API keys.\n"
            f"Use --dry-run to list scenarios without running them.\n"
            f"See _make_runner() docstring for implementation guidance."
        )

    return run_scenario


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def main() -> int:
    """Run trajectory evals for the specified agent(s).

    Returns:
        0 on success (all scenarios passed or dry-run completed)
        1 on failure (some scenarios failed)
        2 on error (runner raised an exception)
    """
    parser = argparse.ArgumentParser(
        description="Run agent trajectory evals for SALGA Trust Engine.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all auth scenarios without running
  python -m tests.evals.run_evals --agent auth --dry-run

  # List all scenarios for all agents
  python -m tests.evals.run_evals --agent all --dry-run

  # Run live evals (requires real LLM API keys)
  python -m tests.evals.run_evals --agent auth
  python -m tests.evals.run_evals --agent all

NOTE: Live eval runs (without --dry-run) are NotImplementedError until
live runners are implemented with real LLM API keys.
        """,
    )
    parser.add_argument(
        "--agent",
        choices=["auth", "municipal", "ticket_status", "gbv", "all"],
        required=True,
        help="Which agent to evaluate. 'all' runs all agents sequentially.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List scenarios without running evals. No API keys required.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Override directory for eval reports (default: tests/evals/reports/).",
    )
    args = parser.parse_args()

    agents = list(SCENARIO_MAP.keys()) if args.agent == "all" else [args.agent]

    if args.dry_run:
        # Dry-run mode: just list scenarios, no API calls
        print(f"\nDry-run mode — listing scenarios only (no eval runs)\n")
        total_scenarios = 0
        for agent_name in agents:
            scenarios = SCENARIO_MAP[agent_name]
            total_scenarios += len(scenarios)
            metadata_only_count = sum(
                1 for s in scenarios if s.get("metadata_only", False)
            )
            print(f"\n[{agent_name}] {len(scenarios)} scenarios")
            if metadata_only_count:
                print(f"  (SEC-05/POPIA: {metadata_only_count} metadata_only — content never logged)")
            for scenario in scenarios:
                tools = scenario.get("expected_tool_sequence", [])
                tools_str = f" -> [{', '.join(tools)}]" if tools else " -> [no tools expected]"
                lang = scenario.get("language", "en")
                metadata_flag = " [METADATA ONLY]" if scenario.get("metadata_only") else ""
                print(
                    f"  - {scenario['name']}"
                    f" (lang={lang}{metadata_flag}{tools_str})"
                )
        print(f"\nTotal: {total_scenarios} scenarios across {len(agents)} agent(s)\n")
        return 0

    # Live eval mode
    all_passed = True
    for agent_name in agents:
        scenarios = SCENARIO_MAP[agent_name]
        print(f"\nRunning {agent_name} evals ({len(scenarios)} scenarios)...")

        runner = _make_runner(agent_name)

        try:
            results = evaluate_agent(agent_name, scenarios, runner)
        except NotImplementedError as e:
            print(f"  SKIPPED: {e}")
            continue
        except Exception as e:
            print(f"  ERROR: {e}")
            return 2

        summary = results
        pass_rate = summary.get("pass_rate", 0.0)
        passed = summary.get("passed", 0)
        total = summary.get("total_scenarios", 0)
        report_path = summary.get("report_path", "unknown")

        status = "PASS" if pass_rate >= 0.8 else "FAIL"
        print(f"  {status}: {passed}/{total} scenarios passed ({pass_rate:.1%})")
        print(f"  Report: {report_path}")

        if pass_rate < 0.8:
            all_passed = False

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
