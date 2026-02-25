---
phase: 02-agentic-ai-system
plan: 03
subsystem: agentic-ai
tags: [gbv, crisis-support, saps, privacy, trauma-informed]
dependency-graph:
  requires: [02-02]
  provides: [gbv-routing, saps-notification, trauma-informed-intake]
  affects: [intake-flow, conversation-management]
tech-stack:
  added: [gbv-prompts, saps-notification]
  patterns: [memory-disabled-crew, session-clearing, data-minimization]
key-files:
  created:
    - src/agents/prompts/gbv.py
    - src/agents/tools/saps_tool.py
    - src/agents/crews/gbv_crew.py
    - tests/test_gbv_crew.py
  modified:
    - src/agents/crews/__init__.py
    - src/agents/flows/intake_flow.py
    - tests/test_intake_flow.py
decisions:
  - memory-disabled-on-gbv-crew
  - max-iter-8-for-gbv
  - saps-notification-internal-log-v1
  - no-pii-in-saps-logs
  - session-clearing-after-gbv-ticket
  - emergency-numbers-in-all-prompts
metrics:
  duration: 898s
  tasks: 2
  files: 7
  tests: 21
  completed: 2026-02-09T16:48:48Z
---

# Phase 02 Plan 03: GBV Specialist Crew with Enhanced Privacy Controls Summary

**One-liner:** GBV specialist crew with trauma-informed trilingual prompts, memory disabled for privacy, SAPS notification tool, and automatic session clearing after ticket creation.

## Objective Completion

Built GBV specialist crew that handles sensitive gender-based violence reports with fundamentally different approach from municipal services: empathetic trauma-informed prompts in EN/ZU/AF, enhanced privacy controls (memory disabled, session clearing), minimal questioning (max 8 iterations vs 10 for municipal), SAPS liaison notification, and emergency contact numbers always provided.

## What Was Built

### 1. GBV Prompts (src/agents/prompts/gbv.py)

Trauma-informed prompts in three languages with:

**English Prompt:**
- Role: "You are a trained crisis support specialist"
- Tone: Empathetic, calm, non-judgmental, never blame victim
- Information collected (minimum required):
  - Type of incident (verbal/physical/sexual/threat)
  - When it happened (approximate)
  - Location for help
  - Immediate danger status
  - Children at risk
- Explicitly DO NOT ask for perpetrator identification (SAPS investigation)
- Always provide emergency numbers: 10111 (SAPS), 0800 150 150 (GBV Command Centre)
- Reassurance: "Help is being arranged. You are not alone."
- Includes full conversation example

**isiZulu Prompt:**
- Same structure with culturally appropriate language
- "Uxolo ngalokhu okudlule kukho" (Sorry for what you're going through)
- Emergency numbers: 10111, 0800 150 150
- Full conversation example in isiZulu

**Afrikaans Prompt:**
- Same structure in Afrikaans
- "Ek is jammer vir wat jy deurgaan"
- Emergency numbers: 10111, 0800 150 150
- Full conversation example in Afrikaans

**GBV Classification Keywords:**
- English: "domestic violence", "abuse", "hitting me", "beats me", "rape", "sexual assault", "threatened"
- isiZulu: "uyangihlukumeza", "uyangishaya", "ukudlwengula", "udlame lwasekhaya"
- Afrikaans: "huishoudelike geweld", "mishandeling", "slaan my", "verkragting"

### 2. SAPS Notification Tool (src/agents/tools/saps_tool.py)

CrewAI tool for notifying SAPS liaisons when GBV tickets are created:

**Implementation (v1):**
- Creates internal log records (no SAPS API integration in v1)
- Uses dedicated `saps_notifications` logger at WARNING level (always captured)
- Logs operational data: ticket_id, tracking_number, incident_type, location_area, danger_level, timestamp
- In production, would send encrypted email to configured SAPS liaison per municipality

**Security:**
- NEVER logs victim identifying information (no names, phone numbers, full addresses)
- Only logs general location area for routing
- Danger level: "IMMEDIATE" or "STANDARD" based on is_immediate_danger flag

**Return Structure:**
```python
{
    "notified": True,
    "method": "internal_log",
    "ticket_id": "...",
    "tracking_number": "TKT-YYYYMMDD-XXXXXX",
    "danger_level": "IMMEDIATE|STANDARD",
    "timestamp": "...",
    "message": "SAPS notification queued..."
}
```

### 3. GBV Specialist Crew (src/agents/crews/gbv_crew.py)

CrewAI crew for GBV intake with enhanced privacy:

**Configuration:**
- Agent role: "Crisis Support Specialist"
- Goal: "Safely capture GBV report details in {language} and arrange help"
- Backstory: Language-specific trauma-informed prompt
- Tools: [create_municipal_ticket, notify_saps]
- max_iter: 8 (vs 10 for municipal - avoid over-questioning victims)
- allow_delegation: False
- verbose: False

**Privacy Controls:**
- memory=False on Crew (CRITICAL - prevents cross-session data leakage)
- Separate Redis namespace for GBV conversations (handled by ConversationManager)
- Session clearing after ticket creation (data minimization)

**Task:**
- Collect minimum required information
- Create ticket with category="gbv", is_sensitive=True
- Notify SAPS with ticket details
- Provide tracking number and emergency contacts

**kickoff Method:**
- Executes crew with inputs: message, language, tenant_id, user_id
- Extracts Pydantic result if available
- Forces category="gbv" if not set (safety check)
- Returns ticket data or error dict

### 4. IntakeFlow Integration (src/agents/flows/intake_flow.py)

Updated handle_gbv method from placeholder to full implementation:

**Before (Plan 02-02):**
```python
def handle_gbv(self) -> dict[str, Any]:
    self.state.error = "GBV crew not yet implemented (planned for 02-03)"
    return {"error": self.state.error}
```

**After (Plan 02-03):**
```python
async def handle_gbv(self) -> dict[str, Any]:
    # Import GBVCrew
    from src.agents.crews.gbv_crew import GBVCrew

    # Create and run GBV crew
    crew = GBVCrew(language=self.state.language, llm_model=self._llm_model)
    result = await crew.kickoff(
        message=self.state.message,
        user_id=self.state.user_id,
        tenant_id=self.state.tenant_id
    )

    # Store result
    self.state.ticket_data = result

    # Clear GBV session from Redis (data minimization)
    if "error" not in result and self.state.session_id:
        await self._conversation_manager.clear_session(
            user_id=self.state.user_id,
            session_id=self.state.session_id,
            is_gbv=True  # Use GBV namespace
        )

    self.state.is_complete = True
    return result
```

**Key Changes:**
- Now async (crew.kickoff is async)
- Instantiates GBVCrew with detected language
- Clears session after successful ticket creation with is_gbv=True
- Gracefully handles clear_session errors (ticket already created)

### 5. Comprehensive Test Suite (tests/test_gbv_crew.py)

21 tests covering all GBV functionality:

**TestGBVCrewInstantiation (4 tests):**
- Verify memory=False on created Crew
- Verify agent has correct tools (create_municipal_ticket, notify_saps)
- Verify max_iter=8 (not higher)
- Verify invalid language defaults to English

**TestGBVPrompts (5 tests):**
- Emergency numbers in English prompt (10111, 0800 150 150)
- Emergency numbers in isiZulu prompt
- Emergency numbers in Afrikaans prompt
- No prompt asks for perpetrator identification
- Prompts use trauma-informed language (EN/ZU/AF specific indicators)

**TestSAPSNotificationTool (3 tests):**
- Returns structured output with expected fields
- Standard (non-immediate) danger level
- Does NOT log PII (verified via mock logger inspection)

**TestGBVRoutingInFlow (2 tests):**
- GBV keywords trigger gbv_intake routing
- Verify GBV routing calls handle_gbv (not handle_municipal)

**TestSessionClearing (1 test):**
- Verify clear_session called with is_gbv=True after GBV ticket

**TestGBVKeywordDetection (4 tests):**
- English GBV message routes to GBV
- isiZulu GBV message routes to GBV
- Afrikaans GBV message routes to GBV
- Municipal messages do NOT route to GBV

**TestIsSensitiveFlag (2 tests):**
- GBV keywords comprehensive across 3 languages
- ticket_tool source contains is_sensitive logic for category="gbv"

**Test Infrastructure:**
- Set fake OPENAI_API_KEY for tests (CrewAI Agent initialization requirement)
- Extensive use of AsyncMock for async methods
- Mock patching for logger inspection (verify NO PII logged)

### 6. Updated IntakeFlow Test (tests/test_intake_flow.py)

Updated test_handle_gbv from placeholder to full implementation test:

**Before:**
```python
def test_handle_gbv(mock_redis_url):
    # Expected error for placeholder
    result = flow.handle_gbv()
    assert "error" in result
    assert "not yet implemented" in flow.state.error.lower()
```

**After:**
```python
@pytest.mark.asyncio
async def test_handle_gbv(mock_redis_url):
    # Mock GBVCrew.kickoff
    with patch('src.agents.crews.gbv_crew.GBVCrew.kickoff', ...):
        result = await flow.handle_gbv()
        assert "tracking_number" in result
        assert result["category"] == "gbv"
        assert flow.state.is_complete is True
        # Verify session cleared
        flow._conversation_manager.clear_session.assert_called_once_with(
            user_id="user_1", session_id="session_1", is_gbv=True
        )
```

## Deviations from Plan

None - plan executed exactly as written. All requirements met:
- GBV specialist crew with trauma-informed prompts in EN/ZU/AF
- Memory disabled on Crew
- SAPS notification tool (internal log for v1)
- IntakeFlow wiring with session clearing
- Comprehensive test suite (21 tests, all passing)

## Key Decisions

**1. Memory Disabled on GBV Crew (Critical Privacy Control)**
- **Context:** CrewAI crews can retain conversation history across sessions if memory=True
- **Decision:** Set memory=False on GBVCrew to prevent cross-session data leakage
- **Rationale:** GBV reports are highly sensitive; victim data must NEVER leak to other conversations
- **Impact:** Each GBV conversation starts fresh with no prior context
- **Location:** src/agents/crews/gbv_crew.py line 97

**2. Max Iterations = 8 for GBV (vs 10 for Municipal)**
- **Context:** Municipal agents have max_iter=10 to gather complete service request details
- **Decision:** GBV agents limited to max_iter=8 to avoid over-questioning trauma victims
- **Rationale:** Research shows re-traumatization risk from excessive questioning; collect minimum required info
- **Impact:** GBV agents must be efficient in data collection
- **Location:** src/agents/crews/gbv_crew.py line 66

**3. SAPS Notification as Internal Log (v1 Scope)**
- **Context:** No SAPS API exists for automated notification integration
- **Decision:** Log SAPS notifications internally; production would send encrypted email to configured liaison
- **Rationale:** Pragmatic v1 approach; establishes pattern for future integration
- **Impact:** SAPS liaisons must manually check logs in v1; automated in v2
- **Location:** src/agents/tools/saps_tool.py

**4. No PII in SAPS Logs (Security Requirement)**
- **Context:** SAPS notification logs could inadvertently expose victim information
- **Decision:** Log ONLY operational data (ticket_id, incident_type, general location area, danger_level)
- **Rationale:** Protect victim identity; SAPS gets full details via ticket lookup, not log entries
- **Impact:** SAPS logs are safe to store/transmit; victim privacy protected
- **Location:** src/agents/tools/saps_tool.py lines 67-73
- **Verification:** Test test_notify_saps_does_not_log_pii explicitly checks for NO PII

**5. Session Clearing After GBV Ticket Creation (Data Minimization)**
- **Context:** GBV conversations stored in Redis could persist after ticket creation
- **Decision:** Automatically call clear_session(is_gbv=True) after successful GBV ticket
- **Rationale:** POPIA data minimization principle; no reason to retain conversation after ticket exists
- **Impact:** GBV conversation data deleted from Redis immediately after ticket creation
- **Location:** src/agents/flows/intake_flow.py lines 191-203

**6. Emergency Numbers in ALL Prompts (Safety Requirement)**
- **Context:** Victims may need immediate help beyond what the system can provide
- **Decision:** Include 10111 (SAPS) and 0800 150 150 (GBV Command Centre) in all language prompts
- **Rationale:** Always provide alternative emergency contact methods; system may not be fastest path to safety
- **Impact:** Victims always have emergency numbers regardless of intake outcome
- **Location:** All three prompts in src/agents/prompts/gbv.py
- **Verification:** Tests verify emergency numbers present in EN/ZU/AF prompts

## Technical Highlights

**1. Trauma-Informed Prompt Design:**
- Non-judgmental tone: "NEVER blame the victim"
- Minimal questioning: "DO NOT ask for excessive details"
- Empathy: "I'm sorry this is happening to you"
- Reassurance: "You are not alone"
- Safety-first: "Are you safe right now?" as first question
- Emergency contacts always provided

**2. Privacy-First Architecture:**
- Memory disabled at Crew level (prevents CrewAI from retaining history)
- Separate Redis namespace (GBV conversations isolated from municipal)
- Session clearing after ticket (data minimization)
- No PII in SAPS logs (only operational data)

**3. Multilingual Crisis Support:**
- Full prompts in English, isiZulu, Afrikaans
- Culturally appropriate empathy expressions
- Emergency numbers in all languages
- Conversation examples in each language

**4. Comprehensive Test Coverage:**
- 21 tests covering all GBV functionality
- Privacy controls explicitly tested (memory=False, session clearing, no PII in logs)
- Keyword detection across all 3 languages
- Integration with IntakeFlow verified
- Mock patching for logger inspection (verify NO PII)

## Integration Points

**Requires (from previous plans):**
- 02-01: Language detection, ConversationManager, Ticket model
- 02-02: IntakeFlow routing, TicketData schema, create_municipal_ticket tool

**Provides (for future plans):**
- GBV routing capability for citizen reporting channels (Phase 3)
- SAPS notification pattern (extensible to other agencies)
- Trauma-informed prompt pattern (reusable for other sensitive topics)

**Affects:**
- intake_flow.py: handle_gbv now fully functional (was placeholder)
- conversation.py: clear_session with is_gbv parameter now used
- ticket_tool.py: is_sensitive=True for category="gbv" (existing logic, now exercised)

## Test Results

**GBV Crew Tests:**
```
21 passed in 38.58s
```

**IntakeFlow Tests (including updated GBV test):**
```
17 passed in 31.90s
```

**Coverage:**
- All GBV crew configuration tested
- All prompts verified (emergency numbers, trauma-informed language, no perpetrator questions)
- SAPS tool tested (output structure, danger levels, NO PII logging)
- Routing tested across all 3 languages
- Session clearing tested
- is_sensitive flag enforcement verified

## Files Changed

**Created:**
- src/agents/prompts/gbv.py (313 lines)
- src/agents/tools/saps_tool.py (93 lines)
- src/agents/crews/gbv_crew.py (137 lines)
- tests/test_gbv_crew.py (375 lines)

**Modified:**
- src/agents/crews/__init__.py (+2 lines: export GBVCrew)
- src/agents/flows/intake_flow.py (+29 lines: handle_gbv implementation)
- tests/test_intake_flow.py (+30 lines: async test_handle_gbv)

**Total:** 979 lines added (7 files)

## Commits

1. **4618dd3** - feat(02-03): implement GBV specialist crew with trauma-informed prompts
   - Created GBV_INTAKE_PROMPTS for EN/ZU/AF
   - Created notify_saps tool
   - Created GBVCrew with memory=False, max_iter=8
   - Emergency numbers in all language prompts
   - SAPS notification logs NO PII

2. **5a27d80** - feat(02-03): wire GBV crew into IntakeFlow with comprehensive tests
   - Updated handle_gbv to instantiate GBVCrew
   - Added session clearing after GBV ticket creation
   - Created 21 comprehensive tests
   - Updated existing intake_flow test to handle async

## Performance

- **Duration:** 898 seconds (14.97 minutes)
- **Tasks:** 2
- **Files:** 7 created/modified
- **Tests:** 21 new tests, all passing
- **Lines of code:** 979 (prompts, tools, crew, tests)

## Next Steps

With GBV routing complete, Phase 2 (Agentic AI System) has one remaining plan:

**02-04:** Agent memory and context management for multi-turn conversations

After Phase 2 completion:

**Phase 3:** Citizen reporting channels (WhatsApp via Twilio, web portal)
- GBV routing will connect to these channels
- SAPS notifications will be triggered from real citizen reports

## Self-Check: PASSED

**Created Files Verification:**
```
FOUND: src/agents/prompts/gbv.py
FOUND: src/agents/tools/saps_tool.py
FOUND: src/agents/crews/gbv_crew.py
FOUND: tests/test_gbv_crew.py
```

**Modified Files Verification:**
```
FOUND: src/agents/crews/__init__.py
FOUND: src/agents/flows/intake_flow.py
FOUND: tests/test_intake_flow.py
```

**Commits Verification:**
```
FOUND: 4618dd3
FOUND: 5a27d80
```

**Test Results:**
```
21 GBV tests: PASSED
17 IntakeFlow tests: PASSED
```

All files created, all commits exist, all tests pass.
