# Story 3.3: Maintain Stable Order Semantics and Visual Feedback

Status: ready-for-dev

Epic: 3 - Task Prioritization by Drag and Reorder  
Story ID: 3.3  
Estimation: M (2-4 days)  
Dependencies: Stories 3.1 and 3.2 implemented; Epic 2 completion and task-card behavior available.

## Story

As a planner,  
I want reorder interactions to feel stable and clear,  
so that I trust the board state while reprioritizing tasks.

## Acceptance Criteria

1. Given a drag starts, when the pointer or keyboard reaches a valid drop zone, then the target is visibly and semantically identifiable as droppable.
2. Given a drag reaches an invalid target, when the user attempts to drop, then the target is rejected and the task remains in its previous authoritative location.
3. Given a successful reorder or move, when the board settles, then the task is shown in its final position with subtle confirmation feedback and no disruptive animation.
4. Given the client has stale ordering, when the server detects a version conflict, then the client replaces its local order with the authoritative snapshot and explains that the board changed.
5. Given completed tasks are present, when active or completed tasks are reordered or moved, then completion styling, visibility, and reopen behavior remain unchanged.
6. Given assistive technology or keyboard-only usage, when reorder/move controls are used, then labels, announcements, focus, and error feedback identify the result without relying on color alone.
7. Given rapid repeated mutations, when responses arrive out of order, then stale responses cannot overwrite a newer authoritative board state.

## Scope Boundaries

- Harden and unify the interaction and reconciliation paths from Stories 3.1 and 3.2.
- Do not change the underlying task lifecycle or introduce real-time collaboration.
- Do not add decorative motion or a new visual language.

## Tasks / Subtasks

### Task 1 - Stable ordering and conflict reconciliation

- [ ] Define one client mutation state model for pending reorder/move, rollback, conflict, and authoritative refetch.
- [ ] Ensure mutation responses are associated with an operation/version so late responses cannot overwrite newer state.
- [ ] Reconcile conflict responses by invalidating/refetching affected week queries and preserving task identity.
- [ ] Verify server reindexing produces deterministic order after insert, delete, reorder, and move.

### Task 2 - Drag/drop and keyboard feedback

- [ ] Add clear insertion markers and invalid-target states to existing lane components.
- [ ] Provide keyboard reorder commands for same-lane movement and an accessible move path for cross-lane destinations.
- [ ] Preserve focus on the moved task or destination control after success, rollback, cancel, and conflict.
- [ ] Add live-region or equivalent announcements for successful, failed, canceled, and conflicted operations.
- [ ] Keep confirmation feedback subtle and compatible with reduced-motion preferences.

### Task 3 - Regression coverage

- [ ] Add frontend tests for valid/invalid target semantics, focus, announcements, reduced motion, rollback, conflict refetch, and out-of-order responses.
- [ ] Add backend tests for stable reindexing and conflict behavior across reorder and move operations.
- [ ] Add a regression covering completed tasks with execution time before and after move/reorder.
- [ ] Run focused tests, full frontend/backend tests where practical, lint, builds, and migration checks.

## Developer Context

- Reuse existing board components and styles; avoid duplicating a second drag/drop implementation for each lane type.
- Keep status and placement independent: reorder/move must never implicitly complete, reopen, or delete a task.
- Use non-color indicators and text/ARIA feedback for invalid, successful, and conflicted states.
- Follow the product motion policy: subtle functional feedback only, with reduced-motion support.

## Definition of Done

- Pointer and keyboard users receive equivalent, understandable reorder capability.
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
