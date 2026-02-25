# Agent Eval Results — 2026-02-25

## Summary: 1/4 PASS, 3/4 FAIL (iteration required)

| Agent | LLM | Verdict | Key Failures |
|-------|-----|---------|-------------|
| Auth | gpt-4o-mini | **FAIL** | No Gugu persona, refuses to collect registration info, no tools called |
| Municipal | gpt-4o-mini | **FAIL** | Ignores user-provided details, asks for info already given, no Gugu persona |
| Ticket Status | gpt-4o-mini | **FAIL** | Misunderstands request, doesn't call lookup_ticket_tool |
| GBV | DeepSeek | **PASS** | Gugu persona, trauma-informed, emergency numbers, no leakage |

## Root Cause

All 3 failing agents use **gpt-4o-mini** via `get_routing_llm()`. The LLM's safety training overrides backstory instructions:
- Auth: "don't collect PII" conflicts with auth agent's registration job
- Municipal: doesn't read task description context (user's message details)
- Ticket Status: confuses "look up my ticket" with "give me a tracking number"

**GBV passes because it uses DeepSeek** (`get_deepseek_llm()`) which follows system prompts more faithfully.

## Common Pattern (gpt-4o-mini agents)
1. No Gugu persona adoption — backstory not influencing behavior
2. Tools not being called — agents don't use their attached tools
3. Generic/confused responses that ignore the task description context

## Recommended Fixes
1. **Switch Auth/Municipal/TicketStatus to DeepSeek** (or test with gpt-4o, not mini)
2. **Strengthen system prompts** — add explicit "YOU MUST use your tools" instructions
3. **Add few-shot examples** in task descriptions showing expected tool call patterns
4. **Increase max_iter** — agents may be hitting iteration limits before tool use
5. **Test with verbose=True** to see if agents attempt tools but fail silently

## Screenshots
- `tests/evals/screenshots/01-auth-initial-state.png`
- `tests/evals/screenshots/01-auth-response.png`
- `tests/evals/screenshots/02-municipal-response.png`
