# Story 2.3: Add Optional Task Execution Time

Status: ready-for-dev

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
3. Given a task card is rendered, when `ExecutionTime` is non-empty, then the time appears in the first row immediately before the task title.
4. Given a task card is rendered, when `ExecutionTime` is empty, then no time text is shown and the title remains correctly positioned.
5. When `ExecutionTime` is empty, it must not be displayed.
6. Given a task card is rendered, when the user chooses the clock control, then a small time-edit popup opens with a labelled time selector and the current value preselected when one exists.
7. Given the time popup is open, when the user selects a time and accepts, then the new `ExecutionTime` value is persisted and displayed on the task card.
8. Given the time popup is open with an existing time, when the user chooses clear time, then `ExecutionTime` becomes an empty string after the change is accepted and the card no longer displays a time.
9. Given the time popup is open, when the user cancels or closes it without accepting, then the task and its persisted `ExecutionTime` remain unchanged and the popup closes.
10. Given an execution-time value is invalid or persistence fails, when the API returns an error, then the prior value remains intact and a clear non-sensitive error is exposed.
11. Given keyboard or assistive-technology usage, when the clock control or popup is used, then the control has an accessible name, focus is usable, and the time value is not communicated by color alone.

## Data Contract

- Add `ExecutionTime` to the task model and task create/update/read contracts.
- `ExecutionTime` is a required string property at the model boundary.
- Use `""` when no time is configured.
- Use the exact `hh:mm` representation when a time is configured.
- The accepted selector range is `00:00` through `24:00`, subject to the chosen browser control's representable value and explicit validation.

## Tasks / Subtasks

### Task 1 - Task model and persistence

- [ ] Add the `ExecutionTime` string property to the task domain model with an empty-string default.
- [ ] Add database mapping and migration using the existing PostgreSQL conventions.
- [ ] Preserve existing tasks by backfilling `ExecutionTime` to `""`.
- [ ] Validate empty string or `hh:mm` values and reject malformed times without changing the prior value.

### Task 2 - Authenticated API and editor

- [ ] Extend task create, update, and response contracts with `ExecutionTime`.
- [ ] Preserve the value through task creation and editing, including the empty-string case.
- [ ] Add the clock action and small time popup to the existing task-card/editor interaction patterns.
- [ ] Support select, accept, clear, cancel, and keyboard dismissal behavior.

### Task 3 - Board presentation

- [ ] Add the clock button as the first control in row one, before the optional execution time and title.
- [ ] Render a non-empty execution time immediately before the title.
- [ ] Keep completed-card minimization, status controls, edit/delete controls, and shared-week/day layouts intact.
- [ ] Ensure popup positioning and focus remain usable in workweek and full-week views.

### Task 4 - Tests and validation

- [ ] Test empty and populated `ExecutionTime` persistence through create, update, reload, and board rendering.
- [ ] Test the clock control, popup accept, clear, cancel, keyboard access, and accessible naming.
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

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Add Optional Task Execution Time]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#Phase 2: Board Overview]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Task card]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md]

## Definition of Done

- [ ] `ExecutionTime` persists as empty string or valid `hh:mm`.
- [ ] Task cards show the optional time before the title and expose the clock action first.
- [ ] Users can set, modify, clear, accept, or cancel an execution time.
- [ ] Popup and clock control are keyboard accessible and preserve existing card behavior.
- [ ] Focused tests and quality gates pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
