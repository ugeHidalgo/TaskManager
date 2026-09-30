# Story 3.1: Reorder Tasks Within the Same Section

Status: in-progress

Epic: 3 - Task Prioritization by Drag and Reorder  
Story ID: 3.1  
Estimation: M (2-4 days)  
Dependencies: Epic 2 task CRUD, task reads, completion persistence, and execution-time behavior completed.

## Story

As a planner,  
I want to reorder tasks inside the same day column or shared week section,  
so that I can set priority quickly as my plan changes.

## Acceptance Criteria

1. Given multiple tasks exist in one lane, when the user drags a task to a new position, then the UI shows the insertion position and updates the visible order immediately.
2. Given a reorder succeeds, when the same week is reloaded, then the lane uses the persisted order and the task identity and other task fields are unchanged.
3. Given a reorder request fails, when the API returns an error, then the UI restores the last authoritative order and shows an actionable non-sensitive error.
4. Given a task list contains completed tasks, when an active task is reordered, then completed tasks remain visible and the final order includes every task exactly once.
5. Given keyboard-only usage, when the user invokes the task reorder controls, then the task can move earlier or later in the same lane and focus remains on the moved task.
6. Given an unauthenticated or cross-workspace reorder request, when the API receives it, then it is denied and no order changes are persisted.

## Scope Boundaries

- Implement ordering inside one existing week/lane only.
- Add the persisted `order_index` field and the smallest authenticated reorder contract needed by this story.
- Do not implement cross-lane or cross-week moves; those belong to Story 3.2.
- Do not replace the existing task CRUD contract or add a second task store.
- Do not change completion, execution-time, recurring-task, week-navigation, or view-mode semantics.

## Tasks / Subtasks

### Task 1 - Domain and persistence ordering

- [x] Add `OrderIndex` to `TaskItem` with a deterministic default for newly created tasks.
- [x] Add snake_case database mapping and an explicit EF migration with a backfill for existing tasks.
- [x] Define lane ordering as `weekStartDate + dayDate/null`, with no ordering inferred from timestamps.
- [x] Add a unique or otherwise protected ordering invariant for task identity within a lane where the existing schema permits it.
- [x] Reindex affected lane rows safely when inserting, deleting, or changing the submitted sequence.

### Task 2 - Authenticated reorder API

- [x] Add a versioned authenticated reorder endpoint using explicit request/response DTOs.
- [x] Validate that submitted task IDs are unique, complete for the target lane, belong to the authenticated workspace/week, and match the requested lane.
- [x] Normalize `order_index` from the submitted sequence in one transaction.
- [x] Return the authoritative ordered lane snapshot using `{ data, meta }`; map failures to the existing structured error envelope.
- [x] Preserve status, title, notes, execution time, placement, timestamps, and IDs while changing order only.

### Task 3 - Frontend reorder interaction

- [ ] Extend task payloads and board mapping with `orderIndex` or an equivalent server-authoritative ordering field.
- [ ] Add drag handles/drop targets to the existing task card and lane components without duplicating board state.
- [ ] Apply an optimistic same-lane reorder, then reconcile from the API response.
- [ ] Roll back to the previous snapshot on failure and expose a visible, accessible error.
- [ ] Add keyboard controls with accessible names and stable focus after moving a task.

### Task 4 - Tests and validation

- [ ] Add domain/API coverage for ordering, duplicate IDs, incomplete sequences, lane scoping, persistence after reload, and unauthorized access.
- [ ] Add frontend coverage for drag insertion feedback, optimistic order, rollback, completed-task visibility, keyboard reorder, and focus retention.
- [ ] Verify migration/model consistency and run focused backend/frontend tests, lint, and builds.

## Developer Context

- Extend `src/backend/src/TaskManager.Domain/Board/TaskItem.cs`; keep identity and task status independent from ordering.
- Extend the existing facade and authenticated routes in `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs` and `Program.cs`.
- Extend `src/frontend/src/api/board.ts`, `TaskCard`, and lane components under `src/frontend/src/features/board/components` using the current task query/refetch patterns.
- Keep API JSON camelCase, database names snake_case, dates as `YYYY-MM-DD`, and all writes scoped to the authenticated user.
- The server response is authoritative. Do not use `CreatedAtUtc` as a fallback priority once `OrderIndex` exists.

## Definition of Done

- Same-lane drag reorder works and persists after reload.
- Same-lane keyboard reorder works with predictable focus.
- Failed reorder restores the authoritative previous order.
- Completed tasks remain visible, uniquely represented, and reorderable.
- No cross-lane behavior is introduced prematurely.
- Focused tests, lint, builds, and migration checks pass.

## References

- `_bmad-output/implementation-artifacts/epic-3-context.md`
- `_bmad-output/planning-artifacts/epics.md#Story 3.1: Reorder Tasks Within the Same Section`
- `_bmad-output/planning-artifacts/architecture.md#Data Architecture`
- `_bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md`
- `_bmad-output/implementation-artifacts/epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md`

## Dev Agent Record

### Debug Log References

- `dotnet test src/backend/tests/Taskmanager.Tests.csproj --filter FullyQualifiedName~TaskApiTests|FullyQualifiedName~TaskItemTests --no-restore` -- passed, 38 tests.
- `dotnet test TaskManager.sln --no-restore` -- passed; migration applied by the integration test database.
- `dotnet ef migrations has-pending-model-changes --project src/backend/src/TaskManager.Infrastructure/TaskManager.Infrastructure.csproj --startup-project src/backend/src/TaskManager.Api/TaskManager.Api.csproj` -- passed with no pending model changes.
- `dotnet test src/backend/tests/Taskmanager.Tests.csproj --filter 'FullyQualifiedName~ReorderTasks' --no-restore` -- passed, 8 tests including the authenticated PostgreSQL route test.
- `dotnet test TaskManager.sln --no-restore` -- passed, 58 tests.

### Completion Notes List

- Added non-negative `OrderIndex` to `TaskItem`; new tasks default to index `0` and facade creation assigns the next index within the workspace/day lane.
- Added `order_index` mapping, composite lookup index, migration backfill ordered by `created_at_utc` and `id`, and a unique expression index that protects the nullable shared-week lane.
- Task reads now expose `OrderIndex` and use it as the authoritative priority while retaining creation-time compatibility for legacy rows with the migration default.
- Deleting a task compacts its lane; changing task placement compacts the source lane and appends the task to the destination lane without changing identity or status.
- Added domain and API regressions for negative order rejection and lane compaction after deletion.
- Added the authenticated `PUT /api/v1/tasks/reorder` contract; validates complete, unique same-week/lane sequences, performs collision-safe order normalization in a transaction, and returns the ordered lane snapshot with structured errors while leaving other task fields unchanged.
- Added API tests for successful persistence/reload, duplicate and incomplete sequences, cross-lane/week IDs, invalid lane dates, metadata preservation, and unauthenticated denial.
- Existing `Program.cs` JWT secret nullability warning remains unchanged.

### File List

- `src/backend/src/TaskManager.Domain/Board/TaskItem.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Configurations/TaskItemConfiguration.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/20260930143725_AddTaskOrderIndex.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/20260930143725_AddTaskOrderIndex.Designer.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/TaskManagerDbContextModelSnapshot.cs`
- `src/backend/src/TaskManager.Api/Contracts/TaskContracts.cs`
- `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs`
- `src/backend/src/TaskManager.Api/Program.cs`
- `src/backend/tests/TaskItemTests.cs`
- `src/backend/tests/TaskApiTests.cs`
- `src/backend/tests/TaskAuthorizationTests.cs`

### Change Log

- 2026-09-30: Implemented Task 1 ordering model, persistence migration/backfill, lane protection, creation/deletion/placement reindexing, and focused regressions.
- 2026-09-30: Implemented Task 2 authenticated same-lane reorder API, transaction-safe normalization, structured response/errors, and backend coverage.
