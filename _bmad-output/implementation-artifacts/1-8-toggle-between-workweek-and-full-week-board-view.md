# Story 1.8: Toggle Between Workweek and Full-Week Board View

Status: backlog

Epic: 1 - Secure Weekly Workspace
Story ID: 1.8
Estimation: S-M (1-2 days)
Dependencies: Story 1.5 baseline week layout

---

## Story

As a planner,
I want to switch board columns between workweek and full-week,
so that I can focus on business days or plan across all seven days.

## Acceptance Criteria

1. Given the board is loaded, when user sees the header, then a selector is available with two options:

- Workweek (Mon-Fri)
- Full week (Mon-Sun)

And default mode is Workweek.

2. Given mode is Workweek, when board renders, then exactly 5 day columns are shown (Monday to Friday).

3. Given mode is Full week, when board renders, then exactly 7 day columns are shown (Monday to Sunday).

4. Given user changes mode, when selection changes, then the board rerenders immediately without page reload.

5. Given user selected a mode previously, when user reloads app, then selected mode is restored from localStorage key `taskmanager.boardViewMode` using values `workweek` or `fullweek`.

6. Given any mode, when board renders, then empty states and accessibility labels remain correct.

7. Given mode is switched between Workweek and Full week, when board rerenders, then Week section, header, and empty-state behavior remain unchanged except for day-column count.

---

## Tasks / Subtasks

### Task 1 - Header selector

- [ ] Add board mode selector in `src/frontend/src/pages/BoardPage.tsx`
- [ ] Options:
  - [ ] `workweek`
  - [ ] `fullweek`
- [ ] Ensure keyboard accessible native control (`select` or segmented buttons with roles)

### Task 2 - Layout conditional rendering

- [ ] Extend `WeekLayout` props to accept mode
- [ ] Render day list by mode:
  - [ ] Workweek: Monday-Friday
  - [ ] Fullweek: Monday-Sunday
- [ ] Keep week section behavior unchanged

### Task 3 - Persistence and state

- [ ] Store selected mode in localStorage
  - [ ] Key: `taskmanager.boardViewMode`
  - [ ] Allowed values: `workweek`, `fullweek`
- [ ] Restore mode on board load
- [ ] Fallback default mode (`workweek`) if value missing/invalid

### Task 4 - Tests

- [ ] Add/extend component tests for mode-specific column counts
- [ ] Add test for selector-driven rerender behavior
- [ ] Add test for localStorage restore behavior
- [ ] Add no-regression test ensuring Week section and empty states remain stable across both modes
- [ ] Keep existing week/date tests passing

### Task 5 - Validation

- [ ] Run frontend tests (`npm run test:run --prefix src/frontend`)
- [ ] Run lint (`npm run lint --prefix src/frontend`)
- [ ] Run build (`npm run build --prefix src/frontend`)

---

## Notes

- First iteration is frontend-only.
- Do not change backend contracts.
- Keep auth/session flow untouched.
