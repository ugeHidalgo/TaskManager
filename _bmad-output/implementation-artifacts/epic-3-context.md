# Epic 3 Context: Task Prioritization by Drag and Reorder

## Goal

Allow the planner to reprioritize tasks by reordering them within a lane and moving them between day lanes and the shared-week lane, including destinations in another week. Every change must preserve task identity, persist authoritative ordering, and recover cleanly from validation, conflict, or transport failure.

## Stories

- Story 3.1: Reorder Tasks Within the Same Section
- Story 3.2: Move Tasks Across Day Columns and Shared Week Section
- Story 3.3: Maintain Stable Order Semantics and Visual Feedback

## Requirements & Constraints

- A lane is either the shared-week lane (`week`) or a concrete calendar day in the selected Monday-based week (`mon` through `sun`, represented by an ISO `dayDate`).
- `TaskItem.Id` remains stable for every reorder or move. A move never creates a replacement task or duplicate.
- PostgreSQL is the source of truth. Persist order with an integer `order_index` scoped to the task's week/lane; do not infer priority from `CreatedAtUtc`.
- Reorder within a lane and move between lanes are persisted server-side and returned through the standard `{ data, meta }` success envelope and structured `{ error }` envelope.
- Cross-week moves must update source and destination atomically. If the source snapshot is stale, the API must reject the operation with a conflict rather than silently overwrite another order.
- The frontend may update optimistically, but failed mutations must restore the last authoritative snapshot and expose an actionable, non-sensitive error.
- Existing task status, execution time, notes, recurring-task identity, completion visibility, workweek/full-week view, week navigation, and authentication behavior remain unchanged.
- Keyboard users need a non-pointer reorder/move path. Drag-and-drop cannot be the only way to change order.

## Proposed Domain/API Contract

### Reorder

`PUT /api/v1/tasks/reorder`

```json
{
  "weekStartDate": "2026-08-17",
  "laneId": "wed",
  "taskIds": ["task-a", "task-c", "task-b"],
  "expectedVersion": "..."
}
```

The server validates that every task belongs to the authenticated workspace, selected week, and lane exactly once. It normalizes `order_index` to the submitted sequence and returns the authoritative lane snapshot plus a version/token suitable for the next mutation.

### Move

`POST /api/v1/tasks/{taskId}/move`

```json
{
  "from": {
    "weekStartDate": "2026-08-17",
    "laneId": "wed",
    "index": 2
  },
  "to": {
    "weekStartDate": "2026-08-24",
    "laneId": "mon",
    "index": 0
  },
  "expectedSourceVersion": "...",
  "expectedDestinationVersion": "..."
}
```

The operation removes the task from the source lane, updates `dayDate` and week ownership, inserts it at the destination index, reindexes affected lanes, and commits as one transaction. Same-week lane moves use the same atomic path.

### Error codes

- `task.order.invalid_lane` (`400`)
- `task.order.invalid_sequence` (`400`)
- `task.move.invalid_week` (`400`)
- `task.move.invalid_index` (`400`)
- `task.move.not_found` (`404`)
- `task.move.conflict` (`409`)
- `task.move.forbidden` (`403`)
- `task.move.unexpected` (`500`)

The exact public contract may be refined during Story 3.1 implementation, but any change must preserve authenticated scope, atomicity, stable identity, standard envelopes, and ISO date/camelCase conventions.

## Cross-Story Dependencies

- Epic 2 Story 2.1 supplies task CRUD, week/day placement, and authenticated task reads/writes.
- Epic 2 Story 2.2 supplies completed-task persistence and reopen behavior; completed cards remain eligible for reorder and move.
- Epic 2 Story 2.3 adds execution time; moving a timed day task to shared week must preserve the existing shared-week normalization rule rather than inventing a new display rule.
- Epic 2 Story 2.4 may add batch-created tasks; each generated task remains independently movable and retains its own identity.
- Epic 2 Story 2.6 protects drafts during navigation. A pending context-menu move must not bypass that protection or leak stale local state into another week.
- Story 3.1 should establish the persistence model and mutation contract before Story 3.2 adds cross-lane/cross-week behavior. Story 3.3 can then harden conflict handling, accessibility, and visual feedback across both paths.

## UX & Interaction Rules

- Keep insertion feedback visible and unambiguous while dragging; invalid targets must be visibly and semantically non-droppable.
- Show subtle confirmation after a successful reorder/move; avoid noisy animation.
- Preserve predictable focus after keyboard reorder and after menus close.
- Support a context-menu flow for cross-week moves: select `Move` on a task, navigate to another week, then choose `Move here` on a destination lane. Cancel/outside click clears pending state without mutation.
- The board must never display a task in both source and destination after a move, including after refetch or retry.
- Completed minimized tasks remain visible, reopenable, and movable.

## Implementation Sequence

1. Add and migrate `order_index` plus authoritative lane ordering/read models (Story 3.1).
2. Add same-week and cross-week atomic move behavior, including context-menu pending move flow (Story 3.2).
3. Add conflict recovery, keyboard parity, drag/drop feedback, and shared regression coverage (Story 3.3).

## Definition of Done for the Epic

- Tasks can be reordered within a lane and moved across day/shared-week lanes.
- Moves to another week preserve task identity and update both week snapshots atomically.
- Ordering survives reload, week navigation, and a fresh authenticated session.
- Failed or conflicting mutations restore authoritative state and provide corrective feedback.
- Pointer and keyboard interactions are both usable and accessible.
- Existing completion, execution-time, recurring-task, view-mode, and navigation behavior remains intact.
- Focused frontend/backend tests, lint, builds, and migration checks pass.
