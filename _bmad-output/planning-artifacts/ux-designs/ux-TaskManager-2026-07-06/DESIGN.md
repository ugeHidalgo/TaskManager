---
title: "DESIGN - TaskManager"
status: final
created: "2026-07-06"
updated: "2026-07-06"
sources:
  - _bmad-output/planning-artifacts/prds/prd-TaskManager-2026-06-30/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
colors:
  bg:
    app: "#F7F6F3"
    surface: "#FFFFFF"
    surfaceMuted: "#F1EEE8"
  text:
    primary: "#1D1D1D"
    secondary: "#5C5A56"
    inverse: "#FFFFFF"
  border:
    default: "#D8D2C7"
    strong: "#B9B1A2"
    error: "#C63D2F"
  accent:
    primary: "#A6733F"
    primaryHover: "#8F6234"
    success: "#2F7A4F"
    warning: "#C68B2F"
    error: "#C63D2F"
typography:
  fontFamily:
    base: "Merriweather, Georgia, serif"
    ui: "Merriweather, Georgia, serif"
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace"
  scale:
    display: "30px/38px"
    h1: "24px/32px"
    h2: "20px/28px"
    h3: "16px/24px"
    body: "15px/22px"
    caption: "13px/18px"
  weight:
    regular: 400
    medium: 500
    semibold: 600
    bold: 700
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
spacing:
  scale:
    1: "4px"
    2: "8px"
    3: "12px"
    4: "16px"
    5: "20px"
    6: "24px"
    8: "32px"
    10: "40px"
  density: "balanced"
components:
  card:
    radius: "{rounded.md}"
    padding: "{spacing.scale.4}"
    border: "1px solid {colors.border.default}"
  button:
    radius: "{rounded.sm}"
    padding: "10px 14px"
  checkbox:
    size: "18px"
    radius: "{rounded.xs}"
  columnHeader:
    radius: "{rounded.sm}"
    padding: "{spacing.scale.3} {spacing.scale.4}"
  modal:
    radius: "{rounded.lg}"
    padding: "{spacing.scale.6}"
---

# DESIGN

## Brand and Style

TaskManager visual language is focused, grounded, and calm. The interface should feel editorial and intentional, not playful or flashy. The design should prioritize readability and task completion confidence over decorative density.

Core style rules:

- Keep each task card text short and scannable.
- Use motion only to support orientation and feedback.
- Reserve strong color contrast for status and errors.
- Keep visual hierarchy stable across weeks.

## Colors

Palette intent:

- Soft warm base to reduce visual fatigue.
- Neutral surfaces for high text legibility.
- One controlled primary accent for actions.
- Red reserved for real error states (missing exit time, missing day logs).

Usage rules:

- App background uses `{colors.bg.app}`.
- Cards and elevated UI use `{colors.bg.surface}`.
- Secondary containers use `{colors.bg.surfaceMuted}`.
- Primary action and active controls use `{colors.accent.primary}`.
- Error highlights use `{colors.accent.error}` with border emphasis.

## Typography

Typography direction is editorial (serif-led) to reinforce focus and reduce dashboard noise.

Rules:

- Body copy and most UI labels use `{typography.fontFamily.base}`.
- Monospace appears only for time-like content when needed (`HH:mm`).
- Keep task title text to one visual line by default; overflow behavior is defined in EXPERIENCE.

## Layout and Spacing

Density is balanced: enough breathing room for scanability without wasting viewport.

Layout rules:

- Board columns should preserve stable width before introducing horizontal scroll.
- Top priority block (today column focus) should be immediately visible on load.
- Card internals should use `{spacing.scale.2}` to `{spacing.scale.3}` vertical rhythm.
- Keep spacing between actionable controls and labels tight to reduce eye travel.

## Elevation and Depth

Depth should be minimal and predictable.

Rules:

- Default cards use border and subtle surface contrast; avoid heavy shadows.
- Hover/focus states can add very light elevation cue, but no dramatic lift.
- Modals use stronger separation than cards to establish temporary focus.

## Shapes

The product uses rounded geometry with smooth, practical radii.

Rules:

- Standard interactive components use `{rounded.sm}` to `{rounded.md}`.
- Containers and modal surfaces can use `{rounded.lg}`.
- Do not mix sharp and highly rounded components in the same view.

## Components

Task Card:

- Compact header area with checkbox near title.
- Short primary line + optional secondary description line.
- Status and meta info should not crowd primary task text.

Day Column Header:

- Must include day name, remote checkbox, and day-complete check state.
- Header visual state changes for errors (missing logs/incomplete time pairs).

Week Header Controls:

- Priority order: week completion status, quick add task, quick add time entry, week label/range, next week, previous week.
- Keep action cluster close; avoid dispersing controls across wide areas.

Time Entry Row:

- Entry and exit values aligned for quick pair scanning.
- Incomplete pair receives immediate red emphasis.

Confirmation Modal:

- Clear, low-verbosity copy.
- Primary and secondary actions visually distinct.

## Do's and Don'ts

Do:

- Keep cards concise and legible.
- Use subtle transitions only.
- Make status states visible at a glance.
- Preserve visual consistency across week navigation.

Do not:

- Overload cards with long text blocks.
- Use flashy or decorative animation.
- Reuse red for non-error meaning.
- Scatter primary actions into unrelated regions.
