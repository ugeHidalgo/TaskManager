# Story 1.1: Initialize Frontend and Backend Starters

Status: review

## Story

As a single user,
I want the project initialized from the selected frontend and backend starters,
so that development starts from a valid architecture foundation.

## Acceptance Criteria

1. Given the repository is cloned, when setup is executed, then frontend and backend are initialized from selected starters and dependencies are installed with runnable local baseline.
2. Given the backend starter is initialized, when solution structure is reviewed, then clean-layer projects are present (Api/Application/Domain/Infrastructure) and backend build succeeds locally.
3. Given the frontend starter is initialized, when development server is started, then app runs without startup errors and TypeScript build passes.

## Tasks / Subtasks

- [ ] Validate frontend starter baseline in current repo structure. (AC: 1, 3)
  - [ ] Confirm React + Vite + TypeScript scripts are present in src/frontend/package.json.
  - [ ] Confirm frontend installs and builds successfully from src/frontend.
  - [ ] Confirm frontend development server starts without startup errors.
- [ ] Validate backend clean architecture baseline in current repo structure. (AC: 1, 2)
  - [ ] Confirm solution references include TaskManager.Api, TaskManager.Application, TaskManager.Domain, and TaskManager.Infrastructure.
  - [ ] Confirm backend solution build succeeds from repository root.
  - [ ] Confirm package baseline for auth/persistence is present (JWT, EF Core, Npgsql, BCrypt).
- [ ] Align docs and scripts with current src-based layout. (AC: 1)
  - [ ] Verify root README commands point to src/frontend and src/backend/src paths.
  - [ ] Ensure bootstrap commands are executable on a clean environment.

## Dev Notes

### Story Scope and Intent

This story establishes and verifies the starter foundation only. Keep implementation focused on project bootstrap integrity, project layout consistency, and run/build correctness. Do not expand to feature work (board behaviors, recurring tasks, time tracking, drag-and-drop logic) in this story.

### Existing Code Reality (Must Preserve)

- Repository is already reorganized under src/ with frontend at src/frontend and backend projects at src/backend/src.
- Root solution file TaskManager.sln already points to clean-layer projects under src/backend/src.
- This story should preserve the current src-based structure and avoid introducing parallel top-level frontend/ or backend/ directories.
- Existing auth and compose baseline exists and must remain functional.

### Technical Requirements

- Frontend stack baseline (from current code): React 19 + Vite 8 + TypeScript 6.
- Backend stack baseline (from current code): ASP.NET Core net9.0 + EF Core 9 + PostgreSQL provider + JWT auth + BCrypt.
- Build and run commands must execute from documented paths without manual path guessing.

### Architecture Compliance

- Maintain clean architecture layering on backend:
  - src/backend/src/TaskManager.Api
  - src/backend/src/TaskManager.Application
  - src/backend/src/TaskManager.Domain
  - src/backend/src/TaskManager.Infrastructure
- Keep API boundary and envelope conventions unchanged:
  - success: { data, meta }
  - error: { error: { code, message, details } }
- Preserve naming and format conventions:
  - DB: snake_case
  - API JSON: camelCase
  - Date: YYYY-MM-DD
  - Time: HH:mm

### Library and Framework Guardrails

- Do not replace Vite tooling with alternate frontend starters.
- Do not replace ASP.NET Core Web API with minimal non-layered structure.
- Do not downgrade or arbitrarily upgrade framework major versions in this story.
- Reuse already installed package set unless a blocker is found.

### File Structure Requirements

Primary files likely touched for this story:

- README.md
- TaskManager.sln (only if a structural mismatch is found)
- src/frontend/package.json (only if script mismatch is found)
- src/backend/src/TaskManager.Api/TaskManager.Api.csproj (only if baseline package mismatch is found)
- src/backend/src/TaskManager.Infrastructure/TaskManager.Infrastructure.csproj (only if baseline package mismatch is found)

Avoid creating new feature modules in this story.

### Testing Requirements

- Backend build check from root:
  - dotnet build TaskManager.sln
- Frontend dependency and build check:
  - cd src/frontend
  - npm install
  - npm run build
- Frontend runtime check:
  - npm run dev
- Optional integrated smoke check if environment is available:
  - docker compose up --build

### Git Intelligence Summary

Recent commits indicate that the repository recently moved to a shared src layout and that this path change is active on main. This story should reinforce that layout rather than revert it.

### Project Structure Notes

Architecture documentation shows example top-level frontend/backend directories, but the implemented repository uses a src container folder. Treat src-based layout as the source of truth for implementation.

### References

- \_bmad-output/planning-artifacts/epics.md (Epic 1, Story 1.1)
- \_bmad-output/planning-artifacts/architecture.md (Technical Constraints and Dependencies; Project Structure and Boundaries)
- \_bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md (FR-1, FR-8, NFR-1)
- \_bmad-output/project-context.md (Technical Stack; System Architecture)
- README.md (Local setup and build/run commands)
- src/frontend/package.json (Frontend starter scripts and dependencies)
- src/backend/src/TaskManager.Api/TaskManager.Api.csproj (Backend API target framework and package baseline)
- src/backend/src/TaskManager.Infrastructure/TaskManager.Infrastructure.csproj (Persistence and security package baseline)
- TaskManager.sln (Clean-layer project references)

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Last 5 commits reviewed during story context generation.

### Completion Notes List

- Story context generated from epics, architecture, PRD, project context, and current repository structure.
- Story prepared to prevent path/layout regressions after src-folder reorganization.
- Implementation confirmed in commit 983d677e08d4ed9cdca69f9267839adcff4c6af6; story moved to review for code-review step.
- Code review identified two high-severity security findings to remediate in Story 1.4 by implementation decision:
  - Finding 1: reject placeholder/predictable JWT secrets at startup and require explicit secure secret configuration.
  - Finding 2: remove default bootstrap admin credentials and make bootstrap user creation explicit dev-only opt-in.
- Story 1.1 remains in review until Story 1.4 implements these remediations.
- Execution checklist for these remediations: \_bmad-output/implementation-artifacts/1-4-security-remediation-checklist.md.

### File List

- \_bmad-output/implementation-artifacts/1-1-initialize-frontend-and-backend-starters.md
