# Story 1.7: Persistence Baseline for Weekly Workspace

Status: ready-for-dev

Epic: 1 - Secure Weekly Workspace
Story ID: 1.7
Estimation: M (2-3 days)
Dependencies: Story 1.6 navigation baseline

---

## Story

As a planner,
I want week context and board data persisted in PostgreSQL,
so that my workspace is stable across sessions.

## Acceptance Criteria

1. Given a week request, when backend loads board data, then data is sourced from PostgreSQL using week/day domain keys and response meets baseline performance targets.
2. Given first-time week access with no records, when board data is requested, then backend returns an initialized empty week workspace payload.
3. Given updates to week workspace entities, when save completes, then subsequent loads for that week return persisted state.

---

## Tasks / Subtasks

### Task 1 - Persistence model baseline

- [ ] Define week/day workspace persistence schema and repository access.
- [ ] Add migration(s) for baseline weekly workspace entities.

### Task 2 - Backend query and response

- [ ] Implement week-scoped load endpoint using Monday-based week_start_date.
- [ ] Return deterministic empty workspace payload when records do not yet exist.

### Task 3 - Frontend integration

- [ ] Integrate board loading flow with week navigation context.
- [ ] Render persisted/empty workspace response with current board structure.

### Task 4 - Validation

- [ ] Add backend tests for week-scoped retrieval and empty initialization behavior.
- [ ] Add smoke validation for persisted week reload behavior.

---

## Definition of Done

- [ ] Week workspace data is persisted and retrieved per week_start_date.
- [ ] Empty week initialization behavior is deterministic.
- [ ] Frontend board reads backend week context successfully.
- [ ] Tests and local quality checks pass.
