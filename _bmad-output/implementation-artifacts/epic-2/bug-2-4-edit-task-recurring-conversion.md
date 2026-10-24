# Bug: Converting an existing task to a recurring batch moved it to Shared week

Status: Fixed
Type: Functional defect
Epic: 2 - Task Lifecycle and Completion
Related story: 2.4 - Manage Recurring Tasks

## Reproduction and cause

Create a normal day task, open Edit task, check Recurring task, select an inclusive date range and save. The editor sent `dayDate: null`, but the board chose ordinary PUT because an existing task was being edited. The update endpoint ignored recurrence fields and moved that task to Shared week instead of creating the batch.

## Agreed behavior

- Conversion preserves the original task ID.
- If the original date is within the requested range, keep it on that date.
- If its date is outside the range, or it is a shared-week task, place it on the first day of the range. Moving to the first day was explicitly confirmed by the user.
- Generate one independent task for every other date, inclusive of weekends and week boundaries. There must be exactly one batch task per date, with the submitted title, notes, status and execution time.
- The operation is atomic, compacts the original source lane when needed, and supports retries with the same idempotency key without duplicating tasks.
- Editing an individual task without checking Recurring task continues to update only that task. Conversion does not update or delete siblings from an earlier batch.

## Implementation

- Added authenticated `POST /api/v1/tasks/{taskId}/recurring`, with source `weekStartDate`, inclusive `startDate`/`endDate`, task fields and the `Idempotency-Key` header.
- Backend validates before modifying entities and uses a transaction for conversion and lane reindexing. PostgreSQL locks serialize retries sharing a key and conversions of the same original.
- The board routes recurring edits to conversion before the ordinary update branch, then reloads the visible week and reports the batch total (including the original).
- No schema change or migration was required. Conversion remains a one-time batch of independent ordinary tasks, not a persistent recurring template.

## Verification

- RED confirmed before implementation: conversion HTTP endpoint returned 404 instead of 201; frontend regression observed PUT rather than the expected conversion POST.
- Full frontend suite: **114 passed**, including conversion outside/inside the range, failed-save draft retention, stable retry keys and ordinary editing.
- Full backend suite: **122 passed**, including **45 conversion tests** covering identity, dates, validation, atomic rollback, retry/concurrency and PostgreSQL persistence.
- Real browser/API/PostgreSQL integration suite: **4 passed**, including both conversion placements, reload and idempotent retries; existing recurring-creation and ordering integrations remain green.
- Frontend lint, TypeScript/production build passed. Test cleanup targets only the tasks created by each run.

## Code and regression map

- [Conversion API and transaction](../../../src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs)
- [Conversion contracts](../../../src/backend/src/TaskManager.Api/Contracts/TaskContracts.cs)
- [Frontend routing](../../../src/frontend/src/pages/BoardPage.tsx)
- [Frontend regression](../../../src/frontend/src/pages/BoardPage.conversion.test.tsx)
- [Backend facade tests](../../../src/backend/tests/TaskConversionFacadeTests.cs)
- [Backend HTTP integration](../../../src/backend/tests/TaskConversionHttpTests.cs)
- [Domain tests](../../../src/backend/tests/TaskConversionDomainTests.cs)
- [Real browser conversion integration](../../../src/frontend/tests/integration/convert-task-to-recurring.integration.ts)
