---
baseline_commit: 7cbfe90c68f93c6ddb330cb502ae0e90398f29a4
---

# Story 2.3: Add Optional Task Execution Time

Status: in-progress

Epic: 2 - Task Lifecycle and Completion  
Story ID: 2.3  
Estimation: M (2-4 days)  
Dependencies: Story 2.1 task model and editor integration completed.

---

## Story

As a planner,  
I want to optionally assign an execution time to a task,  
so that tasks with a fixed start time are clearly scheduled while flexible tasks remain without a time.

## Acceptance Criteria

1. Given a task has no fixed execution time, when it is created or loaded, then `ExecutionTime` is persisted and returned as an empty string.
2. Given a task has a fixed execution time, when it is created or updated, then `ExecutionTime` is persisted and returned as an `hh:mm` string.
3. Given a task card is rendered for a day placement, when `ExecutionTime` is non-empty, then the time appears in the first row immediately before the task title.
4. Given a task card is rendered, when `ExecutionTime` is empty, then no time text is shown and the title remains correctly positioned.
5. Given a task card is rendered, when `ExecutionTime` is empty, then no execution-time text is displayed in the first row.
6. Given a task card is rendered for a day placement, when `ExecutionTime` is non-empty, then its value is displayed immediately before the task title in the first row and no clock control is displayed there.
7. Given the user opens `Edit Task`, then the editor contains an `ExecutionTime` text field that is empty or contains the current `hh:mm` value.
8. Given the `ExecutionTime` field is edited, then its increment and decrement controls move in 30-minute steps while manual entry is allowed when the final value is empty or valid `hh:mm`.
9. Given the user accepts or closes `Edit Task` with a valid `ExecutionTime`, then the value is persisted, including an empty string, and the task card immediately reflects whether the time is visible or hidden.
10. Given the user attempts to accept or close `Edit Task` with an invalid non-empty `ExecutionTime`, then an inline error is shown and the editor remains open until the value is corrected or cleared.
11. Given an existing execution time is cleared in `Edit Task`, when the change is accepted, then `ExecutionTime` is persisted as an empty string and no execution-time text is displayed in the task card.
12. Given keyboard or assistive-technology usage, when the `ExecutionTime` field is edited, then it has an accessible label, usable focus, and an error message that is announced without relying on color alone.
13. Given the `ExecutionTime` field contains an invalid value, when the error is shown in `Edit Task`, then the error message blinks for 15 seconds, remains fixed afterward, and stays visible until the value is corrected or cleared.
14. Given the `ExecutionTime` increment or decrement control is used, when the next 30-minute step would fall outside `00:00`–`23:59`, then the value remains unchanged and never wraps or crosses either limit.
15. Given the user manually enters a non-empty malformed value or a time outside `00:00`–`23:59`, when validation runs, then the field is marked invalid and displays: `Execution time must be empty or within the range 00:00 - 23:59.`
16. Given a task has `Shared Week` placement, when it is created or updated, then its persisted `ExecutionTime` is set to `00:00` regardless of any previously configured execution time.
17. Given a task has `Shared Week` placement, when its card is rendered, then no execution-time text is displayed even though its persisted `ExecutionTime` is `00:00`.

## Data Contract

- Add `ExecutionTime` to the task model and task create/update/read contracts.
- `ExecutionTime` is a required string property at the model boundary.
- Use `""` when no time is configured.
- Use the exact `hh:mm` representation when a time is configured.
- Accepted values are the empty string or a valid `hh:mm` value from `00:00` through `23:59`; the editor uses 30-minute step controls without crossing either boundary while allowing manual entry subject to the same validation.
- `Shared Week` placement (`dayDate` is `null`) is an exception: persist `ExecutionTime` as `00:00` and suppress its display on the task card. Day placements retain the optional-time behavior above.

## Tasks / Subtasks

### Task 1 - Task model and persistence

- [x] Add the `ExecutionTime` string property to the task domain model with an empty-string default.
- [x] Add database mapping and migration using the existing PostgreSQL conventions.
- [x] Preserve existing tasks by backfilling `ExecutionTime` to `""`.
- [x] Validate empty string or `hh:mm` values from `00:00` through `23:59`, rejecting malformed or out-of-range times without changing the prior value.

### Task 2 - Authenticated API and editor

- [x] Extend task create, update, and response contracts with `ExecutionTime`.
- [x] Preserve the value through task creation and editing, including the empty-string case.
- [x] Add an `ExecutionTime` text field to the existing `Edit Task` window, initialized with the current value or an empty string.
- [x] Support 30-minute increment/decrement controls that stay within `00:00`–`23:59`, manual editing, clear-by-empty-value, accept, cancel, and keyboard interaction.
- [x] Keep the editor open and show `Execution time must be empty or within the range 00:00 - 23:59.` when the value is neither empty nor valid `hh:mm` within that range.
- [x] Make the `ExecutionTime` validation error blink for 15 seconds, then remain fixed in `Edit Task` until the value is corrected or cleared.

### Task 3 - Board presentation

- [x] For day placements, render a non-empty execution time immediately before the title in row one; do not render a clock control in row one.
- [x] Keep completed-card minimization, status controls, edit/delete controls, and shared-week/day layouts intact.
- [x] Ensure popup positioning and focus remain usable in workweek and full-week views.

### Task 4 - Shared Week execution-time behavior

- [ ] When a task is created or updated with `Shared Week` placement, set `ExecutionTime` to `00:00` before persistence, replacing any prior execution time.
- [ ] Hide execution-time text on `Shared Week` task cards, including the stored `00:00` value; keep the existing display behavior for day placements.
- [ ] Keep task placement, status/completion behavior, and the shared-week/day card layouts intact.

### Task 5 - Tests and validation

- [ ] Test empty and populated `ExecutionTime` persistence through create, update, reload, and board rendering.
- [ ] Test that `Shared Week` create/update forces `ExecutionTime` to `00:00` and hides it on the card, while day placements retain optional-time display.
- [ ] Test the `Edit Task` execution-time field, 30-minute controls, manual entry, accept, clear, cancel, keyboard access, and accessible naming.
- [ ] Test invalid values and failed persistence rollback.
- [ ] Run focused frontend/backend tests, lint, migration/build checks, and production builds.

## Scope Boundaries

- Do not add duration, reminders, notifications, time tracking, recurring-task scheduling, timezone conversion, or automatic task ordering.
- Do not infer an execution time from task text or other fields.
- Do not change task status or completion behavior when an execution time is edited.

## Dev Notes

- Extend the task model and editor/API patterns created by Stories 2.1 and 2.2; do not create a second task state store.
- Reuse the existing authenticated task update contract and `{ data, meta }` / `{ error }` envelopes.
- Preserve authentication, week navigation, localStorage view mode, task placement, completion styling, and delete confirmation.
- Treat `ExecutionTime` as a display and persistence field only; status remains independently controlled.
- Treat `Shared Week` as `dayDate: null`; its `ExecutionTime` is forced to `00:00` and suppressed from the card display.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Add Optional Task Execution Time]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#Phase 2: Board Overview]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Task card]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md]

## Definition of Done

- [ ] `ExecutionTime` persists as empty string or valid `hh:mm` from `00:00` through `23:59`.
- [ ] Task cards show the optional time before the title and no clock control appears in row one.
- [ ] Shared-week tasks persist `ExecutionTime` as `00:00` and hide it from the task card; day tasks retain optional-time display.
- [ ] `Edit Task` allows users to set, modify, clear, accept, or cancel an execution time.
- [ ] The execution-time field supports 30-minute steps, valid manual `hh:mm` entry, accessible errors, and preserves existing card behavior.
- [ ] Execution-time errors blink for 15 seconds and then remain visible in `Edit Task` until validation succeeds.
- [ ] Focused tests and quality gates pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

- `dotnet test src/backend/tests/Taskmanager.Tests.csproj --filter FullyQualifiedName~TaskItem` — passed (18 tests).
- `dotnet tool run dotnet-ef migrations has-pending-model-changes ...` — no pending model changes.
- `dotnet test TaskManager.sln` — passed (37 tests); migration applied by the PostgreSQL integration test.
- After tightening the range to `00:00`–`23:59`, `dotnet test TaskManager.sln` passed (39 tests); no EF model changes are pending.
- `dotnet test src/backend/tests/Taskmanager.Tests.csproj --filter FullyQualifiedName~TaskApiTests` — passed (10 tests).
- `dotnet test TaskManager.sln` after Task 2 — passed (41 tests).
- `npm run test:run` — passed (46 tests); `npm run lint` and `npm run build` passed.

### Implementation Plan

- Carry the required `ExecutionTime` string through request/response contracts, task facade mappings, and frontend API types; keep status-only updates from dropping the current value.
- Keep the editor input as text to allow manual `hh:mm` entry, use 30-minute controls that refuse out-of-range steps, and validate before save or dismissal.
- Announce the validation error through an associated `role="alert"` / `aria-describedby`, blink for 15 seconds, then leave it static until the value is corrected or cleared.
- Render a semantic `time` element before the title only for day placements with non-empty `ExecutionTime`; use shared task rendering for both shared-week and day cards.
- Force `ExecutionTime` to `00:00` for `Shared Week` placement and suppress that value on the shared-week card.
- Keep the editor backdrop fixed to the viewport, constrain and scroll the dialog within short viewports, and restore focus to the editor opener after cancel or save.

### Completion Notes List

- Completed Task 1 only: added `ExecutionTime` with an empty-string default, required PostgreSQL mapping/default, and migration backfill for existing rows.
- Domain validation accepts empty or exact `hh:mm` values from `00:00` through `23:59`; update validation completes before mutating the task, so invalid times preserve prior values.
- The completed Task 1 validation rejects `24:00`; Task 2 implements the matching editor boundary handling and inline error behavior.
- Completed Task 2: API create/update/read contracts carry `ExecutionTime`, including empty values; editor preserves existing values, supports manual entry and bounded 30-minute steps, and blocks save/cancel/Escape while the value is invalid.
- The exact accessible field error blinks for 15 seconds and remains visible until correction or clearing; Tasks 3–5 and story-wide Definition of Done remain incomplete, so the story remains `in-progress`.
- Visual follow-up: `Execution time` now appears between Title and Notes, with half-height up/down triangle controls stacked without a gap to its left.
- Completed Task 3: day task cards show a non-empty execution time immediately before the title and render no time element when empty; no clock control is introduced in the title row.
- Preserved shared/day rendering and existing completed-card/status/edit/delete behavior; constrained the editor dialog to the viewport and restored focus to its opener in workweek and full-week views.
- Added BoardPage regression tests for populated/empty times and editor placement/focus across both views and both task contexts; frontend suite (53 tests), lint, and production build passed. Tasks 4–5 remain incomplete, so story status remains `in-progress`.

### File List

- `src/backend/src/TaskManager.Domain/Board/TaskItem.cs`
- `src/backend/src/TaskManager.Api/Contracts/TaskContracts.cs`
- `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Configurations/TaskItemConfiguration.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/20260927053011_AddTaskExecutionTime.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/20260927053011_AddTaskExecutionTime.Designer.cs`
- `src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/TaskManagerDbContextModelSnapshot.cs`
- `src/backend/tests/TaskItemTests.cs`
- `src/backend/tests/TaskItemPersistenceTests.cs`
- `src/backend/tests/TaskApiTests.cs`
- `src/frontend/src/api/board.ts`
- `src/frontend/src/api/board.test.ts`
- `src/frontend/src/features/board/components/TaskEditor.tsx`
- `src/frontend/src/features/board/components/TaskEditor.test.tsx`
- `src/frontend/src/features/board/styles/board-layout.css`
- `src/frontend/src/pages/BoardPage.tsx`
- `src/frontend/src/pages/BoardPage.test.tsx`

### Change Log

- 2026-09-27: Implemented and validated Task 1 of Story 2.3.
- 2026-09-27: Tightened the accepted `ExecutionTime` range to `00:00`–`23:59` and specified editor boundary/error behavior.
- 2026-09-27: Implemented and validated Task 2 API contracts, editor field, bounded controls, and accessible timed validation feedback.
- 2026-09-27: Reordered the editor field and restyled its increment/decrement controls as a compact vertical arrow pair.
- 2026-09-27: Implemented Task 3 board time presentation, viewport-safe editor positioning, and focus restoration; frontend tests, lint, and production build passed.
- 2026-09-27: Added Task 4 for Shared Week execution-time normalization and display suppression; renumbered tests and validation as Task 5. No implementation performed.
