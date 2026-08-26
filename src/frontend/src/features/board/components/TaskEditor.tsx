import { useState, type FormEvent } from "react";
import {
  formatDateOnly,
  type SaveTaskInput,
  type TaskPayload,
} from "../../../api/board";

interface TaskEditorProps {
  weekStart: Date;
  initialDayDate: Date | null;
  task?: TaskPayload;
  isSaving: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSave: (input: SaveTaskInput) => void;
}

export function TaskEditor({
  weekStart,
  initialDayDate,
  task,
  isSaving,
  errorMessage,
  onCancel,
  onSave,
}: TaskEditorProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [dayDate, setDayDate] = useState(
    task?.dayDate ?? (initialDayDate ? formatDateOnly(initialDayDate) : ""),
  );
  const [status, setStatus] = useState(task?.status ?? "Not Started");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const weekStartValue = formatDateOnly(weekStart);
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    formatDateOnly(
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + index,
      ),
    ),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setValidationMessage("Title is required.");
      return;
    }

    setValidationMessage(null);
    onSave({
      weekStartDate: weekStartValue,
      title: title.trim(),
      dayDate: dayDate || null,
      notes: notes.trim() || null,
      status,
    });
  }

  return (
    <div className="task-editor-backdrop" role="presentation">
      <section
        className="task-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
      >
        <h2 id="task-editor-title">{task ? "Edit task" : "New task"}</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            aria-invalid={Boolean(validationMessage)}
            aria-describedby={
              validationMessage ? "task-editor-error" : undefined
            }
          />

          <label htmlFor="task-notes">Notes</label>
          <textarea
            id="task-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />

          <label htmlFor="task-placement">Placement</label>
          <select
            id="task-placement"
            value={dayDate}
            onChange={(event) => setDayDate(event.target.value)}
          >
            <option value="">Shared week</option>
            {weekDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>

          <label htmlFor="task-status">Status</label>
          <select
            id="task-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>Not Started</option>
            <option>In Progress</option>
            <option>Completed</option>
          </select>

          {validationMessage || errorMessage ? (
            <p id="task-editor-error" className="error" role="alert">
              {validationMessage ?? errorMessage}
            </p>
          ) : null}
          <div className="task-editor-actions">
            <button type="button" onClick={onCancel} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
