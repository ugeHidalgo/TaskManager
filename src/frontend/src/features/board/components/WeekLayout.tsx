import type { ReactNode } from "react";
import { DayColumn } from "./DayColumn";
import { WeekSection } from "./WeekSection";

export interface WeekLayoutProps {
  /** Monday of the current week */
  weekStart: Date;
  /** Sunday of the current week */
  weekEnd: Date;
  /** Tasks for the week section */
  weekContent?: ReactNode;
  /** Tasks per day, indexed by day number (0=Monday, 6=Sunday) */
  dayContent?: ReactNode[];
  /** Number of day columns to display */
  viewMode?: BoardViewMode;
}

export type BoardViewMode = "workweek" | "fullweek";

/**
 * WeekLayout component displays a full week board with:
 * - A shared week section at the top (full width)
 * - Seven daily columns below (Mon-Sun)
 *
 * The layout uses CSS Grid:
 * - Week section spans all columns
 * - Each day column is equal width
 */
export function WeekLayout({
  weekStart,
  weekEnd,
  weekContent,
  dayContent,
  viewMode = "workweek",
}: WeekLayoutProps) {
  const dayDates = getDayDatesInWeek(weekStart);
  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const visibleDayCount = viewMode === "fullweek" ? 7 : 5;

  return (
    <div className={`week-layout ${viewMode}`}>
      {/* Week section - full width */}
      <WeekSection weekStart={weekStart} weekEnd={weekEnd}>
        {weekContent}
      </WeekSection>

      {/* Daily columns - 7 equal columns */}
      <div className="daily-columns">
        {dayDates.slice(0, visibleDayCount).map((date, index) => (
          <DayColumn key={`day-${index}`} date={date} dayName={dayNames[index]}>
            {dayContent?.[index]}
          </DayColumn>
        ))}
      </div>
    </div>
  );
}

/**
 * Get all 7 dates in a week starting from Monday
 * @param weekStart Monday of the week
 * @returns Array of 7 Date objects (Mon-Sun)
 */
function getDayDatesInWeek(weekStart: Date): Date[] {
  const dates: Date[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }

  return dates;
}
