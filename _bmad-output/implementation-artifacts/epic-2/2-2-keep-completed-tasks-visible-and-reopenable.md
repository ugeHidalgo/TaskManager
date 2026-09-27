# Story 2.2: Keep Completed Tasks Visible and Reopenable

Status: done

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
2. Given a completed task, when it is rendered, then it uses the minimized gray presentation, keeps only the first and second rows visible, hides the description row, and displays the title with strikethrough while keeping essential controls visible.
3. Given a completed task, when the user chooses reopen, then it returns to the active presentation and the reopened state is persisted.
4. Given the board reloads or the user returns to the same week, when data is loaded, then completed tasks remain visible and reopenable.
5. Given accessibility mode, when completion state is rendered, then it is communicated with a non-color cue and accessible control name.
6. Given a completion request fails, when the API returns an error, then the UI rolls back to the previous state and exposes a non-sensitive actionable error.
7. Given a task card is rendered, when its layout is displayed, then the title appears alone in the first row, the checkbox, status, and edit control appear together in the second row, and the description appears in a third row when present.
8. Given a task has `In Progress` status, when its card is rendered, then its status label appears alongside the checkbox and edit control in the second row.
9. Given a task is `Not Started` or `Completed`, when its card is rendered, then no `In Progress` label is shown and the current card presentation remains intact.
10. Given a task is completed, when its card is rendered, then only the title row and controls/status row remain visible, its optional description is hidden, and its title uses strikethrough styling.
11. Given a task card is rendered, when the user chooses permanent deletion, then a confirmation popup appears; confirming removes the task from the database and board, while cancelling leaves the task unchanged and closes the popup.

## Tasks / Subtasks

### Task 1 - Completion state integration

- [x] Extend the task status model and API update flow from Story 2.1.
- [x] Add an authenticated completion/reopen operation or use the established task update contract consistently.
- [x] Persist status without changing task placement or order context.

### Task 2 - Board presentation and interaction

- [x] Keep the completion checkbox adjacent to the task title.
- [x] Render completed tasks with minimized spacing and gray styling without hiding title or reopen action.
- [x] Provide a keyboard-operable reopen action and accessible state announcement.
- [x] Preserve shared-week/day placement and workweek/full-week rendering.

### Task 3 - Tests and validation

- [x] Test completion persistence, reopen persistence, reload behavior, and failed-operation rollback.
- [x] Test that completed tasks remain in their original section and position context.
- [x] Test non-color completion cues and accessible labels.
- [x] Run focused frontend/backend tests, lint, and builds.

### Task 4 - Reorganize task card into three rows

- [x] Put the task title by itself in the first row.
- [x] Put the completion checkbox, status label (when status is `In Progress`), and edit button together in the second row.
- [x] Put the optional description/notes in a third row.
- [x] For completed tasks, hide the third-row description and strike through the title while retaining rows one and two.
- [x] Preserve completed-card compact styling, keyboard access, and workweek/full-week layouts.
- [x] Add frontend regression tests for the three-row structure, status-label visibility, and completed-task row/title presentation.

### Task 5 - US2-2 interaction and status refinements

- [x] Cycle checkbox state through `Not Started`, `In Progress`, and `Completed`, marking the checkbox only for `Completed`.
- [x] Show the `Not Started` status label in blue and keep `Completed` without a status label.
- [x] Keep the edit control icon-only with a transparent background and no visible border at rest.
- [x] Show the edit control border on pointer hover and keyboard focus without losing accessible focus indication.
- [x] Blink the status-change message for 10 seconds, keep it static for 5 seconds, and then remove it.
- [x] Validate the refinements with focused frontend tests, lint, production build, and Docker frontend rebuild.

### Task 6 - Permanent task deletion

- [x] Add an authenticated `DELETE` task endpoint scoped to the selected week workspace.
- [x] Add an icon-only `X` delete button beside the edit button with accessible naming and keyboard focus styling.
- [x] Show a confirmation popup before deletion; cancel keeps the task in place and closes the popup.
- [x] Remove the task from persistence and the board only after confirmation succeeds.
- [x] Add frontend and backend regression coverage for confirmation, cancellation, persistence, week scoping, and authorization.

## Scope Boundaries

- Do not implement date-range batch creation (Story 2.4), day/week completion calculations, reorder, or unsaved-change protection.
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

- [x] Tasks can be completed and reopened from the board.
- [x] Completed tasks remain visible, minimized, and persist across reloads.
- [x] Completion state has a non-color accessible cue.
- [x] Failed updates roll back without losing the prior task state.
- [x] Focused tests and quality gates pass.
- [x] Task cards use the requested three-row layout; completed cards show only the first two rows and strike through the title.
- [x] Tasks can be permanently deleted after explicit confirmation, with cancellation preserving the task.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Reused Story 2.1's authenticated task update contract; no new endpoint or persistence schema was needed.
- Added regression coverage for complete/reopen persistence and stable placement/order, plus unauthenticated update rejection without state mutation.
- Task 2 replaces the double-click status cycle with a native, task-labelled checkbox; completion persists as `Completed` and reopening persists as `Not Started` without optimistic state changes.
- Completed cards use compact neutral-gray styling with readable titles, visible edit/reopen controls, keyboard focus indication, and polite success/failure announcements.
- Existing `In Progress` tasks retain a visible textual status cue; controls use distinct board-position-prefixed accessible names.
- Board task controls remain disabled during status persistence or editor saves, preventing overlapping updates from applying stale results.
- Validation: 23 focused frontend tests passed; ESLint, the frontend production build, and `git diff --check` passed.
- Reopened the story to reorganize task cards: title first, checkbox/status/edit controls second, and description third.
- Added permanent deletion with week-scoped authenticated API, confirmation popup, cancellation preservation, and frontend/backend regression coverage.

### File List

- `src/backend/tests/TaskApiTests.cs`
- `src/backend/tests/TaskAuthorizationTests.cs`
- `src/frontend/src/pages/BoardPage.tsx`
- `src/frontend/src/features/board/components/WeekLayout.tsx`
- `src/frontend/src/features/board/components/WeekSection.tsx`
- `src/frontend/src/features/board/components/DayColumn.tsx`
- `src/frontend/src/features/board/styles/board-layout.css`
- `src/frontend/src/pages/BoardPage.test.tsx`
- `src/frontend/src/api/board.ts`
- `src/backend/src/TaskManager.Api/Program.cs`
- `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs`
- `src/backend/tests/TaskApiTests.cs`
- `src/backend/tests/TaskAuthorizationTests.cs`
