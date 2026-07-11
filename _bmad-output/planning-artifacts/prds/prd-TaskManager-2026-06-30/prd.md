---
title: "PRD - Task Manager"
status: final
created: "2026-06-30"
updated: "2026-07-11"
---

# Product Requirements Document: Task Manager

## Executive Summary

**Product Name:** Task Manager  
**Scope:** MVP - Weekly task management board for personal productivity  
**Primary User:** Uge, software developer managing daily work tasks and meetings  
**Success Criterion:** User can plan and track a full week's tasks (Mon-Fri) and mark day/week completion  
**Deployment:** Docker-containerized, self-hosted, browser-accessible

---

## Vision

Enable a software developer to manage their daily work tasks and recurring meetings in a visual weekly kanban board. Tasks can be created, updated, reordered across days, marked complete, and moved forward if unfinished. The app runs locally in Docker and is accessible from any web browser.

---

## User Journey (UJ-1): Uge's Daily Workflow

### Protagonist

**Uge** — Software developer, plans daily work tasks and attends meetings. Every morning, Uge reviews the task board to organize the day's work.

### Trigger

Uge opens the app each morning via browser to check today's tasks and any carryover items from previous days.

### Phase 1: Authentication

- User logs in with credentials (MVP: single-user, local credentials stored securely).
- Upon successful login, user is taken to the main board.

### Phase 2: Board Overview

Uge sees a weekly kanban board:

- **Columns:** Monday through Friday (5 columns).
- **Top Section:** Above columns, three card areas:
  - **Time Tracking Section:** Daily time entries for each day (entry/exit hours in hh:mm format). Multiple entry-exit pairs per day allowed.
  - **Recurring Tasks:** Tasks that repeat across selected days (e.g., "Daily Standup" on Mon-Fri with checkboxes per day).
  - **Unscheduled Tasks:** Tasks without a date, can be completed any time during the week.
- **Remote Work Indicator:** Each day column header includes a checkbox to mark whether Uge worked remotely that day.
- **Today's Indicator:** Current day is visually highlighted.
- **Week Navigation:** Board header shows current week date range (e.g., "June 30 - July 4, 2026") with "Previous Week" and "Next Week" buttons.
- **Visual Status Indicators:**
  - Days with incomplete time entries (missing exit hour) are highlighted in red.
  - Days with no time entries show an error indicator.
- Uge can navigate to previous or future weeks using navigation controls.
- Uge scans the board and checks email/calendar to identify new tasks and time entries.

### Phase 3: Task Creation & Updates

Uge creates tasks in two types:

**Type A: Regular Task**

- Name (required)
- Description (optional, can be added/edited later)
- Status: "Not Started", "In Progress", "Completed" (default: "Not Started")
- Created in any day column or in "Unscheduled" section.

**Type B: Meeting Task**

- Name (required)
- Description (optional, meeting details)
- Status: "Not Started", "Completed" (default: "Not Started")
- Date and Time (required for meetings)
- Created in the appropriate day column.

**Type C: Time Entry**

- Entry Hour (hh:mm format, required)
- Exit Hour (hh:mm format, optional but recommended)
- Multiple entry-exit pairs can be added per day.
- Added to the daily time tracking section.

Tasks can be edited inline (name, description, status, date/time). Time entries can be added, edited, or deleted.

### Phase 4: During the Day – Task Completion

- Uge opens the app throughout the day.
- As tasks are completed, Uge marks them with a checkbox (status → "Completed").
- Tasks can be dragged between day columns if priorities shift.
- If a task cannot be finished by end-of-day, it is dragged to the next day.

### Phase 5: Day Completion

- When all tasks in a specific day column are marked "Completed", a checkmark appears on that day header.
- Example: When all Monday tasks are done, a ✓ appears on "Monday".

### Phase 6: Week Completion

- When all tasks of all five days (Mon-Fri) are "Completed", the week is marked as a success.
- Visual feedback: Week completion banner or color change (e.g., "Great week! All tasks completed").

### Edge Case 1: Task Deletion

- User initiates delete on a task card.
- Confirmation dialog appears: "Are you sure you want to delete '[Task Name]'?"
- User confirms or cancels.

### Edge Case 2: Unsaved Changes

- User starts editing/creating a task but closes the browser or navigates away without saving.
- App detects unsaved changes.
- Confirmation dialog: "You have unsaved changes. Do you want to leave?"
- Options: "Save & Leave", "Discard", "Stay".

---

## Functional Requirements

### FR-1: User Authentication

- Single-user login with username and password (MVP).
- Secure storage of credentials (bcrypt hashing).
- Session management with JWT tokens.
- User data isolation (prepared for future multi-user, but MVP is single-user).

### FR-2: Board Display

- Display a weekly kanban board (Mon-Fri columns).
- Top section displays:
  - Recurring tasks (with day-of-week checkboxes).
  - Unscheduled tasks (no date assigned).
- Current day is highlighted.
- Responsive layout that works on desktop browsers.

### FR-3: Task Management

- **Create Task:** User can create regular or meeting tasks with name, description, status, and optional date/time.
- **Read Task:** Tasks are displayed on the board with their attributes visible.
- **Update Task:** User can edit name, description, status, and date/time of any task.
- **Delete Task:** User can delete tasks with a confirmation dialog.
- **Mark Complete:** Checkbox on task card marks task as "Completed".
- **Drag & Reorder:** User can drag tasks between day columns or to unscheduled section.

### FR-4: Recurring Tasks

- Recurring task creation: name, description, status, and selected days (e.g., Mon-Fri).
- Display in "Recurring Tasks" section above columns with day checkboxes.
- User can mark a recurring task as complete for a specific day.

### FR-5: Day Completion Tracking

- When all tasks in a day column are completed, a ✓ checkmark appears on the day header.
- Visual feedback is immediate.

### FR-6: Week Completion Feedback

- When all five days have checkmarks, a success message or banner appears.
- Example message: "Great work! All tasks for the week are completed."

### FR-7: Unsaved Changes Protection

- App detects if a task is being edited but not saved.
- On browser close or navigation away, a confirmation dialog is shown.
- Options: "Save & Leave", "Discard", "Stay".

### FR-8: Task Persistence

- All tasks, their states, and changes are persisted to the backend (PostgreSQL).
- Data is retrieved on each login.

### FR-9: Week Navigation

- Board displays current week date range in the header (e.g., "June 30 - July 4, 2026").
- "Previous Week" and "Next Week" navigation buttons allow user to view tasks from other weeks.
- When navigating to a different week, the board updates to show tasks for that week's Mon-Fri.
- Recurring tasks remain visible in all weeks.
- Unscheduled tasks remain visible when viewing any week.
- User can navigate to any past or future week without restrictions (MVP: no date limits).

### FR-11: Remote Work Indicator

- Each day column header includes a checkbox labelled "Remote" (or similar).
- Checked = worked remotely that day; unchecked = worked on-site.
- State is persisted per day to the backend (PostgreSQL).
- Visible and editable for any week (past and future).

### FR-10: Time Tracking

- **Daily Time Entries:** User can add multiple entry-exit hour pairs per day.
- **Entry Hour:** Recorded in hh:mm format (required).
- **Exit Hour:** Recorded in hh:mm format (optional, but recommended).
- **Incomplete Entry Alert:** If an entry hour exists without an exit hour, that day is highlighted in red to signal missing exit time.
- **Empty Day Alert:** If a day has no time entries at all, the day is marked with an error indicator (e.g., red border or icon).
- **Time Entry Management:** User can add, edit, or delete time entries for any day.
- **Persistence:** All time entries are persisted to the backend (PostgreSQL).
- **Visual Feedback:** Incomplete/missing time entries are visually distinct (red highlight, error icon) to encourage completion.

---

## Non-Functional Requirements

### NFR-1: Containerization & Portability

- Entire app (React frontend + ASP.NET Core backend + PostgreSQL database) runs in Docker.
- Docker Compose orchestrates three services: `frontend` (React app), `backend` (ASP.NET Core API), `postgres` (database).
- App can be deployed to any server or local machine with Docker installed.

### NFR-2: Accessibility

- App is accessible via any modern web browser (Chrome, Firefox, Safari, Edge).
- No installation required on the client machine (browser-only access).

### NFR-3: Performance

- Page load time: < 2 seconds (first load after login).
- Task operations (create, update, delete, reorder): < 500ms response time.
- Drag & drop reordering is smooth and responsive.

### NFR-4: Data Security

- Credentials are securely hashed (bcrypt).
- API communication is over HTTPS (in production).
- JWT tokens are used for session management.
- No sensitive data is logged.

### NFR-5: Browser Compatibility

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+).
- Mobile browsers: iOS Safari 14+, Chrome Android 90+ with functional support baseline.
- MVP optimization target is desktop and tablet; mobile web is supported for core flows but not fully optimized in this phase.
- Responsive design for tablet and desktop screens.

### NFR-6: User Experience

- Minimalist, clean UI.
- Drag & drop interactions feel smooth.
- Immediate visual feedback on actions (task completion, day checkmarks, success messages).

---

## Success Metrics

1. **Functional Completeness:**
   - User can login, create/update/delete tasks, mark complete, and track week completion.
   - All edge cases (delete confirmation, unsaved changes) are handled.

2. **Week Completion:**
   - User successfully marks all tasks for a full week (Mon-Fri) as completed.
   - Success message appears and is clearly visible.

3. **Data Persistence:**
   - Tasks are persisted after logout and re-login.
   - Reordering is persisted across sessions.

4. **Performance:**
   - App loads in < 2 seconds.
   - All task operations complete in < 500ms.

5. **Deployment:**
   - App runs in Docker Compose on local machine and any cloud server.
   - No configuration changes needed to move between environments (dev, staging, production).

---

## Out of Scope (Future Enhancements)

- Multi-user collaboration (logged-in user only in MVP).
- Mobile app (Android/iOS native apps; future phase).
- Notifications and reminders (email/push).
- Recurring task templates or smart suggestions.
- Analytics or productivity metrics.
- Team workspaces or shared task boards.
- Time tracking or Pomodoro timer integration.

---

## Technical Stack (Reference)

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** ASP.NET Core Web API (.NET 10 LTS)
- **Database:** PostgreSQL
- **Infrastructure:** Docker & Docker Compose
- **Authentication:** JWT + bcrypt

---

## Implementation Notes

[ASSUMPTION] Single-user authentication in MVP will use simple username/password stored locally in the database. Future phases can integrate ASP.NET Identity or OAuth providers.

[ASSUMPTION] Drag & drop reordering will use a frontend library (e.g., React DnD or react-beautiful-dnd) and persist the new order via API on drop.

[ASSUMPTION] "Recurring tasks" in MVP means tasks created once with day checkboxes, not automatic daily duplication. Future phases can add rule-based recurrence.

[ASSUMPTION] Time tracking uses 24-hour format (hh:mm, e.g., 09:00, 17:30) for entry/exit hours.

[ASSUMPTION] Incomplete time entries (entry without exit) trigger visual alert but do not block app functionality.

[NOTE FOR ARCHITECT] Task reordering within columns needs an ordering/priority field in the database (e.g., `order_index` per day) to maintain user's drag sequence.

[NOTE FOR ARCHITECT] Time entries require a new database table (TimeEntry) with fields: day_id, entry_hour, exit_hour, created_at, updated_at. Day completion validation must check for both tasks AND time entries.
