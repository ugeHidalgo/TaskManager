# Story 2.5: Protect Unsaved Changes During Navigation

Status: ready-for-dev

Epic: 2 - Task Lifecycle and Completion  
Story ID: 2.5  
Estimation: M (2-3 days)  
Dependencies: Story 2.1 editor and navigation integration completed.

---

## Story

As a planner,  
I want warnings before losing unsaved edits,  
so that I do not accidentally discard in-progress changes.

## Acceptance Criteria

1. Given there are unsaved changes, when the user attempts route change, week change, or page leave, then a confirmation modal appears and navigation is blocked pending a decision.
2. Given the user cancels navigation, when the modal closes, then the current draft remains intact and the user stays in the current view.
3. Given the user confirms discard, when navigation proceeds, then unsaved changes are dropped safely and the destination loads without stale draft state.
4. Given no unsaved changes, when the user navigates, then no blocking prompt is shown.
5. Given the user chooses Save & Leave where saving is supported, when save succeeds, then navigation proceeds with persisted data; when save fails, navigation remains blocked and the draft remains available.
6. Given the browser is closing or reloading with unsaved changes, when the platform allows a before-unload warning, then the browser receives the unsaved state signal without exposing sensitive draft content.
7. Given keyboard or assistive-technology usage, when the modal opens, then focus is trapped predictably, controls are labelled, and the decision is announced.

## Tasks / Subtasks

### Task 1 - Track draft state

- [ ] Define one source of truth for dirty state across task create/edit forms and supported board editors.
- [ ] Mark drafts dirty only after meaningful changes and clear dirty state after successful save or explicit discard.
- [ ] Prevent stale drafts from leaking into a newly selected week or route.

### Task 2 - Navigation guard

- [ ] Guard week previous/current/next actions and route changes using the existing router/navigation patterns.
- [ ] Register and clean up the browser `beforeunload` handler only while dirty state exists.
- [ ] Ensure no prompt appears for ordinary navigation when there are no unsaved changes.

### Task 3 - Confirmation modal

- [ ] Build or reuse the existing modal pattern with Stay, Discard, and Save & Leave actions where applicable.
- [ ] Keep the modal keyboard-operable with focus management, escape/cancel behavior, and clear button labels.
- [ ] Preserve the current board layout and do not silently reset form state on cancellation.
- [ ] Use concise corrective microcopy and avoid exposing draft contents in browser-native warnings.

### Task 4 - Tests and validation

- [ ] Test route, week, and browser-leave protection with dirty and clean states.
- [ ] Test cancel, discard, successful save-and-leave, and failed save-and-leave flows.
- [ ] Test focus behavior and keyboard interaction for the modal.
- [ ] Test cleanup after save/discard and prevent stale draft state after navigation.
- [ ] Run focused frontend tests, lint, and build; include browser-level checks if the test framework supports them.

## Scope Boundaries

- Do not redesign task editing or add new task fields.
- Do not implement generic navigation confirmation for unrelated future editors; guard the task flows present in this application.
- Do not block navigation when there are no unsaved changes.

## Dev Notes

- Integrate with the editor and navigation state created by Story 2.1 rather than duplicating route logic.
- Week navigation currently changes selected date in `BoardPage.tsx`; guards must wrap those actions without breaking functional +/-7-day updates.
- `beforeunload` behavior is browser-controlled and may show only a generic message; do not depend on custom text.
- The modal must not rely on color alone and must preserve focus and draft contents when the user chooses Stay.
- Preserve authentication, board view mode, task persistence, and stale-request protection.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5: Protect Unsaved Changes During Navigation]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md#Edge Case 2: Unsaved Changes]
- [Source: _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/FR-7: Unsaved Changes Protection]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Week navigation states]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md#Accessibility Floor]
- [Source: _bmad-output/implementation-artifacts/epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md]

## Definition of Done

- [ ] Dirty task drafts block supported navigation.
- [ ] Stay, Discard, and Save & Leave behavior is correct and tested.
- [ ] Browser leave protection is registered only when needed.
- [ ] Modal accessibility and draft cleanup behavior pass validation.
- [ ] Focused tests and quality gates pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
