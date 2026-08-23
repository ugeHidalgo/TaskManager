# Story 2.3: Manage Recurring Tasks and Daily Checks

Status: ready-for-dev

Epic: 2 - Task Lifecycle and Completion  
Story ID: 2.3  
Estimation: M (2-4 days)  
Dependencies: Story 2.1 task model and board integration completed.

---

## Story

As a planner,  
I want recurring tasks and per-day completion checks,  
so that I can track habitual responsibilities across the week.

## Acceptance Criteria

1. Given recurring-task settings, when the user creates or updates a recurring task, then it appears in the recurring section with its selected schedule and the definition is persisted.
2. Given a recurring task is due on a day, when the user marks it done for that day, then only that day's completion state is persisted.
3. Given a recurring task is not checked for a day, when the day closes, then it remains incomplete for that day and does not auto-propagate to another day.
4. Given recurring data is loaded for any selected week, when the board renders, then recurring items are visually distinguishable from regular tasks and their daily controls remain usable.
5. Given the user changes the recurring schedule, when the update succeeds, then future rendering uses the new selected days without corrupting existing per-day completion history.
6. Given recurring create, update, or daily-check validation fails, when the API returns an error, then the draft or prior check state remains intact and a clear non-sensitive error is shown.

## Tasks / Subtasks

### Task 1 - Recurring domain and persistence

- [ ] Define recurring-task fields: stable identifier, title, optional notes, status, selected weekdays, and timestamps.
- [ ] Define per-day completion records keyed by recurring task and concrete ISO date; do not store one global completion flag.
- [ ] Add EF Core mappings, constraints, and migration using existing PostgreSQL conventions.
- [ ] Ensure recurring definitions are not duplicated when loading multiple weeks.

### Task 2 - Authenticated API

- [ ] Add versioned authenticated endpoints for recurring-task CRUD and per-day completion checks.
- [ ] Use explicit DTOs, camelCase JSON, ISO dates, and the existing success/error envelopes.
- [ ] Scope writes and reads to the authenticated workspace.
- [ ] Validate required title and selected weekday input server-side.

### Task 3 - Board integration

- [ ] Render recurring tasks in the existing recurring section above day columns.
- [ ] Render one check control per scheduled weekday and associate it with the concrete date.
- [ ] Keep daily checks independent when switching weeks or between workweek/full-week modes.
- [ ] Provide keyboard labels and screen-reader feedback for each daily check.

### Task 4 - Tests and validation

- [ ] Test recurring definition create/update persistence and selected-day behavior.
- [ ] Test checking one day does not change any other day.
- [ ] Test reload, week navigation, schedule changes, validation failures, and authenticated access.
- [ ] Run focused frontend/backend tests, lint, and builds.

## Scope Boundaries

- Do not implement regular-task completion styling beyond the behavior supplied by Story 2.2.
- Do not implement day/week completion indicators, time tracking, reorder, delete confirmation, or unsaved-change protection.

## Dev Notes

- Reuse the board's existing shared-section data flow and task presentation patterns.
- Recurring task definitions are distinct from regular task instances; daily completion must be modeled separately.
- Use deterministic Monday-based week context and concrete ISO calendar dates for checks.
- Completion is per day only and must never be inferred as a global recurring-task status.
- Preserve authentication, task CRUD, week navigation, and board view-mode behavior.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Manage Recurring Tasks and Daily Checks]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#Phase 2: Board Overview]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#FR-4: Recurring Tasks]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Task card]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md]

## Definition of Done

- [ ] Recurring definitions can be created and updated.
- [ ] Each scheduled day has an independent persisted completion check.
- [ ] Recurring tasks remain visible and distinguishable in the board.
- [ ] API, accessibility, and regression tests pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
