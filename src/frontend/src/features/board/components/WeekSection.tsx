import { useId, type ReactNode } from "react";
import type { DropZoneFeedback } from "./WeekLayout";

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
  dropFeedback?: DropZoneFeedback;
  onLaneDragLeave?: (event: React.DragEvent<HTMLElement>) => void;
  onMoveHere?: () => void;
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
  dropFeedback,
  onLaneDragLeave,
  onMoveHere,
}: WeekSectionProps) {
  const feedbackId = `week-section-drop-feedback-${useId()}`;
  const headingId = "week-section-title";

  return (
    <section
      className={`week-section${dropFeedback ? ` drop-zone-${dropFeedback.valid ? "valid" : "invalid"}` : ""}`}
      data-lane-key="shared"
      data-drop-state={
        dropFeedback ? (dropFeedback.valid ? "valid" : "invalid") : undefined
      }
      tabIndex={-1}
      aria-label="Week tasks"
      aria-describedby={dropFeedback ? feedbackId : undefined}
      onDragOver={onLaneDragOver}
      onDrop={onLaneDrop}
      onDragLeave={onLaneDragLeave}
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
        {onMoveHere ? (
          <button
            type="button"
            className="move-here-button"
            data-move-here="true"
            onClick={onMoveHere}
            aria-label="Move here to shared week"
          >
            Move here
          </button>
        ) : null}
      </header>

      <article
        className="week-section-content"
        role="region"
        aria-labelledby={headingId}
      >
        {children || (
          <div className="empty-state">
            <p className="empty-state-text">No week tasks</p>
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
