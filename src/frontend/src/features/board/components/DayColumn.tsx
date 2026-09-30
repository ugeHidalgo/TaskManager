import type { ReactNode } from "react";
import { formatDateOnly } from "../../../api/board";

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
}: DayColumnProps) {
  const formattedDate = formatDate(date);
  const isoDate = formatDateOnly(date);
  const dayKey = `${dayName.toLowerCase()}-${isoDate}`;
  const headingId = `day-column-title-${dayKey}`;
  const regionId = `day-column-region-${dayKey}`;

  return (
    <section
      className="day-column"
      aria-label={`${dayName} ${formattedDate}`}
      onDragOver={(event) => onLaneDragOver?.(event, isoDate)}
      onDrop={(event) => onLaneDrop?.(event, isoDate)}
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
      </header>

      <article
        id={regionId}
        className="day-column-content"
        role="region"
        aria-labelledby={headingId}
        onDragOver={(event) => onLaneDragOver?.(event, isoDate)}
        onDrop={(event) => onLaneDrop?.(event, isoDate)}
      >
        {children || (
          <div className="empty-state">
            <p className="empty-state-text">No tasks for {dayName}</p>
          </div>
        )}
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
