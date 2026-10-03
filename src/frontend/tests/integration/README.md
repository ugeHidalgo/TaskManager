# Recurring task integration regression

This suite uses a real Chromium browser, frontend, authenticated API and PostgreSQL. It does not mock task creation or change production behavior.

## Prerequisites

- Run the local stack described in the repository README. Rebuild frontend/backend containers after any implementation changes: these tests exercise the running application, not the source tree automatically.
- From `src/frontend`, install dependencies with `npm ci` and the browser with `npx playwright install chromium`.
- Run `npm run test:integration` from `src/frontend`.
- Development login defaults to the documented local bootstrap account. Override credentials using `TASKMANAGER_TEST_USERNAME` and `TASKMANAGER_TEST_PASSWORD` when needed.
- Optional endpoints: `TASKMANAGER_FRONTEND_URL` (default `http://localhost:5173`) and `TASKMANAGER_API_URL` (default `http://localhost:8080/api/v1`). The latter must match the API used by the frontend's `VITE_API_BASE_URL` configuration.
- Use a local/test database, never production. Browser contexts are isolated; the database is shared with the running stack.

## Expected behavior

1. Submit a Friday-to-Monday inclusive range: four independent tasks, including the weekend, with identical submitted values and correct containing weeks.
2. Reload the page and intentionally create a second, different four-day range. This is a new submission, not a retry; it must not return the previous batch.
3. Read both affected weeks through the API and verify all eight task identities and calendar dates persisted.

Each run uses a unique title marker and deletes only tasks created with that marker, including when assertions fail. It never deletes an unrelated batch returned by the bug. Empty week workspaces may remain; the test does not delete shared board data. A database containing an earlier colliding batch can reproduce the defect on the first submission, before the reload step.

The `.integration.ts` suffix is intentionally selected by Playwright and excluded from Vitest's default `.test`/`.spec` discovery. Generated reports are ignored by Git.
