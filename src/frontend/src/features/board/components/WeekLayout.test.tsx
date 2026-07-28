import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeekLayout } from "./WeekLayout";

const weekStart = new Date(2026, 6, 27);
const weekEnd = new Date(2026, 7, 2);
const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

describe("WeekLayout", () => {
  it("renders week section", () => {
    render(<WeekLayout weekStart={weekStart} weekEnd={weekEnd} />);

    expect(
      screen.getByRole("heading", { name: "Week Tasks", level: 2 }),
    ).toBeInTheDocument();

    expect(screen.getByText("No week tasks")).toBeInTheDocument();
  });

  it("renders seven day columns", () => {
    render(<WeekLayout weekStart={weekStart} weekEnd={weekEnd} />);

    for (const dayName of dayNames) {
      expect(
        screen.getByRole("heading", {
          name: new RegExp(dayName, "i"),
          level: 3,
        }),
      ).toBeInTheDocument();
    }

    expect(screen.getAllByText(/^No tasks for /i)).toHaveLength(7);
  });

  it("renders provided week and day content", () => {
    render(
      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekContent={<div>Week planning content</div>}
        dayContent={[
          <div key="mon">Monday task</div>,
          undefined,
          undefined,
          <div key="thu">Thursday task</div>,
        ]}
      />,
    );

    expect(screen.getByText("Week planning content")).toBeInTheDocument();
    expect(screen.getByText("Monday task")).toBeInTheDocument();
    expect(screen.getByText("Thursday task")).toBeInTheDocument();
  });
});
