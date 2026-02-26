"""CLI entry point for Playwright+Claude-judge eval loop.

Usage (run by Claude Code interactively):
    python -m tests.evals.run_playwright_eval --agent auth
    python -m tests.evals.run_playwright_eval --agent all
    python -m tests.evals.run_playwright_eval --agent auth --dry-run

This script is designed to be run BY Claude Code, which:
1. Starts crew_server and Streamlit (or verifies they're running)
2. Uses Playwright MCP to open Streamlit
3. Provides send_message_fn, read_response_fn, reset_session_fn
   via Playwright browser interactions
4. Acts as the LLM judge, scoring each response against rubrics

The eval loop is DYNAMIC -- Claude reads agent responses and decides
the next input based on behavior, not from a fixed script.
"""
import argparse
import sys

from tests.evals.playwright_judge import SCENARIO_MAP, PlaywrightJudge


def main() -> int:
    """Run Playwright+Claude-judge eval loop for the specified agent(s).

    Returns:
        0 on success (dry-run or eval setup complete)
        1 on argument error
    """
    parser = argparse.ArgumentParser(
        description="Run Playwright+Claude-judge eval loop",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all scenarios for all agents (no browser/LLM required)
  python -m tests.evals.run_playwright_eval --agent all --dry-run

  # List scenarios for a single agent
  python -m tests.evals.run_playwright_eval --agent auth --dry-run

  # Interactive mode (requires Claude Code + Playwright MCP)
  python -m tests.evals.run_playwright_eval --agent auth

Notes:
  Live eval runs require:
  - crew_server running: uvicorn src.api.v1.crew_server:crew_app --port 8001
  - Streamlit running:   streamlit run streamlit_dashboard/app.py
  - Claude Code driving Playwright MCP for browser interactions
  - Real DEEPSEEK_API_KEY and OPENAI_API_KEY for live agent responses
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
        help="Show scenarios and rubric info without running evals. No API keys required.",
    )
    parser.add_argument(
        "--crew-server-url",
        default="http://localhost:8001",
        help="URL of the crew server (default: http://localhost:8001)",
    )
    parser.add_argument(
        "--streamlit-url",
        default="http://localhost:8501",
        help="URL of the Streamlit dashboard (default: http://localhost:8501)",
    )
    args = parser.parse_args()

    agents = list(SCENARIO_MAP.keys()) if args.agent == "all" else [args.agent]

    if args.dry_run:
        print("\nDry-run mode -- listing Playwright+Claude-judge scenarios\n")
        total_scenarios = 0

        for agent_name in agents:
            scenarios = SCENARIO_MAP[agent_name]
            total_scenarios += len(scenarios)
            metadata_only_count = sum(
                1 for s in scenarios if s.get("metadata_only", False)
            )

            print(f"\n[{agent_name}] {len(scenarios)} scenarios (Playwright+Claude judge)")
            if metadata_only_count:
                print(
                    f"  (SEC-05/POPIA: {metadata_only_count} metadata_only "
                    "-- conversation content never logged)"
                )

            for s in scenarios:
                tools = s.get("expected_tool_sequence", [])
                tools_str = f" -> [{', '.join(tools)}]" if tools else " -> [no tools expected]"
                lang = s.get("language", "en")
                metadata_flag = " [METADATA ONLY]" if s.get("metadata_only") else ""
                print(f"  - {s['name']} (lang={lang}{metadata_flag}{tools_str})")

        print(f"\nTotal: {total_scenarios} scenarios across {len(agents)} agent(s)")
        print("\nTo run live evals, Claude Code should:")
        print("  1. Start crew_server: uvicorn src.api.v1.crew_server:crew_app --port 8001")
        print("  2. Start Streamlit:   streamlit run streamlit_dashboard/app.py")
        print("  3. Use Playwright MCP to navigate to Streamlit")
        print("  4. Run this script without --dry-run")
        return 0

    # Interactive mode: Claude Code provides Playwright callbacks
    print("=" * 60)
    print("PLAYWRIGHT+CLAUDE-JUDGE EVAL LOOP")
    print("=" * 60)
    print()
    print("This script requires Claude Code to drive Playwright MCP.")
    print()
    print("Claude Code should:")
    print("  1. Navigate to Streamlit via browser_navigate")
    print("  2. Create send_message_fn using browser_type + browser_click")
    print("  3. Create read_response_fn using browser_snapshot")
    print("  4. Create reset_session_fn using browser_click on 'New Session'")
    print("  5. Call PlaywrightJudge.run_agent_eval() with these callbacks")
    print()
    print("For automated use, import PlaywrightJudge directly:")
    print("  from tests.evals.playwright_judge import PlaywrightJudge")
    print()

    judge = PlaywrightJudge(
        crew_server_url=args.crew_server_url,
        streamlit_url=args.streamlit_url,
    )

    for agent_name in agents:
        scenarios = SCENARIO_MAP[agent_name]
        print(f"\nReady to evaluate: {agent_name}")
        print(f"  Scenarios: {len(scenarios)}")
        print(f"  Crew server: {judge.crew_server_url}")
        print(f"  Streamlit:   {judge.streamlit_url}")
        print()
        print("  Waiting for Claude Code to provide Playwright callbacks...")
        print(
            "  In practice, Claude Code imports PlaywrightJudge and drives "
            "the eval loop directly using Playwright MCP tools."
        )
        # In practice, Claude Code imports PlaywrightJudge and drives
        # the eval loop directly using Playwright MCP tools.
        # This CLI serves as documentation and dry-run capability.

    return 0


if __name__ == "__main__":
    sys.exit(main())
