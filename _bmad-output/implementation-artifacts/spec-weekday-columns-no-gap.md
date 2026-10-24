---
title: "Remove spacing between weekday columns"
type: "refactor"
created: "2026-10-24"
status: "done"
route: "one-shot"
---

# Remove spacing between weekday columns

## Intent

**Problem:** Horizontal gaps between weekday columns reduce the available width for tasks.

**Approach:** Remove horizontal grid gaps at every breakpoint while preserving existing vertical spacing between wrapped rows, column counts, and task styling. Verified the rendered board has a computed column gap and adjacent-column distance of zero after rebuilding the frontend. CSS diagnostics and an independent diff review found no issues.

## Suggested Review Order

1. [Daily grid and responsive spacing](../../src/frontend/src/features/board/styles/board-layout.css#L162) — Zero horizontal gap; responsive rules adjust only row spacing.
