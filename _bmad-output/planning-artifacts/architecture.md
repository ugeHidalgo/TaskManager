---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md
  - _bmad-output/project-context.md
workflowType: architecture
lastStep: 8
status: complete
completedAt: 2026-07-01
project_name: TaskManager
user_name: Uge
date: 2026-07-01
---

# Architecture Decision Document

This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together.

## Project Context Analysis

### Requirements Overview

Functional Requirements:
The solution must support user authentication, weekly board display (Mon-Fri), task CRUD with drag-and-drop reordering, recurring tasks, day/week completion tracking, unsaved-changes protection, task persistence, week navigation, remote day indicator, and daily time tracking with error highlighting for missing or incomplete entries. Architecturally, this implies domain entities with clear ownership and consistent aggregate rules per week and per day.

Non-Functional Requirements:
The architecture must prioritize containerized portability (Docker + Compose), secure authentication (JWT + bcrypt), browser-based UX compatibility, and responsive performance for core operations. These NFRs will drive hosting topology, API design boundaries, persistence strategy, and client-side state handling.

Scale and Complexity:
The project is medium complexity: feature-rich personal productivity app, no multi-tenant complexity yet, but with non-trivial weekly scheduling, ordering, and validation logic.

- Primary domain: full-stack web app (React + ASP.NET Core + PostgreSQL)
- Complexity level: medium
- Estimated architectural components: 8-12 major components (auth, board, tasks, recurring logic, time tracking, week navigation, day/week status, persistence/infrastructure)

### Technical Constraints and Dependencies

- Frontend: React + Vite + TypeScript + Tailwind
- Backend: ASP.NET Core Web API with Clean Architecture
- Database: PostgreSQL with EF Core
- Deployment: Docker Compose portable to local/server environments
- Auth: JWT with hashed credentials
- Week and time model must be deterministic (week range calculation + hh:mm validation)
- Drag-drop ordering requires persisted ordering semantics, not UI-only state

### Cross-Cutting Concerns Identified

- Date/week boundary consistency between frontend and backend
- Validation strategy for time pairs and empty-day time logs
- Day and week completion rule evaluation
- Data integrity for reorder operations
- Error-state UX consistency (red highlights, missing data indicators)
- Security baseline for auth/session/token lifecycle
- Portability and environment configuration across local and server deployments

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application based on project requirements and preferred stack (React + ASP.NET Core + PostgreSQL).

### Starter Options Considered

- Single full-stack framework starter (for example Next.js full-stack): faster bootstrap but conflicts with explicit ASP.NET Core backend preference.
- Dual-starter architecture (frontend starter + backend starter): aligns with declared stack and preserves clear service boundaries.

### Selected Starter: Dual-Starter Architecture

Rationale for Selection:

- Matches your preferred technologies without compromise.
- Preserves independent frontend/backend deployment and clean API contracts.
- Fits Docker Compose service-oriented setup naturally.

Initialization Commands:

```bash
# Frontend
npm create vite@latest frontend -- --template react-ts

# Backend
dotnet new webapi -n backend -o backend
```

### Architectural Decisions Provided by Starter

Language and Runtime:

- Frontend: TypeScript + Node toolchain
- Backend: C# + ASP.NET Core Web API

Styling Solution:

- Tailwind CSS layered on Vite React starter

Build Tooling:

- Vite for frontend dev/build
- dotnet CLI for backend build/run/publish

Testing Framework Baseline:

- Frontend: add Vitest + React Testing Library in implementation stories
- Backend: add xUnit + integration testing in implementation stories

Code Organization:

- Split by service (`frontend` and `backend`)
- API boundary as a first-class contract

Development Experience:

- Independent local development loops
- Compose-based integrated environment

Note: Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

Critical Decisions (Block Implementation):

- Domain data model centered on week/day aggregates with deterministic week boundaries (Monday-Friday board).
- JWT-based authentication with secure password hashing (bcrypt).
- Persisted drag-and-drop ordering using stable `order_index` per day lane.
- Time-entry validation model (incomplete pair and empty-day error states).

Important Decisions (Shape Architecture):

- REST API with explicit version prefix (`/api/v1`).
- Standard API response and error envelope.
- Frontend server-state management via React Query; local UI state for board interactions.
- Three-service Docker Compose topology (`frontend`, `backend`, `postgres`).

Deferred Decisions (Post-MVP):

- Multi-user RBAC and team collaboration model.
- Real-time synchronization (WebSocket/SSE).
- Distributed caching layer (Redis).

### Data Architecture

- Database: PostgreSQL as source of truth.
- ORM: EF Core with code-first migrations.
- Aggregate model:
  - `WeekPlan` identified by `week_start_date` (ISO date, Monday).
  - `DayPlan` child records for Monday-Friday.
  - `Task` records linked to `DayPlan` (or unscheduled bucket in same week context).
  - `RecurringTask` with selected weekdays and per-day completion flags.
  - `TimeEntry` linked to `DayPlan` with `entry_hour` and nullable `exit_hour` (HH:mm).
  - `DayPlan.remote_worked` boolean for remote checkbox.
- Ordering strategy: integer `order_index` with gap-friendly updates (reindex only when needed).
- Validation strategy:
  - HH:mm strict format at API boundary.
  - `entry_hour` required, `exit_hour` optional.
  - Incomplete entries flagged, not blocked.
  - Empty-day time tracking flagged as error state in read models.

### Authentication and Security

- Auth method: single-user JWT auth for MVP.
- Password hashing: bcrypt.
- Token flow:
  - Access token short-lived.
  - Refresh token rotation deferred to post-MVP unless needed.
- Transport security: HTTPS in production.
- API protection: authenticated routes required except login/bootstrap.
- Security middleware: centralized auth, input validation, and exception handling.

### API and Communication Patterns

- API style: REST.
- Base path: `/api/v1`.
- Resource groups:
  - `/auth`
  - `/weeks`
  - `/days`
  - `/tasks`
  - `/recurring-tasks`
  - `/time-entries`
- Response envelope:
  - Success: `{ "data": ..., "meta": ... }`
  - Error: `{ "error": { "code": "...", "message": "...", "details": [...] } }`
- Date/time formats:
  - Dates: ISO-8601 date strings (`YYYY-MM-DD`).
  - Times: `HH:mm` 24-hour.
- Error handling: consistent status-code mapping plus machine-readable `error.code`.

### Frontend Architecture

- Framework: React + Vite + TypeScript.
- State approach:
  - React Query for server state (weeks, tasks, time entries, recurring tasks).
  - Local component state for edit forms, drag interactions, and transient UI.
- Routing: lightweight route structure (`/login`, `/board/:weekStartDate?`).
- Drag/drop: maintained React drag-drop library with backend persistence on drop.
- UI feedback:
  - Red highlight for incomplete time pairs.
  - Error indicator for days without time entries.
  - Day and week completion badges calculated from backend read model.

### Infrastructure and Deployment

- Compose topology:
  - `frontend`: React app.
  - `backend`: ASP.NET Core API.
  - `postgres`: PostgreSQL with persistent volume.
- Environment config: `.env` + service-specific environment variables.
- Migration strategy:
  - Explicit migration command in deployment/startup workflow.
  - Avoid implicit auto-migrate on every app start in production.
- Logging:
  - Structured logs in backend.
  - Client error capture via centralized frontend logger abstraction.

### Decision Impact Analysis

Implementation Sequence:

1. Initialize `frontend` and `backend` projects from selected starters.
2. Define domain model and EF Core schema/migrations.
3. Implement auth and protected API foundation.
4. Implement week/day read model endpoints.
5. Implement task, recurring, and time-entry workflows.
6. Implement board UI, week navigation, drag/drop persistence, and validation visuals.
7. Integrate Docker Compose and end-to-end verification.

Cross-Component Dependencies:

- Week/day aggregate model drives both API contracts and board rendering.
- Validation rules for time entries drive backend response flags and frontend error visuals.
- Ordering semantics affect drag/drop behavior and persistence transaction boundaries.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

Critical conflict points identified:

- Naming conventions across DB, API, frontend, and backend.
- API response/error payload consistency.
- Date/time and week boundary format consistency.
- Frontend state/update patterns for reorder and validation states.
- Test and folder placement consistency across services.

### Naming Patterns

Database naming conventions:

- Tables: snake_case plural (for example `tasks`, `time_entries`, `week_plans`).
- Columns: snake_case (for example `week_start_date`, `remote_worked`, `order_index`).
- Foreign keys: `<entity>_id` (for example `day_plan_id`).
- Index names: `idx_<table>_<column>`.

API naming conventions:

- Route groups plural and kebab-case where needed (`/recurring-tasks`, `/time-entries`).
- Route parameters use camelCase in API docs, serialized as URL path params (`/weeks/{weekStartDate}`).
- Query parameters use camelCase.

Code naming conventions:

- Frontend components/files: `PascalCase` for component names, folder-level feature grouping.
- Frontend functions/variables: camelCase.
- Backend classes/methods: PascalCase.
- Backend locals/parameters: camelCase.

### Structure Patterns

Project organization:

- Backend follows clean layers: `Domain`, `Application`, `Infrastructure`, `Api`.
- Frontend organized by feature slices (`board`, `tasks`, `timeEntries`, `auth`, `shared`).
- Shared contracts/types live in explicit boundary modules (no ad hoc duplication).

Test organization:

- Backend: `tests/unit` and `tests/integration` separated.
- Frontend: co-located `*.test.ts(x)` for component logic + separate e2e folder.

### Format Patterns

API response formats:

- Success envelope: `{ data, meta }`.
- Error envelope: `{ error: { code, message, details } }`.

Data exchange formats:

- JSON payload fields: camelCase.
- Date format: `YYYY-MM-DD`.
- Time format: `HH:mm` (24-hour).
- Booleans: native true/false values (no integer surrogates).

### Communication Patterns

State management patterns:

- React Query handles server state and cache invalidation.
- Local component state handles transient UI state (edit buffers, modal open/close, drag state).
- Optimistic update allowed only for task reorder, with rollback on API failure.

Service communication patterns:

- Frontend communicates only through versioned REST API.
- No direct DB or cross-service shortcuts.

### Process Patterns

Error handling patterns:

- Backend maps domain/application errors to standardized error envelope.
- Frontend uses centralized API error mapper to user-facing messages.

Loading state patterns:

- Query-driven loading flags for data fetches.
- Explicit per-action loading state for mutations (create/update/delete/reorder).

### Enforcement Guidelines

All AI agents MUST:

- Follow naming/format rules exactly.
- Use defined response envelopes for all endpoints.
- Respect layer boundaries (no bypass of Application layer to Infrastructure from API handlers).
- Keep all date/time parsing centralized in shared utilities.

Pattern enforcement:

- ESLint + Prettier + TypeScript strict mode on frontend.
- .NET analyzers + nullable reference types on backend.
- CI checks run lint/tests and fail on convention violations.

### Pattern Examples

Good examples:

- `GET /api/v1/weeks/2026-07-01` returns `{ data: { ... }, meta: { ... } }`.
- `timeEntries` payload uses `entryHour` and `exitHour` (HH:mm) in API JSON.
- Backend column names remain snake_case via EF mapping configuration.

Anti-patterns:

- Mixing snake_case and camelCase in API payloads.
- Returning raw exception text in API error responses.
- Writing drag-drop order only in frontend state without persistence.
- Scattering week boundary logic across multiple components/services.

## Project Structure and Boundaries

### Complete Project Directory Structure

```text
TaskManager/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── app/
│       │   ├── router.tsx
│       │   ├── providers/
│       │   └── layout/
│       ├── features/
│       │   ├── auth/
│       │   ├── board/
│       │   ├── tasks/
│       │   ├── recurringTasks/
│       │   ├── timeEntries/
│       │   └── remoteWork/
│       ├── shared/
│       │   ├── api/
│       │   ├── ui/
│       │   ├── utils/
│       │   └── types/
│       └── tests/
│           ├── e2e/
│           └── setup/
├── backend/
│   ├── TaskManager.Api/
│   ├── TaskManager.Application/
│   ├── TaskManager.Domain/
│   ├── TaskManager.Infrastructure/
│   ├── TaskManager.sln
│   └── tests/
│       ├── TaskManager.UnitTests/
│       └── TaskManager.IntegrationTests/
└── infra/
  ├── docker/
  ├── scripts/
  └── ci/
```

### Architectural Boundaries

API boundaries:

- Frontend communicates only with backend REST endpoints under `/api/v1`.
- Auth boundary enforced in API middleware; login/bootstrap endpoints are explicit exceptions.

Component boundaries:

- Frontend features are isolated modules with shared UI/components consumed via `shared/`.
- Board orchestration (week/day rendering) is separate from task/time entry forms.

Service boundaries:

- API layer handles transport concerns only.
- Application layer owns use-case orchestration and business workflows.
- Domain layer owns core rules and invariants.
- Infrastructure layer owns persistence, EF Core mappings, and external service adapters.

Data boundaries:

- PostgreSQL as source of truth.
- Repositories exposed through Application contracts.
- No direct DB access from API controllers/handlers.

### Requirements to Structure Mapping

Feature/FR mapping:

- FR-1 (Auth) → `frontend/src/features/auth`, `backend/*/Auth*` modules.
- FR-2/3 (Board + Task management) → `frontend/src/features/board|tasks`, `backend/*/Tasks*` and `DayPlan` services.
- FR-4 (Recurring tasks) → `frontend/src/features/recurringTasks`, `backend/*/RecurringTasks*`.
- FR-5/6 (Day/week completion) → board read model + backend completion evaluators.
- FR-7 (Unsaved changes) → frontend form guard utilities in `shared/utils` + feature-level hooks.
- FR-8 (Persistence) → infrastructure repositories + EF migrations.
- FR-9 (Week navigation) → frontend board route/query state + backend week endpoints.
- FR-10 (Time tracking) → `frontend/src/features/timeEntries`, `backend/*/TimeEntries*` modules.
- FR-11 (Remote work checkbox) → `frontend/src/features/remoteWork`, backend day update endpoint/handler.

Cross-cutting concerns mapping:

- Validation (HH:mm, week boundary, completeness) → Application validators + frontend input guards.
- Error envelope consistency → backend API middleware + frontend centralized error mapper.
- Date/time formatting consistency → shared utility modules frontend/backend.

### Integration Points

Internal communication:

- Frontend feature modules call shared API client.
- Backend API handlers call Application use cases.
- Application layer coordinates Domain + Infrastructure abstractions.

External integrations:

- PostgreSQL via EF Core provider.
- Docker Compose networking between `frontend`, `backend`, and `postgres`.

Data flow:

1. User interaction in frontend feature.
2. API request via shared client.
3. Backend use case execution and persistence.
4. Response envelope returned.
5. React Query cache update and UI refresh.

### File Organization Patterns

Configuration files:

- Root: compose + shared env examples.
- Frontend/backend each keep service-local config files.

Source organization:

- Frontend by feature slice.
- Backend by clean architecture layers and bounded modules.

Test organization:

- Backend unit/integration split.
- Frontend e2e and component-level tests in feature context.

Asset organization:

- Frontend static assets and UI resources under `frontend/src/shared` and `frontend/public`.

### Development Workflow Integration

Development server structure:

- Local dev uses separate frontend/backend processes or Compose stack.

Build process structure:

- Frontend built by Vite.
- Backend built/published by dotnet CLI.

Deployment structure:

- Compose orchestrates app services and persistent database volume.
- Migration scripts executed as explicit deployment step.

## Architecture Validation Results

### Coherence Validation ✅

Decision compatibility:

- Technology choices are compatible: React + Vite frontend, ASP.NET Core API backend, PostgreSQL + EF Core persistence, Docker Compose orchestration.
- Core decisions are non-contradictory and aligned with project constraints and selected stack.

Pattern consistency:

- Naming, format, and process patterns reinforce architectural choices and reduce multi-agent divergence.
- Response envelopes, date/time formats, and boundary rules are consistent across backend and frontend.

Structure alignment:

- Project tree and module boundaries support the selected architecture and implementation sequence.
- Integration points map correctly to service boundaries.

### Requirements Coverage Validation ✅

Feature and FR coverage:

- FR-1 through FR-11 are mapped to explicit components/modules and backend capabilities.
- Cross-cutting requirements (validation, completion indicators, week boundaries, reorder persistence) are covered.

Non-functional requirements coverage:

- Portability: Docker Compose topology and env strategy defined.
- Security: JWT + bcrypt + protected routes + middleware policy defined.
- Performance/UX: lightweight architecture with explicit state and API patterns supports the target behavior.

### Implementation Readiness Validation ✅

Decision completeness:

- Critical and important architectural decisions are documented with rationale and impact.
- Deferred items are clearly scoped post-MVP.

Structure completeness:

- Directory structure, boundaries, and integration points are concrete and implementation-ready.

Pattern completeness:

- Consistency rules cover naming, structure, format, communication, process, and enforcement.

### Gap Analysis Results

Critical gaps:

- None.

Important gaps:

- None blocking implementation.

Nice-to-have refinements:

- Token storage hardening policy can be revisited in security hardening pass.
- Drag/drop library final selection can be locked in first implementation story if not preselected.

### Validation Issues Addressed

- Ensured FR-10 (time tracking) and FR-11 (remote work indicator) are explicitly mapped to both backend and frontend modules.
- Confirmed week navigation and completion logic share deterministic week/day modeling.
- Confirmed persistence strategy for reorder/time-entry states is explicit.

### Architecture Completeness Checklist

Requirements Analysis

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

Architectural Decisions

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

Implementation Patterns

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

Project Structure

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

Overall status: READY FOR IMPLEMENTATION

Confidence level: high

Key strengths:

- Strong alignment between product requirements and architectural boundaries.
- Clear consistency rules that reduce AI-agent implementation conflicts.
- Explicit data model and API conventions for week/day/task/time scenarios.

Areas for future enhancement:

- Multi-user authorization model and collaborative capabilities.
- Real-time synchronization and optional caching strategy.

### Implementation Handoff

AI agent guidelines:

- Follow architectural decisions exactly as documented.
- Respect all consistency patterns and layer boundaries.
- Use the defined response/error envelopes and date/time formats in all integrations.

First implementation priority:

- Initialize `frontend` and `backend` from selected starters, then establish domain model and first migration.
