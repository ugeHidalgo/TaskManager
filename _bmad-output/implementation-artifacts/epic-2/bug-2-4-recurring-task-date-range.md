# Bug: Recurring task creation does not create one task per date

Status: Closed
Type: Functional defect
Epic: 2 - Task Lifecycle and Completion
Related story: 2.4 - Manage Recurring Tasks

## Description

When creating a recurring task, selecting the `Recurring task` checkbox reveals the `Date From` and `Date To` fields. After selecting a date range, the application is expected to create the same task once for every calendar day in that range, inclusive. The reported defect is that this per-day batch-creation behavior is not working as expected.

## Reproduction steps

1. Open the `New Task` form.
2. Select the `Recurring task` checkbox.
3. Set `Date From` and `Date To` to a valid range.
4. Submit the task.

## Expected result

One independent task is created for each calendar date from `Date From` through `Date To`, inclusive, with the entered task values.

## Actual result

The browser integration regression reproduced a new submission returning an existing batch instead of creating tasks for the requested dates. Submitting January 2–5, 2037 returned HTTP 200 with five tasks dated September 21–25, 2026, rather than four new tasks for the submitted inclusive range.

## Scope and notes

- This defect belongs to Epic 2, Story 2.4.
- The story's existing acceptance criteria and implementation tasks already describe the intended batch behavior.
- Confirmed root cause: the editor used React `useId()` as an idempotency key, while the API returns an existing batch when its key matches. React IDs are not globally unique submission identifiers across page loads.
- The editor now generates a cryptographically random 128-bit hexadecimal key once per mounted editor using a lazy `useState` initializer. New editors/page loads receive new keys; rerenders and retries retain the same key.
- `crypto.getRandomValues()` also works in non-secure HTTP contexts, preserving local/self-hosted browser compatibility without requiring `crypto.randomUUID()`.
- The fix is limited to frontend batch identity. The backend's inclusive date generation and retry behavior are unchanged; existing tasks are not migrated or deleted.

## Verification when fixed

- Test an inclusive range with multiple days and confirm exactly one task exists for each date.
- Confirm the generated tasks retain the submitted task values and can be managed independently.
- Run the relevant frontend and backend regression tests.

## Regression tests — red phase (2026-10-03)

- [Browser/API integration regression](../../../src/frontend/tests/integration/recurring-task-date-range.integration.ts): real form submission, inclusive range across a weekend/week boundary, a second intentional submission after page reload, and persistence checks through the API. **Failing as expected** on the returned calendar dates; the pre-existing database batch reproduces the failure on the first submission, before reload.
- [Authenticated HTTP/PostgreSQL integration](../../../src/backend/tests/TaskAuthorizationTests.cs): the new `CreateRecurringTasks_CreatesIndependentTasksForEveryDateInInclusiveRange` test verifies four dates, copied fields, containing weeks, reload and independent editing. **Passing without a fix** when supplied a genuinely unique batch key; the ordinary API creation path is not sufficient to reproduce the browser defect.
- [Integration setup and execution](../../../src/frontend/tests/integration/README.md): run `npm run test:integration` from the frontend directory with the local stack running. Rebuild the running application after the eventual implementation change before checking for green.
- Cleanup only removes tasks carrying the regression run's unique title marker. Existing tasks returned by the bug are left untouched.

## Fix verification — green phase (2026-10-03)

- The original browser/API integration test was rerun unchanged after rebuilding only the frontend container: **1 passed**. Both inclusive four-day ranges create their own tasks, including the second submission after page reload; all eight task identities and dates are verified through the real API.
- Full frontend suite: **76 passed**, including two new editor tests for random keys on new editors and key stability after a save error/rerender/retry.
- Focused backend recurring-task suite: **5 passed**, including the HTTP/PostgreSQL integration and retry regression.
- Frontend lint, TypeScript/production build and `git diff --check` passed.
- No production task data was removed; integration cleanup deleted only tasks bearing its unique run marker.
