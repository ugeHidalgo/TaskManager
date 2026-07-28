import type { ReactNode } from "react";

export interface DayColumnProps {
  /** The date for this day */
  date: Date;
  /** Day name (e.g., "Monday", "Tuesday") */
  dayName: string;
  /** Tasks or content to display in this column */
  children?: ReactNode;
}

/**
 * DayColumn component represents a single day in the week layout.
 * Displays the day name and date, with a container for tasks.
 */
export function DayColumn({ date, dayName, children }: DayColumnProps) {
  const formattedDate = formatDate(date);

  return (
    <section className="day-column" aria-label={`${dayName} ${formattedDate}`}>
      <header className="day-column-header">
        <h3 className="day-column-title">
          {dayName}
          <span className="day-column-date">{formattedDate}</span>
        </h3>
      </header>

      <article className="day-column-content" role="region">
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
