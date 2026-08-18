import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMonthDay,
  formatWeekDisplay,
  getDayName,
  getWeekRange,
  shiftDateByDays,
  useWeekCalculation,
} from "./useWeekCalculation";

const midWeekInput = new Date(2026, 6, 29, 15, 30);
const sundayInput = new Date(2026, 7, 2, 11, 0);
const yearBoundaryInput = new Date(2027, 0, 1, 12, 0);
const weekStart = new Date(2026, 6, 27);
const weekEnd = new Date(2026, 7, 2);

describe("useWeekCalculation helpers", () => {
  it("calculates Monday-Sunday range for a mid-week date", () => {
    const { weekStart, weekEnd } = getWeekRange(midWeekInput);

    expect(weekStart.getDay()).toBe(1);
    expect(weekEnd.getDay()).toBe(0);
    expect(weekStart.getHours()).toBe(0);
    expect(weekStart.getMinutes()).toBe(0);
    expect(weekEnd.getHours()).toBe(23);
    expect(weekEnd.getMinutes()).toBe(59);
    expect(weekStart.getDate()).toBe(27);
    expect(weekEnd.getDate()).toBe(2);
  });

  it("uses previous Monday when input date is Sunday", () => {
    const { weekStart, weekEnd } = getWeekRange(sundayInput);

    expect(weekStart.getDate()).toBe(27);
    expect(weekStart.getMonth()).toBe(6);
    expect(weekEnd.getDate()).toBe(2);
    expect(weekEnd.getMonth()).toBe(7);
  });

  it("handles year boundaries correctly", () => {
    const { weekStart, weekEnd } = getWeekRange(yearBoundaryInput);

    expect(weekStart.getFullYear()).toBe(2026);
    expect(weekStart.getMonth()).toBe(11);
    expect(weekStart.getDate()).toBe(28);

    expect(weekEnd.getFullYear()).toBe(2027);
    expect(weekEnd.getMonth()).toBe(0);
    expect(weekEnd.getDate()).toBe(3);
  });

  it("matches hook result with helper output", () => {
    const fromHook = useWeekCalculation(midWeekInput);
    const fromHelper = getWeekRange(midWeekInput);

    expect(fromHook.weekStart.getTime()).toBe(fromHelper.weekStart.getTime());
    expect(fromHook.weekEnd.getTime()).toBe(fromHelper.weekEnd.getTime());
  });

  it("formats week and date labels", () => {
    expect(formatWeekDisplay(weekStart, weekEnd)).toBe("Jul 27 - Aug 2");
    expect(getDayName(weekStart)).toBe("Monday");
    expect(formatDate(weekStart)).toBe("Jul 27");
    expect(formatMonthDay(weekStart)).toBe("July 27");
  });

  it("shifts dates deterministically by 7 days", () => {
    const nextWeek = shiftDateByDays(weekStart, 7);
    const previousWeek = shiftDateByDays(weekStart, -7);

    expect(nextWeek.getDate()).toBe(3);
    expect(nextWeek.getMonth()).toBe(7);
    expect(previousWeek.getDate()).toBe(20);
    expect(previousWeek.getMonth()).toBe(6);
  });
});
