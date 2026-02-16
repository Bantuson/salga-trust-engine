---
status: resolved
trigger: "Flaky E2E test: ticket-management.spec.ts:32 - Manager can view ticket list with table"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:00:00Z
---

## Current Focus

hypothesis: allTextContents() is a snapshot (non-retrying) call that captures <th> elements during a React re-render transition when text hasn't populated yet
test: Add auto-retrying assertion (toHaveText) before using allTextContents()
expecting: Test will wait for header text to appear before asserting content
next_action: Apply fix to ticket-management.spec.ts

## Symptoms

expected: Table headers should contain text matching /tracking|id/, /status/, /category/
actual: headerText is empty string "" -- th elements exist but have no text content
errors: Error: expect(received).toMatch(expected) Expected pattern: /tracking|id/ Received string: ""
reproduction: cd e2e-tests && npx playwright test --project=public-chromium tests/municipal/ticket-management.spec.ts --reporter=list (intermittent)
started: Flaky -- passed in Runs 5, 6, 7 (110 passed). Failed only in Run 8.

## Eliminated

- hypothesis: Headers are completely missing from DOM
  evidence: headerCount > 0 (th elements exist) and tableVisible is true
  timestamp: 2026-02-16

- hypothesis: Wrong locator selector
  evidence: page.locator('thead th') matches the TicketTable component's <thead><th> structure correctly in both skeleton and data states
  timestamp: 2026-02-16

## Evidence

- timestamp: 2026-02-16
  checked: TicketTable.tsx component rendering logic
  found: Component has THREE render paths -- (1) skeleton table when isLoading=true (hardcoded headers), (2) real data table when !isLoading && tickets.length>0 (flexRender headers), (3) "No tickets found" div when !isLoading && tickets.length===0 (no table at all)
  implication: During React state transitions between loading/loaded states, there's a brief moment where DOM may be in flux

- timestamp: 2026-02-16
  checked: Test code at lines 62-73
  found: allTextContents() is a Playwright snapshot method (non-retrying). It captures whatever text is in matched elements at the instant it runs. If called during a React re-render transition, th elements may exist but have empty text content.
  implication: The 3-second waitForTimeout is not sufficient -- the timing is non-deterministic. Need auto-retrying assertion instead.

- timestamp: 2026-02-16
  checked: TicketTable skeleton vs real table header text
  found: Skeleton headers: ['Tracking #', 'Category', 'Status', 'Priority', 'Created', 'Updated', 'Deadline']. Real headers: ['Tracking #', 'Category', 'Status', 'Severity', 'Created', 'SLA Deadline', 'Address']. Note different column names between skeleton and real table.
  implication: Both states have text in th elements, but during the TRANSITION between them, the old table unmounts and new table mounts -- a brief window where th elements may be empty or absent.

## Resolution

root_cause: allTextContents() is a non-retrying snapshot call. When called during a React re-render transition (skeleton table unmounting, real table mounting), it captures <th> elements that exist in the DOM but haven't populated with text yet. The 3-second waitForTimeout is insufficient because API response timing is non-deterministic.
fix: Add auto-retrying assertion `await expect(ticketList.tableHeaders.first()).toHaveText(/.+/, { timeout: 15000 })` before calling allTextContents(). This ensures Playwright waits until at least the first <th> has non-empty text, indicating the table has fully rendered.
verification: Ran test 3 consecutive times -- all passed (12.5s, 11.8s, 23.5s). Also ran full ticket-management suite (10 passed, 1 unrelated failure on CSV export dialog).
files_changed:
  - e2e-tests/tests/municipal/ticket-management.spec.ts
