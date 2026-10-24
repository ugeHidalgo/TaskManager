# Bug: Move here to the previous week could fail with a stale snapshot conflict

Status: Fixed
Type: Functional defect
Epic: 3 - Task Prioritization by Drag and Reorder
Related stories: 3.2 - Move tasks across day columns and shared week section; 3.3 - Maintain Stable Order Semantics and Visual Feedback

## Reproduction

1. Start Move from a task's three-dot menu.
2. Navigate to the previous week and select `Move here` (for example, Monday).
3. If the destination week's initial board request is still loading, the move could return `409 task.move.conflict` with “The week changed while the request was being prepared.” The task remains in the source week and the UI reports that it reloaded the board.

## Cause

Move preflight loaded destination tasks and computed a destination snapshot hash in the browser. In the timing window where the destination workspace had not yet been initialized by its initial board request, the server had no authoritative destination snapshot to validate and rejected the move. A locally calculated hash is not an authoritative replacement for creating/loading the destination board snapshot.

## Fix

For a cross-week move, the client now loads destination tasks and the destination board snapshot together. The board request ensures an empty destination workspace is initialized and supplies the canonical server snapshot version. The move uses that version rather than a browser-derived hash; same-week moves continue to reuse their source snapshot. Genuine concurrent changes still produce a conflict and are reconciled normally.

## Verification

- Added a real Chromium/API/PostgreSQL regression that starts Move, navigates to the previous week, holds that week's first board snapshot request open, and immediately selects Monday's `Move here` action. The move succeeds and the submitted destination version matches the server response.
- The destination week is five weeks ahead when the test starts so it is normally uninitialized; the intercepted initial board request is deliberately not sent to the API. The regression covers the initialization race deterministically.
- Frontend unit suite: **114 passed**.
- Real Playwright suite: **5 passed, 1 skipped**. The existing stable-order test skips when its selected week already contains tasks rather than changing unrelated user data.
- ESLint, TypeScript/production build and `git diff --check` passed.

## Regression test

- [Previous-week Move here race regression](../../../src/frontend/tests/integration/move-task-to-previous-week.integration.ts)
- [Move snapshot preflight](../../../src/frontend/src/pages/BoardPage.tsx)
