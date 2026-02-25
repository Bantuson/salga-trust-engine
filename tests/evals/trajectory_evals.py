"""
Trajectory evaluation harness for SALGA Trust Engine agents.

Uses deepeval's ToolCorrectnessMetric to compare expected tool call sequences
against actual tool calls made during agent execution.

Key functions:
- run_trajectory_eval(): Compare expected vs actual tool sequences via deepeval
- check_content_signals(): Validate expected/forbidden words in agent response
- save_eval_report(): Persist results as JSON, stripping content for GBV (metadata_only)
- evaluate_agent(): Full agent evaluation loop across all scenarios

SEC-05 / POPIA: GBV scenarios with metadata_only=True have ALL response content
stripped from reports. Only pass/fail, score, and scenario_name are retained.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Callable

from deepeval.metrics import ToolCorrectnessMetric
from deepeval.test_case import LLMTestCase, ToolCall

# Directory where timestamped eval reports are saved
_REPORTS_DIR = Path(__file__).parent / "reports"


def run_trajectory_eval(
    scenario: dict,
    actual_output: str,
    actual_tool_calls: list[str],
) -> dict:
    """
    Compare expected vs actual tool sequences using deepeval ToolCorrectnessMetric.

    Args:
        scenario: Scenario dict with at minimum 'name', 'input',
                  and 'expected_tool_sequence' keys.
        actual_output: The agent's final response string.
        actual_tool_calls: List of tool names actually called (in order).

    Returns:
        Dict with keys: passed, score, reason, scenario (name).

    Example:
        result = run_trajectory_eval(
            scenario=AUTH_SCENARIOS[0],
            actual_output="Please provide your phone number to verify.",
            actual_tool_calls=["lookup_user_tool", "send_otp_tool"],
        )
    """
    expected_sequence = scenario.get("expected_tool_sequence", [])

    # Convert string tool names to ToolCall objects for deepeval
    expected_tool_calls = [ToolCall(name=name) for name in expected_sequence]
    actual_tool_call_objs = [ToolCall(name=name) for name in actual_tool_calls]

    test_case = LLMTestCase(
        input=scenario["input"],
        actual_output=actual_output,
        tools_called=actual_tool_call_objs,
        expected_tools=expected_tool_calls,
    )

    metric = ToolCorrectnessMetric(threshold=0.8)
    metric.measure(test_case)

    return {
        "passed": metric.is_successful(),
        "score": metric.score,
        "reason": metric.reason if hasattr(metric, "reason") else "",
        "scenario": scenario["name"],
    }


def check_content_signals(response: str, scenario: dict) -> dict:
    """
    Validate required and forbidden words/phrases in an agent response.

    Args:
        response: The agent's final response string.
        scenario: Scenario dict with optional 'expected_content_signals'
                  and 'expected_content_signals_absent' keys.

    Returns:
        Dict with keys:
          - passed: bool — True if all signals present and none forbidden
          - missing_signals: list of required signals not found
          - forbidden_signals_found: list of forbidden signals that were found

    Note:
        Matching is case-insensitive.
    """
    response_lower = response.lower()

    required = scenario.get("expected_content_signals", [])
    forbidden = scenario.get("expected_content_signals_absent", [])

    missing_signals = [
        signal for signal in required if signal.lower() not in response_lower
    ]
    forbidden_signals_found = [
        signal for signal in forbidden if signal.lower() in response_lower
    ]

    passed = len(missing_signals) == 0 and len(forbidden_signals_found) == 0

    return {
        "passed": passed,
        "missing_signals": missing_signals,
        "forbidden_signals_found": forbidden_signals_found,
    }


def save_eval_report(agent_name: str, results: list[dict]) -> Path:
    """
    Save evaluation results to a timestamped JSON file.

    SEC-05 / POPIA: Scenarios with metadata_only=True have all response content
    stripped. Only pass/fail, score, and scenario_name are retained in the report.

    Args:
        agent_name: Identifier for the agent being evaluated (e.g., "auth", "gbv").
        results: List of per-scenario result dicts as returned by run_trajectory_eval()
                 and check_content_signals(), augmented with scenario metadata.

    Returns:
        Path to the saved report file.
    """
    _REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    report_path = _REPORTS_DIR / f"{agent_name}_{timestamp}.json"

    sanitized_results = []
    for result in results:
        # SEC-05 / POPIA: strip all conversation content for metadata_only scenarios
        if result.get("metadata_only", False):
            sanitized_results.append(
                {
                    "scenario": result.get("scenario"),
                    "passed": result.get("passed"),
                    "score": result.get("score"),
                    # No response content, no input, no signals — metadata only
                }
            )
        else:
            sanitized_results.append(result)

    total = len(sanitized_results)
    passed_count = sum(1 for r in sanitized_results if r.get("passed", False))
    failed_count = total - passed_count
    pass_rate = round(passed_count / total, 4) if total > 0 else 0.0

    report = {
        "agent": agent_name,
        "timestamp": timestamp,
        "summary": {
            "total_scenarios": total,
            "passed": passed_count,
            "failed": failed_count,
            "pass_rate": pass_rate,
        },
        "results": sanitized_results,
    }

    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report_path


def evaluate_agent(
    agent_name: str,
    scenarios: list[dict],
    run_scenario_fn: Callable[[dict], tuple[str, list[str]]],
) -> dict:
    """
    Full evaluation loop: run all scenarios, check signals, save report.

    Args:
        agent_name: Identifier for the agent (e.g., "auth", "municipal", "gbv").
        scenarios: List of scenario dicts to evaluate.
        run_scenario_fn: Callable that accepts a scenario dict and returns
                         (actual_output: str, actual_tool_calls: list[str]).

    Returns:
        Summary dict with keys: agent, total_scenarios, passed, failed, pass_rate,
        report_path (str).

    Example usage:
        def run_auth_scenario(scenario):
            # ... spin up AuthCrew, capture outputs ...
            return actual_output, actual_tool_calls

        summary = evaluate_agent("auth", AUTH_SCENARIOS, run_auth_scenario)
        assert summary["pass_rate"] >= 0.8
    """
    all_results = []

    for scenario in scenarios:
        actual_output, actual_tool_calls = run_scenario_fn(scenario)

        trajectory_result = run_trajectory_eval(scenario, actual_output, actual_tool_calls)
        content_result = check_content_signals(actual_output, scenario)

        # Combined pass: both trajectory AND content signals must pass
        combined_passed = trajectory_result["passed"] and content_result["passed"]

        result = {
            "scenario": scenario["name"],
            "metadata_only": scenario.get("metadata_only", False),
            "passed": combined_passed,
            "score": trajectory_result["score"],
            "trajectory_passed": trajectory_result["passed"],
            "trajectory_reason": trajectory_result["reason"],
            "content_passed": content_result["passed"],
            "missing_signals": content_result["missing_signals"],
            "forbidden_signals_found": content_result["forbidden_signals_found"],
        }

        # Only include response content for non-metadata scenarios
        if not scenario.get("metadata_only", False):
            result["actual_output"] = actual_output
            result["actual_tool_calls"] = actual_tool_calls

        all_results.append(result)

    report_path = save_eval_report(agent_name, all_results)

    total = len(all_results)
    passed_count = sum(1 for r in all_results if r["passed"])

    return {
        "agent": agent_name,
        "total_scenarios": total,
        "passed": passed_count,
        "failed": total - passed_count,
        "pass_rate": round(passed_count / total, 4) if total > 0 else 0.0,
        "report_path": str(report_path),
    }
