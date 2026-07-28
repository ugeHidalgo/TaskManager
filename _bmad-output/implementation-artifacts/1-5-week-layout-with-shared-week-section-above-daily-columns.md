# Story 1.5: Week Layout with Shared Week Section Above Daily Columns

Status: in-progress

**Epic:** 1 - Secure Weekly Workspace  
**Story ID:** 1.5  
**Estimation:** M (Medium - 3-5 days)  
**Dependencies:** Story 1-4 (frontend login and session lifecycle) ✅ COMPLETED  
**Blocking:** Story 1-6 (week navigation and range resolution)

---

## Story

As a user,
I want to see a weekly board with a shared week section and daily columns,
so that I can organize tasks by week and day efficiently.

## Acceptance Criteria

1. **Given** a user is logged in, **When** accessing the board, **Then** a week layout is displayed with:
   - A shared "week" section at the top containing tasks for the entire week
   - Seven daily columns below (Mon-Sun) for day-specific tasks
   - Current date/week range indicator in the header

2. **Given** the week layout is displayed, **When** examining the visual structure, **Then**:
   - Week section takes full width above columns
   - Daily columns are equally sized and labeled with day name + date
   - Section headers are clearly differentiated (week vs daily)
   - Layout is responsive and looks good on desktop (tablet/mobile in future)

3. **Given** tasks exist in the system, **When** the board loads, **Then**:
   - Empty states are shown in sections with no tasks
   - Task containers are ready to receive tasks (scaffolding for future story 2.1)
   - Section styling makes it clear where tasks can be added

4. **Given** the board is rendered, **When** inspecting accessibility, **Then**:
   - Semantic HTML is used (section, article, or div with proper roles)
   - Week range information is present in page header
   - Daily columns have clear labels for screen readers

---

## Tasks / Subtasks

### Task 1: Create WeekLayout component structure (AC: 1, 2, 3)

- [x] Create `frontend/src/features/board/components/WeekLayout.tsx`
  - [x] Container with CSS grid layout (1 row for week section, 1 row for day columns)
  - [x] Accepts week props (`weekStart`, `weekEnd`) and task content placeholders (`weekContent`, `dayContent`)
  - [x] Renders WeekSection and DayColumn components
  - [x] Responsive grid (full width, overflow handled)

- [x] Create `frontend/src/features/board/components/WeekSection.tsx`
  - [x] Takes full width above daily columns
  - [x] Header with "Week Tasks" label + week range display (e.g., "Jul 29 - Aug 4")
  - [x] Container for tasks (empty state by default)
  - [x] Styling distinguishes it from daily sections (different background, border, spacing)

- [x] Create `frontend/src/features/board/components/DayColumn.tsx`
  - [x] Receives `date: Date`, `dayName: string` (Mon, Tue, etc.)
  - [x] Header with day name and date (e.g., "Monday, Jul 29")
  - [x] Container for day-specific tasks (empty state by default)
  - [x] Consistent height and equal width within grid
  - [x] Subtle visual feedback (hover state, borders) ready for drag-drop future story

### Task 2: Integrate WeekLayout into board page (AC: 1, 2)

- [x] Update `frontend/src/pages/BoardPage.tsx`
  - [x] Remove placeholder/test content
  - [x] Import and use WeekLayout component
  - [x] Pass calculated week data:
    - [x] Calculate `weekStart` as Monday of current week
    - [x] Calculate `weekEnd` as Sunday of current week
  - [x] Display week range in page title/header ("Board - Week of ...")

- [x] Create `frontend/src/features/board/hooks/useWeekCalculation.ts`
  - [x] Export `getWeekRange(date: Date)` → `{ weekStart, weekEnd }`
  - [x] Export `formatWeekDisplay(weekStart, weekEnd)` → "Jul 29 - Aug 4" format
  - [x] Handle week boundaries correctly (Monday as week start)
  - [x] Support current week calculation by default

### Task 3: Build responsive styling and empty states (AC: 2, 3, 4)

- [ ] Create `frontend/src/features/board/styles/board-layout.css` or use Tailwind
  - [ ] Grid layout: 1 full-width row (week) + 7 equal columns (days)
  - [ ] Minimum height for columns to ensure visual separation
  - [ ] Padding/spacing inside sections for visual clarity
  - [ ] Border and background colors for section differentiation
  - [ ] Media queries for responsive behavior (future: tablet/mobile variants)

- [ ] Implement empty states
  - [ ] Empty WeekSection: "No week tasks" placeholder or visual indicator
  - [ ] Empty DayColumn: Light background or subtle text ("No tasks for {day}")
  - [ ] Consistent styling across all empty sections

- [ ] Accessibility enhancements
  - [ ] Use semantic HTML: `<section>` for week/day sections, `<article>` or `<div role="region">` for containers
  - [ ] Add `aria-label` to sections (e.g., "Week tasks", "Monday July 29")
  - [ ] Add `aria-live="polite"` if tasks will be dynamically added (future story)

### Task 4: Create helper utilities for date/week calculations (AC: 1)

- [ ] Create `frontend/src/shared/utils/dateUtils.ts`
  - [ ] `getWeekStart(date: Date): Date` → Monday of that week
  - [ ] `getWeekEnd(date: Date): Date` → Sunday of that week
  - [ ] `getDayName(date: Date): string` → "Monday", "Tuesday", etc.
  - [ ] `formatDate(date: Date): string` → "Jul 29" format
  - [ ] `formatMonthDay(date: Date): string` → "July 29"

- [ ] Create unit tests for date utilities
  - [ ] Test week start calculation (ensures Monday is returned)
  - [ ] Test week end calculation (ensures Sunday is returned)
  - [ ] Test edge cases (year boundaries, leap years)
  - [ ] Test formatting for various locales if applicable

### Task 5: Validation and documentation (AC: 4)

- [ ] Test component tree renders without errors
  - [ ] WeekLayout → WeekSection + 7 DayColumns
  - [ ] All props flow correctly through component hierarchy
  - [ ] No console warnings or TypeScript errors

- [ ] Verify accessibility
  - [ ] Test screen reader navigation (NVDA, JAWS, or browser screen reader)
  - [ ] Verify semantic HTML structure
  - [ ] Check color contrast for visual sections

- [ ] Create inline comments documenting
  - [ ] Component props and their purpose
  - [ ] Week calculation logic and edge cases
  - [ ] Empty state styling approach for future customization

---

## Technical Notes

- **Date Library:** Use native `Date` or lightweight `date-fns` if needed (check project dependencies)
- **Styling:** Leverage existing Tailwind CSS config from Story 1.4 frontend setup
- **Component Structure:** Follow React hooks pattern used in AuthContext and LoginPage
- **No Backend Changes:** This story is frontend-only; backend remains unchanged
- **Future Integration:** Story 2.1 will add task rendering inside WeekSection and DayColumn containers

---

## Definition of Done

- [ ] WeekLayout component renders without errors
- [ ] Week and daily sections are visually distinct and properly sized
- [ ] Week range is correctly calculated for current week
- [ ] All seven days are displayed with proper labels and dates
- [ ] Empty states are shown when no tasks exist
- [ ] Accessibility requirements met (semantic HTML, aria-labels)
- [ ] Date utility functions are tested and documented
- [ ] BoardPage uses WeekLayout and displays week range header
- [ ] No TypeScript errors or ESLint warnings
- [ ] Manual verification: Layout looks correct at desktop resolution
- [ ] Responsive design prepared (CSS breakpoints ready for tablet/mobile in future)

---

## Rollout Checklist

- [ ] Feature branch created from `main`
- [ ] All tasks completed and tested locally
- [ ] Code review completed (run via `code-review` skill)
- [ ] Smoke tests pass (existing auth tests + new component rendering)
- [ ] PR merged to `main`
- [ ] Sprint status updated to "done"
- [ ] Story 1.6 created and ready for development
