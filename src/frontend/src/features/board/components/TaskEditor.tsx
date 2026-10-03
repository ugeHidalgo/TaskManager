import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  formatDateOnly,
  type SaveTaskInput,
  type TaskPayload,
  type TaskStatus,
} from "../../../api/board";

interface TaskEditorProps {
  weekStart: Date;
  viewMode?: "workweek" | "fullweek";
  initialDayDate: Date | null;
  task?: TaskPayload;
  isSaving: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSave: (input: SaveTaskInput) => void;
}

const EXECUTION_TIME_ERROR =
  "Execution time must be empty or within the range 00:00 - 23:59.";
const MAX_EXECUTION_MINUTES = 23 * 60 + 59;

function parseExecutionTime(value: string): number | null {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidExecutionTime(value: string): boolean {
  return value === "" || parseExecutionTime(value) !== null;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return formatDateOnly(date) === value;
}

function canStepExecutionTime(value: string, minutes: number): boolean {
  if (value === "") {
    return minutes > 0;
  }

  const currentMinutes = parseExecutionTime(value);
  return (
    currentMinutes !== null &&
    currentMinutes + minutes >= 0 &&
    currentMinutes + minutes <= MAX_EXECUTION_MINUTES
  );
}

function stepExecutionTime(value: string, minutes: number): string {
  if (value === "") {
    return "00:00";
  }

  const nextMinutes = (parseExecutionTime(value) ?? 0) + minutes;
  const hours = Math.floor(nextMinutes / 60);
  const remainingMinutes = nextMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export function TaskEditor({
  weekStart,
  viewMode = "workweek",
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
  const [status, setStatus] = useState<TaskStatus>(
    task?.status ?? "Not Started",
  );
  const [executionTime, setExecutionTime] = useState(task?.executionTime ?? "");
  const recurringBatchId = useId();
  const [isRecurring, setIsRecurring] = useState(false);
  const [startDate, setStartDate] = useState(formatDateOnly(weekStart));
  const [endDate, setEndDate] = useState(() =>
    formatDateOnly(
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + (viewMode === "fullweek" ? 6 : 4),
      ),
    ),
  );
  const [dateValidationMessage, setDateValidationMessage] = useState<
    string | null
  >(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [executionTimeError, setExecutionTimeError] = useState<string | null>(
    null,
  );
  const [isExecutionTimeErrorBlinking, setIsExecutionTimeErrorBlinking] =
    useState(false);
  const executionTimeErrorTimeout = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (executionTimeErrorTimeout.current !== null) {
        window.clearTimeout(executionTimeErrorTimeout.current);
      }
    },
    [],
  );

  const weekStartValue = formatDateOnly(weekStart);
  function clearExecutionTimeError() {
    if (executionTimeErrorTimeout.current !== null) {
      window.clearTimeout(executionTimeErrorTimeout.current);
      executionTimeErrorTimeout.current = null;
    }
    setExecutionTimeError(null);
    setIsExecutionTimeErrorBlinking(false);
  }

  function showExecutionTimeError() {
    if (executionTimeErrorTimeout.current !== null) {
      window.clearTimeout(executionTimeErrorTimeout.current);
    }
    setExecutionTimeError(EXECUTION_TIME_ERROR);
    setIsExecutionTimeErrorBlinking(true);
    executionTimeErrorTimeout.current = window.setTimeout(() => {
      setIsExecutionTimeErrorBlinking(false);
      executionTimeErrorTimeout.current = null;
    }, 15_000);
  }

  function attemptClose() {
    if (isSaving) {
      return;
    }
    if (dayDate && !isValidExecutionTime(executionTime)) {
      showExecutionTimeError();
      return;
    }

    clearExecutionTimeError();
    onCancel();
  }

  function handleExecutionTimeChange(value: string) {
    setExecutionTime(value);
    if (isValidExecutionTime(value)) {
      clearExecutionTimeError();
    }
  }

  function handleExecutionTimeStep(minutes: number) {
    if (!canStepExecutionTime(executionTime, minutes)) {
      return;
    }
    handleExecutionTimeChange(stepExecutionTime(executionTime, minutes));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isSharedWeekPlacement = !dayDate;
    const normalizedExecutionTime =
      isSharedWeekPlacement && !isRecurring ? "" : executionTime;

    if (
      (!isSharedWeekPlacement || isRecurring) &&
      !isValidExecutionTime(executionTime)
    ) {
      showExecutionTimeError();
      return;
    }
    clearExecutionTimeError();
    if (!title.trim()) {
      setValidationMessage("Title is required.");
      return;
    }

    if (isRecurring) {
      if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
        setDateValidationMessage("Enter a valid start and end date.");
        return;
      }
      if (startDate > endDate) {
        setDateValidationMessage("Start date must be on or before end date.");
        return;
      }
    }

    setValidationMessage(null);
    setDateValidationMessage(null);
    onSave({
      weekStartDate: weekStartValue,
      title: title.trim(),
      dayDate: isRecurring ? null : dayDate || null,
      notes: notes.trim() || null,
      status,
      executionTime: normalizedExecutionTime,
      ...(isRecurring
        ? {
            isRecurring: true,
            startDate,
            endDate,
            idempotencyKey: recurringBatchId,
          }
        : {}),
    });
  }

  const isSharedWeekPlacement = !dayDate && !isRecurring;

  return (
    <div className="task-editor-backdrop" role="presentation">
      <section
        className="task-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            attemptClose();
          }
        }}
      >
        <h2 id="task-editor-title">{task ? "Edit task" : "New task"}</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="task-title-row">
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
          </div>

          {!isSharedWeekPlacement ? (
            <>
              <label htmlFor="task-execution-time">Execution time</label>
              <div
                className="execution-time-controls"
                role="group"
                aria-label="Execution time controls"
              >
                <button
                  type="button"
                  className="execution-time-step-button execution-time-step-button--increase"
                  aria-label="Increase execution time by 30 minutes"
                  aria-controls="task-execution-time"
                  disabled={
                    isSaving || !canStepExecutionTime(executionTime, 30)
                  }
                  onClick={() => handleExecutionTimeStep(30)}
                >
                  ▲
                </button>
                <input
                  id="task-execution-time"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={executionTime}
                  onChange={(event) =>
                    handleExecutionTimeChange(event.target.value)
                  }
                  aria-invalid={executionTimeError ? true : undefined}
                  aria-describedby={
                    executionTimeError
                      ? "execution-time-error"
                      : "execution-time-hint"
                  }
                  aria-errormessage={
                    executionTimeError ? "execution-time-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="execution-time-step-button execution-time-step-button--decrease"
                  aria-label="Decrease execution time by 30 minutes"
                  aria-controls="task-execution-time"
                  disabled={
                    isSaving || !canStepExecutionTime(executionTime, -30)
                  }
                  onClick={() => handleExecutionTimeStep(-30)}
                >
                  ▼
                </button>
              </div>
              <p id="execution-time-hint" className="execution-time-hint">
                Optional, from 00:00 to 23:59.
              </p>
              {executionTimeError ? (
                <p
                  id="execution-time-error"
                  className={`error execution-time-error${
                    isExecutionTimeErrorBlinking
                      ? " execution-time-error--blinking"
                      : ""
                  }`}
                  role="alert"
                  aria-live="assertive"
                >
                  {executionTimeError}
                </p>
              ) : null}
            </>
          ) : null}

          <label className="task-recurring-toggle" htmlFor="task-recurring">
            <input
              id="task-recurring"
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => {
                setIsRecurring(event.target.checked);
                setDateValidationMessage(null);
              }}
            />
            Recurring task
          </label>

          {isRecurring ? (
            <div className="recurring-date-row">
              <label htmlFor="task-start-date">Start date</label>
              <input
                id="task-start-date"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setDateValidationMessage(null);
                }}
                aria-invalid={Boolean(dateValidationMessage)}
                aria-describedby={
                  dateValidationMessage ? "task-date-error" : undefined
                }
              />
              <label htmlFor="task-end-date">End date</label>
              <input
                id="task-end-date"
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setDateValidationMessage(null);
                }}
                aria-invalid={Boolean(dateValidationMessage)}
                aria-describedby={
                  dateValidationMessage ? "task-date-error" : undefined
                }
              />
              {dateValidationMessage ? (
                <p id="task-date-error" className="error" role="alert">
                  {dateValidationMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          <label htmlFor="task-notes">Notes</label>
          <textarea
            id="task-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />

          {!isRecurring ? (
            <>
              <label htmlFor="task-placement">Placement</label>
              <select
                id="task-placement"
                value={dayDate}
                onChange={(event) => setDayDate(event.target.value)}
              >
                <option value="">Shared week</option>
                {Array.from({ length: 7 }, (_, index) =>
                  formatDateOnly(
                    new Date(
                      weekStart.getFullYear(),
                      weekStart.getMonth(),
                      weekStart.getDate() + index,
                    ),
                  ),
                ).map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label htmlFor="task-status">Status</label>
          <select
            id="task-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
          >
            <option>Not Started</option>
            <option>In Progress</option>
            <option>Completed</option>
            <option>Not done</option>
          </select>

          {validationMessage || errorMessage ? (
            <p id="task-editor-error" className="error" role="alert">
              {validationMessage ?? errorMessage}
            </p>
          ) : null}
          <div className="task-editor-actions">
            <button type="button" onClick={attemptClose} disabled={isSaving}>
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
