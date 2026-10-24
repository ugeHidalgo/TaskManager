# Bug: Task status overflows card in full-week view

Status: Fixed
Type: Visual defect

## Reproduction

1. Open the board and choose `Full week (Mon-Sun)`.
2. View a day task in one of the seven columns, particularly one with a status label such as `In progress`.
3. On narrower columns, the task action/status row does not wrap, causing its status label to render beyond the right edge of its task card.

## Expected result

Task controls and status remain inside the card. When the row does not fit in the narrower full-week column, its items wrap onto another line.

## Cause and fix

`.task-controls-row` was a flex row without wrapping. The seven-column layout reduced available width, so its children overflowed. The row now uses `flex-wrap: wrap` and a minimum width of zero; `.task-content` also has `min-width: 0` so its grid item can shrink to the card's available width.

## Verification

- Browser integration regression reproduced the overflow in Chromium before the CSS change: the status label extended past the card's right edge.
- After rebuilding the frontend, the same test passed and verified the status remains inside the card.
- Frontend unit suite: **114 passed**; ESLint and production build passed.
- The full browser integration run passed the new overflow test and the recurring conversion/creation tests. The separate existing stable-order integration passed when run in isolation; it intermittently failed its focus assertion when run after the other browser tests, so that unrelated focus-suite flake is not counted as a passing result.

## Regression test

- [Full-week card overflow browser regression](../../../src/frontend/tests/integration/full-week-card-overflow.integration.ts)
- [Responsive task card styles](../../../src/frontend/src/features/board/styles/board-layout.css)
