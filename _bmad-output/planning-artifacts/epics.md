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
