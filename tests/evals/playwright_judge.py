"""Playwright+Claude-judge eval engine.

Drives Streamlit conversations via Playwright MCP and scores responses
against judge rubrics. This is the automated replacement for manual
Streamlit verification per CONTEXT.md locked decision.

Usage: Called by run_playwright_eval.py CLI or directly by Claude Code.
"""
import json
import os
import time
from datetime import datetime
from typing import Callable

from tests.evals.judge_rubrics import RUBRIC_MAP, format_rubric
from tests.evals.scenarios.auth_scenarios import AUTH_SCENARIOS
from tests.evals.scenarios.gbv_scenarios import GBV_SCENARIOS
from tests.evals.scenarios.municipal_scenarios import MUNICIPAL_SCENARIOS
from tests.evals.scenarios.ticket_status_scenarios import TICKET_STATUS_SCENARIOS

SCENARIO_MAP: dict[str, list[dict]] = {
    "auth": AUTH_SCENARIOS,
    "municipal": MUNICIPAL_SCENARIOS,
    "ticket_status": TICKET_STATUS_SCENARIOS,
    "gbv": GBV_SCENARIOS,
}


class PlaywrightJudge:
    """Orchestrates Playwright-driven eval loop with Claude-as-judge scoring.

    Design:
    - Each eval session: reset session -> send scenario input -> read response -> score -> next input
    - Claude decides next input dynamically based on agent response (not scripted)
    - Scoring uses rubric from judge_rubrics.py
    - GBV scenarios: metadata-only reporting (no conversation content in reports)

    Usage (by Claude Code driving Playwright MCP):
        judge = PlaywrightJudge()

        # Claude Code provides these callbacks via Playwright MCP:
        def send_message_fn(message: str) -> None:
            # browser_type into chat input, browser_click Send
            ...

        def read_response_fn() -> str:
            # browser_snapshot, extract latest assistant message
            ...

        def reset_session_fn() -> None:
            # browser_click on "New Session" button in sidebar
            ...

        summary = judge.run_agent_eval("auth", send_message_fn, read_response_fn, reset_session_fn)
    """

    def __init__(
        self,
        crew_server_url: str = "http://localhost:8001",
        streamlit_url: str = "http://localhost:8501",
    ):
        self.crew_server_url = crew_server_url
        self.streamlit_url = streamlit_url
        self.results: list[dict] = []
        self.conversation_history: list[dict] = []

    def run_scenario(
        self,
        agent_name: str,
        scenario: dict,
        send_message_fn: Callable[[str], None],
        read_response_fn: Callable[[], str],
        reset_session_fn: Callable[[], None],
    ) -> dict:
        """Run a single eval scenario via Playwright.

        Args:
            agent_name: Which agent is being evaluated (e.g. "auth", "municipal").
            scenario: Scenario dict from scenarios/*.py
            send_message_fn: Callable that sends a message in Streamlit via Playwright.
                Signature: (message: str) -> None
            read_response_fn: Callable that reads the latest agent response from Streamlit.
                Signature: () -> str
            reset_session_fn: Callable that resets the Streamlit session.
                Signature: () -> None

        Returns:
            dict with scenario_name, criteria scores, pass/fail, conversation metadata.
            GBV scenarios (metadata_only=True) have conversation content stripped.
        """
        # Step 1: Reset session
        reset_session_fn()
        self.conversation_history = []

        # Step 2: Send initial message
        send_message_fn(scenario["input"])
        self.conversation_history.append({"role": "user", "content": scenario["input"]})

        # Step 3: Wait for and read response (allow LLM to respond)
        time.sleep(5)
        response = read_response_fn()
        self.conversation_history.append({"role": "assistant", "content": response})

        # Step 4: Score response against rubric
        score_result = self._score_response(
            agent_name=agent_name,
            response=response,
            scenario=scenario,
        )

        # Step 5: Build result (metadata-only for GBV)
        result: dict = {
            "scenario_name": scenario["name"],
            "agent_name": agent_name,
            "timestamp": datetime.utcnow().isoformat(),
            "criteria": score_result.get("criteria", {}),
            "pass": score_result.get("pass", False),
            "reason": score_result.get("reason", ""),
            "turn_count": len(self.conversation_history),
            "language": scenario.get("language", "en"),
        }

        # GBV: strip conversation content from result (SEC-05 / POPIA)
        if not scenario.get("metadata_only", False):
            result["conversation"] = self.conversation_history
            result["response_preview"] = response[:200]

        return result

    def _score_response(
        self,
        agent_name: str,
        response: str,
        scenario: dict,
    ) -> dict:
        """Score an agent response against the judge rubric.

        This method formats the rubric prompt and returns a structured
        score. When run by Claude Code, Claude itself IS the judge —
        it reads the formatted rubric and response, then returns
        pass/fail per criterion.

        In automated mode, this returns a template for Claude to fill.
        In Claude Code interactive mode, Claude evaluates directly.

        Args:
            agent_name: One of "auth", "municipal", "gbv", "ticket_status".
            response: The agent's response string.
            scenario: Scenario dict (used for language and tool sequence context).

        Returns:
            dict with rubric_prompt, criteria, pass, and reason keys.
        """
        # tools_called is a list[str] as required by format_rubric
        tools_called: list[str] = scenario.get("expected_tool_sequence", [])

        rubric = format_rubric(
            agent_name=agent_name,
            response=response,
            history=self._format_history(),
            language=scenario.get("language", "en"),
            tools_called=tools_called,
        )

        # Return the formatted rubric as the scoring template.
        # When Claude Code drives this, Claude reads the rubric and
        # provides the JSON score. For non-interactive runs, this
        # returns a placeholder that the caller must evaluate.
        return {
            "rubric_prompt": rubric,
            "criteria": {},
            "pass": False,
            "reason": "Awaiting Claude Code judge evaluation",
        }

    def _format_history(self) -> str:
        """Format conversation history for rubric injection."""
        lines = []
        for turn in self.conversation_history:
            role = "Citizen" if turn["role"] == "user" else "Gugu"
            lines.append(f"{role}: {turn['content']}")
        return "\n".join(lines)

    def run_agent_eval(
        self,
        agent_name: str,
        send_message_fn: Callable[[str], None],
        read_response_fn: Callable[[], str],
        reset_session_fn: Callable[[], None],
    ) -> dict:
        """Run all scenarios for a given agent.

        Args:
            agent_name: One of "auth", "municipal", "ticket_status", "gbv".
            send_message_fn: Playwright callback to send a message.
            read_response_fn: Playwright callback to read latest response.
            reset_session_fn: Playwright callback to reset the session.

        Returns:
            Summary dict with total, passed, failed, results per scenario.
        """
        scenarios = SCENARIO_MAP.get(agent_name, [])
        results = []

        for scenario in scenarios:
            result = self.run_scenario(
                agent_name=agent_name,
                scenario=scenario,
                send_message_fn=send_message_fn,
                read_response_fn=read_response_fn,
                reset_session_fn=reset_session_fn,
            )
            results.append(result)

        summary = {
            "agent_name": agent_name,
            "timestamp": datetime.utcnow().isoformat(),
            "total_scenarios": len(results),
            "passed": sum(1 for r in results if r["pass"]),
            "failed": sum(1 for r in results if not r["pass"]),
            "results": results,
        }

        # Save report to tests/evals/reports/
        self._save_report(agent_name, summary)
        return summary

    def _save_report(self, agent_name: str, summary: dict) -> None:
        """Save eval report to tests/evals/reports/ as timestamped JSON.

        GBV reports are already metadata-only at this point (stripped in run_scenario).
        """
        reports_dir = os.path.join(os.path.dirname(__file__), "reports")
        os.makedirs(reports_dir, exist_ok=True)

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{agent_name}_playwright_{timestamp}.json"
        filepath = os.path.join(reports_dir, filename)

        with open(filepath, "w") as f:
            json.dump(summary, f, indent=2, default=str)

        print(f"Report saved: {filepath}")
