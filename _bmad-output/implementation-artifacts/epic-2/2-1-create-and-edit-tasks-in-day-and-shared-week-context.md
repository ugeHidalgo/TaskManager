# Story 2.1: Create and Edit Tasks in Day and Shared Week Context

Status: ready-for-dev

Epic: 2 - Task Lifecycle and Completion  
Story ID: 2.1  
Estimation: M-L (3-5 days)  
Dependencies: Stories 1.5, 1.6, and 1.7 completed; authenticated board and week persistence baseline available.

---

## Story

As a planner,  
I want to create and edit tasks in day columns or in the shared week section,  
so that I can organize planned work with the right temporal scope.

## Acceptance Criteria

1. Given the authenticated board is open, when the user presses the `+` button in the shared week section header or a day-column header, then a task-creation popup opens with the task fields and the selected section/date as its default context.
2. Given a task exists, when the user edits its title, notes, or context, then the changes are validated, persisted, and reflected in the board without a full page reload.
3. Given a task is moved between the shared week context and a day context through the supported edit flow, when the save succeeds, then it is removed from the old location and appears in the new location for the same week.
4. Given the user submits an empty or whitespace-only title, when validation runs, then an inline validation message is shown, the request is not sent, and the task is not created or changed.
5. Given the task-creation popup is open, when the user presses `Save`, then valid task data is persisted and the new task appears in the selected section without a full page reload.
6. Given the task-creation or edit popup is open, when the user presses `Cancel`, then the popup closes, no task is created or changed, and the board remains unchanged.
7. Given a create or edit request fails, when the API returns an error, then the draft remains available for correction, the board does not silently lose existing data, and an actionable non-sensitive error is shown.
8. Given a create or edit request succeeds, when the operation completes, then the board state is refreshed or updated from the persisted response, and clear save feedback is exposed to the user.
9. Given the user reloads the same week or logs out and back in, when the board is loaded, then created and edited tasks retain their title, notes, status, week context, and day/shared-week location.
10. Given the board is rendered in workweek or full-week mode, when tasks are loaded, then shared-week tasks remain in the shared section and day tasks render in their matching date column; changing view mode must not duplicate or discard tasks.
11. Given an unauthenticated request attempts to create or edit a task, when the API receives it, then access is denied using the existing authentication and error-envelope conventions.

## Scope Boundaries

- Implement regular task create/read/update behavior needed by this story.
- Support the existing task fields from the product requirements: required name/title, optional description/notes, and status with default `Not Started`.
- Support placement in the shared week section or one concrete day of the selected week.
- Do not implement completion interaction, recurring tasks, delete confirmation, drag-and-drop reorder, time entries, day/week completion calculation, or unsaved-change protection; those belong to later Epic 2 and Epic 3 stories.
- Preserve the current week navigation, board view-mode persistence, authentication, and empty-board behavior.

## Tasks / Subtasks

### Task 1 - Define task domain and persistence model

- [x] Introduce a task representation that has a stable identifier, week ownership, required title, optional notes, status, creation/update timestamps, and placement information.
- [x] Represent shared-week placement distinctly from a day placement; use the existing deterministic Monday-based week key and ISO date conventions.
- [x] Add database mapping and migration(s) using existing PostgreSQL/EF Core conventions.
- [x] Preserve existing week workspace data while migrating away from or interoperating with the current generic `lanes` JSON baseline; do not create two competing sources of truth.
- [x] Enforce server-side title validation and data constraints. A title containing only whitespace is invalid.

### Task 2 - Add authenticated API contract

- [x] Add task list, create, and update operations under the versioned `/api/v1` API boundary, following the repository's existing response envelope: success uses `{ data, meta }`, errors use `{ error: { code, message, details } }`.
- [x] Use camelCase JSON payloads and ISO date strings; do not expose database snake_case names in API payloads.
- [x] Define explicit request/response DTOs rather than accepting persistence entities directly.
- [x] Scope every read/write to the authenticated user's workspace and selected Monday-based week.
- [x] Return validation failures as a client-correctable response without leaking database or exception details.
- [x] Ensure create defaults status to `Not Started` when omitted and update applies the submitted editable fields.

### Task 3 - Integrate board data flow

- [ ] Extend the existing board loading contract/client in `src/frontend/src/api/board.ts` or introduce a focused task API module that follows its authentication and error-handling pattern.
- [ ] Load task data with the selected `week_start_date` and map shared-week placement and day placement into the existing `WeekSection` and `DayColumn` components.
- [ ] Ensure a task created or edited in the currently selected week is visible immediately after the persisted operation; avoid a hard navigation or full-page reload.
- [ ] Ensure navigation to another week refetches the correct week data and does not display stale tasks from the previous week.
- [ ] Keep the current stale-request protection for rapid week navigation.

### Task 4 - Build create/edit interaction

- [ ] Add a reusable task editor opened by the `+` button in the shared-week header and each day-column header.
- [ ] Provide controls for title, optional notes, and placement; default placement must match the section from which the editor opened.
- [ ] Provide explicit `Save` and `Cancel` buttons; `Cancel` closes the popup without creating or changing a task.
- [ ] Provide a clear edit entry point on each task card once tasks are rendered.
- [ ] Keep the editor keyboard-operable with labels, logical focus order, visible validation, and screen-reader-friendly save/error feedback.
- [ ] Keep task card content concise: title plus optional short notes preview, consistent with the existing UX guidance.
- [ ] Use a familiar plus symbol for compact creation actions, with an accessible label and tooltip for the control.
- [ ] Use subtle functional feedback only; do not introduce flashy transitions or a new visual system.

### Task 5 - Tests and validation

- [ ] Add backend unit/integration coverage for title validation, default status, shared-week placement, day placement, week scoping, create, update, and unauthenticated access.
- [ ] Add frontend tests for `+` popup opening, editor validation, Save, Cancel, create from shared/day context, edit persistence, error draft retention, and rendering in the correct section.
- [ ] Add a regression test that reloads or refetches the same week and verifies task persistence.
- [ ] Add a regression test for workweek/full-week view switching with tasks present.
- [ ] Run focused frontend tests, frontend lint/build, backend tests, and backend build; record commands and outcomes in the Dev Agent Record.

## Developer Context

### Current implementation to extend

- `src/frontend/src/pages/BoardPage.tsx` owns selected week state, week navigation, board view-mode persistence, and board loading. Preserve these behaviors.
- `src/frontend/src/api/board.ts` currently calls `GET /api/v1/board?week_start_date=...` and unwraps `body.data`. Its current `BoardPayload.lanes` type is `unknown[]`; replace or extend this contract deliberately once task data is structured.
- `src/frontend/src/features/board/components/WeekLayout.tsx`, `WeekSection.tsx`, and `DayColumn.tsx` provide the existing shared-week and day-column containers. Add task rendering through their established props rather than duplicating board layouts.
- `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs` currently owns board retrieval/save behavior and normalizes dates to Monday. Keep date normalization in one backend path and avoid a second incompatible week calculation.
- `src/backend/src/TaskManager.Api/Program.cs` registers the authenticated board routes. New task routes must use the same `[Authorize]` protection and dependency-injection style.
- `src/backend/src/TaskManager.Domain/Board/WeekWorkspace.cs` and `TaskManagerDbContext` are the current persistence baseline. The implementation must decide and document whether task records replace `LanesJson` for task data or are adapted into it; both stores must not drift.

### API and domain rules

- Week identity is the Monday date (`weekStartDate` / persisted `week_start_date`). Normalize incoming dates to Monday on the server.
- A day placement is an ISO calendar date within the selected week. Shared-week placement has no day date.
- Regular task statuses are `Not Started`, `In Progress`, and `Completed`; this story only needs to persist/render the value and defaults it to `Not Started`. Completion behavior is Story 2.2.
- Required title validation must happen on both client and server. Client validation avoids unnecessary requests; server validation is authoritative.
- Use parameterized EF Core queries and authenticated boundaries. Do not log credentials, JWTs, or sensitive request contents.
- Core task operations should meet the existing target of under 500 ms in the normal local environment; avoid loading unrelated weeks or using unbounded queries.

### UX guardrails

- The task title and completion control relationship must remain ready for Story 2.2; do not bury the title in a large editor-only representation.
- Shared-week section remains above day columns. In full-week mode, Sunday and Saturday columns must receive only tasks assigned to those dates; shared-week tasks remain unchanged.
- Save, validation, and API errors should be announced accessibly and should not rely on color alone.
- Do not silently discard an in-progress draft when a save fails. Unsaved-change navigation protection is explicitly deferred to Story 2.5.

## Project Structure Notes

- Backend changes should stay within `src/backend/src/TaskManager.Domain`, `TaskManager.Application`, `TaskManager.Api`, and `TaskManager.Infrastructure`, matching the existing clean-layer solution.
- Frontend changes should stay within `src/frontend/src/api`, `features/board`, `pages`, and existing shared/auth patterns. Add a task feature directory only if it follows the current organization and avoids duplicate board state.
- Database names use snake_case; C# and TypeScript symbols use the existing casing conventions; API JSON uses camelCase.
- Do not modify authentication/session semantics or the existing `taskmanager.boardViewMode` localStorage contract.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Task Lifecycle and Completion]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Create and Edit Tasks in Day and Shared Week Context]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#Phase 3: Task Creation & Updates]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#FR-3: Task Management]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#FR-8: Task Persistence]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API and Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Component Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Accessibility Floor]
- [Source: _bmad-output/implementation-artifacts/epic-1/1-7-persistence-baseline-for-weekly-workspace.md]
- [Source: _bmad-output/implementation-artifacts/epic-1/1-8-toggle-between-workweek-and-full-week-board-view.md]

## Definition of Done

- [ ] Authenticated users can open task creation with `+` from shared-week or day context and save a regular task.
- [ ] Authenticated users can edit title, notes, status, and placement and see the result without a full reload.
- [ ] Empty/whitespace-only titles are rejected inline and server-side.
- [ ] Tasks persist by Monday-based week and reload in the correct section/date column.
- [ ] API contracts and errors follow established envelopes and naming conventions.
- [ ] Existing authentication, navigation, workweek/full-week mode, and empty states remain functional.
- [ ] Focused backend/frontend tests, lint, and builds pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Implemented `TaskItem` with weekly ownership, nullable day placement for shared-week tasks, title/notes normalization, supported status validation, and UTC timestamps.
- Added EF Core mapping and generated `TaskPersistence` migration for the `tasks` table with a foreign key to `week_workspaces`.
- Added six focused domain tests; all pass.
- Added authenticated `GET /api/v1/tasks`, `POST /api/v1/tasks`, and `PUT /api/v1/tasks/{taskId}` endpoints with explicit DTOs, week scoping, validation envelopes, and `201 Created` responses.
- Added four API contract tests; all pass.

### File List

- `src/backend/src/TaskManager.Domain/Board/TaskItem.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Configurations/TaskItemConfiguration.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/TaskManagerDbContext.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/20260823180849_TaskPersistence.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/20260823180849_TaskPersistence.Designer.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/TaskManagerDbContextModelSnapshot.cs`
- `src/backend/tests/TaskItemTests.cs`
- `src/backend/src/TaskManager.Api/Contracts/TaskContracts.cs`
- `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs`
- `src/backend/src/TaskManager.Api/Program.cs`
- `src/backend/tests/TaskApiTests.cs`
