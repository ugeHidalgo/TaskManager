---
title: "Story 2.2 Task 2: Completed Task Board Presentation"
type: feature
created: "2026-09-26"
baseline_commit: "812d44daa69afa2c4b3c05c70548ab80006aec18"
status: done
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md"
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Completed tasks currently look like active tasks and can only change status through a double-click cycle, so reopening is not discoverable or keyboard-operable.

**Approach:** Replace the status indicator with a labelled native completion checkbox next to the title, give completed cards a compact neutral-gray treatment while retaining title and actions, and announce completion/reopening through the existing status message. Reuse the persisted task update flow and keep changes non-optimistic so failures retain the prior board state.

## Boundaries & Constraints

**Always:** Preserve task identity, section, relative order, workweek/full-week behavior, authentication, existing status values, and the existing update/error contract. Keep text readable and completion state apparent without color alone; support keyboard interaction and accessible names.

**Ask First:** Any change to backend/API behavior or an interaction that discards an active status other than the established reopen-to-`Not Started` behavior.

**Never:** Add recurring-task behavior, drag-and-drop, day/week completion calculations, unsaved-change prompts, database/API changes, or a second task state store.

## I/O & Edge-Case Matrix

| Scenario           | Input / State                        | Expected Output / Behavior                                                      | Error Handling                                     |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| Complete task      | Unchecked task checkbox activated    | Persist `Completed`; task remains in place/order and becomes compact gray       | Keep prior status and announce actionable error    |
| Reopen task        | Checked task checkbox activated      | Persist `Not Started`; restore normal card treatment and keep placement/order   | Keep completed state and announce actionable error |
| Keyboard use       | Checkbox focused, Space pressed      | Same complete/reopen behavior as pointer activation; checked state is announced | No pointer-only event dependency                   |
| View switch/reload | Completed task in day/shared section | Task remains in the corresponding section when returned/rendered                | Existing loading behavior                          |

</frozen-after-approval>

## Code Map

- `src/frontend/src/pages/BoardPage.tsx` -- task status mutation and card rendering.
- `src/frontend/src/features/board/styles/board-layout.css` -- task-card layout and status styles.
- `src/frontend/src/pages/BoardPage.test.tsx` -- board interaction, accessibility, placement, and failure regressions.
- `src/frontend/src/api/board.ts` -- existing authenticated task-update contract; preserve without changes.

## Tasks & Acceptance

**Execution:**

- [x] `src/frontend/src/pages/BoardPage.tsx` -- use a task-specific native checkbox for complete/reopen and clear live status feedback -- make the action direct, discoverable, and keyboard-operable.
- [x] `src/frontend/src/features/board/styles/board-layout.css` -- add compact gray completed-card treatment and visible focus feedback without hiding title or controls -- preserve readability and task access.
- [x] `src/frontend/src/features/board/components/WeekLayout.tsx`, `WeekSection.tsx`, and `DayColumn.tsx` -- disable board mutation entry points while an update/editor save is pending -- prevent stale concurrent refreshes from replacing newer status.
- [x] `src/frontend/src/pages/BoardPage.test.tsx` -- cover keyboard toggling, accessible state/name, completed presentation, placement/order/view mode, persistence on reload, and failed-update retention -- prevent interaction and regression gaps.

**Acceptance Criteria:**

- Given an active task, when its checkbox is activated, then it becomes completed without changing section or relative position.
- Given a completed task, when its checkbox is activated, then it reopens, returns to normal presentation, and remains in the same section/order.
- Given a completed task, when rendered, then its title and edit/reopen controls remain visible in a compact gray card and completion is not conveyed by color alone.
- Given keyboard-only use, when the checkbox is focused and Space is pressed, then the same completion/reopen transition occurs and its checked state is accessible.
- Given a failed update, when the API rejects the change, then the previous status/presentation remains and a useful non-sensitive message is announced.
- Given a board mutation is pending, when another task action is attempted, then task create/edit/completion actions remain disabled until it settles.
- Given shared-week/day placement or workweek/full-week mode changes, when the board renders, then completed tasks remain in the proper context and survive a reload.

## Verification

**Commands:**

- `npm run test:run -- src/pages/BoardPage.test.tsx src/features/board/components/WeekLayout.test.tsx src/api/board.test.ts` -- expected: focused frontend tests pass.
- `npx eslint src/pages/BoardPage.tsx src/pages/BoardPage.test.tsx` -- expected: no lint errors.
- `npm run build` -- expected: TypeScript and Vite build succeed.

**Verification note (2026-09-26):** Focused frontend tests passed (3 files, 23 tests); focused ESLint passed with no errors; frontend production build passed (TypeScript and Vite); `git diff --check` passed. Completion controls have distinct position-prefixed accessible names, and board task actions are serialized while an editor/status update is pending to prevent stale overlapping updates. `In Progress` remains visible with a textual cue.

## Suggested Review Order

**Completion and status behavior**

- The existing authenticated update flow persists complete/reopen without optimistic changes.
  [`BoardPage.tsx:156`](../../src/frontend/src/pages/BoardPage.tsx#L156)
- The checkbox exposes a unique task position, retains In Progress text, and keeps edit available.
  [`BoardPage.tsx:328`](../../src/frontend/src/pages/BoardPage.tsx#L328)
- Completed cards are compact while focus and state remain visually discernible.
  [`board-layout.css:130`](../../src/frontend/src/features/board/styles/board-layout.css#L130)

**Mutation serialization**

- The page computes the pending action state and forwards it to the layout.
  [`BoardPage.tsx:98`](../../src/frontend/src/pages/BoardPage.tsx#L98)
- Week and day entry points disable creation while a board mutation is pending.
  [`WeekLayout.tsx:17`](../../src/frontend/src/features/board/components/WeekLayout.tsx#L17)
- The shared-week create control respects the disabled state.
  [`WeekSection.tsx:34`](../../src/frontend/src/features/board/components/WeekSection.tsx#L34)
- Day-column create controls respect the same disabled state.
  [`DayColumn.tsx:40`](../../src/frontend/src/features/board/components/DayColumn.tsx#L40)

**Regression coverage and tracking**

- Keyboard complete/reopen and persisted status announcements are exercised here.
  [`BoardPage.test.tsx:258`](../../src/frontend/src/pages/BoardPage.test.tsx#L258)
- Failure rollback, order, reload, modes, and accessible duplicate names have focused tests.
  [`BoardPage.test.tsx:431`](../../src/frontend/src/pages/BoardPage.test.tsx#L431)
- Story acceptance, Definition of Done, and Task 2.2 are marked complete.
  [`2-2-keep-completed-tasks-visible-and-reopenable.md:3`](epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md#L3)
- Sprint tracking records Story 2.2 as done.
  [`sprint-status.yaml:58`](sprint-status.yaml#L58)
