# Story 3.3: Maintain Stable Order Semantics and Visual Feedback

Status: review

Epic: 3 - Task Prioritization by Drag and Reorder  
Story ID: 3.3  
Estimation: M (2-4 days)  
Dependencies: Stories 3.1 and 3.2 implemented; Epic 2 completion and task-card behavior available.

## Story

As a planner,  
I want reorder interactions to feel stable and clear,  
so that I trust the board state while reprioritizing tasks.

## Acceptance Criteria

1. Given a drag starts, when the pointer reaches a valid drop zone, then the target is visibly and semantically identifiable as droppable.
2. Given a drag reaches an invalid target, when the user attempts to drop, then the target is rejected and the task remains in its previous authoritative location.
3. Given a successful reorder or move, when the board settles, then the task is shown in its final position with subtle confirmation feedback and no disruptive animation.
4. Given the client has stale ordering, when the server detects a version conflict, then the client replaces its local order with the authoritative snapshot and explains that the board changed.
5. Given completed tasks are present, when active or completed tasks are reordered or moved, then completion styling, visibility, and reopen behavior remain unchanged.
6. Given assistive technology or keyboard-only usage, when the accessible move flow is used, then labels, announcements, focus, and error feedback identify the result without relying on color alone. Pointer reorder retains meaningful labels, focus restoration and announcements; keyboard reordering within a lane is out of scope.
7. Given rapid repeated mutations, when responses arrive out of order, then stale responses cannot overwrite a newer authoritative board state.

## Scope Boundaries

- Harden and unify the interaction and reconciliation paths from Stories 3.1 and 3.2.
- Do not change the underlying task lifecycle or introduce real-time collaboration.
- Do not add decorative motion or a new visual language.
- Keyboard reordering is excluded by the user's scope decision on 2026-10-03. Preserve the existing keyboard-operable cross-lane/week Move here flow; do not add arrow-key reorder commands or up/down reorder buttons.

## Tasks / Subtasks

### Task 1 - Stable ordering and conflict reconciliation

- [x] Define one client mutation state model for pending reorder/move, rollback, conflict, and authoritative refetch.
- [x] Ensure mutation responses are associated with an operation/version so late responses cannot overwrite newer state.
- [x] Reconcile conflict responses by invalidating/refetching affected week queries and preserving task identity.
- [x] Verify server reindexing produces deterministic order after insert, delete, reorder, and move.

### Task 2 - Drag/drop and accessible move feedback

- [x] Add clear insertion markers and invalid-target states to existing lane components.
- [x] Preserve the accessible move path for cross-lane destinations without adding keyboard reorder commands.
- [x] Preserve focus on the moved task or destination control after success, rollback, cancel, and conflict.
- [x] Add live-region or equivalent announcements for successful, failed, canceled, and conflicted operations.
- [x] Keep confirmation feedback subtle and compatible with reduced-motion preferences.

### Task 3 - Regression coverage

- [x] Add frontend tests for valid/invalid target semantics, focus, announcements, reduced motion, rollback, conflict refetch, and out-of-order responses.
- [x] Add backend tests for stable reindexing and conflict behavior across reorder and move operations.
- [x] Add a regression covering completed tasks with execution time before and after move/reorder.
- [x] Run focused tests, full frontend/backend tests where practical, lint, builds, and migration checks.

## Developer Context

- Reuse existing board components and styles; avoid duplicating a second drag/drop implementation for each lane type.
- Keep status and placement independent: reorder/move must never implicitly complete, reopen, or delete a task.
- Use non-color indicators and text/ARIA feedback for invalid, successful, and conflicted states.
- Follow the product motion policy: subtle functional feedback only, with reduced-motion support.

## Definition of Done

- Pointer users receive clear reorder capability; keyboard users retain the understandable, accessible Move here flow. Same-lane keyboard reorder is not required.
- Invalid drops are prevented and stale/conflicting state is reconciled from the server.
- Focus and announcements remain predictable through success, failure, cancellation, and conflict.
- Completed tasks and execution-time display rules remain intact.
- No late response can corrupt the visible order.
- Focused tests and quality gates pass.

## References

- `_bmad-output/implementation-artifacts/epic-3-context.md`
- `_bmad-output/planning-artifacts/epics.md#Story 3.3: Maintain Stable Order Semantics and Visual Feedback`
- `_bmad-output/planning-artifacts/architecture.md#Frontend Architecture`
- `_bmad-output/implementation-artifacts/epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md`
- `_bmad-output/implementation-artifacts/epic-2/2-3-add-task-execution-time.md`

## Implementation and verification — 2026-10-03

- Scope explicitly excludes keyboard reordering. The existing keyboard-operable Move here flow remains available, including Escape/cancel, labels, announcements and focus restoration.
- Move/reorder share one pending/reconciling operation model. A monotonically increasing board generation invalidates old responses on navigation, logout and unmount; late success, errors, reconciliation responses and focus callbacks cannot replace newer visible state.
- Reorder sends `snapshotVersion`. The backend checks the authoritative week snapshot before mutation and returns `409 task.order.conflict` for stale clients. The optional field preserves compatibility with older clients; legacy callers omitting it do not receive snapshot-based stale protection.
- Errors and conflicts refetch the visible week's tasks and board snapshot. The user receives an explicit board-changed message; fallback restores the prior state and requests reload if reconciliation fails. No hidden affected-week cache is kept by this board.
- Deletion reloads compacted sibling indexes; status updates retain authoritative timestamps. Snapshot hashing uses `js-sha256` so reorder/move remain usable over non-secure self-hosted HTTP.
- Lane/card insertion markers expose textual valid/invalid states and accessible descriptions, including empty lanes. Lane drag/drop callbacks run only once through the section, preventing duplicate moves. Completion/time presentation remains unchanged.
- Independent review found and verified fixes for moving while a destination week is still loading, reorder after deletion, HTTP snapshot hashing and response/focus leakage across unmount.

### Quality gates

- Full frontend suite: **110 passed**, including **27** dedicated ordering/reconciliation regressions and lane feedback tests.
- Full backend suite: **77 passed**, including authenticated HTTP/PostgreSQL stale-reorder conflicts, deterministic reindexing, move rollback and identity/field preservation.
- Real Chromium/API/PostgreSQL integrations: **2 passed** after rebuilding frontend/backend, including US3.3 pointer reorder, stale conflict, keyboard Move here, cancellation/focus, completed execution-time presentation and computed reduced-motion styles; recurring creation regression also remains green.
- Frontend lint, TypeScript/production build and `git diff --check` passed. Backend compilation passed with six existing warnings. No schema change or migration was required; integration startup applied/checked existing migrations against PostgreSQL successfully.
- Test-created tasks were cleaned up by their own IDs/unique markers; existing user task data was not removed.

### Main code and regression map

- [Board mutation/reconciliation and feedback](../../../src/frontend/src/pages/BoardPage.tsx)
- [Ordering regression suite](../../../src/frontend/src/pages/BoardPage.ordering.test.tsx)
- [Lane components and feedback tests](../../../src/frontend/src/features/board/components/WeekLayout.test.tsx)
- [Backend reorder version contract](../../../src/backend/src/TaskManager.Api/Contracts/TaskContracts.cs)
- [Backend version validation](../../../src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs)
- [Backend unit/API regressions](../../../src/backend/tests/TaskApiTests.cs)
- [Authenticated persistence/conflict regressions](../../../src/backend/tests/TaskAuthorizationTests.cs)
- [Real browser integration](../../../src/frontend/tests/integration/stable-order-feedback.integration.ts)

Implementation is ready for final human review. No commit or push was performed for this story.
