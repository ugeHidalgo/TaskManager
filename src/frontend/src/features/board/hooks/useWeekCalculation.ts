export interface WeekRange {
  weekStart: Date;
  weekEnd: Date;
}

/**
 * Hook for calculating and formatting week ranges.
 * Used to get the current week's Monday-Sunday dates.
 */
export function useWeekCalculation(date: Date = new Date()): WeekRange {
  return getWeekRange(date);
}

/**
 * Get the Monday and Sunday of the week containing the given date.
 * @param date Any date in the week
 * @returns Object with weekStart (Monday) and weekEnd (Sunday)
 */
export function getWeekRange(date: Date): WeekRange {
  const d = new Date(date);
  const day = d.getDay();

  // Calculate days to Monday (Monday = 1, Sunday = 0)
  // If Sunday (0), we need to go back 6 days to get Monday of this week
  // Otherwise, go back (day - 1) days
  const daysToMonday = day === 0 ? 6 : day - 1;

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/**
 * Format week range as "Jul 29 - Aug 4"
 * @param weekStart Monday of the week
 * @param weekEnd Sunday of the week
 * @returns Formatted string
 */
export function formatWeekDisplay(weekStart: Date, weekEnd: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
}

/**
 * Get day name (Monday, Tuesday, etc.)
 * @param date The date
 * @returns Day name
 */
export function getDayName(date: Date): string {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return dayNames[date.getDay()];
}

/**
 * Format date as "Jul 29"
 * @param date The date
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  return formatter.format(date);
}

/**
 * Format date as "July 29"
 * @param date The date
 * @returns Formatted date string with full month name
 */
export function formatMonthDay(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  });
  return formatter.format(date);
}

/**
 * Shift a date by a fixed number of days.
 * Useful for deterministic week navigation (+/-7 days).
 * @param date Base date
 * @param days Number of days to shift (negative for previous)
 * @returns Shifted date
 */
export function shiftDateByDays(date: Date, days: number): Date {
  const shiftedDate = new Date(date);
  shiftedDate.setDate(shiftedDate.getDate() + days);
  return shiftedDate;
}
