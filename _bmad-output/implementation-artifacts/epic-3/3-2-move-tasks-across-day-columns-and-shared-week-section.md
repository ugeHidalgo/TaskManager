# Story 3.2: Move Tasks Across Day Columns and Shared Week Section

Status: ready-for-dev

Epic: 3 - Task Prioritization by Drag and Reorder  
Story ID: 3.2  
Estimation: L (4-6 days)  
Dependencies: Story 3.1 ordering persistence and same-lane reorder completed; Epic 2 task placement and week navigation available.

## Story

As a planner,  
I want to move tasks between day columns and the shared week section, including another week,  
so that I can reassign work without recreating it.

## Acceptance Criteria

1. Given a task in any lane, when the user drops it into another day lane in the same week, then its day assignment and destination order persist and it appears exactly once.
2. Given a day task is moved to the shared-week lane, when the operation succeeds, then its day assignment becomes null and its execution-time behavior follows the existing shared-week rule.
3. Given a shared-week task is moved to a day lane, when the operation succeeds, then its destination date and order persist.
4. Given a task is moved to a lane in another week, when the operation succeeds, then the source no longer contains it, the destination contains the same task ID at the requested index, and both week snapshots are correct after reload.
5. Given a move request fails or conflicts, when the API responds, then source and destination UI state are restored or refetched from the authoritative snapshots and no duplicate is displayed.
6. Given the user opens a task context menu and chooses `Move`, then pending-move mode starts without changing persisted data.
7. Given pending-move mode is active, when the user navigates to another week and chooses `Move here` on a valid day/shared-week lane, then the selected task moves there.
8. Given pending-move mode is active, when the user cancels or clicks outside the flow, then pending state clears and no mutation is sent.
9. Given an invalid lane, index, week, task, or unauthorized source, when the API receives the request, then it returns the corresponding structured error and leaves persisted data unchanged.

## Scope Boundaries

- Implement same-week lane moves and cross-week moves with stable task identity.
- Implement the context-menu two-step flow required for destinations outside the currently visible week.
- Reuse Story 3.1 ordering and authoritative snapshots; do not create a separate move-specific task model.
- Do not add bulk move, recurring-definition propagation, multi-user collaboration, or real-time synchronization.

## Tasks / Subtasks

### Task 1 - Atomic move domain operation

- [ ] Define a move command covering source week/lane/index and destination week/lane/index.
- [ ] Normalize both week inputs to Monday and validate day lanes against the destination week.
- [ ] Update task week ownership and nullable day placement while preserving task ID and task fields.
- [ ] Remove from the source sequence, insert into the destination sequence, and reindex all affected lanes in one database transaction.
- [ ] Preserve the existing shared-week execution-time normalization rule when destination placement has no day date.

### Task 2 - Move API contract

- [ ] Add `POST /api/v1/tasks/{taskId}/move` with explicit camelCase DTOs and standard envelopes.
- [ ] Add source/destination snapshot version or equivalent optimistic-concurrency validation.
- [ ] Return authoritative source and destination snapshots plus metadata needed for cache reconciliation.
- [ ] Map invalid lane/index/week, missing task, forbidden access, conflict, and unexpected failure to stable error codes.
- [ ] Ensure a failed transaction cannot leave the task in both lanes or in neither lane.

### Task 3 - Board and context-menu flow

- [ ] Add lane-level drop targets for day and shared-week sections, including full-week weekend lanes when visible.
- [ ] Refetch or reconcile both affected weeks after a successful same-week or cross-week move.
- [ ] Implement pending-move state independently from task drafts; preserve it across week navigation without persisting until `Move here`.
- [ ] Add `Move` to the task context menu and `Move here` to valid destination lane menus.
- [ ] Clear pending move on cancel, outside click, logout, or invalidated session.
- [ ] Keep task card edit, delete, completion, and execution-time controls functional after a move.

### Task 4 - Tests and validation

- [ ] Add backend integration coverage for day-to-day, day-to-shared, shared-to-day, same-week reorder, and cross-week moves.
- [ ] Verify task ID preservation, source/destination order, transaction rollback, conflict response, and authorization boundaries.
- [ ] Add frontend coverage for valid/invalid drop targets, duplicate prevention, cross-week refetch, context-menu pending state, cancel, and `Move here`.
- [ ] Run focused backend/frontend tests, lint, build, and migration validation.

## Developer Context

- The existing task update flow in `TaskManagerFacade` may accept placement changes, but this story requires a dedicated atomic move path so source/destination ordering cannot drift.
- Keep week identity Monday-based and use `dayDate: null` for shared week. Weekend destinations are valid only when the board is in full-week mode, but API validation must remain view-independent.
- Use React Query/server-state invalidation for affected weeks; pending move selection belongs to local transient UI state.
- Preserve completed-task visibility and task execution-time behavior from Epic 2. Moving a completed task must not reopen it.

## Definition of Done

- Same-week and cross-week moves work for day and shared-week lanes.
- Cross-week moves are atomic and preserve task identity.
- Context-menu pending move supports navigation, confirmation, cancellation, and cleanup.
- Source/destination data contains no duplicate or missing task after success, failure, reload, or refetch.
- Focused tests and quality gates pass.

## References

- `_bmad-output/implementation-artifacts/epic-3-context.md`
- `_bmad-output/planning-artifacts/epics.md#Story 3.2: Move Tasks Across Day Columns and Shared Week Section`
- `_bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md`
- `_bmad-output/implementation-artifacts/epic-2/2-3-add-task-execution-time.md`
- `_bmad-output/implementation-artifacts/epic-2/2-6-protect-unsaved-changes-during-navigation.md`
