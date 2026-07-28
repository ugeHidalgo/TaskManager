import type { ReactNode } from "react";

export interface WeekSectionProps {
  /** Week start date (Monday) */
  weekStart: Date;
  /** Week end date (Sunday) */
  weekEnd: Date;
  /** Tasks or content to display in the week section */
  children?: ReactNode;
}

/**
 * WeekSection component represents the shared week tasks container.
 * This section spans the full width above daily columns.
 */
export function WeekSection({
  weekStart,
  weekEnd,
  children,
}: WeekSectionProps) {
  const weekDisplay = formatWeekRange(weekStart, weekEnd);

  return (
    <section
      className="week-section"
      aria-label={`Week tasks - ${weekDisplay}`}
    >
      <header className="week-section-header">
        <h2 className="week-section-title">Week Tasks</h2>
        <span className="week-section-date">{weekDisplay}</span>
      </header>

      <article className="week-section-content" role="region">
        {children || (
          <div className="empty-state">
            <p className="empty-state-text">No week tasks</p>
          </div>
        )}
      </article>
    </section>
  );
}

/**
 * Format week range as "Jul 29 - Aug 4"
 */
function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const startFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${startFormatter.format(weekStart)} - ${endFormatter.format(weekEnd)}`;
}
