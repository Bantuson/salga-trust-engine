# Phase 7: Fix WhatsApp -> AI Agent Integration (GAP CLOSURE) - Research

**Researched:** 2026-02-21
**Domain:** CrewAI intake pipeline integration — fixing broken API call sites (messages.py, reports.py, whatsapp_service.py)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LLM Model Configuration**
- All agents use DeepSeek (same model for all — manager, GBV, municipal, auth, ticket status)
- Move LLM config to YAML agent definitions (CrewAI best practice) instead of hardcoded Python params
- Remove `llm_model="gpt-4o"` from all Python callers — callers pass `llm=None`
- Keep `get_deepseek_llm()` in IntakeFlow as a safety net fallback if YAML LLM is missing

**GBV Safety in Webhook Path**
- Add a confirmation step before routing to SAPS — citizen must confirm they want to report
- If citizen confirms: immediate SAPS notification AND ticket flagged for admin review (double coverage)
- If citizen declines: treat as regular ticket, no GBV flag (MVP simplicity)
- Confirmation message tone: Claude's discretion, using trauma-informed communication best practices

**Conversation Continuity**
- Session-based context: remember within a 24-hour window, then start fresh
- Pass full conversation history to AI agent within a session (all previous turns)
- Topic switching: ManagerCrew asks citizen for consent before switching specialists ("finish current issue or switch?")

**Error/Fallback Behavior**
- On AI failure: friendly English-only apology + retry hint ("Please try again in a few minutes")
- No staff logging of failures, no circuit breaker — keep it simple for MVP
- No error message translation for MVP (English only)

**MVP Priority (USER DIRECTIVE)**
- Focus on what matters: tool use, agent trajectories, end-to-end workflow execution
- User info, ticket creation, and reporting success must persist in database
- Don't over-engineer — this is gap closure for demo MVP
- Fix the broken calls, verify the flow works end-to-end, move on

### Claude's Discretion
- GBV confirmation message wording (trauma-informed, empathetic)
- Error message exact wording
- Any technical implementation details for the fixes

### Deferred Ideas (OUT OF SCOPE)
- Trilingual error messages — future phase (currently English only)
- Circuit breaker for LLM outages — not needed for MVP
- Staff notification on failed AI processing — not needed for MVP
- Error logging for staff follow-up — not needed for MVP
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-01 | Citizen can report service issues via WhatsApp using hybrid bot (guided intake + AI agent) | Fix WhatsAppService to use IntakeFlow(llm=None) + flow.kickoff() instead of removed methods |
| RPT-07 | GBV reports are automatically routed to the nearest SAPS police station based on geolocation | Fix Twilio webhook path so GBV routing via ManagerCrew (which calls notify_saps) works end-to-end |
</phase_requirements>

---

## Summary

Phase 7 is a targeted bug-fix phase — not a feature build. The root cause is a Phase 6.9 refactor that changed IntakeFlow's constructor signature (removed `llm_model: str` parameter, replaced with `llm=None` accepting a `crewai.LLM` object) and replaced `receive_message()` / `classify_message()` methods with a single `@start()` method (`receive_and_route()`). Two call sites — `src/api/v1/messages.py` and `src/api/v1/reports.py` — were not updated when IntakeFlow was refactored. A third call site — `src/services/whatsapp_service.py` — also uses the old signature but its flow.kickoff() call still works (only the constructor arg is wrong). Together these three files cause runtime crashes on any citizen-facing report submission.

The fix is surgical: update the broken call sites to match the current IntakeFlow API, add the GBV confirmation step in the WhatsApp webhook path, and verify the full end-to-end flow produces tickets persisted to the database. The crew_server.py path (used by Streamlit dashboard) already works correctly and serves as the reference implementation. The CONTEXT.md confirms the WhatsApp webhook path in `whatsapp_service.py` has correct flow logic (kickoff) — only the constructor arg is wrong. The reports.py call to `receive_message()` and `classify_message()` must be replaced with a call to `flow.kickoff()`.

For GBV, the WhatsApp webhook must add a confirmation step: citizen says something that ManagerCrew classifies as GBV, then the bot asks for explicit confirmation before routing to SAPS. If confirmed, `notify_saps` is called (already wired into GBVCrew tools). The entire end-to-end path (WhatsApp message → IntakeFlow → ManagerCrew → GBVCrew → create_municipal_ticket + notify_saps → DB persist) becomes the acceptance test.

**Primary recommendation:** Fix the three broken call sites to use `IntakeFlow(redis_url=..., llm=None)` + `await flow.kickoff()` (or synchronous kickoff for reports.py), replace the `receive_message()/classify_message()` chain in reports.py with direct `flow.kickoff()` or bypass IntakeFlow entirely for the already-categorized case, and add GBV confirmation state tracking in the WhatsApp path.

---

## Standard Stack

### Core (already in codebase — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| crewai | Installed | Agent orchestration with Process.hierarchical | Already the project's AI backbone; ManagerCrew, GBVCrew, MunicipalCrew all use it |
| fastapi | Installed | REST API + webhook endpoint | All API endpoints already FastAPI |
| twilio | Installed | Twilio client for WhatsApp signature validation | Already used in whatsapp_service.py |
| sqlalchemy 2.0 | Installed | Async DB session for ticket persistence | All DB patterns use AsyncSession |

### No new packages required
This is a bug fix phase. All required libraries are already installed. No `pip install` needed.

---

## Architecture Patterns

### Current Working Reference: crew_server.py
The standalone crew server (`src/api/v1/crew_server.py`) uses ManagerCrew correctly and is the reference implementation:

```python
# crew_server.py — CORRECT pattern (reference)
from src.agents.crews.manager_crew import ManagerCrew

manager_crew = ManagerCrew(language=detected_language)
agent_result = await manager_crew.kickoff(manager_context)
```

No IntakeFlow is used in crew_server.py at all. For the two web-facing API endpoints, IntakeFlow wraps ManagerCrew — but IntakeFlow's `__init__` signature changed in Phase 6.9:

```python
# BEFORE (Phase 6.9 refactor) — WRONG, causes TypeError at runtime
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")
flow.receive_message()   # Method removed in Phase 6.9
flow.classify_message()  # Method removed in Phase 6.9

# AFTER (current IntakeFlow API) — CORRECT
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm=None)  # llm=None → gets_deepseek_llm()
result = flow.kickoff()  # Single entry point, async-wrapped
```

### Pattern 1: messages.py Fix (WhatsApp + Web Portal messages)

**What:** Replace the broken IntakeFlow constructor call and run kickoff directly.

**Current broken code (messages.py line 180):**
```python
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")
flow._state = intake_state
result = flow.kickoff()
```

**Fixed code:**
```python
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm=None)
flow._state = intake_state
result = flow.kickoff()
```

Note: `flow.kickoff()` is synchronous for CrewAI Flow (the `@start()` method `receive_and_route` is async but CrewAI Flow.kickoff() handles this internally). The existing pattern of calling `flow.kickoff()` without `await` is consistent with how CrewAI Flows work — verify this against current behavior in crew_server.py which uses `await manager_crew.kickoff()` (ManagerCrew has its own async kickoff that wraps `crew.kickoff()` in a thread executor). IntakeFlow delegates to ManagerCrew asynchronously internally.

**Response extraction:** After kickoff, `flow.state.ticket_data` is a dict returned from ManagerCrew. The `message` key contains the citizen-facing text. Extract it:
```python
agent_response = (flow.state.ticket_data or {}).get("message", "Your report is being processed.")
tracking_number = (flow.state.ticket_data or {}).get("tracking_number")
```

### Pattern 2: reports.py Fix (Web Portal categorized submission)

**What:** `reports.py` has two problems:
1. Constructor uses `llm_model="gpt-4o"` (wrong kwarg)
2. Calls `flow.receive_message()` and `flow.classify_message()` (methods removed)

**Current broken code (reports.py lines 90-100):**
```python
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")
flow._state = intake_state
flow.receive_message()   # DOES NOT EXIST
flow.classify_message()  # DOES NOT EXIST
category = flow.state.subcategory or flow.state.category or "other"
```

**Fix options (choose based on purpose):**

Option A — Use ManagerCrew directly (bypass IntakeFlow for classification-only):
```python
# For reports.py, we only need category classification — not full agent conversation
# Use ManagerCrew directly, or use a keyword-based classifier
from src.agents.crews.manager_crew import ManagerCrew

manager_crew = ManagerCrew(language=report.language)
result = await manager_crew.kickoff({
    "message": sanitized_description,
    "user_id": str(current_user.id),
    "tenant_id": str(current_user.tenant_id),
    "language": report.language,
    "phone": "",
    "session_status": "active",
    "user_exists": "True",
    "conversation_history": "(none)",
    "pending_intent": "none",
})
category = result.get("category") or result.get("routing_phase") or "other"
```

Option B — Use IntakeFlow with fixed constructor + kickoff:
```python
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm=None)
flow._state = intake_state
flow.kickoff()
category = flow.state.subcategory or flow.state.category or "other"
```

**Recommendation: Option B** for minimal change surface. The flow.kickoff() already runs ManagerCrew internally and sets `flow.state.category` via `self.state.ticket_data`. However, `flow.state.category` may not be set by ManagerCrew results (ManagerCrew returns a dict, not category field on state). **Critical check:** After `flow.kickoff()`, category must be read from `flow.state.ticket_data.get("routing_phase")` mapped to a ticket category, OR the flow's `receive_and_route()` must be updated to set `flow.state.category` from the ManagerCrew result.

Looking at `intake_flow.py` line 77: `self.state.ticket_data = result` — so category isn't set on state. The reports.py fix should read from ticket_data:
```python
ticket_data = flow.state.ticket_data or {}
routing_phase = ticket_data.get("routing_phase", "")
# Map routing_phase to ticket category
phase_to_category = {"municipal": "other", "gbv": "gbv", "manager": "other"}
category = phase_to_category.get(routing_phase, "other")
```

### Pattern 3: whatsapp_service.py Fix (Constructor Only)

**What:** The `process_incoming_message` method uses the same broken constructor. The kickoff() call on line 287 is correct (`flow.kickoff()`), but the state reading is stale (uses `flow.state.ticket_data` dict patterns that are now set by ManagerCrew, not the old classification chain).

**Current broken code (whatsapp_service.py line 280):**
```python
flow = IntakeFlow(redis_url=self._redis_url, llm_model="gpt-4o")
```

**Fix:**
```python
flow = IntakeFlow(redis_url=self._redis_url, llm=None)
```

Then update response extraction to read from ManagerCrew result dict:
```python
ticket_data = flow.state.ticket_data or {}
agent_response = ticket_data.get("message", "Your report is being processed.")
tracking_number = ticket_data.get("tracking_number")
```

### Pattern 4: GBV Confirmation Step (WhatsApp Webhook Path)

**What:** Before routing to SAPS, citizen must explicitly confirm. The ManagerCrew already classifies GBV intent — the confirmation gate must be added in the session state layer.

**Where to implement:** In `crew_server.py` (the working path) or in `whatsapp_service.py` / `whatsapp.py` for the Twilio webhook path. Since the CONTEXT.md says "WhatsApp webhook path is actually correct" in terms of routing — the confirmation step must be injected at the conversation state level.

**Implementation approach:** Use `routing_phase` in ConversationState as a state machine:
1. ManagerCrew classifies as `gbv` → set `routing_phase = "gbv_pending_confirm"` instead of `"gbv"`
2. Next citizen turn: read `routing_phase == "gbv_pending_confirm"` → send confirmation message
3. Citizen confirms (yes/positive): set `routing_phase = "gbv"` → run GBVCrew → notify_saps
4. Citizen declines (no/negative): set `routing_phase = "municipal"` → treat as regular ticket

**State flow:**
```
message → ManagerCrew(GBV classified)
  → routing_phase = "gbv_pending_confirm"
  → reply: "I hear you. Before we connect you with emergency support, can you confirm..."

next message (citizen confirms)
  → routing_phase = "gbv_pending_confirm" detected
  → citizen said yes? → run GBVCrew → notify_saps + create_ticket
  → citizen said no?  → reset to "municipal" routing
```

**Trauma-informed confirmation message (Claude's discretion — recommended wording):**
```
"I hear you, and I want to make sure you get the right support.
I'd like to connect you with emergency services and log a confidential report.
Are you okay with me doing that? You can simply reply 'yes' or 'no' —
your safety is the priority. Emergency: 10111 | GBV Helpline: 0800 150 150"
```

### Pattern 5: IntakeFlow async/sync kickoff clarification

**Critical finding from code inspection:** `IntakeFlow.receive_and_route()` is defined as `async def`, but `Flow.kickoff()` in CrewAI handles async `@start()` methods. In messages.py and whatsapp_service.py, `flow.kickoff()` is called **without** `await`. The crew_server.py path does NOT use IntakeFlow at all (it calls `await manager_crew.kickoff()` directly).

Check how CrewAI Flow.kickoff() works with async start methods: CrewAI's `Flow.kickoff()` is synchronous — it internally runs the async event loop for async `@start()` methods. This means `flow.kickoff()` (without await) is correct for IntakeFlow. Do NOT add `await` to `flow.kickoff()` — it will fail if called from an already-running event loop (FastAPI's async context).

**Solution for async context:** Use `asyncio.get_event_loop().run_in_executor(None, flow.kickoff)` pattern (same as ManagerCrew.kickoff does for `crew.kickoff()`), OR redesign the messages.py endpoint to call ManagerCrew directly (bypassing IntakeFlow) as crew_server.py does.

**Recommended approach for messages.py and whatsapp_service.py:** Bypass IntakeFlow entirely — call ManagerCrew directly (matching crew_server.py). IntakeFlow adds no value over direct ManagerCrew calls now that the multi-step classify chain is gone.

### Anti-Patterns to Avoid

- **Don't call `flow.kickoff()` with await in an async FastAPI endpoint** — CrewAI Flow.kickoff() is synchronous; calling with await will raise TypeError
- **Don't use `flow.receive_message()` or `flow.classify_message()`** — removed in Phase 6.9, they do not exist
- **Don't pass `llm_model="gpt-4o"`** — IntakeFlow.__init__ only accepts `llm=<crewai.LLM object or None>`
- **Don't read `flow.state.category`** — it's never set by Phase 6.9 IntakeFlow; read from `flow.state.ticket_data.get("routing_phase")` instead
- **Don't block FastAPI async event loop with synchronous crew.kickoff()** — always wrap in `run_in_executor` (ManagerCrew.kickoff() already does this correctly)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM-based intent classification | Custom keyword matcher | ManagerCrew (already exists) | Full LLM routing already implemented and tested |
| Async wrapper for sync crew.kickoff | Custom thread pool code | ManagerCrew.kickoff() pattern (`loop.run_in_executor`) | Already implemented in manager_crew.py |
| GBV notification | Custom SAPS API client | `notify_saps` tool (already in GBVCrew tools) | Already wired into gbv_agent's tools list |
| Response sanitization | New artifact stripper | `sanitize_reply()` in crew_server.py | Already handles all CrewAI artifacts, delegation text, GBV safety |
| Conversation state | Custom Redis key scheme | `ConversationManager` + `InMemoryConversationManager` | Already implemented with GBV isolation |

**Key insight:** The entire pipeline infrastructure is already correct in crew_server.py. Phase 7 is about making messages.py, reports.py, and whatsapp_service.py call the same correct infrastructure that crew_server.py already uses.

---

## Common Pitfalls

### Pitfall 1: Calling flow.kickoff() from async FastAPI context
**What goes wrong:** `Flow.kickoff()` internally runs `asyncio.run()` or an event loop. Calling it from inside an `async def` FastAPI endpoint raises `RuntimeError: This event loop is already running`.
**Why it happens:** CrewAI Flow is designed for standalone use, not embedded in existing async contexts.
**How to avoid:** Either (a) bypass IntakeFlow entirely and call ManagerCrew.kickoff() directly (which uses `run_in_executor` — already async-safe), or (b) wrap `flow.kickoff()` in `await loop.run_in_executor(None, flow.kickoff)`.
**Warning signs:** `RuntimeError: This event loop is already running` in FastAPI logs.

### Pitfall 2: Reading category from flow.state after kickoff
**What goes wrong:** `flow.state.category` is `None` after kickoff because `receive_and_route()` only sets `self.state.ticket_data = result` (the ManagerCrew result dict). It never sets `self.state.category`.
**Why it happens:** Phase 6.9 refactor removed the `classify_message()` step that used to set category on state. Now category is in the ManagerCrew result dict.
**How to avoid:** Read `flow.state.ticket_data.get("routing_phase")` and map to category: `{"municipal": "municipal", "gbv": "gbv"}.get(routing_phase, "other")`.
**Warning signs:** `category` is always `None`, tickets created with `category=None`.

### Pitfall 3: Using wrong kwarg name for IntakeFlow LLM
**What goes wrong:** `IntakeFlow(llm_model="gpt-4o")` raises `TypeError: __init__() got an unexpected keyword argument 'llm_model'` at the instant of object creation.
**Why it happens:** Phase 6.9 changed `llm_model: str` parameter to `llm=None` (accepts `crewai.LLM` object). Old callers weren't updated.
**How to avoid:** Use `IntakeFlow(redis_url=..., llm=None)`. The `None` value triggers `get_deepseek_llm()` fallback inside IntakeFlow.__init__.
**Warning signs:** `TypeError: __init__() got an unexpected keyword argument 'llm_model'` in startup or first request.

### Pitfall 4: GBV confirmation routing_phase naming collision
**What goes wrong:** If GBV confirmation is stored as `routing_phase = "gbv"`, the short-circuit in crew_server.py immediately routes to GBVCrew without the confirmation check.
**Why it happens:** crew_server.py's SHORT-CIRCUIT block reads `routing_phase != "manager"` and routes to `_SPECIALIST_MAP["gbv"]` → GBVCrew directly.
**How to avoid:** Use a dedicated intermediate state like `routing_phase = "gbv_pending_confirm"`. The SHORT-CIRCUIT map does not contain this key, so it falls through to manager routing, where the confirmation check is applied.
**Warning signs:** Citizens not seeing the confirmation message; GBV tickets created without consent.

### Pitfall 5: Missing `await` on ManagerCrew.kickoff()
**What goes wrong:** `agent_result = manager_crew.kickoff(context)` returns a coroutine object, not a dict.
**Why it happens:** `ManagerCrew.kickoff()` is `async def` — it must be awaited.
**How to avoid:** Always `agent_result = await manager_crew.kickoff(context)`.
**Warning signs:** `agent_result.get("message")` raises `AttributeError: 'coroutine' object has no attribute 'get'`.

### Pitfall 6: reports.py — blocking async endpoint with sync crew call
**What goes wrong:** If reports.py calls `ManagerCrew.kickoff()` (async), it works fine. But if it uses `flow.kickoff()` directly (sync), it may block the event loop.
**Why it happens:** FastAPI endpoints are async; long-running sync operations block the thread.
**How to avoid:** Use `await manager_crew.kickoff(context)` — ManagerCrew.kickoff() wraps `crew.kickoff()` in `run_in_executor` so it's async-safe.

### Pitfall 7: session_id collision in WhatsApp webhook
**What goes wrong:** `session_id = f"wa-{payload.MessageSid}"` creates a new session per message. The GBV confirmation state needs to persist across message turns.
**Why it happens:** Twilio's MessageSid is unique per message — using it as session_id means each incoming message starts a fresh conversation.
**How to avoid:** Use a stable session_id per phone number, such as `f"wa-{normalized_phone}"`. The conversation manager already handles 24-hour expiry. This is the same approach crew_server.py uses (`session_id = f"crew:{phone}"`).
**Warning signs:** GBV confirmation state lost between messages; citizen must re-type their GBV report.

---

## Code Examples

### Fix 1: messages.py — corrected IntakeFlow call

```python
# Source: Current IntakeFlow.__init__ signature (src/agents/flows/intake_flow.py)
# BEFORE (broken):
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")
flow._state = intake_state
result = flow.kickoff()

# AFTER (Option A — recommended, bypass IntakeFlow entirely like crew_server.py does):
from src.agents.crews.manager_crew import ManagerCrew
manager_crew = ManagerCrew(language=conversation_state.language)
agent_result = await manager_crew.kickoff({
    "message": input_result.sanitized_message,
    "user_id": str(current_user.id),
    "tenant_id": str(tenant_id),
    "language": conversation_state.language,
    "phone": getattr(current_user, "phone", ""),
    "session_status": "active",
    "user_exists": "True",
    "conversation_history": _format_history(conversation_state.turns),
    "pending_intent": "none",
})
agent_response = agent_result.get("message", "Your report is being processed.")
tracking_number = agent_result.get("tracking_number")
category = agent_result.get("routing_phase", "other")
is_complete = True  # ManagerCrew completes in one turn

# AFTER (Option B — minimal change, fix constructor only):
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm=None)
flow._state = intake_state
# flow.kickoff() is synchronous but runs async code internally.
# In async FastAPI context, wrap in executor:
loop = asyncio.get_event_loop()
await loop.run_in_executor(None, flow.kickoff)
agent_response = (flow.state.ticket_data or {}).get("message", "Your report is being processed.")
```

### Fix 2: reports.py — replace removed methods

```python
# Source: src/agents/flows/intake_flow.py — receive_message() and classify_message() DO NOT EXIST
# BEFORE (broken):
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")
flow._state = intake_state
flow.receive_message()   # AttributeError: 'IntakeFlow' has no attribute 'receive_message'
flow.classify_message()  # AttributeError: 'IntakeFlow' has no attribute 'classify_message'
category = flow.state.subcategory or flow.state.category or "other"

# AFTER (use ManagerCrew for classification):
from src.agents.crews.manager_crew import ManagerCrew
manager_crew = ManagerCrew(language=report.language or "en")
agent_result = await manager_crew.kickoff({
    "message": sanitized_description,
    "user_id": str(current_user.id),
    "tenant_id": str(current_user.tenant_id),
    "language": report.language or "en",
    "phone": "",
    "session_status": "active",
    "user_exists": "True",
    "conversation_history": "(none)",
    "pending_intent": "none",
})
routing_phase = agent_result.get("routing_phase", "other")
_PHASE_TO_CATEGORY = {"municipal": "other", "gbv": "gbv", "auth": "other", "manager": "other"}
category = _PHASE_TO_CATEGORY.get(routing_phase, "other")
```

### Fix 3: whatsapp_service.py — corrected constructor

```python
# Source: src/agents/flows/intake_flow.py line 31 — def __init__(self, redis_url: str, llm=None)
# BEFORE (broken):
flow = IntakeFlow(redis_url=self._redis_url, llm_model="gpt-4o")  # TypeError

# AFTER (Option A — fix constructor only):
flow = IntakeFlow(redis_url=self._redis_url, llm=None)
flow._state = intake_state
# Then wrap kickoff in executor for async safety:
loop = asyncio.get_event_loop()
await loop.run_in_executor(None, flow.kickoff)
ticket_data = flow.state.ticket_data or {}
agent_response = ticket_data.get("message", "Your report is being processed.")
tracking_number = ticket_data.get("tracking_number")

# AFTER (Option B — bypass IntakeFlow, use ManagerCrew directly, recommended):
from src.agents.crews.manager_crew import ManagerCrew
manager_crew = ManagerCrew(language=conversation_state.language)
agent_result = await manager_crew.kickoff({
    "message": input_result.sanitized_message,
    "user_id": user_id,
    "tenant_id": tenant_id,
    "language": conversation_state.language,
    "phone": user.phone or "",
    "session_status": "active",
    "user_exists": "True",
    "conversation_history": _format_history(conversation_state.turns),
    "pending_intent": "none",
})
agent_response = agent_result.get("message", "Your report is being processed.")
tracking_number = agent_result.get("tracking_number")
```

### Fix 4: WhatsApp session_id stability

```python
# BEFORE (broken — new session per message):
session_id = f"wa-{payload.MessageSid}"

# AFTER (stable per phone — supports multi-turn state):
normalized_phone = sender_phone.replace("whatsapp:", "").strip()
session_id = f"wa-{normalized_phone}"
```

### Fix 5: GBV confirmation state machine in crew_server.py / whatsapp_service.py

```python
# GBV confirmation pattern (new state: "gbv_pending_confirm")
# After ManagerCrew returns routing_phase="gbv":
if agent_result.get("routing_phase") == "gbv" and routing_phase == "manager":
    # First GBV signal — enter confirmation state
    conv_state.routing_phase = "gbv_pending_confirm"
    await manager.save_state(conv_state, is_gbv=False)  # Save in non-GBV namespace until confirmed
    return confirmation_message  # See wording below

elif routing_phase == "gbv_pending_confirm":
    # Second turn — citizen must confirm
    lower_msg = request.message.lower()
    positive = any(w in lower_msg for w in ["yes", "ja", "yebo", "confirm", "okay", "ok"])
    negative = any(w in lower_msg for w in ["no", "nee", "cha", "cancel", "stop"])

    if positive:
        # Confirmed — route to GBV crew
        conv_state.routing_phase = "gbv"
        await manager.save_state(conv_state, is_gbv=True)
        # Now run GBVCrew
        gbv_crew = GBVCrew(language=detected_language)
        agent_result = await gbv_crew.kickoff(manager_context)
        # GBVCrew internally calls create_municipal_ticket + notify_saps

    elif negative:
        # Declined — treat as regular municipal ticket
        conv_state.routing_phase = "municipal"
        await manager.save_state(conv_state, is_gbv=False)
        # Route to municipal intake or send acknowledgment
        reply = "Understood. If you need to report a service issue, I'm here to help."
```

**Trauma-informed GBV confirmation message:**
```python
GBV_CONFIRMATION_MESSAGE = (
    "I hear you, and your safety is the most important thing right now. "
    "I'd like to create a confidential report and alert emergency services on your behalf. "
    "Can I go ahead and do that?\n\n"
    "Reply YES to confirm, or NO if you'd prefer not to.\n\n"
    "Emergency: SAPS 10111 | GBV Command Centre: 0800 150 150"
)
```

### Fix 6: Helper function for conversation history formatting

Both messages.py and whatsapp_service.py will need to format conversation history to pass to ManagerCrew. crew_server.py already has this:

```python
# Already exists in crew_server.py — copy to shared utility or import
def _format_history(turns: list[dict]) -> str:
    """Format conversation turns as human-readable string for crew injection."""
    if not turns:
        return "(none)"
    lines = []
    for turn in turns:
        role = turn.get("role", "user").capitalize()
        content = turn.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `IntakeFlow(llm_model="gpt-4o")` | `IntakeFlow(redis_url=..., llm=None)` | Phase 6.9 | 3 call sites broken |
| `flow.receive_message()` then `flow.classify_message()` | Single `@start()` method `receive_and_route()` via `flow.kickoff()` | Phase 6.9 | reports.py crashes at runtime |
| Keyword-based classification → specialist crew routing | ManagerCrew (LLM-based, Process.hierarchical) | Phase 6.9 | All intent classification now LLM-driven |
| `session_id = f"wa-{payload.MessageSid}"` (per-message) | Should be `f"wa-{normalized_phone}"` (per-phone) | Now (fix needed) | GBV confirmation state lost between turns |
| No GBV confirmation step in WhatsApp path | Need `routing_phase="gbv_pending_confirm"` state | Now (new for Phase 7) | RPT-07 requirement |

**Deprecated/outdated:**
- `IntakeFlow.receive_message()`: Removed in Phase 6.9. Any call to this method is a hard AttributeError.
- `IntakeFlow.classify_message()`: Removed in Phase 6.9. Same as above.
- `llm_model: str` parameter on IntakeFlow: Removed in Phase 6.9. Replaced with `llm=None`.
- `flow.state.category` being set by flow: Was set by old classify_message(), never set by Phase 6.9 receive_and_route().

---

## Exact Files to Change

Based on codebase analysis, these are the precise locations of all bugs:

### 1. `src/api/v1/messages.py` — Line 180
```
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")  # WRONG: llm_model kwarg
```
Fix: Change to `llm=None` OR bypass IntakeFlow and call ManagerCrew directly.
Also update lines 191-203 to read response from `flow.state.ticket_data.get("message")`.

### 2. `src/api/v1/reports.py` — Lines 90-100
```
flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")  # WRONG: llm_model kwarg
flow.receive_message()   # WRONG: method removed
flow.classify_message()  # WRONG: method removed
```
Fix: Replace with ManagerCrew.kickoff() call for classification.

### 3. `src/services/whatsapp_service.py` — Line 280
```
flow = IntakeFlow(redis_url=self._redis_url, llm_model="gpt-4o")  # WRONG: llm_model kwarg
```
Fix: Change to `llm=None` OR bypass IntakeFlow.
Also fix session_id from per-MessageSid to per-phone (in whatsapp.py line 188).

### 4. `src/api/v1/whatsapp.py` — Line 188
```
session_id = f"wa-{payload.MessageSid}"  # WRONG: new session per message
```
Fix: `session_id = f"wa-{normalized_phone}"` where normalized_phone is from lookup_user_by_phone's normalized value.

### 5. GBV confirmation (new logic)
Add to either crew_server.py's `chat()` function or whatsapp_service.py's `process_incoming_message()`:
- Handle `routing_phase == "gbv_pending_confirm"` state
- Route GBV reports through two-turn confirmation before calling GBVCrew

---

## Open Questions

1. **IntakeFlow async in FastAPI context**
   - What we know: `flow.kickoff()` is sync, `receive_and_route()` is async. FastAPI endpoints are async.
   - What's unclear: Whether `flow.kickoff()` raises RuntimeError when called from async context in production (vs test environment). Tests may not catch this.
   - Recommendation: Bypass IntakeFlow entirely in messages.py and whatsapp_service.py — call ManagerCrew.kickoff() directly. This eliminates the async/sync boundary issue entirely and matches the working crew_server.py pattern.

2. **GBV confirmation placement**
   - What we know: The confirmation step must intercept between ManagerCrew classifying "gbv" and GBVCrew running.
   - What's unclear: Whether to add this in crew_server.py (for Streamlit path) or only in whatsapp_service.py (for Twilio path) or both.
   - Recommendation: Add to both paths — crew_server.py's `chat()` function and whatsapp_service.py's `process_incoming_message()`. The routing_phase state machine approach works identically in both.

3. **reports.py — is AI classification needed at all?**
   - What we know: reports.py already accepts `category` as a user-provided field (step 2 checks `if category is None`). The AI classification only runs when category is not provided.
   - What's unclear: How often citizens submit without a category in the web portal (ReportIssuePage.tsx). The frontend may always send a category.
   - Recommendation: Still fix the broken AI classification path, but note that the fix may rarely be exercised if frontend always sends category.

4. **Test coverage for fixed paths**
   - What we know: Existing `test_messages_api.py` uses `MockIntakeFlow` with `llm_model: str` parameter in its mock — after the fix, the mock's `__init__` signature mismatch will cause test failures.
   - What's unclear: Whether tests pass against the old broken code or are also broken.
   - Recommendation: Update `MockIntakeFlow` to use `llm=None` parameter, and add integration tests that verify end-to-end ticket creation.

---

## Sources

### Primary (HIGH confidence)
- `src/agents/flows/intake_flow.py` — Direct code inspection, `__init__` signature `(self, redis_url: str, llm=None)`, single `@start()` method `receive_and_route()`
- `src/api/v1/messages.py` — Direct code inspection, line 180 bug confirmed: `llm_model="gpt-4o"`
- `src/api/v1/reports.py` — Direct code inspection, lines 90-100 bugs confirmed: `receive_message()`, `classify_message()`, `llm_model="gpt-4o"`
- `src/services/whatsapp_service.py` — Direct code inspection, line 280 bug confirmed: `llm_model="gpt-4o"`
- `src/agents/crews/manager_crew.py` — Direct code inspection, `async kickoff()` with `run_in_executor`, `parse_result()` returning dict with `message`, `routing_phase`, `tracking_number`
- `src/api/v1/crew_server.py` — Reference implementation, correct ManagerCrew usage pattern
- `.planning/v1.0-MILESTONE-AUDIT.md` — Authoritative audit confirming bugs and broken integration paths
- `07-CONTEXT.md` — User decisions constraining implementation approach

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase history confirming "Phase 06.7-03: Crews accept llm=None (not llm_model: str)" as the change that created the break
- `tests/test_messages_api.py` — Shows existing MockIntakeFlow uses `llm_model: str` — needs updating

---

## Metadata

**Confidence breakdown:**
- Bug locations: HIGH — all confirmed by direct code inspection
- Fix patterns: HIGH — derived from working reference implementation (crew_server.py)
- GBV confirmation state machine: MEDIUM — designed from first principles; routing_phase state approach is consistent with existing Phase 6.9 patterns
- Async/sync boundary: MEDIUM — recommendation to bypass IntakeFlow is safe bet; exact behavior of `flow.kickoff()` in async context requires runtime verification

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable — no external dependencies, all internal codebase)
