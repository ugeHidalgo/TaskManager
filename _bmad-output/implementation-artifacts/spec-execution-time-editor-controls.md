---
title: "Compact Execution Time Editor Controls"
type: "feature"
created: "2026-09-27"
status: "done"
route: "one-shot"
baseline_commit: "f70bacb5a9fa3490f8aa43888b591b5264634cdc"
---

# Compact Execution Time Editor Controls

## Intent

**Problem:** Execution time was below the other task fields and its step controls were horizontal, obscuring the desired editing order and taking excess space.

**Approach:** Place Execution time between Title and Notes, with compact up/down triangle buttons stacked without a gap to the input's left.

## Suggested Review Order

- The editor JSX sets the requested field sequence and preserves accessible button labels.
  [TaskEditor.tsx:205](../../src/frontend/src/features/board/components/TaskEditor.tsx#L205)

- The grid assigns equal half-height rows to the arrow buttons and spans the input across both.
  [board-layout.css:263](../../src/frontend/src/features/board/styles/board-layout.css#L263)

- The focused test covers field order, arrow direction, and control placement in the group.
  [TaskEditor.test.tsx:47](../../src/frontend/src/features/board/components/TaskEditor.test.tsx#L47)
