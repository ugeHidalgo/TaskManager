---
title: "Story 2.2 Task 1: Completion State Integration"
type: feature
created: "2026-09-26"
baseline_commit: "68edf94c3890e14dd37acc753d947df55484426a"
status: done
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md"
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.1 already persists task status through its authenticated update API, but Story 2.2 Task 1 lacks a focused regression proving completion and reopening persist without changing task placement or list position.

**Approach:** Reuse the existing authenticated task update contract and add focused API/facade tests for both status transitions, confirming the task remains in the same week and day/shared-week context and retains its relative list order. Avoid a second status store or a new endpoint unless testing uncovers a concrete gap.

## Boundaries & Constraints

**Always:** Preserve existing status values, `{ data, meta }` / `{ error }` envelopes, week scoping, task identity, placement, and current ordering behavior. Keep API authorization in place.

**Ask First:** Any contract change that requires a new endpoint, schema migration, or change to how tasks are ordered.

**Never:** Add completed-card styling, checkbox/reopen UI, keyboard interaction, recurring-task logic, day/week completion calculations, or unsaved-change protection; those are outside Task 1.

## I/O & Edge-Case Matrix

| Scenario            | Input / State                                                   | Expected Output / Behavior                                                          | Error Handling                         |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| Complete            | Existing task, same week and placement, status `Completed`      | Update succeeds; GET returns completed task in unchanged context and relative order | Existing structured error response     |
| Reopen              | Existing completed task, same week and placement, active status | Update succeeds; GET returns active task in unchanged context and relative order    | Existing structured error response     |
| Unauthorized update | No authenticated identity                                       | Update is denied; task remains unchanged                                            | Existing authentication error envelope |

</frozen-after-approval>

## Code Map

- `src/backend/src/TaskManager.Domain/Board/TaskItem.cs` -- status validation/update and stable task fields.
- `src/backend/src/TaskManager.Api/Program.cs` -- authenticated task update route.
- `src/backend/src/TaskManager.Api/Facades/TaskManagerFacade.cs` -- update persistence and week task retrieval/order.
- `src/backend/tests/TaskApiTests.cs` -- focused status-persistence and context-preservation regressions.
- `src/backend/tests/TaskAuthorizationTests.cs` -- authenticated boundary regression.

## Tasks & Acceptance

**Execution:**

- [x] `src/backend/tests/TaskApiTests.cs` -- cover complete and reopen through the established update flow, then reload and assert status, identity, placement, and relative order remain correct -- lock down Task 1 behavior without duplicating status logic.
- [x] `src/backend/tests/TaskAuthorizationTests.cs` -- verify unauthenticated task update remains denied if existing coverage does not already cover PUT -- protect the authenticated boundary.

**Acceptance Criteria:**

- Given a task in a week/day or shared-week context, when its status changes to `Completed`, then the update and subsequent reload preserve task identity, placement, and relative order.
- Given a completed task, when it is reopened using an active status, then the update and subsequent reload preserve task identity, placement, and relative order.
- Given an unauthenticated request, when it attempts to update task status, then access is denied and persisted task state is unchanged.
- Existing success and error envelopes remain unchanged; no new endpoint or migration is introduced.

## Design Notes

The update API currently accepts the full task edit shape, so tests must submit unchanged title, week, day date, and notes alongside status. `CreatedAtUtc` drives current list order; a status-only update must not mutate it. Completion/reopen controls and card presentation belong to later tasks in Story 2.2.

## Verification

**Commands:**

- `dotnet test src/backend/tests/Taskmanager.Tests.csproj` -- expected: all backend tests pass.
- `dotnet build TaskManager.sln` -- expected: build succeeds with no new errors.

## Implementation / Verification Note

Implemented Story 2.2 Task 1 regression coverage using the existing authenticated PUT contract and GET reload flow. Complete/reopen persistence is verified for both shared-week and day placement, including stable identity, workspace, placement, created-at ordering, and surrounding task order. Added missing unauthenticated PUT coverage; no endpoint, schema, frontend, or story-wide status changes were made.

Verification: `dotnet test src/backend/tests/Taskmanager.Tests.csproj` succeeded — 23 passed, 0 failed, 0 skipped. `dotnet build TaskManager.sln` succeeded. An initial compile exposed and was corrected for a nullable type inference issue in the new test. The API project has an existing CS8604 JWT-secret nullability warning in `Program.cs`.

## Suggested Review Order

**Completion state persistence**

- The API update/reload regression proves status changes preserve identity, placement, and ordering.
  [`TaskApiTests.cs:83`](../../src/backend/tests/TaskApiTests.cs#L83)

**Authorization boundary**

- The unauthenticated request is checked against a seeded persisted task, including all task fields and cleanup.
  [`TaskAuthorizationTests.cs:47`](../../src/backend/tests/TaskAuthorizationTests.cs#L47)

**Story and sprint tracking**

- Task 1 is checked off while the rest of Story 2.2 correctly remains in progress.
  [`2-2-keep-completed-tasks-visible-and-reopenable.md:29`](epic-2/2-2-keep-completed-tasks-visible-and-reopenable.md#L29)
- Sprint status retains Story 2.2 as in progress rather than prematurely marking the whole story for review.
  [`sprint-status.yaml:58`](sprint-status.yaml#L58)
- Story 2.1's completion status is aligned with its existing sprint tracker entry.
  [`2-1-create-and-edit-tasks-in-day-and-shared-week-context.md:3`](epic-2/2-1-create-and-edit-tasks-in-day-and-shared-week-context.md#L3)

**Solution configuration**

- The solution file includes the backend test project for solution-level builds.
  [`TaskManager.sln:28`](../../TaskManager.sln#L28)
