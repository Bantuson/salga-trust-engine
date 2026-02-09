---
phase: 02-agentic-ai-system
plan: 01
subsystem: agentic-infrastructure
tags: [language-detection, conversation-state, ticket-model, redis, lingua-py]
dependency-graph:
  requires: [Phase 1 foundation, PostgreSQL, Redis]
  provides: [LanguageDetector, ConversationManager, Ticket model, Ticket schemas]
  affects: [Phase 2 Plans 02-04, Phase 3 intake channels]
tech-stack:
  added: [lingua-language-detector, tiktoken, fakeredis]
  patterns: [singleton language detector, Redis-backed state, enum-based categories]
key-files:
  created:
    - src/core/language.py
    - src/core/conversation.py
    - src/models/ticket.py
    - src/schemas/ticket.py
    - alembic/versions/2026_02_09_1545-02_01_ticket_model.py
    - tests/test_language.py
    - tests/test_conversation.py
  modified:
    - pyproject.toml
    - src/models/__init__.py
    - src/schemas/__init__.py
decisions:
  - key: "Deferred CrewAI installation"
    rationale: "ChromaDB dependency requires C++ build tools on Windows. Core functionality (lingua, tiktoken, fakeredis) installed successfully. CrewAI will be added in later plan when agents are actually needed."
    impact: "Plan execution unblocked. Agent framework deferred to Plan 02-02."
  - key: "Short text fallback threshold (20 chars)"
    rationale: "Research showed language detection unreliable for short messages. Falls back to user's preferred language."
    impact: "Prevents false detection on 'ok', 'yes', single words."
  - key: "Confidence threshold (0.7)"
    rationale: "Minimum confidence to avoid ambiguous language detection."
    impact: "Ensures reliable trilingual detection for EN/ZU/AF."
  - key: "GBV/municipal namespace separation"
    rationale: "Security requirement - GBV conversations isolated in Redis."
    impact: "Prevents accidental cross-contamination of sensitive data."
  - key: "Max 20 turns per conversation"
    rationale: "Safety limit to prevent infinite loops or stuck conversations."
    impact: "Conversations terminate after 20 turns. Research-backed."
  - key: "Separate lat/lng columns (not PostGIS yet)"
    rationale: "PostGIS geospatial queries deferred to Phase 4."
    impact: "Simple Float columns for now. Migration path for future ST_Point."
metrics:
  duration: 14.2m
  tasks-completed: 2
  files-created: 7
  files-modified: 3
  tests-added: 23
  test-pass-rate: 100%
  completed-date: 2026-02-09
---

# Phase 02 Plan 01: Agentic AI Infrastructure Summary

**One-liner:** Trilingual language detection (EN/ZU/AF) with lingua-py, Redis-backed conversation state management with GBV/municipal namespace separation, and Ticket data model for agent intake output.

## What Was Built

### Language Detection Module (`src/core/language.py`)

- **LanguageDetector singleton** using lingua-py for EN/ZU/AF detection
- Confidence threshold (0.7) to avoid false positives
- Short text fallback (<20 chars) to user's preferred language
- `detect()` method returns ISO code ("en", "zu", "af")
- `detect_with_confidence()` for debugging/logging

**Key implementation details:**
- Uses `LanguageDetectorBuilder.from_languages()` with 3 languages only
- Minimum relative distance 0.25 to distinguish similar languages
- Fallback scenarios: short text, no detection, low confidence

### Conversation State Manager (`src/core/conversation.py`)

- **ConversationManager** class with Redis async connection
- **ConversationState** Pydantic model tracks:
  - User ID, session ID, tenant ID, language
  - Category (municipal/GBV)
  - Turn history (role, content, timestamp)
  - Collected data (partial ticket info)
  - Safety: max 20 turns per conversation

**Namespace separation:**
- Municipal: `conv:municipal:{user_id}:{session_id}`
- GBV: `conv:gbv:{user_id}:{session_id}`
- Prevents accidental data mixing

**Lifecycle methods:**
- `create_session()` - Initialize new conversation
- `get_state()` - Retrieve existing state
- `append_turn()` - Add user/agent turn with max_turns enforcement
- `save_state()` - Persist with TTL (default 1 hour)
- `clear_session()` - Delete after ticket creation (data minimization)

### Ticket Model (`src/models/ticket.py`)

- **Ticket** SQLAlchemy model (TenantAwareModel)
- **Enums:** TicketCategory, TicketStatus, TicketSeverity
- **Tracking number:** TKT-YYYYMMDD-{6_random_hex} (unique)
- **Fields:**
  - category (water/roads/electricity/waste/sanitation/gbv/other)
  - description (text)
  - location (lat/lng/address - PostGIS deferred to Phase 4)
  - severity (low/medium/high/critical, default: medium)
  - status (open/in_progress/escalated/resolved/closed, default: open)
  - language (en/zu/af)
  - user_id, assigned_to (foreign keys to users)
  - is_sensitive (True for GBV tickets)
  - resolved_at (timestamp)

### Ticket Schemas (`src/schemas/ticket.py`)

- **TicketCreate** - API creation schema with validators
- **TicketResponse** - API response schema (from_attributes)
- **TicketUpdate** - Partial update schema
- **TicketData** - Agent intake structured output schema (min 20 char description)

All schemas validate category/severity/status against enum values.

### Database Migration

- **File:** `alembic/versions/2026_02_09_1545-02_01_ticket_model.py`
- Creates `tickets` table with all fields
- Indexes: tenant_id, category, status, user_id, tracking_number (unique)
- Foreign keys: user_id, assigned_to → users.id
- Revision ID: `02_01_ticket`
- Revises: `7f9967035b32` (Phase 1 RLS policies)

### Tests

**Language detection tests (13 tests):**
- English, isiZulu, Afrikaans detection
- Short text fallback (default and custom)
- Empty string fallback
- Confidence score validation
- Longer text for higher confidence
- Ambiguous text fallback

**Conversation manager tests (10 tests):**
- Create, get, append, clear sessions
- Max turns enforcement (ValueError after 20)
- GBV/municipal namespace separation
- Clear GBV doesn't affect municipal
- Uses fakeredis (no real Redis needed)

**All 23 tests pass. Phase 1 tests still pass (no regressions).**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] CrewAI installation blocked by C++ build tools**
- **Found during:** Task 1 dependency installation
- **Issue:** `crewai[tools]` dependency pulls in ChromaDB which requires chroma-hnswlib. On Windows, this needs Microsoft Visual C++ 14.0+ build tools to compile native extensions.
- **Fix:** Removed `crewai[tools]` from pyproject.toml temporarily. Installed core dependencies (lingua-language-detector, tiktoken, fakeredis) successfully.
- **Files modified:** pyproject.toml
- **Commit:** e0170da (included in Task 1 commit)
- **Rationale:** CrewAI not used in THIS plan - it's needed for Plans 02-02 onwards when we build actual agents. Blocking entire plan for unused dependency is wasteful. Core infrastructure (language detection, conversation state, ticket model) unaffected.
- **Next steps:** Will revisit CrewAI installation in Plan 02-02 when agents are built. Options: prebuilt ChromaDB wheels, Conda, or install C++ build tools.

## Verification Results

All verification commands passed:

```bash
# Language detection
$ pytest tests/test_language.py -v
# 13 passed in 2.69s

$ python -c "from src.core.language import language_detector; print(language_detector.detect('Hello world'))"
# en

$ python -c "from src.core.language import language_detector; print(language_detector.detect('Amanzi ami ayaphuma'))"
# zu

# Conversation manager
$ pytest tests/test_conversation.py -v
# 10 passed in 1.19s

$ python -c "from src.core.conversation import ConversationManager; print('OK')"
# OK

# Ticket model and schemas
$ python -c "from src.models.ticket import Ticket, TicketCategory; print(list(TicketCategory))"
# [<TicketCategory.WATER: 'water'>, <TicketCategory.ROADS: 'roads'>, ...]

$ python -c "from src.schemas.ticket import TicketCreate, TicketResponse; print('OK')"
# OK

# Phase 1 regression check
$ pytest tests/ -v -m "not integration" --ignore=tests/test_language.py --ignore=tests/test_conversation.py
# 22 passed, 47 deselected in 5.37s (ALL PHASE 1 TESTS PASS)
```

## Success Criteria Validation

- [x] Language detector identifies EN/ZU/AF correctly with >= 0.7 confidence threshold
- [x] Short text (<20 chars) falls back to preferred language
- [x] Conversation state manager creates, reads, updates, and deletes sessions via Redis
- [x] GBV conversations use separate Redis namespace from municipal conversations
- [x] Ticket model has all required fields (category, description, location, severity, status, user link)
- [x] Ticket Pydantic schemas validate agent intake output
- [x] All unit tests pass (23/23)
- [x] All Phase 1 tests still pass (22/22 unit tests)

## Authentication Gates

None. No external service authentication required for this plan.

## Next Steps

**Plan 02-02:** Build CrewAI agent framework with manager + specialist agents

**Prerequisites:**
- Resolve CrewAI installation (C++ build tools or prebuilt wheels)
- Define agent roles (manager, water, roads, electricity, waste, sanitation, GBV)
- Implement agent communication patterns

**Unblocked:**
- Phase 2 Plans 02-03, 02-04 (use LanguageDetector and ConversationManager)
- Phase 3 intake channels (use Ticket model)

## Commits

| Hash | Message |
|------|---------|
| e0170da | feat(02-01): add trilingual language detection with lingua-py |
| f281c12 | feat(02-01): add conversation manager and ticket model |

## Self-Check: PASSED

**Created files verified:**
- [x] src/core/language.py exists
- [x] src/core/conversation.py exists
- [x] src/models/ticket.py exists
- [x] src/schemas/ticket.py exists
- [x] alembic/versions/2026_02_09_1545-02_01_ticket_model.py exists
- [x] tests/test_language.py exists
- [x] tests/test_conversation.py exists

**Commits verified:**
- [x] e0170da exists in git history
- [x] f281c12 exists in git history

**Tests verified:**
- [x] 23/23 tests pass
- [x] 22/22 Phase 1 unit tests still pass

All claims validated. Plan executed successfully.
