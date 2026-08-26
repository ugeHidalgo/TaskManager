import type { ReactNode } from "react";

export interface DayColumnProps {
  /** The date for this day */
  date: Date;
  /** Day name (e.g., "Monday", "Tuesday") */
  dayName: string;
  /** Tasks or content to display in this column */
  children?: ReactNode;
  onAddTask?: () => void;
}

/**
 * DayColumn component represents a single day in the week layout.
 * Displays the day name and date, with a container for tasks.
 */
export function DayColumn({
  date,
  dayName,
  children,
  onAddTask,
}: DayColumnProps) {
  const formattedDate = formatDate(date);
  const dayKey = `${dayName.toLowerCase()}-${date.toISOString().slice(0, 10)}`;
  const headingId = `day-column-title-${dayKey}`;
  const regionId = `day-column-region-${dayKey}`;

  return (
    <section className="day-column" aria-label={`${dayName} ${formattedDate}`}>
      <header className="day-column-header">
        <h3 id={headingId} className="day-column-title">
          {dayName}
          <span className="day-column-date">{formattedDate}</span>
        </h3>
        <button
          type="button"
          className="add-task-button"
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
