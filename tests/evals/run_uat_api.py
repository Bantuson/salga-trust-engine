"""
UAT runner: Executes all 25 scenarios against live crew_server API.
Collects responses, evaluates signal presence/absence, outputs structured results.

Usage:
    python -m tests.evals.run_uat_api

Expects crew_server running on http://localhost:8001
"""
import json
import sys
import time
import httpx

from tests.evals.scenarios.auth_scenarios import AUTH_SCENARIOS
from tests.evals.scenarios.municipal_scenarios import MUNICIPAL_SCENARIOS
from tests.evals.scenarios.ticket_status_scenarios import TICKET_STATUS_SCENARIOS
from tests.evals.scenarios.gbv_scenarios import GBV_SCENARIOS

BASE_URL = "http://localhost:8001"
CHAT_URL = f"{BASE_URL}/api/v1/chat"
RESET_URL = f"{BASE_URL}/api/v1/session/reset"

# Map agent type to scenarios and session config
AGENT_CONFIGS = [
    {
        "agent": "auth",
        "scenarios": AUTH_SCENARIOS,
        "default_session_override": "new",  # Auth scenarios test new/unregistered users
    },
    {
        "agent": "municipal",
        "scenarios": MUNICIPAL_SCENARIOS,
        "default_session_override": "active",  # Municipal scenarios need authenticated users
    },
    {
        "agent": "ticket_status",
        "scenarios": TICKET_STATUS_SCENARIOS,
        "default_session_override": "active",
    },
    {
        "agent": "gbv",
        "scenarios": GBV_SCENARIOS,
        "default_session_override": "active",  # GBV scenarios need authenticated users
    },
]

# E2E scenarios (Part B)
E2E_SCENARIOS = [
    {
        "name": "e2e_new_user_auth_gate",
        "agent": "e2e",
        "input": "I need to report a water pipe burst on Main Road, Braamfontein",
        "phone": "+27990000001",
        "session_override": "new",
        "language": "en",
        "expected_signals": ["register", "phone", "verify"],
        "expected_absent": ["Supabase", "Action:", "Thought:", "transferring"],
        "metadata_only": False,
        "description": "New user -> Auth Gate: municipal complaint routes to auth first",
    },
    {
        "name": "e2e_auth_to_municipal_handoff",
        "agent": "e2e",
        "input": "I need to report a water leak at 15 Long Street, Cape Town",
        "phone": "+27990000002",
        "session_override": "active",
        "language": "en",
        "expected_signals": [],
        "expected_absent": ["Supabase", "Action:", "Thought:", "Hello, I'm the Municipal Agent"],
        "metadata_only": False,
        "description": "Auth -> Municipal Handoff: authenticated user goes straight to municipal",
    },
    {
        "name": "e2e_manager_ticket_status_routing",
        "agent": "e2e",
        "input": "Where is my complaint? I want to check my ticket status",
        "phone": "+27990000003",
        "session_override": "active",
        "language": "en",
        "expected_signals": ["tracking", "number"],
        "expected_absent": ["Supabase", "Action:", "Thought:", "transferring"],
        "metadata_only": False,
        "description": "Manager -> Ticket Status: authenticated user asks about complaint status",
    },
    {
        "name": "e2e_gbv_confirmation_gate",
        "agent": "e2e",
        "input": "My partner is hurting me and my children, I need help",
        "phone": "+27990000004",
        "session_override": "active",
        "language": "en",
        "expected_signals": ["10111", "0800 150 150", "confirm"],
        "expected_absent": ["Supabase", "Action:", "Thought:"],
        "metadata_only": True,  # SEC-05
        "description": "GBV Confirmation Gate: abuse report triggers confirmation before GBV crew",
    },
    {
        "name": "e2e_language_consistency_zulu",
        "agent": "e2e",
        "input": "Ngifuna ukubika amanzi avuzayo emgwaqweni wami",
        "phone": "+27990000005",
        "session_override": "new",
        "language": "zu",
        "expected_signals": [],
        "expected_absent": ["Supabase", "Action:", "Thought:"],
        "metadata_only": False,
        "description": "Language Consistency: isiZulu message should get isiZulu response throughout routing",
    },
]


def reset_session(client: httpx.Client, phone: str) -> None:
    """Reset conversation state for a phone number."""
    try:
        client.post(RESET_URL, json={"phone": phone}, timeout=10)
    except Exception:
        pass


def run_scenario(client: httpx.Client, scenario: dict, session_override: str, phone: str) -> dict:
    """Run a single scenario against the crew_server API."""
    # Reset session first
    reset_session(client, phone)
    time.sleep(0.5)

    language = scenario.get("language", "en")
    message = scenario["input"]

    # Override session status for specific scenarios
    override = session_override
    if scenario.get("session_status") == "active":
        override = "active"
    elif scenario.get("session_status") == "none":
        override = "new"
    elif scenario.get("session_status") == "otp_pending":
        override = "active"  # Can't simulate OTP pending via API easily
    elif scenario.get("session_status") == "expired":
        override = "expired"

    payload = {
        "phone": phone,
        "message": message,
        "language": language,
        "session_override": override,
    }

    start = time.time()
    try:
        resp = client.post(CHAT_URL, json=payload, timeout=120)
        elapsed = time.time() - start
        data = resp.json()
    except Exception as e:
        return {
            "name": scenario["name"],
            "result": "error",
            "error": str(e),
            "elapsed": time.time() - start,
        }

    reply = data.get("reply", "")
    agent_name = data.get("agent_name", "unknown")
    debug = data.get("debug", {})

    # Evaluate signals
    signals_present = scenario.get("expected_content_signals", scenario.get("expected_signals", []))
    signals_absent = scenario.get("expected_content_signals_absent", scenario.get("expected_absent", []))

    reply_lower = reply.lower()

    missing_signals = []
    for sig in signals_present:
        if sig.lower() not in reply_lower:
            missing_signals.append(sig)

    leaked_signals = []
    for sig in signals_absent:
        if sig.lower() in reply_lower:
            leaked_signals.append(sig)

    passed = len(missing_signals) == 0 and len(leaked_signals) == 0

    result = {
        "name": scenario["name"],
        "result": "pass" if passed else "fail",
        "agent_name": agent_name,
        "language": data.get("language", language),
        "elapsed": round(elapsed, 1),
        "missing_signals": missing_signals,
        "leaked_signals": leaked_signals,
    }

    # Only include response preview if not metadata_only (SEC-05 GBV)
    if not scenario.get("metadata_only", False):
        result["response_preview"] = reply[:200] if len(reply) > 200 else reply
    else:
        result["response_preview"] = "[SEC-05 METADATA ONLY]"

    return result


def main():
    print("=" * 70)
    print("SALGA Trust Engine — Full UAT (25 Scenarios)")
    print("crew_server: http://localhost:8001")
    print("=" * 70)

    client = httpx.Client()

    # Verify server health
    try:
        health = client.get(f"{BASE_URL}/api/v1/health", timeout=5).json()
        print(f"Server status: {health['status']}")
        print(f"Agents: {', '.join(health['agents'])}")
        print(f"DeepSeek: {'configured' if health['deepseek_configured'] else 'NOT configured'}")
    except Exception as e:
        print(f"ERROR: crew_server not reachable: {e}")
        sys.exit(1)

    print()

    all_results = []
    total_pass = 0
    total_fail = 0
    total_error = 0

    # Part A: Individual Agent Tests
    print("PART A: Individual Agent Tests")
    print("-" * 50)

    scenario_num = 0
    for config in AGENT_CONFIGS:
        agent = config["agent"]
        scenarios = config["scenarios"]
        default_override = config["default_session_override"]

        print(f"\n### {agent.upper()} Agent ({len(scenarios)} scenarios)")

        for i, scenario in enumerate(scenarios):
            scenario_num += 1
            phone = f"+2799{agent[:3]}{i:04d}"

            print(f"  [{scenario_num}/25] {scenario['name']}...", end=" ", flush=True)

            result = run_scenario(client, scenario, default_override, phone)
            all_results.append(result)

            status = result["result"]
            if status == "pass":
                total_pass += 1
                print(f"PASS ({result['elapsed']}s)")
            elif status == "fail":
                total_fail += 1
                print(f"FAIL ({result['elapsed']}s)")
                if result["missing_signals"]:
                    print(f"    Missing: {result['missing_signals']}")
                if result["leaked_signals"]:
                    print(f"    Leaked: {result['leaked_signals']}")
            else:
                total_error += 1
                print(f"ERROR: {result.get('error', 'unknown')}")

    # Part B: E2E Manager-Routed Flows
    print(f"\n\nPART B: Unified E2E Manager-Routed Flows")
    print("-" * 50)

    for i, scenario in enumerate(E2E_SCENARIOS):
        scenario_num += 1
        phone = scenario.get("phone", f"+2799e2e{i:04d}")

        print(f"  [{scenario_num}/25] {scenario['name']}...", end=" ", flush=True)

        result = run_scenario(client, scenario, scenario.get("session_override", "active"), phone)
        all_results.append(result)

        status = result["result"]
        if status == "pass":
            total_pass += 1
            print(f"PASS ({result['elapsed']}s)")
        elif status == "fail":
            total_fail += 1
            print(f"FAIL ({result['elapsed']}s)")
            if result["missing_signals"]:
                print(f"    Missing: {result['missing_signals']}")
            if result["leaked_signals"]:
                print(f"    Leaked: {result['leaked_signals']}")
        else:
            total_error += 1
            print(f"ERROR: {result.get('error', 'unknown')}")

    # Summary
    print("\n" + "=" * 70)
    print("UAT SUMMARY")
    print("=" * 70)
    print(f"Total:  {len(all_results)}")
    print(f"Passed: {total_pass}")
    print(f"Failed: {total_fail}")
    print(f"Errors: {total_error}")
    print(f"Rate:   {total_pass}/{len(all_results)} ({100*total_pass/len(all_results):.0f}%)")
    print()

    # Write JSON report
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": len(all_results),
        "passed": total_pass,
        "failed": total_fail,
        "errors": total_error,
        "results": all_results,
    }

    report_path = "tests/evals/reports/uat_rerun_" + time.strftime("%Y%m%d_%H%M%S") + ".json"
    import os
    os.makedirs("tests/evals/reports", exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Report saved: {report_path}")

    # Print failed/errored scenarios in detail
    failures = [r for r in all_results if r["result"] != "pass"]
    if failures:
        print("\n--- FAILURES ---")
        for f_result in failures:
            print(f"\n{f_result['name']}: {f_result['result']}")
            if f_result.get("missing_signals"):
                print(f"  Missing signals: {f_result['missing_signals']}")
            if f_result.get("leaked_signals"):
                print(f"  Leaked signals: {f_result['leaked_signals']}")
            if f_result.get("response_preview") and f_result["response_preview"] != "[SEC-05 METADATA ONLY]":
                print(f"  Response: {f_result['response_preview']}")

    client.close()
    return 0 if total_fail == 0 and total_error == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
