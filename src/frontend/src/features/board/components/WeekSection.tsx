import type { ReactNode } from "react";

export interface WeekSectionProps {
  /** Week start date (Monday) */
  weekStart: Date;
  /** Week end date (Sunday) */
  weekEnd: Date;
  /** Tasks or content to display in the week section */
  children?: ReactNode;
  disabled?: boolean;
  onAddTask?: () => void;
  onLaneDragOver?: (event: React.DragEvent<HTMLElement>) => void;
  onLaneDrop?: (event: React.DragEvent<HTMLElement>) => void;
}

/**
 * WeekSection component represents the shared week tasks container.
 * This section spans the full width above daily columns.
 */
export function WeekSection({
  children,
  disabled = false,
  onAddTask,
  onLaneDragOver,
  onLaneDrop,
}: WeekSectionProps) {
  const headingId = "week-section-title";

  return (
    <section
      className="week-section"
      aria-label="Week tasks"
      onDragOver={onLaneDragOver}
      onDrop={onLaneDrop}
    >
      <header className="week-section-header">
        <h2 id={headingId} className="week-section-title">
          Week Tasks
        </h2>
        <button
          type="button"
          className="add-task-button"
          disabled={disabled}
          onClick={onAddTask}
          aria-label="Add task to shared week"
          title="Add task"
        >
          +
        </button>
      </header>

      <article
        className="week-section-content"
        role="region"
        aria-labelledby={headingId}
        onDragOver={onLaneDragOver}
        onDrop={onLaneDrop}
      >
        {children || (
          <div className="empty-state">
            <p className="empty-state-text">No week tasks</p>
          </div>
        )}
      </article>
    </section>
  );
}
