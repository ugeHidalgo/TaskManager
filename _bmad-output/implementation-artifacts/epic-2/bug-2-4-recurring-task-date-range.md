# Bug: Recurring task creation does not create one task per date

Status: Open
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

The expected per-day task creation is not achieved. The precise post-submit outcome (for example, no tasks, one task, or a partial batch) still needs to be captured during reproduction.

## Scope and notes

- This defect belongs to Epic 2, Story 2.4.
- The story's existing acceptance criteria and implementation tasks already describe the intended batch behavior.
- Root cause has not been investigated.
- No implementation or code changes have been made as part of opening this bug.

## Verification when fixed

- Test an inclusive range with multiple days and confirm exactly one task exists for each date.
- Confirm the generated tasks retain the submitted task values and can be managed independently.
- Run the relevant frontend and backend regression tests.
