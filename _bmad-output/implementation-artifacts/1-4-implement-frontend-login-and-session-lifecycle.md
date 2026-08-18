# Story 1.4: Implement Frontend Login and Session Lifecycle

Status: ready-for-dev

**Epic:** 1 - Secure Weekly Workspace  
**Story ID:** 1.4  
**Estimation:** M (Medium - 3-5 days)  
**Dependencies:** Story 1-3 (authentication backend baseline) ✅ COMPLETED  
**Blocking:** Story 1-5 (Week Layout with Shared Week Section)

---

## Story

As a single user,
I want frontend login and session handling,
so that I can authenticate once and access the board securely.

## Acceptance Criteria

1. **Given** valid credentials, **When** the user submits login, **Then** frontend stores session token safely **And** user is redirected to the board.

2. **Given** invalid credentials, **When** login is submitted, **Then** user remains on login **And** a clear non-sensitive error message is shown.

3. **Given** an existing valid token, **When** app reloads, **Then** session is restored **And** re-login is not required.

4. **Given** logout action, **When** user confirms logout, **Then** token/session is cleared **And** protected routes are no longer accessible.

---

## Tasks / Subtasks

### Task 1: Build login form with client-side validation and API integration (AC: 1, 2)

- [ ] Create `frontend/src/features/auth/LoginForm.tsx` component
  - [ ] Form structure with username and password fields
  - [ ] Add a checkbox to show or hide the password value
  - [ ] Client-side validation (required fields, basic format checks)
  - [ ] Form submission handler that calls backend login API
  - [ ] Loading and error state management during submission
  - [ ] Display non-sensitive error messages from API responses
- [ ] Create `frontend/src/features/auth/LoginPage.tsx` (full page layout)
  - [ ] Page structure with centered login form
  - [ ] Styling using Tailwind CSS from project design system
  - [ ] Empty state before authentication (no board visible)
- [ ] Create `frontend/src/shared/api/authClient.ts` (API client)
  - [ ] `login(username: string, password: string)` endpoint call to `/api/v1/auth/login`
  - [ ] Parse response envelope `{ data: { token, ... }, meta: ... }`
  - [ ] Handle error envelope `{ error: { code, message, details } }`
  - [ ] Extract JWT token from successful response

### Task 2: Implement token storage and protected routes (AC: 1, 3, 4)

- [ ] Create `frontend/src/features/auth/useAuth.ts` (auth context/hook)
  - [ ] Store token in memory during session (NOT localStorage on first pass - keep session-focused)
  - [ ] Expose `isAuthenticated`, `token`, `login()`, `logout()` functions
  - [ ] Provide context wrapper for app tree
- [ ] Create `frontend/src/features/auth/ProtectedRoute.tsx` component
  - [ ] Check if user is authenticated before rendering protected page
  - [ ] Redirect to login if not authenticated
  - [ ] Preserve intended destination for post-login redirect
- [ ] Update `frontend/src/app/router.tsx` with route structure
  - [ ] Public routes: `/login` (accessible without auth)
  - [ ] Protected routes: `/board`, others requiring authentication
  - [ ] Route guard integration with `useAuth` hook
  - [ ] Post-login redirect to `/board` or preserved destination

### Task 3: Implement token restore on reload and logout session teardown (AC: 3, 4)

- [ ] Create token persistence mechanism in `frontend/src/features/auth/useAuth.ts`
  - [ ] Attempt to restore session from browser session storage or API validation call
  - [ ] On app load, check for existing valid token before requiring login
  - [ ] If restoration fails, clear any partial session data
- [ ] Add logout handler to `useAuth.ts`
  - [ ] Clear token from state
  - [ ] Call optional backend logout endpoint if available
  - [ ] Redirect user to login page
- [ ] Integrate session restore into app initialization
  - [ ] Create app-level effect to run on first mount
  - [ ] Check and restore session before rendering board routes

### Task 4: Add auth smoke checks (AC: 1, 2, 3, 4)

- [ ] Extend `scripts/smoke-auth.sh` with frontend checks
  - [ ] Validate login form renders on `/login`
  - [ ] Test successful login flow: submit credentials, verify redirect to board
  - [ ] Test invalid credentials: verify error message shown, no redirect
  - [ ] Test session restore: login, reload page, verify session persists
  - [ ] Test logout: logout, verify can't access protected routes
- [ ] Document manual testing steps in README or wiki
  - [ ] Login with valid user credentials
  - [ ] Verify token is stored and used in subsequent requests
  - [ ] Verify page reload restores session
  - [ ] Verify logout clears session

---

## Developer Context

### Architecture Guardrails

**CRITICAL REQUIREMENTS FROM ARCHITECTURE:**

1. **Frontend State Management** ([Source: architecture.md#Frontend Architecture](source))
   - Use **React Query** for server state (weeks, tasks, etc.) - NOT for auth state
   - Keep auth as React Context + local hook state (simpler pattern for session-focused auth)
   - Local UI state (loading, errors) in component state, not global

2. **API Response Envelopes** ([Source: architecture.md#API and Communication Patterns](source))
   - Success: `{ "data": { token, ... }, "meta": ... }`
   - Error: `{ "error": { "code": "...", "message": "...", "details": [...] } }`
   - **MUST** extract `error.message` for user display, NOT raw exception text
   - **MUST** NOT leak sensitive details (never show internal errors)

3. **REST API Patterns** ([Source: architecture.md#API and Communication Patterns](source))
   - Base path: `/api/v1`
   - Auth endpoint: `POST /api/v1/auth/login`
   - All protected routes require `Authorization: Bearer {token}` header
   - Token format: JWT with standard claims

4. **Security Requirements** ([Source: architecture.md#Authentication and Security](source))
   - Backend uses bcrypt + JWT (you don't hash - backend does)
   - Store token in memory for MVP (session-focused, not persistent)
   - Frontend MUST add token to all API requests (via centralized API client)
   - Do NOT expose token in URLs or logs

5. **Naming Conventions** ([Source: architecture.md#Naming Patterns](source))
   - Frontend files/folders: PascalCase for components, camelCase for functions
   - Auth feature folder: `frontend/src/features/auth/`
   - API client functions: camelCase, e.g., `login()`, `logout()`
   - Route path: kebab-case, e.g., `/board`, `/login`

6. **Project Structure** ([Source: architecture.md#Project Structure and Boundaries](source))
   ```
   frontend/src/
   ├── app/
   │   ├── router.tsx (route definitions)
   │   └── providers/ (context providers including auth)
   ├── features/
   │   ├── auth/
   │   │   ├── LoginPage.tsx
   │   │   ├── LoginForm.tsx
   │   │   ├── ProtectedRoute.tsx
   │   │   ├── useAuth.ts (context hook)
   │   │   └── index.ts (exports)
   │   ├── board/
   │   └── [other features]
   ├── shared/
   │   ├── api/
   │   │   └── authClient.ts
   │   ├── ui/
   │   ├── utils/
   │   └── types/
   └── tests/
   ```

### Technical Stack Details

**Frontend Stack** ([Source: project-context.md](source)):

- **Framework:** React 18+
- **Build Tool:** Vite
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **HTTP Client:** Consider Axios or Fetch API (check story 1-1 for decision)
- **State:** React Query (for server state), React Context (for auth)
- **Routing:** React Router v6 (or check if locked in story 1-1)

**Backend API** ([Source: project-context.md, architecture.md](source)):

- Framework: ASP.NET Core Web API
- Auth: JWT with bcrypt password hashing
- Token expiry: Configured by backend (follow backend response)
- Rate limiting: Not in MVP (deferred post-MVP)

### Testing Standards

**Frontend Testing Framework** ([Source: architecture.md#Implementation Patterns & Consistency Rules](source)):

- Unit/integration: Vitest + React Testing Library (to be added in this or next story)
- E2E: Playwright recommended (can add after core feature works)
- Smoke tests: Add to `scripts/smoke-auth.sh` for manual CI/local verification

**Testing Requirements for Story 1-4:**

1. Login form renders and validates inputs
2. Successful login stores token and redirects
3. Invalid login shows error message
4. Session restores on page reload
5. Logout clears session
6. Protected routes redirect to login when not authenticated

### API Integration Specifics

**Backend Endpoints Ready** ([Source: 1-3 implementation evidence](source)):

- **POST `/api/v1/auth/login`** - Takes `username`, `password`; returns JWT
- Protected routes automatically reject without valid token
- 401/403 responses follow standard error envelope

**Frontend API Client Requirements:**

- Create `frontend/src/shared/api/authClient.ts`
- Export `login(username, password)` function
- Automatically add `Authorization: Bearer {token}` header to all subsequent requests
- Handle error responses gracefully

### Critical Implementation Patterns

**DO:**
✅ Use React Context for auth state (simple, appropriate for single-user MVP)
✅ Store token in memory (not localStorage) for session-focused approach
✅ Redirect to `/board` after successful login
✅ Show clear error messages (e.g., "Invalid username or password")
✅ Restore session on app reload via context effect
✅ Use protected route component to guard `/board`

**DON'T:**
❌ Don't store password anywhere - only store returned JWT token
❌ Don't expose JWT token in logs, errors, or browser console logs
❌ Don't bypass API auth middleware - always use backend login endpoint
❌ Don't use localStorage for token (MVP = session-focused)
❌ Don't show raw backend errors - map to user-friendly messages
❌ Don't hardcode token expiry - let backend control it

### Previous Story Intelligence

**From Story 1-3 (Authentication Backend Baseline)** ([Source: 1-3-implement-authentication-backend-baseline.md](source)):

**Key Learnings:**

1. **JWT Implementation:** Backend uses signed JWT with required claims for protected routes
2. **Error Handling:** 401/403 responses follow standard error envelope format
3. **Password Security:** Backend uses bcrypt - frontend doesn't hash, only sends plain password to login endpoint
4. **Protected Routes Pattern:** Auth middleware automatically rejects requests without valid token header
5. **Error Envelope:** Unauthorized responses return `{ error: { code, message, details } }` - extract `message` for user display

**Files to Reference:**

- `src/backend/src/TaskManager.Api/Program.cs` - Auth middleware setup
- `src/backend/src/TaskManager.Infrastructure/Auth/JwtTokenService.cs` - JWT creation logic
- `scripts/smoke-auth.sh` - Auth validation script (extend for frontend)

**Dev Notes from 1-3:**

- JWT token is returned on successful login
- Token must be sent in `Authorization: Bearer {token}` header on protected requests
- Unauthorized envelope shape is consistent across all protected routes
- Non-sensitive error messages are required for invalid credentials

### Recent Git Patterns

**Recent Commits Analysis:**

- `edea81a`: US 1-3 authentication backend completed
- `78f3100`: Implementation artifact for 1-2 added
- Previous stories focused on backend/infrastructure setup

**Code Patterns to Follow:**

1. Create implementation artifact file after story completion
2. Use conventional commit messages: `US {story-id} {description}`
3. Organize features by epic/story in frontend structure
4. Smoke tests in `scripts/` folder with explicit verification steps

### References

- **Epics Definition:** [Story 1.4 from epics.md](source)
- **Architecture Decisions:** [Frontend Architecture](source) and [API Patterns](source)
- **UX Requirements:** [EXPERIENCE.md - Login Screen, Key Flows](source)
- **Backend Implementation:** [1-3-implement-authentication-backend-baseline.md](source)
- **Project Context:** [project-context.md - Tech Stack](source)

---

## Dev Notes - Detailed Implementation Guidance

### Component Architecture

**LoginPage.tsx** (Container Component)

- Handles page layout and high-level auth flow
- Manages page-level loading/error states
- Redirects to board on successful login
- Redirects to login if already authenticated (avoid redirect loop)

**LoginForm.tsx** (Presentational Component)

- Form markup with username/password fields
- Client-side validation (required field checks)
- Form submission and error display
- Reusable across different auth flows (if needed)

**useAuth.ts** (Custom Hook + Context)

- Manages global auth state: `isAuthenticated`, `token`, `user`
- Provides `login(username, password)`, `logout()` functions
- Handles token restoration on app load
- Manages loading/error states during auth operations

**ProtectedRoute.tsx** (Route Guard)

- Checks authentication status before rendering
- Redirects to login if not authenticated
- Preserves redirect destination (e.g., `/board?redirect=/board`)

### Session Restore Flow

```
App Mounts
  ↓
App.useEffect runs
  ↓
Check if token exists in context/session storage
  ↓
If token exists: Validate with backend (optional) or trust it
  ↓
If valid: Restore auth state, continue
  ↓
If invalid/expired: Clear session, show login
  ↓
Render routes based on auth status
```

### Error Handling Strategy

| Scenario            | Backend Response       | Frontend Action                  | User Message                          |
| ------------------- | ---------------------- | -------------------------------- | ------------------------------------- |
| Valid credentials   | 200 + JWT token        | Store token, redirect            | None (redirect)                       |
| Invalid credentials | 401 + error envelope   | Show error, stay on login        | "Invalid username or password"        |
| Network error       | Connection timeout     | Show error, allow retry          | "Connection error. Please try again." |
| Session expired     | 401 on protected route | Clear session, redirect to login | None (silent redirect)                |
| Logout              | 200 (optional)         | Clear token, redirect            | None (redirect)                       |

### Validation Rules

**Client-Side Validation (LoginForm):**

- Username: Required, non-empty
- Password: Required, non-empty
- Form submission: Disabled while loading

**API Validation (Backend):**

- Credential verification: Handled by backend
- JWT validation: Handled by backend on protected routes

### Testing Approach

**Manual Testing (Before Auto-Tests):**

1. Start local stack: `docker-compose up` (ensures backend available)
2. Open frontend at `http://localhost:5173`
3. Test login with valid credentials
4. Test login with invalid credentials
5. Test page reload with session active
6. Test logout
7. Test that board is inaccessible without auth

**Smoke Test Script** (`scripts/smoke-auth.sh`):

- Extend existing script to include frontend checks
- Use curl to test backend endpoints
- Document frontend manual steps

### Status Indicators

**Implementation Checklist for Developer:**

- [ ] Auth feature folder created with all components
- [ ] LoginPage and LoginForm components render without errors
- [ ] useAuth hook provides auth state and functions
- [ ] ProtectedRoute component guards `/board` route
- [ ] Login form validates inputs
- [ ] Successful login calls backend and stores token
- [ ] Invalid login shows error message
- [ ] Session restores on page reload
- [ ] Logout clears session and redirects
- [ ] Smoke tests pass
- [ ] All acceptance criteria verified

---

## Implementation Evidence (To Be Filled After Dev)

- [ ] Commit hash(es) validating implementation
- [ ] Frontend login page accessible at `/login`
- [ ] Backend login endpoint integration verified
- [ ] Protected routes redirect to login without auth
- [ ] Smoke test script extended with frontend checks
- [ ] Manual testing evidence (screenshot/log of flows)

---

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Haiku 4.5)

### Completion Notes List

**Context Provided:**

- Epic 1.4 user story and acceptance criteria from epics.md
- Architecture patterns for frontend state, API communication, and security
- Previous story (1-3) learnings on backend JWT implementation
- UX design requirements from EXPERIENCE.md
- Project structure and naming conventions
- API response envelope formats and error handling patterns
- Testing standards and smoke test extension requirements

**Guardrails for Developer:**

- Use React Context for auth state (not Redux or other)
- Store token in memory for MVP (not localStorage)
- Follow API envelope format for error extraction
- Respect project naming conventions (PascalCase components, camelCase functions)
- Extend smoke-auth.sh with frontend verification
- Reference backend JWT implementation from story 1-3

**Critical Warnings:**

- ⚠️ Don't bypass backend login endpoint
- ⚠️ Don't store password - only store JWT token
- ⚠️ Don't expose token in logs/errors
- ⚠️ Don't hardcode token expiry - let backend control it

### File List (To Be Populated)

**Expected Files to Create/Modify:**

- `frontend/src/features/auth/LoginPage.tsx` (NEW)
- `frontend/src/features/auth/LoginForm.tsx` (NEW)
- `frontend/src/features/auth/ProtectedRoute.tsx` (NEW)
- `frontend/src/features/auth/useAuth.ts` (NEW)
- `frontend/src/features/auth/index.ts` (NEW - exports)
- `frontend/src/shared/api/authClient.ts` (NEW)
- `frontend/src/app/router.tsx` (UPDATE - add auth routes)
- `frontend/src/app/providers/index.tsx` (UPDATE - add AuthProvider)
- `scripts/smoke-auth.sh` (UPDATE - add frontend checks)
- `README.md` (UPDATE - document login flow)
- `_bmad-output/implementation-artifacts/1-4-implement-frontend-login-and-session-lifecycle.md` (UPDATE - add evidence)

**Epic 1 Progress:**

- Story 1-1: Initialize Frontend and Backend Starters - REVIEW ⏳
- Story 1-2: Provision Local Runtime - DONE ✅
- Story 1-3: Implement Authentication Backend Baseline - DONE ✅
- **Story 1-4: Implement Frontend Login and Session Lifecycle - READY FOR DEV** 🚀
- Story 1-5+: Ready once 1-4 completes

---

## Validation Checklist

**Before Development Starts:**

- [x] Story requirements extracted from epics.md
- [x] Previous story learnings documented
- [x] Architecture guardrails identified
- [x] API contracts from backend defined
- [x] UI/UX requirements from EXPERIENCE.md considered
- [x] Project structure and patterns documented
- [x] Testing approach outlined
- [x] Critical warnings and patterns documented

**After Development Completes:**

- [ ] All acceptance criteria verified
- [ ] Manual smoke tests pass
- [ ] Code follows project naming conventions
- [ ] Auth flow integrates with backend endpoints
- [ ] Session restore works on page reload
- [ ] Logout clears session
- [ ] Protected routes redirect correctly
- [ ] Error messages are user-friendly
- [ ] Implementation artifact updated with evidence

---

## Status

**Current Status:** ready-for-dev  
**Estimated Duration:** 3-5 days  
**Created:** 2026-07-15  
**Ready for:** `dev-story` workflow execution

**Next Steps for Developer:**

1. Review all sections of this story file
2. Clone/fetch latest code with story 1-3 changes
3. Create frontend auth feature components following architecture patterns
4. Integrate with backend login endpoint from story 1-3
5. Run smoke tests and manual verification
6. Update sprint status to "in-progress" when starting
7. Run `code-review` workflow when complete
