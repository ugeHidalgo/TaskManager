# Story 2.4: Manage Recurring Tasks

Status: ready-for-dev

Epic: 2 - Task Lifecycle and Completion
Story ID: 2.4
Estimation: M (reassess for multi-week batch creation)
Dependencies: Story 2.1 task model and board integration; Story 2.3 execution-time field.

---

## Story

As a planner,
I want to create one task for every day in a chosen date range and manage each task individually,
so that I can plan repeated work without separate daily checks or a recurring template.

## Acceptance Criteria

1. Given `New Task` is open, when the form renders, then a `Recurring task` checkbox is shown immediately below `Notes` and is unchecked by default. Without recurrence selected, the existing single-task placement and creation flow remains unchanged.
2. Given the checkbox is checked, when recurrence fields appear immediately below it, then accessible start-date and end-date date pickers default to the Monday of the currently viewed week and to that week's Friday in workweek view or Sunday in full-week view, respectively. `Placement` is hidden because each generated task receives the day corresponding to its date; `Execution Time`, `Notes`, and `Status` remain available for the batch.
3. Given the checkbox is unchecked again, when the form returns to ordinary creation, then the recurrence dates are hidden, ordinary `Placement` becomes editable again, and saving creates only one ordinary task.
4. Given a valid inclusive start/end range, when the user saves, then exactly one ordinary day task is persisted for **each calendar date** from start through end (including weekends, even if workweek view hides them). Each task receives its own identity and day placement, plus the same title, execution time, notes, and initial status entered in the form. A range can cross week boundaries; every task belongs to the week containing its own date.
5. Given a start date after the end date, a missing/invalid date, or an invalid task field, when saving is attempted, then inline validation prevents creation and retains the draft. The server also validates the range and task fields. A failed batch must not leave only some of the requested tasks persisted; show a non-sensitive error and retain the draft for retry.
6. Given a successful batch, when the user views an affected week, then the created tasks appear in their respective day columns (Saturday/Sunday in full-week view); workweek mode does not display weekend columns. Week navigation and reload preserve the created tasks and their values. Success feedback reports the number of tasks created.
7. Given any task created by the batch, when the user edits its fields or status, completes/reopens it, or confirms its deletion, then only that individual task changes. The existing edit, completion, and delete-confirmation flows apply; siblings in the range are neither updated nor deleted.
8. Given a selected board week that differs from the calendar's current week, when the form opens, then the read-only week and default dates use the **currently viewed board week**, not today's week. Switching view mode before opening the form changes only the default end date, not any previously saved instances.

## Tasks / Subtasks

### Task 1 - New Task form and date defaults

- [ ] Add unchecked `Recurring task` checkbox directly beneath `Notes` in the existing New Task form.
- [ ] When checked, place `Start date` and `End date` date pickers directly below the checkbox, in that order; use the selected board week's Monday and its Friday/Sunday according to the current view mode as defaults.
- [ ] While checked, hide `Placement` because day placement is assigned from each generated date; while unchecked, preserve the ordinary editable placement, including day and shared-week options.
- [ ] Keep title, execution time, notes, and status available for every generated day; do not discard a valid execution time because the batch is initiated from week context.
- [ ] Validate title, execution time, dates, and chronological range in the form, with accessible labels, keyboard support, and inline feedback.

### Task 2 - Atomic per-day task creation

- [ ] Provide an authenticated, workspace-scoped batch creation use case/endpoint using existing task data and API envelope conventions; no recurring-definition entity, weekday schedule, or daily-check resource.
- [ ] Validate start/end dates as ISO calendar dates and require start ≤ end; generate each date in the inclusive range without timezone drift, including weekend dates and week boundaries.
- [ ] Persist one independent day task per date in one atomic operation; ensure each generated task uses its containing Monday-based week and retains the entered title, execution time, notes, and status.
- [ ] Make a retry of the **same submission** safe (for example via an idempotency key), without blocking a later intentional creation of another batch with the same values.
- [ ] Return enough information for accurate count feedback and refresh/invalidate every affected board week; on failure, avoid partial persistence or misleading success feedback.

### Task 3 - Individual editing and deletion

- [ ] Use existing day-task card, editor, status toggle, and delete-confirmation flows for every generated task.
- [ ] Confirm that editing, completing/reopening, or deleting one generated task does not affect any other instance; do not add a series-wide edit/delete action.
- [ ] Preserve normal task presentation and day/week completion semantics for generated tasks; do not add a separate recurring section or per-day check control for this story.

### Task 4 - Tests and validation

- [ ] Test checkbox placement, default/selected-view dates, read-only placement, unchecking, accessible date inputs, and normal single-task regression.
- [ ] Test inclusive boundaries, weekend/full-week visibility, ranges spanning weeks, field copying (including execution time and initial status), invalid ranges, atomic failure, and duplicate prevention on retry.
- [ ] Test independent edit, completion/reopen, and confirmed deletion plus reload/week navigation and authentication.
- [ ] Run focused frontend/backend tests, lint, and builds during implementation.

## Scope Boundaries

- No recurring templates, recurrence rules, selected weekdays, automatic generation after the chosen end date, separate recurring section, or daily-check/completion-history records.
- No bulk edit/delete after creation. Do not change the existing single-task creation flow or the Story 2.2 individual-task completion/delete behavior.
- Do not implement day/week completion indicators, reorder, time tracking, or unsaved-change protection here; generated tasks feed the existing/future ordinary-task rules.

## Dev Notes

- This is a **one-time batch of ordinary tasks**, not a persistent recurrence definition. Once saved, the instances have no series-level synchronization or schedule to edit.
- `Placement` shows the currently selected board week when recurring creation is enabled; day placement is assigned from each generated date at save time. Ordinary single-task placement remains selectable.
- Use concrete `YYYY-MM-DD` dates and Monday-based week assignment. The date range is inclusive and may span multiple weeks; full-week view can display weekend tasks created by the batch.
- Execution time must be copied to each day task; existing ordinary shared-week tasks may continue to have no execution time.
- Reuse task CRUD, status, authentication, API error handling, and board cache invalidation conventions. Make batch creation atomic to prevent partial sets on failure.
- Existing planning/readiness documents from before this scope change may contain historical references; the current story and updated planning artifacts supersede their obsolete recurring-template assumptions.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Manage Recurring Tasks]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#FR-4: Recurring Tasks]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Quick add interactions]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-3-add-task-execution-time.md]

## Definition of Done

- [ ] The New Task checkbox and conditional date pickers produce the correct defaults for both board views; regular creation is unchanged.
- [ ] One independent task per inclusive date is saved atomically, including across weekends and week boundaries, with all entered fields copied.
- [ ] Individual task edit, completion, and confirmed deletion never affect sibling instances.
- [ ] Validation, accessibility, authenticated API, persistence, and regression tests pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
