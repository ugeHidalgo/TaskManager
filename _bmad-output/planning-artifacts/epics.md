---
stepsCompleted: [1, 2]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-TaskManager-2026-07-06/EXPERIENCE.md
---

# TaskManager - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for TaskManager, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Single-user authentication with username/password, secure password hashing, and JWT session management.
FR2: Weekly board display with Monday-Friday columns, recurring tasks section, unscheduled tasks section, and current-day highlight.
FR3: Full task management (create/read/update/delete), mark complete, and drag-and-drop reorder across day columns and unscheduled section.
FR4: Recurring tasks creation and per-day completion marking in recurring section.
FR5: Day completion indicator when all day tasks are completed.
FR6: Week completion feedback when all five days are completed.
FR7: Unsaved changes protection via leave confirmation flow.
FR8: Persistent storage and retrieval of tasks and task state in PostgreSQL.
FR9: Week navigation with previous/next controls and week-range label; supports past/future weeks.
FR10: Time tracking with multiple entry/exit pairs per day, HH:mm format, incomplete/empty-day visual error states, CRUD for entries.
FR11: Remote work indicator checkbox in each day header, persisted per day/week context.

### NonFunctional Requirements

NFR1: Containerized portability using Docker and Docker Compose.
NFR2: Browser-first accessibility across modern browsers.
NFR3: Performance targets (<2s initial load, <500ms core task operations).
NFR4: Security baseline (hashed credentials, JWT auth, HTTPS in production, safe logging).
NFR5: Cross-browser compatibility and responsive behavior.
NFR6: Focused UX with clear, immediate visual feedback.

### Additional Requirements

- Starter foundation must use dual-starter setup: React+Vite frontend and ASP.NET Core Web API backend.
- Architecture must follow clean layering in backend (Api/Application/Domain/Infrastructure).
- API must use REST with versioned base path `/api/v1`.
- API responses must follow standard envelope (`{data,meta}` success and structured error envelope).
- Week/day domain model must be deterministic (`week_start_date`, Monday-Friday model).
- Task reorder persistence must use stable `order_index` semantics.
- Time-entry validation logic must be centralized and consistent (HH:mm, missing exit handling, empty-day error state).
- Frontend state approach must separate server-state (React Query) from local transient UI state.
- Compose topology uses three services (`frontend`, `backend`, `postgres`) with explicit env configuration.
- Migration execution must be explicit in deployment workflow (no unsafe auto-migrate in production).
- Implementation must follow naming/format conventions: DB snake_case; API payload camelCase; consistent date/time formats.
- CI/lint/test enforcement is required to preserve cross-agent consistency.

### UX Design Requirements

UX-DR1: Main board must prioritize "today" column on initial load and keep all tasks visible (completed and pending).
UX-DR2: Task card must keep completion checkbox adjacent to task title for immediate action.
UX-DR3: Card content must remain concise; avoid long text overload in default card view.
UX-DR4: Header action priority must be: week completion status, quick add task, quick add time entry, week label/range, next week, previous week.
UX-DR5: Weekly board must preserve focused visual hierarchy with low-noise feedback patterns.
UX-DR6: Motion policy is subtle-only; no flashy entrance/transition effects.
UX-DR7: Day header must expose remote checkbox, completion marker, and error states clearly.
UX-DR8: Time-entry editor must support multiple pairs per day and visibly flag incomplete pairs.
UX-DR9: Day-level missing-time state must be visible without opening deep editors.
UX-DR10: Key flows must support frictionless drag reorder then quick mark-complete flow.
UX-DR11: Unsaved edits must trigger confirmation modal before destructive navigation.
UX-DR12: Accessibility baseline includes keyboard-operable actions, AA-level readability, and non-color-only error signaling.

### FR Coverage Map

- FR1: Epic 1 - Authentication and secure session handling
- FR2: Epic 1 - Weekly board baseline with Monday-Friday structure and today focus
- FR3: Epic 2 - Task CRUD and completion behavior
- FR3: Epic 3 - Drag-and-drop reorder and persistent ordering semantics
- FR4: Epic 2 - Recurring task creation and per-day completion
- FR5: Epic 2 - Day completion indicator behavior
- FR6: Epic 2 - Week completion feedback behavior
- FR7: Epic 2 - Unsaved changes confirmation on navigation
- FR8: Epic 1 - Persistent storage/retrieval baseline for workspace data
- FR9: Epic 1 - Week navigation with previous/next controls and week range
- FR10: Epic 4 - Time tracking with pair validation and visual error states
- FR11: Epic 4 - Remote work indicator persisted per day/week

## Epic List

### Epic 1: Secure Weekly Workspace

Deliver a working authenticated experience where the user can log in and navigate week-by-week in a persistent Monday-Friday board baseline.
**FRs covered:** FR1, FR2, FR8, FR9

### Epic 2: Task Lifecycle and Completion

Enable full task execution inside the weekly board through task create/edit/delete, completion marking, recurring tasks, day/week completion status, and safe unsaved-change handling.
**FRs covered:** FR3 (CRUD and completion scope), FR4, FR5, FR6, FR7

### Epic 3: Task Prioritization by Drag and Reorder

Allow users to prioritize work fluidly by reordering tasks within and across day/unscheduled lanes with persisted order behavior.
**FRs covered:** FR3 (drag/reorder scope)

### Epic 4: Time and Work-Mode Accountability

Add operational day controls for multiple time-entry pairs and remote-work marking, with validation feedback that supports end-of-day closure.
**FRs covered:** FR10, FR11

## Epic 1: Secure Weekly Workspace

Deliver a working authenticated experience where the user can log in and navigate week-by-week in a persistent Monday-Friday board baseline.

### Story 1.1: Login and Session Bootstrapping

As a single user,
I want to log in with username and password,
So that I can access my planning workspace securely.

**Acceptance Criteria:**

**Given** valid credentials
**When** the user submits login
**Then** API returns a JWT and frontend stores session state
**And** user is redirected to the board

**Given** invalid credentials
**When** login is submitted
**Then** user remains on login
**And** a clear non-sensitive error message is shown

**Given** an existing valid token
**When** app reloads
**Then** session is restored
**And** re-login is not required

**Given** logout action
**When** user confirms logout
**Then** token/session is cleared
**And** protected routes are no longer accessible

### Story 1.2: Week Layout with Shared Week Section Above Daily Columns

As a planner,
I want a weekly board with a shared week section placed above the daily columns,
So that I can organize both flexible weekly tasks and day-specific tasks with a clear visual hierarchy.

**Acceptance Criteria:**

**Given** an authenticated user
**When** board loads
**Then** exactly five day columns are shown (Monday to Friday)
**And** the layout remains stable across desktop and mobile breakpoints

**Given** board loads
**When** layout renders
**Then** a distinct shared week section is displayed above the row of daily columns
**And** it is visually separated from day-specific columns

**Given** current calendar date in selected week
**When** board renders
**Then** today column is visually highlighted
**And** focus order remains keyboard accessible

**Given** no tasks exist
**When** board renders
**Then** shared week section and all day columns show empty states
**And** empty states do not break layout or interactions

**Given** header renders
**When** user views top controls
**Then** priority order is preserved: week completion, quick add task, quick add time entry, week label/range, next week, previous week
**And** controls remain available while changing week context

### Story 1.3: Week Navigation and Range Resolution

As a planner,
I want to move to previous and next weeks,
So that I can review and plan across time.

**Acceptance Criteria:**

**Given** board is open
**When** user clicks next week
**Then** selected week advances by 7 days
**And** week label/range updates correctly

**Given** board is open
**When** user clicks previous week
**Then** selected week moves back by 7 days
**And** week label/range updates correctly

**Given** navigation to any week
**When** board data is requested
**Then** API resolves deterministic Monday-based `week_start_date`
**And** returns that week context

**Given** rapid week navigation
**When** requests overlap
**Then** only the latest navigation result is rendered
**And** stale responses do not overwrite current view

### Story 1.4: Persistence Baseline for Weekly Workspace

As a planner,
I want week context and board data persisted in PostgreSQL,
So that my workspace is stable across sessions.

**Acceptance Criteria:**

**Given** a week request
**When** backend loads board data
**Then** data is sourced from PostgreSQL using week/day domain keys
**And** response is returned within expected performance thresholds

**Given** first-time week access with no records
**When** week is loaded
**Then** system returns a valid empty board structure
**And** no server error is produced

**Given** API success response
**When** frontend consumes it
**Then** payload follows standard success envelope (`data`, `meta`)
**And** naming conventions are respected

**Given** API failure
**When** error is returned
**Then** structured error envelope is provided
**And** sensitive internals are not leaked

## Epic 2: Task Lifecycle and Completion

Enable full task execution inside the weekly board through task create/edit/delete, completion marking, recurring tasks, day/week completion status, and safe unsaved-change handling.

### Story 2.1: Create and Edit Tasks in Day and Shared Week Context

As a planner,
I want to create and edit tasks in day columns or in the shared week section,
So that I can organize planned work with the right temporal scope.

**Acceptance Criteria:**

**Given** the board is open
**When** user creates a task
**Then** task can be assigned to a specific day or to the shared week section
**And** task appears immediately in the selected location

**Given** a task exists
**When** user edits title, notes, or context
**Then** changes are validated and persisted
**And** updated values are reflected without full page reload

**Given** invalid input such as empty title
**When** user submits task changes
**Then** inline validation is shown
**And** task is not saved until fixed

**Given** successful create or edit
**When** operation completes
**Then** board state refreshes consistently
**And** user receives clear success feedback

### Story 2.2: Keep Completed Tasks Visible and Reopenable

As a planner,
I want completed tasks to remain visible in the board in a minimized gray style and be reopenable,
So that I can keep progress context without losing the ability to reactivate work.

**Acceptance Criteria:**

**Given** an active task
**When** user marks it as completed
**Then** the task remains in the same board section and position context
**And** completion state is persisted

**Given** a completed task in the board
**When** it is rendered
**Then** it appears minimized and in gray visual style
**And** title plus essential controls remain visible

**Given** a completed task
**When** user chooses reopen
**Then** task returns to active state and normal visual style
**And** reopened state is persisted

**Given** board reload or navigation back to the same week
**When** data is loaded
**Then** completed tasks remain visible with minimized gray style
**And** tasks can still be reopened

**Given** accessibility mode
**When** completed style is shown
**Then** completion state is not indicated by color only
**And** a non-color cue is provided

### Story 2.3: Manage Recurring Tasks and Daily Checks

As a planner,
I want recurring tasks and per-day completion checks,
So that I can track habitual responsibilities across the week.

**Acceptance Criteria:**

**Given** recurring task settings
**When** user creates or updates a recurring task
**Then** it appears in the recurring section with expected schedule
**And** recurring definition is persisted

**Given** a recurring task is due for a day
**When** user marks it done for that day
**Then** day-specific completion state is persisted
**And** other days remain unchanged

**Given** recurring task is not checked for a day
**When** day closes
**Then** status remains incomplete for that day only
**And** completion does not auto-propagate to other days

**Given** recurring data is loaded
**When** board renders
**Then** recurring items are visually distinguishable from standard tasks
**And** interaction behavior remains consistent

### Story 2.4: Compute Day and Week Completion Status

As a planner,
I want automatic day and week completion indicators,
So that I can see closure status at a glance.

**Acceptance Criteria:**

**Given** all tasks for a day are complete
**When** board status recalculates
**Then** day is marked complete
**And** day completion indicator appears in day header

**Given** any task in a day becomes incomplete
**When** board status recalculates
**Then** day completion marker is removed
**And** day returns to in-progress state

**Given** all five weekdays are complete
**When** board status recalculates
**Then** week completion feedback is shown
**And** feedback is visible in header priority area

**Given** at least one weekday is incomplete
**When** board status recalculates
**Then** week completion feedback is not shown as complete
**And** state remains consistent after reload

### Story 2.5: Protect Unsaved Changes During Navigation

As a planner,
I want warnings before losing unsaved edits,
So that I do not accidentally discard in-progress changes.

**Acceptance Criteria:**

**Given** there are unsaved changes
**When** user attempts route change, week change, or page leave
**Then** confirmation modal appears
**And** navigation is blocked pending user decision

**Given** user cancels navigation
**When** modal closes
**Then** current edits remain intact
**And** user stays in current view

**Given** user confirms discard
**When** navigation proceeds
**Then** unsaved changes are dropped safely
**And** destination view loads without stale draft state

**Given** no unsaved changes
**When** user navigates
**Then** no blocking prompt is shown
**And** navigation flow remains uninterrupted
