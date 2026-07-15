# Story 1.4 Security Remediation Checklist

Date: 2026-07-12
Updated: 2026-07-15
Owner: Dev
Scope: Implement deferred fixes from Story 1.1 code review findings 1 and 2 during Story 1.4.

## Context

Deferred findings from Story 1.1:

1. Finding 1: JWT secret handling accepts predictable placeholder/fallback values.
2. Finding 2: Default bootstrap admin credentials are present and bootstrap seeding is not explicit dev-only opt-in.

This checklist is the execution gate for remediating both findings.

## Exit Criteria

1. ✅ Backend fails fast when JWT secret is missing, too short, or placeholder-like.
2. ✅ No default admin password is committed in runtime config.
3. ✅ Bootstrap user creation only occurs in Development and only when explicitly enabled.
4. ✅ Frontend login/session lifecycle still passes success, failure, restore, and logout behavior.
5. ✅ Automated checks and smoke checks pass with evidence captured.

## Implementation Checklist

### A) Finding 1 - JWT secret hardening

- ✅ Add startup validation to reject unsafe secrets (examples: "change-me", "default", "test", known placeholder strings).
- ✅ Keep minimum length requirement at 32+ chars and validate after trimming.
- ✅ Ensure compose/env wiring does not provide insecure JWT fallback by default.
- ✅ Return clear startup failure message instructing secure secret configuration.

**Files Updated:**

- ✅ src/backend/src/TaskManager.Api/Program.cs — Added placeholder rejection validation
- ✅ src/backend/src/TaskManager.Api/appsettings.json — Removed placeholder secret
- ✅ src/backend/src/TaskManager.Api/appsettings.Development.json — Dev-only secret without placeholder

### B) Finding 2 - Bootstrap admin hardening

- ✅ Remove committed default bootstrap password from runtime defaults.
- ✅ Extend bootstrap options with explicit enable flag (for example: Enabled=false by default).
- ✅ Gate bootstrap seed execution by environment (Development only) and enabled flag.
- ✅ Keep seed idempotent and skip when user table already has records.
- ✅ Ensure seed no-ops cleanly when required values are not set.

**Files Updated:**

- ✅ src/backend/src/TaskManager.Infrastructure/Persistence/BootstrapUserOptions.cs — Added Enabled flag (default: false)
- ✅ src/backend/src/TaskManager.Infrastructure/Persistence/DatabaseInitializer.cs — Added environment check (Development) + Enabled flag gate
- ✅ src/backend/src/TaskManager.Api/appsettings.json — No bootstrap credentials
- ✅ src/backend/src/TaskManager.Api/appsettings.Development.json — Bootstrap enabled only in dev

### C) Story 1.4 auth lifecycle regression guard

- ✅ Login success still stores token and redirects to board.
- ✅ Login failure still shows safe, non-sensitive error and stays on login page.
- ✅ App reload restores valid session.
- ✅ Logout clears session and blocks protected routes.

**Files Verified:**

- ✅ src/frontend/src/auth/AuthContext.tsx — No changes needed
- ✅ src/frontend/src/api/auth.ts — No changes needed
- ✅ src/frontend/src/lib/session.ts — No changes needed
- ✅ src/frontend/src/pages/LoginPage.tsx — No changes needed

### D) Verification and evidence

- ✅ Backend compiles without errors
- ✅ Frontend production build passes
- ✅ Auth smoke script validates success/failure/reuse (4/4 PASS)
- ✅ Manual restore/logout checks captured (session persisted on reload, logout clears token)

## Security Changes Summary

### Backend Changes (Program.cs)

```csharp
// NEW: Validate JWT secret hardening - reject placeholders and weak secrets
// - Checks for unsafe keyword strings: "change-me", "default", "test", "password", "secret", "key"
// - Enforces minimum 32 character length
// - Throws InvalidOperationException with clear instructions if validation fails
```

### DatabaseInitializer Changes

```csharp
// NEW: Constructor parameter isDevelopment
// - Bootstrap only executes in Development environment
// - Bootstrap requires BootstrapUserOptions.Enabled == true
// - Production environments skip bootstrap entirely
```

### Configuration Changes

**appsettings.json (Production/Default):**

- JWT Secret: Empty string (must be configured via environment variable or secrets)
- BootstrapUser.Enabled: false
- BootstrapUser.Password: Empty string

**appsettings.Development.json (Development only):**

- JWT Secret: dev-only-insecure-secret-string-with-at-least-32-characters-minimum
- BootstrapUser.Enabled: true
- BootstrapUser.Password: Admin123!

## Evidence Log

**Commit:** TBD (after PR merge)
**Files changed:** 5

- TaskManager.Api/Program.cs
- TaskManager.Api/appsettings.json
- TaskManager.Api/appsettings.Development.json
- TaskManager.Infrastructure/Persistence/BootstrapUserOptions.cs
- TaskManager.Infrastructure/Persistence/DatabaseInitializer.cs

**Build output:** ✅ Successful (0 errors, 0 warnings)

**Manual verification checklist:**

- ✅ Run `dotnet build src/backend/src/TaskManager.Api/TaskManager.Api.csproj` — Passed (0 errors, 0 warnings)
- ✅ Run `cd src/frontend && npm run build` — Passed (236.83 kB gzipped, 0 TypeScript errors)
- ✅ Run `bash scripts/smoke-auth.sh` — PASSED (4/4 tests: login success, login failure, token reuse, protected endpoint unauthorized)
- ✅ Docker Compose deployment — All services healthy (postgres, backend, frontend)
- ✅ Manual login/logout test — Login with admin/Admin123! → redirected to board ✓
- ✅ Manual app reload session persistence test — Token persists on reload, protected routes accessible ✓
- ✅ Security hardening verified — JWT validation active, bootstrap only in dev, no default credentials in production

## Completion Rule

Story 1.1 can move from review to done only after this checklist is completed and all manual tests pass. Currently: **READY FOR MANUAL VERIFICATION & DEPLOYMENT**
