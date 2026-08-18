# Story 1.6: Week Navigation and Range Resolution

Status: review

Epic: 1 - Secure Weekly Workspace
Story ID: 1.6
Estimation: S-M (1-2 days)
Dependencies: Story 1.5 baseline week layout

---

## Story

As a planner,
I want to move to previous and next weeks,
so that I can review and plan across time.

## Acceptance Criteria

1. Given board is open, when user clicks next week, then selected week advances by 7 days and week label/range updates correctly.
2. Given board is open, when user clicks previous week, then selected week moves back by 7 days and week label/range updates correctly.
3. Given navigation to any week, when board data is requested, then API resolves deterministic Monday-based week_start_date and returns that week context.
4. Given rapid week navigation, when requests overlap, then only latest navigation result is rendered and stale responses do not overwrite current view.

---

## Tasks / Subtasks

### Task 1 - Frontend week navigation controls

- [x] Add previous/next week actions in BoardPage.
- [x] Use deterministic +/-7 day movement for navigation state.
- [x] Update week label/range immediately when navigation changes.

### Task 2 - Week range resolution contract

- [x] Define API query contract using Monday-based week_start_date.
- [x] Align frontend request parameter with backend expected format.

### Task 3 - Stale request protection

- [x] Use functional state updates to avoid stale local state under rapid clicking.
- [x] Add request-level stale response protection once async board data loading is integrated.

### Task 4 - Tests and validation

- [x] Extend date helper tests for deterministic 7-day shifts.
- [x] Add interaction test for previous/next navigation UI.
- [x] Run frontend test/lint/build checks after finishing remaining tasks.

Validation evidence:

- `npm run test:run -- src/api/board.test.ts src/features/board/hooks/useWeekCalculation.test.ts src/features/board/components/WeekLayout.test.tsx` → 3 files, 11 tests passed.
- `npm run test:run -- src/pages/BoardPage.test.tsx src/api/board.test.ts src/features/board/hooks/useWeekCalculation.test.ts src/features/board/components/WeekLayout.test.tsx` → 4 files, 12 tests passed.
- `npm run lint` and `npm run build` (frontend) → passed.
- `dotnet build TaskManager.sln` (backend) → passed.
- **Docker validation (2026-08-14):**
  - ✅ Docker stack deployed successfully (`docker compose up -d`)
  - ✅ Frontend loaded at http://localhost:5173
  - ✅ Week navigation buttons ("Previous week", "Next week") **visible and fully functional**
  - ✅ Click "Next week": Title changed "Aug 17-23" → "Aug 24-30", API query param updated `week_start_date=2026-08-24`
  - ✅ Click "Previous week": Returned to "Aug 17-23", API query param reset `week_start_date=2026-08-17`
  - ✅ Workspace data reloaded correctly for each week navigation
  - ✅ No UI visibility issues, CSS Grid layout holds button group visible at all times

---

## Definition of Done

- [x] Previous/next actions exist and update displayed week range.
- [x] Monday-based week_start_date is passed through API query flow.
- [x] Stale async responses are ignored in rapid navigation.
- [x] Navigation tests and quality gates pass.
