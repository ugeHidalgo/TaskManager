---
baseline_commit: 5f84e172314597f2e4ca9bbca935e4889fa9465c
---

# Story 3.2: Move Tasks Across Day Columns and Shared Week Section

Status: in-progress

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

- [x] Define a move command covering source week/lane/index and destination week/lane/index.
- [x] Normalize both week inputs to Monday and validate day lanes against the destination week.
- [x] Update task week ownership and nullable day placement while preserving task ID and task fields.
- [x] Remove from the source sequence, insert into the destination sequence, and reindex all affected lanes in one database transaction.
- [x] Preserve the existing shared-week execution-time normalization rule when destination placement has no day date.

### Task 2 - Move API contract

- [x] Add `POST /api/v1/tasks/{taskId}/move` with explicit camelCase DTOs and standard envelopes.
- [x] Add source/destination snapshot version or equivalent optimistic-concurrency validation.
- [x] Return authoritative source and destination snapshots plus metadata needed for cache reconciliation.
- [x] Map invalid lane/index/week, missing task, forbidden access, conflict, and unexpected failure to stable error codes.
- [x] Ensure a failed transaction cannot leave the task in both lanes or in neither lane.

### Task 3 - Board and context-menu flow

- [x] Add lane-level drop targets for day and shared-week sections, including full-week weekend lanes when visible.
- [x] Reconcile the affected week from authoritative move snapshots after a successful same-week move.
- [x] Implement direct drag-and-drop between lanes and within a lane without a separate pending-move mode.
- [x] Remove the obsolete per-task move-up and move-down buttons; mouse drag-and-drop is the supported ordering interaction.
- [x] Keep task card edit, delete, completion, and execution-time controls functional after a move.

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

## Dev Agent Record

### Debug Log References

- `dotnet test src/backend/tests/Taskmanager.Tests.csproj --no-restore --filter 'FullyQualifiedName~MoveTaskAsync|FullyQualifiedName~TaskLanePosition' --logger 'console;verbosity=minimal'` — passed, 8 tests.
- `dotnet test TaskManager.sln --no-restore --verbosity quiet` — passed, 66 tests.
- `git diff --check` — passed.

### Completion Notes List

- Added `MoveTaskCommand` and `TaskLanePosition` in the application layer; lane positions normalize weeks to Monday and validate dates and non-negative indices.
- Added `TaskItem.MoveTo` to update week ownership and nullable day placement without replacing task identity or changing task content/status; moving to shared-week clears execution time.
- Added a transaction-backed move operation that verifies the source position, inserts at the requested destination position, and collision-safely reindexes all affected lanes.
- Added unit and PostgreSQL-backed regressions for cross-week moves, same-week day/shared-week moves, same-lane reordering, metadata preservation, invalid destination positions, and lane index normalization.
- Added `POST /api/v1/tasks/{taskId}/move` with camelCase request DTOs, standard success/error envelopes, and source/destination snapshots.
- Added deterministic snapshot versions and in-transaction optimistic validation; conflicts return `task.move.conflict`.
- Added stable move error mapping for validation, invalid positions, missing tasks, conflicts, and unexpected failures.

### File List

- `src/backend/src/TaskManager.Application/Board/MoveTaskCommand.cs`
- `src/backend/src/TaskManager.Api/Contracts/TaskContracts.cs`
- `src/backend/src/TaskManager.Api/Program.cs`
- `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs`
- `src/backend/src/TaskManager.Domain/Board/TaskItem.cs`
- `src/backend/tests/TaskApiTests.cs`
- `src/backend/tests/TaskAuthorizationTests.cs`
- `_bmad-output/implementation-artifacts/epic-3/3-2-move-tasks-across-day-columns-and-shared-week-section.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-09-30: Completed US3.2 Task 1 with normalized move command, transactional lane reindexing, domain placement updates, shared-week execution-time normalization, and focused backend coverage.
- 2026-09-30: Completed US3.2 Task 2 with versioned move API contract, authoritative source/destination snapshots, stable error mapping, and full backend validation.
