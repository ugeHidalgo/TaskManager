import { useId, type ReactNode } from "react";
import { formatDateOnly } from "../../../api/board";
import type { DropZoneFeedback } from "./WeekLayout";

export interface DayColumnProps {
  /** The date for this day */
  date: Date;
  /** Day name (e.g., "Monday", "Tuesday") */
  dayName: string;
  /** Tasks or content to display in this column */
  children?: ReactNode;
  disabled?: boolean;
  onAddTask?: () => void;
  onLaneDragOver?: (
    event: React.DragEvent<HTMLElement>,
    dayDate: string,
  ) => void;
  onLaneDrop?: (event: React.DragEvent<HTMLElement>, dayDate: string) => void;
  dropFeedback?: DropZoneFeedback;
  onLaneDragLeave?: (event: React.DragEvent<HTMLElement>) => void;
  onMoveHere?: () => void;
}

/**
 * DayColumn component represents a single day in the week layout.
 * Displays the day name and date, with a container for tasks.
 */
export function DayColumn({
  date,
  dayName,
  children,
  disabled = false,
  onAddTask,
  onLaneDragOver,
  onLaneDrop,
  dropFeedback,
  onLaneDragLeave,
  onMoveHere,
}: DayColumnProps) {
  const feedbackId = `day-column-drop-feedback-${useId()}`;
  const formattedDate = formatDate(date);
  const isoDate = formatDateOnly(date);
  const dayKey = `${dayName.toLowerCase()}-${isoDate}`;
  const headingId = `day-column-title-${dayKey}`;
  const regionId = `day-column-region-${dayKey}`;

  return (
    <section
      className={`day-column${dropFeedback ? ` drop-zone-${dropFeedback.valid ? "valid" : "invalid"}` : ""}`}
      data-lane-key={isoDate}
      data-drop-state={
        dropFeedback ? (dropFeedback.valid ? "valid" : "invalid") : undefined
      }
      tabIndex={-1}
      aria-label={`${dayName} ${formattedDate}`}
      aria-describedby={dropFeedback ? feedbackId : undefined}
      onDragOver={(event) => onLaneDragOver?.(event, isoDate)}
      onDrop={(event) => onLaneDrop?.(event, isoDate)}
      onDragLeave={onLaneDragLeave}
    >
      <header className="day-column-header">
        <h3 id={headingId} className="day-column-title">
          {dayName}
          <span className="day-column-date">{formattedDate}</span>
        </h3>
        <button
          type="button"
          className="add-task-button"
          disabled={disabled}
          onClick={onAddTask}
          aria-label={`Add task to ${dayName}`}
          title="Add task"
        >
          +
        </button>
        {onMoveHere ? (
          <button
            type="button"
            className="move-here-button"
            data-move-here="true"
            onClick={onMoveHere}
            aria-label={`Move here to ${dayName}`}
          >
            Move here
          </button>
        ) : null}
      </header>

      <article
        id={regionId}
        className="day-column-content"
        role="region"
        aria-labelledby={headingId}
      >
        {children || (
          <div className="empty-state">
            <p className="empty-state-text">No tasks for {dayName}</p>
          </div>
        )}
        {dropFeedback ? (
          <p
            id={feedbackId}
            className={`lane-drop-indicator${dropFeedback.valid ? "" : " lane-drop-indicator-invalid"}`}
            role="status"
            aria-live="polite"
          >
            {dropFeedback.message}
          </p>
        ) : null}
      </article>
    </section>
  );
}

/**
 * Format date as "Jul 29"
 */
function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  return formatter.format(date);
}
