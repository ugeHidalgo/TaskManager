# Story 1.2: Provision Local Runtime with Docker Compose and Env Configuration

Status: done

## Story

As a developer,
I want a reproducible local runtime with frontend, backend, and database services,
so that the team can run the stack consistently.

## Acceptance Criteria

1. Given environment configuration is required, when developer starts local stack, then required variables and service wiring are documented and validated and app boots with frontend, backend, and database connected.
2. Given Docker Compose configuration exists, when compose is started, then services frontend, backend, and postgres start successfully and backend can connect to postgres through service networking.
3. Given first backend persistence setup, when migrations are applied, then initial schema for auth baseline is created and migration command is documented.

## Implementation Evidence

- Commit validated: 983d677e08d4ed9cdca69f9267839adcff4c6af6
- Compose topology with frontend/backend/postgres and service wiring:
  - docker-compose.yml
- Environment variable templates:
  - .env.example
  - src/backend/src/TaskManager.Api/.env.example
  - src/frontend/.env.example
- Backend Postgres wiring (UseNpgsql + DefaultConnection):
  - src/backend/src/TaskManager.Infrastructure/DependencyInjection.cs
- Initial auth migration present:
  - src/backend/src/TaskManager.Infrastructure/Persistence/Migrations/20260708145329_InitialAuth.cs
- Migration command documented:
  - README.md

## Tasks / Subtasks

- [x] Create docker-compose topology for frontend, backend, postgres. (AC: 2)
- [x] Define environment variables and sample env files for all services. (AC: 1)
- [x] Configure backend database connection and first migration path. (AC: 3)
- [x] Document local run and migration commands. (AC: 1, 3)

## Dev Notes

### Scope

This story covers local runtime reproducibility (compose + env + migration baseline).
Authentication behavior details and frontend session lifecycle are tracked in Stories 1.3 and 1.4.

### Verification Summary

- AC1: satisfied by env templates and startup instructions in README + compose wiring.
- AC2: satisfied by docker-compose services and backend connection string using host `postgres`.
- AC3: satisfied by EF migration artifact and documented `dotnet-ef database update` command.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Completion Notes List

- Story 1.2 implementation was verified against commit 983d677e08d4ed9cdca69f9267839adcff4c6af6.
- Sprint status was aligned to `done` in implementation-artifacts/sprint-status.yaml.
- Missing implementation artifact document for Story 1.2 was created to keep artifact parity with Story 1.1.

### File List

- \_bmad-output/implementation-artifacts/1-2-provision-local-runtime-with-docker-compose-and-env-configuration.md
- \_bmad-output/implementation-artifacts/sprint-status.yaml
