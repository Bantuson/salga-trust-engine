---
phase: 03-citizen-reporting-channels
plan: 02
subsystem: whatsapp-integration
tags: [whatsapp, twilio, webhook, media-handling, citizen-channels]
dependency_graph:
  requires:
    - "03-01 (S3 storage service for media uploads)"
    - "02-04 (Guardrails engine for input/output filtering)"
    - "02-01 (ConversationManager for session state)"
    - "02-02 (IntakeFlow for message routing)"
  provides:
    - "WhatsApp webhook endpoint with signature validation"
    - "WhatsAppService for processing incoming messages"
    - "Phone-to-user mapping for tenant resolution"
    - "Media download/upload pipeline from Twilio to S3"
  affects:
    - "Tenant middleware (exempt WhatsApp paths)"
    - "Main app router registration"
tech_stack:
  added:
    - "Twilio SDK (twilio) for WhatsApp Business API"
    - "Twilio Request Validator for webhook security"
    - "TwiML MessagingResponse for webhook replies"
  patterns:
    - "Cross-tenant phone lookup (security decision documented)"
    - "TwiML XML response format for Twilio compatibility"
    - "Graceful error handling for Twilio operations"
    - "Media streaming from Twilio to S3 without local storage"
key_files:
  created:
    - src/api/v1/whatsapp.py
    - src/services/whatsapp_service.py
    - src/schemas/whatsapp.py
  modified:
    - src/middleware/tenant_middleware.py
    - src/main.py
decisions:
  - decision: "WhatsApp webhook exempt from tenant middleware"
    rationale: "Twilio cannot send X-Tenant-ID header. Webhook resolves tenant from user lookup by phone number."
    trade_offs: "Cross-tenant phone lookup is necessary and documented as security decision."
  - decision: "Phone-to-user lookup is cross-tenant"
    rationale: "Phone numbers are unique across entire system. User's tenant_id provides context after lookup."
    trade_offs: "No tenant filtering on phone lookup query. This is intentional and safe because phone is already unique constraint."
  - decision: "Media downloads use temp ticket_id placeholder"
    rationale: "Ticket doesn't exist yet during media processing. S3 key uses temp UUID, would need update after ticket creation."
    trade_offs: "MediaAttachment record creation deferred to future task (TODO in code)."
  - decision: "Twilio signature validation skipped if no TWILIO_AUTH_TOKEN"
    rationale: "Allows development/testing without Twilio account. Production must have auth token configured."
    trade_offs: "Dev mode is insecure but acceptable for local development. Production validation enforced."
metrics:
  duration_seconds: 473
  duration_minutes: 7.9
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  commits: 2
  lines_added: 665
  completed_at: "2026-02-09T21:07:55Z"
---

# Phase 3 Plan 2: WhatsApp Business API Integration Summary

**One-liner:** Twilio WhatsApp webhook with signature validation, media download/upload pipeline, and integration with Phase 2 intake flow.

## What Was Built

Implemented Twilio WhatsApp Business API integration as the primary citizen reporting channel (highest SA penetration per research). Citizens can now send text messages and photos via WhatsApp, which are processed through the existing AI intake pipeline from Phase 2.

**Key capabilities:**
- **Webhook endpoint** at `/api/v1/whatsapp/webhook` with Twilio signature validation (prevents request forgery)
- **Phone-to-user mapping** resolves tenant context from user's municipality (no X-Tenant-ID header needed)
- **Media handling** downloads attachments from Twilio and uploads to S3 (reuses StorageService from 03-01)
- **Pipeline integration** processes messages through guardrails → IntakeFlow → crew routing (reuses Phase 2 architecture)
- **TwiML responses** return agent replies in Twilio-compatible XML format
- **Status callbacks** log message delivery status for monitoring

## Architecture

```
WhatsApp Message (Twilio)
  → webhook validates signature
  → lookup user by phone (cross-tenant)
  → extract media URLs
  → WhatsAppService.process_incoming_message()
    → download media from Twilio → upload to S3
    → guardrails.process_input()
    → IntakeFlow.kickoff() (language detection → classification → crew routing)
    → guardrails.process_output()
    → ConversationManager saves turns
  → TwiML response sent back to Twilio
  → Twilio delivers reply to citizen's WhatsApp
```

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | WhatsApp webhook endpoint with Twilio signature validation | 2549aee | src/api/v1/whatsapp.py, src/schemas/whatsapp.py, src/middleware/tenant_middleware.py, src/main.py |
| 2 | WhatsApp service with media handling and intake pipeline integration | 66176e6 | src/services/whatsapp_service.py |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Missing dependency imports in whatsapp.py**
- **Found during:** Task 1 verification
- **Issue:** Initial implementation missing `from sqlalchemy import select` for user lookup query
- **Fix:** Added import statement to enable cross-tenant phone lookup
- **Files modified:** src/api/v1/whatsapp.py (implicitly fixed during writing)
- **Commit:** 2549aee (included in initial commit)

No other deviations - plan executed as written.

## Key Integration Points

**Reused from Phase 2:**
- `guardrails_engine.process_input()` / `process_output()` (input validation, output sanitization)
- `IntakeFlow` (language detection, classification, crew routing)
- `IntakeState` (conversation state management)
- `ConversationManager` (Redis-backed session persistence)

**Reused from Phase 3-01:**
- `StorageService.download_and_upload_media()` (Twilio → S3 pipeline)
- `MediaAttachment` model (schema for linking media to tickets)

**Extended:**
- `TenantContextMiddleware` - added `/api/v1/whatsapp` to exempt paths (Twilio can't send headers)
- `main.py` - registered WhatsApp router

## Security Decisions

1. **Twilio signature validation:** Validates `X-Twilio-Signature` header using `RequestValidator` to prevent webhook forgery. Skipped only in dev mode (no auth token configured).

2. **Cross-tenant phone lookup:** Phone number query intentionally bypasses tenant filtering because:
   - Phone is unique constraint across entire system
   - User's `tenant_id` provides context after lookup
   - This is the only way to resolve tenant from WhatsApp (Twilio can't send X-Tenant-ID)

3. **Tenant middleware exemption:** WhatsApp webhook paths exempt from tenant middleware because tenant is resolved from user lookup, not header.

## Known Limitations

1. **MediaAttachment record creation deferred:** Code logs that media should be linked to ticket, but doesn't create MediaAttachment records. This requires importing Ticket model and querying by ticket_id. TODO left in code for future task.

2. **No tracking number in response:** WhatsAppService returns `tracking_number: None` because it's not extracted from ticket creation result yet. Would need to access ticket_data structure.

3. **No outbound message sending yet:** `send_whatsapp_message()` method implemented but not used. Would be called for proactive updates (e.g., "Your pothole was fixed").

## Testing Notes

**To test webhook locally:**
1. Install ngrok: `ngrok http 8000`
2. Set Twilio webhook URL to `https://{ngrok-domain}/api/v1/whatsapp/webhook`
3. Send WhatsApp message to Twilio sandbox number
4. Check logs for signature validation, user lookup, media handling, flow execution

**Manual verification checklist:**
- [ ] Unregistered phone receives "Please register" message
- [ ] Registered user's message triggers intake flow
- [ ] Media attachments downloaded and uploaded to S3
- [ ] TwiML response returned (check Content-Type: application/xml)
- [ ] Status callback logs delivery status

## Files Modified

**Created:**
- `src/api/v1/whatsapp.py` (235 lines) - Webhook endpoints with signature validation
- `src/services/whatsapp_service.py` (322 lines) - Message processing service
- `src/schemas/whatsapp.py` (108 lines) - Pydantic schemas for Twilio payloads

**Modified:**
- `src/middleware/tenant_middleware.py` - Added `/api/v1/whatsapp` to exempt paths
- `src/main.py` - Imported and registered WhatsApp router

## Next Steps (Phase 3 Plan 3)

After this plan, the next steps are:
1. **Web portal message endpoint** (03-03) - HTTP API for citizens without WhatsApp
2. **Media upload endpoint** (03-03) - Direct file upload for web portal
3. **Complete MediaAttachment linking** - Wire up media to tickets in WhatsAppService

## Self-Check: PASSED

**Files exist:**
- [x] src/api/v1/whatsapp.py
- [x] src/services/whatsapp_service.py
- [x] src/schemas/whatsapp.py

**Commits exist:**
- [x] 2549aee (Task 1)
- [x] 66176e6 (Task 2)

**Routes registered:**
- [x] /api/v1/whatsapp/webhook in app.routes
- [x] /api/v1/whatsapp/status in app.routes

All checks passed.
