# Story 2.4: Compute Day and Week Completion Status

Status: ready-for-dev

Epic: 2 - Task Lifecycle and Completion  
Story ID: 2.4  
Estimation: M (2-3 days)  
Dependencies: Stories 2.1, 2.2, and 2.3 completed.

---

## Story

As a planner,  
I want automatic day and week completion indicators,  
so that I can see closure status at a glance.

## Acceptance Criteria

1. Given all regular tasks for a day are complete, when board status recalculates, then the day is marked complete and its indicator appears in the day header.
2. Given any regular task in a day becomes incomplete, when board status recalculates, then the day completion marker is removed and the day returns to in-progress state.
3. Given all five weekdays are complete, when board status recalculates, then week completion feedback is shown in the header priority area.
4. Given at least one weekday is incomplete, when board status recalculates, then the week is not shown as complete.
5. Given a day has no regular tasks, when status is calculated, then the implementation follows one documented rule consistently and does not show a false completed state.
6. Given status is loaded after reload or week navigation, when the board renders, then day and week indicators match persisted task and recurring-check state.
7. Given status calculation or loading fails, when the API returns an error, then the board keeps task data visible and exposes a non-sensitive status error without falsely claiming completion.

## Tasks / Subtasks

### Task 1 - Define completion rules

- [ ] Centralize day and week status calculation in the backend/read model or a shared domain service, with one authoritative rule.
- [ ] Define how recurring daily checks participate in the day rule and document the empty-day behavior.
- [ ] Ensure completed tasks remain visible and reopened tasks immediately invalidate affected indicators.

### Task 2 - API and frontend state

- [ ] Extend the board response or add a focused status contract using the existing `{ data, meta }` envelope.
- [ ] Recalculate status after task status changes and recurring daily checks without a full page reload.
- [ ] Render day indicators in each day header and week feedback in the existing header priority area.
- [ ] Keep indicators correct in workweek and full-week views; week completion is based on Monday-Friday only.

### Task 3 - Accessibility and feedback

- [ ] Provide semantic labels and non-color cues for day and week completion.
- [ ] Announce status changes accessibly without noisy repeated announcements.
- [ ] Use the existing low-noise visual feedback and motion policy.

### Task 4 - Tests and validation

- [ ] Test transitions incomplete → complete and complete → incomplete for a day.
- [ ] Test all-five-weekdays completion and one-incomplete-day behavior.
- [ ] Test empty days, recurring checks, reload, navigation, full-week mode, and failed status loading.
- [ ] Run focused frontend/backend tests, lint, and builds.

## Scope Boundaries

- Do not add task editing, recurring-task CRUD, time tracking, reorder, delete confirmation, or unsaved-change handling.
- Do not treat Saturday/Sunday as required for week completion; the product week-completion rule is Monday-Friday.

## Dev Notes

- Use task status as the source for regular-task completion and the Story 2.3 per-day state for recurring checks.
- Avoid duplicating completion logic across API and frontend. The frontend may render the authoritative read model and optimistically update only where rollback is defined.
- Preserve board layout, navigation, view-mode persistence, task visibility, and authentication.
- Completion indicators must be trustworthy after reload, not derived only from transient component state.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Compute Day and Week Completion Status]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#FR-5: Day Completion Tracking]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#FR-6: Week Completion Feedback]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Weekly board structure]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-3-manage-recurring-tasks-and-daily-checks.md]

## Definition of Done

- [ ] Day completion indicators accurately reflect current task/check state.
- [ ] Week completion feedback appears only when all five weekdays satisfy the documented rule.
- [ ] Status survives reload and navigation and remains accessible.
- [ ] Focused tests and quality gates pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
