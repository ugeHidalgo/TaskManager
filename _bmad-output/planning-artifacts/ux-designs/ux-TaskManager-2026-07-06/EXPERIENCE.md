---
title: "EXPERIENCE - TaskManager"
status: final
created: "2026-07-06"
updated: "2026-07-06"
sources:
  - _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
---

# EXPERIENCE

## Foundation

Form factor:

- Primary: desktop web browser.
- Secondary: tablet web browser.

UI system:

- Custom React UI built from local reusable components.
- Visual identity and tokens are defined in DESIGN and referenced here.

Behavioral priorities:

- Focused operation over decorative exploration.
- Fast weekly planning and adjustment loop.
- Explicit status visibility (completion and errors).

Token references:

- Primary app surfaces use `{colors.bg.app}` and `{colors.bg.surface}`.
- Interactive corner style follows `{rounded.sm}` and `{rounded.md}`.
- Balanced density follows `{spacing.density}`.

## Information Architecture

Primary surfaces:

1. Login screen.
2. Weekly board screen (main hub).
3. Task quick-add/edit panel.
4. Time-entry editor per day.
5. Delete confirmation modal.
6. Unsaved-changes confirmation modal.
7. Week completion feedback banner/state.

Weekly board structure:

- Header action priority:
  1.  Week completion status
  2.  Quick add task
  3.  Quick add time entry
  4.  Current week label/date range
  5.  Next week
  6.  Previous week
- Top sections for recurring tasks and unscheduled tasks.
- Five day columns (Mon-Fri), with today emphasized on load.

## Voice and Tone

Microcopy style:

- Short, direct, low-friction.
- Avoid celebratory noise; keep feedback practical.
- Error copy is specific and corrective.

Examples:

- Good: "Missing exit time for one entry."
- Good: "No time entries logged for Tuesday."
- Avoid: "Oops! Something magical happened."

## Component Patterns

Task card:

- Checkbox is positioned next to task title for immediate completion action.
- Card shows minimal text: title + optional short description line.
- Meta information should collapse before text wrapping overload.

Day column:

- Header includes day name, remote checkbox, and completion state marker.
- Day-level error states are visible without opening editors.

Time entry editor:

- Supports multiple entry/exit pairs per day.
- Entry (`HH:mm`) required; exit optional.
- Incomplete pairs remain editable and visibly flagged.

Quick add interactions:

- Quick add task and quick add time entry are always accessible from board header.
- Entry points should not open full-page navigations.

## State Patterns

Board loading state:

- Preserve column skeleton layout while data loads.
- Keep header actions visible during loading.

Task states:

- Not started, in progress, completed.
- Completion toggle applies immediately with optimistic UI and rollback on error.

Time-entry validation states:

- Incomplete pair (entry without exit): red highlight using `{colors.accent.error}`.
- No time entries for a day: day-level error indicator.

Week navigation states:

- Persist selected week context while editing.
- Prevent silent loss of unsaved edits when switching weeks.

## Interaction Primitives

Drag reorder:

- Must be frictionless and stable.
- Drop target should be clearly visible during drag.
- Reorder within and across day columns is allowed.

Completion toggle:

- Single click/tap on checkbox updates task state.
- Completion feedback should be immediate and subtle.

Week navigation:

- Next/previous week is always one action away.
- Current week range remains visible while navigating.

Motion policy:

- Subtle transitions only.
- No flashy entrance effects.
- Animation duration should remain short and functional.

## Accessibility Floor

Keyboard:

- All header actions, checkboxes, and card actions must be keyboard operable.
- Logical tab order follows visual priority and reading flow.

Contrast:

- Text and status indicators meet WCAG AA minimum.
- Error states must not rely on color alone (add icon/text cue).

Semantics:

- Day columns and task lists use meaningful structural landmarks.
- Completion and remote toggles expose accessible labels.

Feedback:

- Validation and save/error states are announced in a screen-reader-friendly way.

## Key Flows

### Flow 1: Morning planning start (Uge)

1. Uge logs in and lands on weekly board.
2. UI focuses today column first with all tasks visible (completed and pending).
3. Uge scans recurring and unscheduled sections.
4. Uge adds or edits tasks/time entries from quick actions.
5. Climax beat: Uge confirms day plan and starts execution without context switching.

### Flow 2: Midday adjustment and completion (Uge)

1. Uge drags tasks to reprioritize within or across columns.
2. Uge marks tasks complete via checkbox near each task title.
3. Uge logs entry/exit hour pairs.
4. If exit is missing, day state flags visibly.
5. Climax beat: Uge sees immediate, trustworthy progress visibility.

### Flow 3: End-of-day validation (Uge)

1. Uge reviews day completion check and time-entry status.
2. Uge resolves incomplete time pairs or accepts pending status.
3. Uge sees week-level completion progress in header.
4. If deleting/editing risks data loss, confirmation modal appears.
5. Climax beat: Uge closes session confident that state is correct.

## Responsive and Platform

Desktop:

- Default target for full board visibility and drag workflows.

Tablet:

- Keep column layout readable with controlled horizontal scroll.
- Preserve header action order and fast completion actions.

Mobile web:

- Not primary MVP target; should remain functional but not fully optimized in this phase.
