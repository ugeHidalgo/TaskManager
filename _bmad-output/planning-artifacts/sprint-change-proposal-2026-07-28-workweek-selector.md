# Sprint Change Proposal - Workweek/Full Week Selector

Date: 2026-07-28
Scope: Epic 1 - Secure Weekly Workspace
Type: Moderate change (backlog/story update + UI behavior extension)

## 1) Issue Summary

During implementation of Story 1.5, a new product need emerged:

- Users should be able to switch weekly board columns between:
  - Workweek view (Monday-Friday)
  - Full week view (Monday-Sunday)

Current implementation renders a fixed 7-day board and does not provide a user selector.

## 2) Impact Analysis

### Epic impact

- Epic 1 remains active and this feature aligns with board baseline and navigation capabilities.
- No backend schema changes required for first iteration (UI-only selector state).

### Story impact

- Story 1.5 currently covers week layout baseline and can remain in-progress.
- New functionality is best tracked as a dedicated follow-up story in Epic 1 to avoid overloading 1.5 scope.

### Artifact conflicts

- Planning artifacts have mixed wording around 5-day vs 7-day expectations.
- This proposal resolves the ambiguity by explicitly supporting both modes via selector.

### Technical impact

Frontend-only changes:

- Board header: add selector control (Workweek / Full week)
- WeekLayout: render 5 or 7 day columns based on selected mode
- Week calculations: expose filtered day ranges for workweek mode
- Tests: add selector behavior and conditional rendering coverage

No API contract changes required.

## 3) Recommended Approach

Recommended path: **Direct adjustment via new story in Epic 1**

Rationale:

- Preserves progress made in 1.5 (layout baseline + tests)
- Adds new behavior as isolated scope with clear acceptance criteria
- Avoids reworking completed commits under ambiguous requirements

Effort estimate: S-M (1-2 dev days)
Risk: Low (UI/state only)
Timeline impact: Minimal

## 4) Detailed Change Proposals

### 4.1 Sprint status update

- Add new story key in Epic 1 backlog:
  - `1-8-toggle-between-workweek-and-full-week-board-view`

### 4.2 New story proposal

Create implementation artifact story with:

- Selector in board header (Workweek / Full week)
- Default mode defined (recommendation: Workweek for business focus)
- Persist selector in localStorage for user continuity
- WeekLayout receives mode and renders 5 or 7 columns accordingly
- Tests for mode switching and expected column count

## 5) Implementation Handoff

Scope classification: **Moderate**

Handoff:

1. Create Story (CS): generate `1-8-toggle-between-workweek-and-full-week-board-view.md`
2. Validate Story (VS): verify readiness before implementation
3. Dev Story (DS): implement selector + tests
4. Code Review (CR): validate acceptance and regressions

Success criteria:

- User can toggle between 5-day and 7-day board
- Column labels and empty states remain correct in both modes
- Existing auth/session flow unaffected
- Unit tests updated and passing
