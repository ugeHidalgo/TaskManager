# Story 1.4 Security Remediation Checklist

Date: 2026-07-12
Owner: Dev
Scope: Implement deferred fixes from Story 1.1 code review findings 1 and 2 during Story 1.4.

## Context

Deferred findings from Story 1.1:

1. Finding 1: JWT secret handling accepts predictable placeholder/fallback values.
2. Finding 2: Default bootstrap admin credentials are present and bootstrap seeding is not explicit dev-only opt-in.

This checklist is the execution gate for remediating both findings.

## Exit Criteria

1. Backend fails fast when JWT secret is missing, too short, or placeholder-like.
2. No default admin password is committed in runtime config.
3. Bootstrap user creation only occurs in Development and only when explicitly enabled.
4. Frontend login/session lifecycle still passes success, failure, restore, and logout behavior.
5. Automated checks and smoke checks pass with evidence captured.

## Implementation Checklist

### A) Finding 1 - JWT secret hardening

- [ ] Add startup validation to reject unsafe secrets (examples: "change-me", "default", "test", known placeholder strings).
- [ ] Keep minimum length requirement at 32+ chars and validate after trimming.
- [ ] Ensure compose/env wiring does not provide insecure JWT fallback by default.
- [ ] Return clear startup failure message instructing secure secret configuration.

Primary files to update:

- src/backend/src/TaskManager.Api/Program.cs
- src/backend/src/TaskManager.Api/appsettings.json
- docker-compose.yml

### B) Finding 2 - Bootstrap admin hardening

- [ ] Remove committed default bootstrap password from runtime defaults.
- [ ] Extend bootstrap options with explicit enable flag (for example: Enabled=false by default).
- [ ] Gate bootstrap seed execution by environment (Development only) and enabled flag.
- [ ] Keep seed idempotent and skip when user table already has records.
- [ ] Ensure seed no-ops cleanly when required values are not set.

Primary files to update:

- src/backend/src/TaskManager.Api/appsettings.json
- src/backend/src/TaskManager.Infrastructure/Persistence/BootstrapUserOptions.cs
- src/backend/src/TaskManager.Infrastructure/Persistence/DatabaseInitializer.cs
- src/backend/src/TaskManager.Infrastructure/DependencyInjection.cs

### C) Story 1.4 auth lifecycle regression guard

- [ ] Login success still stores token and redirects to board.
- [ ] Login failure still shows safe, non-sensitive error and stays on login page.
- [ ] App reload restores valid session.
- [ ] Logout clears session and blocks protected routes.

Primary files to verify:

- src/frontend/src/auth/AuthContext.tsx
- src/frontend/src/api/auth.ts
- src/frontend/src/lib/session.ts
- src/frontend/src/pages/LoginPage.tsx

### D) Verification and evidence

- [ ] Backend unit tests pass.
- [ ] Frontend production build passes.
- [ ] Auth smoke script validates success/failure/reuse.
- [ ] Manual restore/logout checks captured (or automated equivalent added).

Commands:

```bash
dotnet test src/backend/tests/Taskmanager.Tests.csproj
cd src/frontend && npm run build
bash scripts/smoke-auth.sh
```

Manual checks:

1. Login with valid credentials -> redirected to board.
2. Refresh board route -> session remains active.
3. Logout -> token cleared and board route blocked.
4. Attempt login with invalid credentials -> clear error shown.

## Evidence Log Template

- Commit:
- Files changed:
- Test output summary:
- Smoke output summary:
- Manual checks summary:
- Notes:

## Completion Rule

Story 1.1 can move from review to done only after this checklist is completed and verified in Story 1.4.
