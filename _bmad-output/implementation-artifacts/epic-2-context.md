# Epic 2 Context: Task Lifecycle and Completion

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable dependable task execution across the weekly board: users can manage tasks in the shared-week and day contexts, track recurring work independently for each scheduled day, and see accurate day/week completion. Preserve progress context by keeping completed tasks visible and reopenable, and prevent accidental loss of drafts during navigation.

## Stories

- Story 2.1: Create and Edit Tasks in Day and Shared Week Context
- Story 2.2: Keep Completed Tasks Visible and Reopenable
- Story 2.3: Add Optional Task Execution Time
- Story 2.4: Manage Recurring Tasks and Daily Checks
- Story 2.5: Compute Day and Week Completion Status
- Story 2.6: Protect Unsaved Changes During Navigation

## Requirements & Constraints

- Support task create, read, update, delete, and completion in the board; validate required titles and provide corrective inline feedback for invalid input. Confirm destructive task deletion.
- Preserve a task’s board context when completing or reopening it. Completed tasks remain visible after reload and week navigation; reopening restores active state.
- Optional task execution times persist as empty strings or `hh:mm` values and appear before task titles; clock editing supports set, modify, clear, accept, and cancel without changing task status.
- Recurring definitions and their per-day completion state must persist independently: changing one weekday must not alter any other day. Recurring tasks remain visually distinguishable from standard tasks.
- Day completion reflects whether all tasks for that day are complete; week completion is shown only when all five weekdays are complete. Recalculate and persistently reproduce status after updates and reload.
- Protect unsaved task edits/creation from route changes, week changes, and page leave. A user who stays/cancels retains the draft; confirmed discard clears stale draft state; clean navigation has no blocking prompt.
- Keep task operations within the product’s <500 ms response-time target. Maintain keyboard-operable actions, WCAG AA readability, and status cues that do not rely on color alone.

## Technical Decisions

- PostgreSQL is the source of truth. The domain is organized around a Monday-based `WeekPlan`, its weekday `DayPlan` records, and tasks associated with a day or the shared/unscheduled week context. Recurring definitions use selected weekdays with per-day completion state.
- Keep business rules and use-case orchestration in the Domain/Application layers; persistence belongs in Infrastructure, and the API layer handles transport. The frontend communicates through versioned REST under `/api/v1`, not directly with the database.
- Use the standard success envelope (`data`, `meta`) and structured error envelope. JSON fields use camelCase; database tables and columns use snake_case. Keep date formats as `YYYY-MM-DD` and use consistent API error mapping.
- Use React Query for task/recurring server state and cache refresh/invalidation after mutations. Keep edit buffers, modal state, and other transient drafts local to the UI; isolate draft cleanup when navigation is confirmed.

## UX & Interaction Patterns

- Keep the completion checkbox adjacent to the concise task title. Completion changes give immediate, subtle feedback; completed cards remain visible in a minimized gray treatment with title and essential controls, plus a non-color completion cue.
- Make recurring work distinct while keeping per-day checks direct and consistent with ordinary completion controls. Show day completion in the day header and week completion in the header priority area.
- Use short, specific validation and save/error messages. Confirmation dialogs should be clear and low-verbosity; preserve current edits when navigation is canceled. Use subtle motion only, with accessible labels and screen-reader-friendly feedback.

## Cross-Story Dependencies

- Task context and CRUD from Story 2.1 underpin completion/reopening (2.2) and the task inputs to day/week status (2.4). Mutations must keep board data and derived completion indicators consistent.
- Optional execution time (2.3) remains independent from ordinary task lifecycle state and recurring definitions.
- Recurring definitions and isolated daily checks (2.4) must remain distinct from ordinary task lifecycle state; completion must not propagate between days.
- Unsaved-change protection (2.6) must cover the board’s route and week navigation, including the existing week-navigation flow, and coordinate with local drafts so canceled navigation preserves them and confirmed discard cannot leak them into the destination.
