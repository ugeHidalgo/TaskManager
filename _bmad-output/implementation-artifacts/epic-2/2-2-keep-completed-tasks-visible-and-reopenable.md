# Story 2.2: Keep Completed Tasks Visible and Reopenable

Status: ready-for-dev

Epic: 2 - Task Lifecycle and Completion  
Story ID: 2.2  
Estimation: S (1-2 days)  
Dependencies: Story 2.1 completed.

---

## Story

As a planner,  
I want completed tasks to remain visible in a minimized gray style and be reopenable,  
so that I can keep progress context without losing the ability to reactivate work.

## Acceptance Criteria

1. Given an active task, when the user marks it completed, then the task remains in the same board section and position context, and its completion state is persisted.
2. Given a completed task, when it is rendered, then it uses the minimized gray presentation while keeping its title and essential controls visible.
3. Given a completed task, when the user chooses reopen, then it returns to the active presentation and the reopened state is persisted.
4. Given the board reloads or the user returns to the same week, when data is loaded, then completed tasks remain visible and reopenable.
5. Given accessibility mode, when completion state is rendered, then it is communicated with a non-color cue and accessible control name.
6. Given a completion request fails, when the API returns an error, then the UI rolls back to the previous state and exposes a non-sensitive actionable error.

## Tasks / Subtasks

### Task 1 - Completion state integration

- [ ] Extend the task status model and API update flow from Story 2.1.
- [ ] Add an authenticated completion/reopen operation or use the established task update contract consistently.
- [ ] Persist status without changing task placement or order context.

### Task 2 - Board presentation and interaction

- [ ] Keep the completion checkbox adjacent to the task title.
- [ ] Render completed tasks with minimized spacing and gray styling without hiding title or reopen action.
- [ ] Provide a keyboard-operable reopen action and accessible state announcement.
- [ ] Preserve shared-week/day placement and workweek/full-week rendering.

### Task 3 - Tests and validation

- [ ] Test completion persistence, reopen persistence, reload behavior, and failed-operation rollback.
- [ ] Test that completed tasks remain in their original section and position context.
- [ ] Test non-color completion cues and accessible labels.
- [ ] Run focused frontend/backend tests, lint, and builds.

## Scope Boundaries

- Do not implement recurring-task daily checks, day/week completion calculations, delete confirmation, reorder, or unsaved-change protection.
- Do not remove completed tasks from API responses or board lists.

## Dev Notes

- Extend the task model and editor/API patterns created by `2-1`; do not create a second task state store.
- Use existing `{ data, meta }` success and structured `{ error }` failure envelopes.
- Status values remain `Not Started`, `In Progress`, and `Completed`.
- Completion state must not depend on color alone; use text, icon, checkbox state, or an equivalent semantic cue.
- Preserve authentication, week navigation, localStorage view mode, and existing board layout.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Keep Completed Tasks Visible and Reopenable]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#Phase 4: During the Day – Task Completion]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Task states]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Accessibility Floor]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md]

## Definition of Done

- [ ] Tasks can be completed and reopened from the board.
- [ ] Completed tasks remain visible, minimized, and persist across reloads.
- [ ] Completion state has a non-color accessible cue.
- [ ] Failed updates roll back without losing the prior task state.
- [ ] Focused tests and quality gates pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
