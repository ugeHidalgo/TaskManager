---
stepsCompleted: [1, 2, 3, 4]
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

### Story 1.1: Initialize Frontend and Backend Starters

As a single user,
I want the project initialized from the selected frontend and backend starters,
So that development starts from a valid architecture foundation.

**Acceptance Criteria:**

**Given** the repository is cloned
**When** setup is executed
**Then** frontend and backend are initialized from selected starters
**And** dependencies are installed with runnable local baseline

**Given** the backend starter is initialized
**When** solution structure is reviewed
**Then** clean-layer projects are present (Api/Application/Domain/Infrastructure)
**And** backend build succeeds locally

**Given** the frontend starter is initialized
**When** development server is started
**Then** app runs without startup errors
**And** TypeScript build passes

**Implementation Task Checklist (Estimation + DoD):**

1. [ ] Create frontend project from React + Vite + TypeScript starter. Size: S. DoD: frontend dev server starts and renders default app.
2. [ ] Create backend project from ASP.NET Core Web API starter and clean-layer structure. Size: M. DoD: solution contains Api/Application/Domain/Infrastructure and builds successfully.
3. [ ] Add workspace-level run/build commands to README. Size: S. DoD: documented commands can be executed on a clean environment.

### Story 1.2: Provision Local Runtime with Docker Compose and Env Configuration

As a developer,
I want a reproducible local runtime with frontend, backend, and database services,
So that the team can run the stack consistently.

**Acceptance Criteria:**

**Given** environment configuration is required
**When** developer starts local stack
**Then** required variables and service wiring are documented and validated
**And** app boots with frontend, backend, and database connected

**Given** Docker Compose configuration exists
**When** compose is started
**Then** services frontend, backend, and postgres start successfully
**And** backend can connect to postgres through service networking

**Given** first backend persistence setup
**When** migrations are applied
**Then** initial schema for auth baseline is created
**And** migration command is documented

**Implementation Task Checklist (Estimation + DoD):**

1. [ ] Create docker-compose topology for frontend, backend, postgres. Size: M. DoD: single compose command starts all services successfully.
2. [ ] Define environment variables and sample env files for all services. Size: S. DoD: env vars are documented and validated at startup.
3. [ ] Configure backend database connection and first migration path. Size: M. DoD: migration applies cleanly against postgres container.

### Story 1.3: Implement Authentication Backend Baseline

As a single user,
I want secure backend authentication endpoints,
So that session creation and route protection are enforced reliably.

**Acceptance Criteria:**

**Given** valid credentials
**When** the user submits login
**Then** API returns a valid JWT
**And** token contains required claims for protected routes

**Given** invalid credentials
**When** login is submitted
**Then** authentication is rejected
**And** API returns a clear non-sensitive error response

**Given** protected API endpoints
**When** request has no valid token
**Then** access is denied consistently
**And** unauthorized response follows standard error envelope

**Implementation Task Checklist (Estimation + DoD):**

1. [ ] Implement user credential verification with bcrypt hashing. Size: M. DoD: credentials are verified using hashed password storage only.
2. [ ] Add login endpoint and JWT issuance flow. Size: M. DoD: valid login returns signed JWT with configured expiry.
3. [ ] Apply auth middleware/policies to protected routes. Size: S. DoD: unauthorized requests are blocked with consistent error contract.

### Story 1.4: Implement Frontend Login and Session Lifecycle

As a single user,
I want frontend login and session handling,
So that I can authenticate once and access the board securely.

**Acceptance Criteria:**

**Given** valid credentials
**When** the user submits login
**Then** frontend stores session token safely
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

**Implementation Task Checklist (Estimation + DoD):**

1. [ ] Build login form with client-side validation and API integration. Size: S. DoD: valid and invalid submissions show expected behavior.
2. [ ] Implement guarded routing and post-login redirect to board. Size: S. DoD: protected routes are inaccessible without session.
3. [ ] Implement token restore on reload and logout session teardown. Size: S. DoD: reload keeps session, logout clears access.
4. [ ] Add auth smoke checks (success, failure, restore, logout). Size: S. DoD: checks pass with explicit pass/fail evidence.

### Story 1.5: Week Layout with Shared Week Section Above Daily Columns

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

**Implementation Task Checklist (Estimation + DoD):**

1. [ ] Implement five day columns and shared week section layout. Size: M. DoD: board renders stable structure for desktop/tablet breakpoints.
2. [ ] Implement today highlight and accessible focus order. Size: S. DoD: today state is visible and keyboard navigation is coherent.
3. [ ] Implement empty-state rendering for shared section and day columns. Size: S. DoD: empty board has no visual or interaction regressions.
4. [ ] Implement prioritized header control order. Size: S. DoD: control order matches UX specification exactly.

### Story 1.6: Week Navigation and Range Resolution

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

**Implementation Task Checklist (Estimation + DoD):**

1. [ ] Implement previous/next week actions with deterministic 7-day movement. Size: S. DoD: navigation updates selected week and label correctly.
2. [ ] Implement API query flow using Monday-based week_start_date. Size: M. DoD: backend responses align with requested week context.
3. [ ] Implement stale-request protection for rapid navigation. Size: S. DoD: only latest request updates visible board state.

### Story 1.7: Persistence Baseline for Weekly Workspace

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

**Implementation Task Checklist (Estimation + DoD):**

1. [ ] Implement week/day persistence model and repository queries. Size: M. DoD: week load returns persisted or valid empty structures.
2. [ ] Implement success/error response envelope compliance in week endpoints. Size: S. DoD: responses conform to defined contract in all tested scenarios.
3. [ ] Add integration checks for first-time week load and reload persistence. Size: M. DoD: tests or scripts verify persistence behavior and safe failure handling.

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

## Epic 3: Task Prioritization by Drag and Reorder

Allow users to prioritize work fluidly by reordering tasks within and across day and shared-week lanes with persisted order behavior.

### Story 3.1: Reorder Tasks Within the Same Section

As a planner,
I want to reorder tasks inside the same day column or shared week section,
So that I can set priority quickly as my plan changes.

**Acceptance Criteria:**

**Given** multiple tasks in the same section
**When** user drags a task up or down
**Then** order updates immediately in the UI
**And** visual insertion feedback remains clear

**Given** a reorder action succeeds
**When** save completes
**Then** new order persists after reload
**And** ordering is stable between sessions

**Given** reorder fails in backend
**When** API returns error
**Then** UI rolls back to last valid order
**And** a clear actionable error is shown

**Given** keyboard-only usage
**When** user triggers reorder controls
**Then** task order can be changed without mouse input
**And** focus remains predictable after reorder

### Story 3.2: Move Tasks Across Day Columns and Shared Week Section

As a planner,
I want to move tasks between day columns and the shared week section,
So that I can reassign work to the right day or keep it flexible for the week.

**Acceptance Criteria:**

**Given** a task in any board section
**When** user drags it to another day column
**Then** task is reassigned to destination day
**And** reassignment persists

**Given** a task in a day column
**When** user moves it to shared week section
**Then** task becomes week-scoped and not day-specific
**And** reassignment persists

**Given** a task in shared week section
**When** user moves it to a day column
**Then** task becomes day-scoped
**And** destination day assignment persists

**Given** cross-section move completes
**When** board recalculates
**Then** source and destination lists reflect correct order and counts
**And** no duplicate task entry is displayed

### Story 3.3: Maintain Stable Order Semantics and Visual Feedback

As a planner,
I want reorder interactions to feel stable and clear,
So that I trust the board state while reprioritizing tasks.

**Acceptance Criteria:**

**Given** drag starts
**When** user hovers valid drop zones
**Then** destination feedback is visible and unambiguous
**And** invalid targets are clearly non-droppable

**Given** drop completes
**When** UI settles
**Then** moved task appears in final position
**And** subtle confirmation feedback is shown without noisy animation

**Given** concurrent updates or stale client state
**When** reorder request is processed
**Then** server resolves order using stable `order_index` semantics
**And** client syncs to authoritative order

**Given** completed tasks are present
**When** active tasks are reordered
**Then** completed minimized gray tasks remain visible and reopenable
**And** completion behavior remains consistent with Epic 2

## Epic 4: Time and Work-Mode Accountability

Add operational day controls for multiple time-entry pairs and remote-work marking, with validation feedback that supports end-of-day closure.

### Story 4.1: Capture Multiple Time Entry Pairs per Day

As a planner,
I want to register multiple entry and exit pairs for each day,
So that I can track split work sessions accurately.

**Acceptance Criteria:**

**Given** a selected day
**When** user adds a time pair
**Then** entry and exit fields are available in HH:mm format
**And** the pair is associated to that day context

**Given** existing pairs for a day
**When** user adds another pair
**Then** multiple pairs are supported and displayed
**And** display order is chronological

**Given** a saved day with pairs
**When** board reloads
**Then** all persisted pairs are restored correctly
**And** no pair is silently dropped

**Given** edit or delete on an existing pair
**When** operation completes
**Then** change persists
**And** UI reflects updated totals immediately

### Story 4.2: Validate Incomplete or Invalid Time Registrations

As a planner,
I want clear validation for incomplete or invalid time records,
So that I can fix errors before considering a day complete.

**Acceptance Criteria:**

**Given** a pair with missing exit
**When** user leaves editor or saves
**Then** day shows incomplete-time error state
**And** day cannot be considered validly complete

**Given** invalid HH:mm input
**When** user submits
**Then** field-level validation appears
**And** invalid value is not persisted

**Given** overlapping or logically inconsistent ranges
**When** user saves
**Then** validation blocks save
**And** an actionable error is shown

**Given** no time pairs for a working day
**When** day status is evaluated
**Then** missing-time visual state is shown
**And** state is visible from board level

**Given** accessibility constraints
**When** errors are displayed
**Then** errors are conveyed by text or icon cues
**And** error meaning is not color-only

### Story 4.3: Surface Day-Level Time Status in Board

As a planner,
I want day-level time completeness visible directly in the board,
So that I can detect pending fixes without opening detailed editors.

**Acceptance Criteria:**

**Given** a day with valid complete pairs
**When** board renders
**Then** day header shows compliant time status
**And** status is understandable at a glance

**Given** a day with incomplete or missing pairs
**When** board renders
**Then** day header shows warning or error status
**And** user can navigate to fix input quickly

**Given** time data changes
**When** recalculation runs
**Then** day status updates immediately
**And** page reload is not required

**Given** mobile and desktop layouts
**When** board is viewed
**Then** day-level time status remains visible
**And** semantics are consistent across breakpoints

### Story 4.4: Track Remote Work per Day

As a planner,
I want to mark each day as remote or non-remote,
So that I can keep a reliable record of work mode.

**Acceptance Criteria:**

**Given** day header is visible
**When** user toggles remote checkbox
**Then** state updates immediately in UI
**And** remote state persists

**Given** week navigation and return
**When** same day is loaded again
**Then** remote state remains consistent with persisted data
**And** no unintended reset occurs

**Given** mixed remote and non-remote days in the same week
**When** board renders
**Then** each day reflects its own independent state
**And** day markers are not coupled across days

**Given** API failure on toggle
**When** persistence fails
**Then** UI reverts to previous stable state
**And** a clear error feedback message is shown
