import { useId } from "react";

interface WeekNavigationProps {
  onPreviousWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
}

export function WeekNavigation({
  onPreviousWeek,
  onCurrentWeek,
  onNextWeek,
}: WeekNavigationProps) {
  const hintId = useId();
  return (
    <div className="week-nav" role="group" aria-label="Week navigation">
      <button
        type="button"
        onClick={onPreviousWeek}
        aria-label="Go to previous week"
        aria-describedby={`${hintId}-previous`}
        className="week-nav-button"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span
          id={`${hintId}-previous`}
          className="week-nav-hint"
          role="tooltip"
        >
          Previous week
        </span>
      </button>
      <button
        type="button"
        onClick={onCurrentWeek}
        aria-label="Go to current week"
        aria-describedby={`${hintId}-current`}
        className="week-nav-button"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18M8 15h8" />
          <path d="M8 18h5" />
        </svg>
        <span id={`${hintId}-current`} className="week-nav-hint" role="tooltip">
          Return to current week
        </span>
      </button>
      <button
        type="button"
        onClick={onNextWeek}
        aria-label="Go to next week"
        aria-describedby={`${hintId}-next`}
        className="week-nav-button"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m9 6 6 6-6 6" />
        </svg>
        <span id={`${hintId}-next`} className="week-nav-hint" role="tooltip">
          Next week
        </span>
      </button>
    </div>
  );
}
