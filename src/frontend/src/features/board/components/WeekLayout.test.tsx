import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayColumn } from "./DayColumn";
import { WeekLayout } from "./WeekLayout";
import { WeekSection } from "./WeekSection";

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
    expect(screen.queryByText("Jul 27 - Aug 2")).toBeNull();
  });

  it("renders five workweek day columns by default", () => {
    render(<WeekLayout weekStart={weekStart} weekEnd={weekEnd} />);

    for (const dayName of dayNames.slice(0, 5)) {
      expect(
        screen.getByRole("heading", {
          name: new RegExp(dayName, "i"),
          level: 3,
        }),
      ).toBeInTheDocument();
    }

    expect(screen.getAllByText(/^No tasks for /i)).toHaveLength(5);
    expect(screen.queryByRole("heading", { name: /Saturday/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Sunday/i })).toBeNull();
  });

  it("renders all seven day columns in full-week mode", () => {
    render(
      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        viewMode="fullweek"
      />,
    );

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

  it.each(["2026-07-27", "shared"])(
    "shows feedback only for the active lane %s, including empty lanes",
    (laneKey) => {
      const message = "Drop here at the end of this lane";
      const { container, rerender } = render(
        <WeekLayout
          weekStart={weekStart}
          weekEnd={weekEnd}
          laneDropFeedback={{ laneKey, valid: true, message }}
        />,
      );
      const lane = container.querySelector(`[data-lane-key="${laneKey}"]`)!;
      const status = within(lane as HTMLElement).getByRole("status");
      expect(container.querySelectorAll("[data-drop-state]")).toHaveLength(1);
      expect(lane).toHaveAttribute("data-drop-state", "valid");
      expect(lane).toHaveClass("drop-zone-valid");
      expect(lane).toHaveAttribute("tabindex", "-1");
      expect(lane).toHaveAttribute("aria-describedby", status.id);
      expect(status).toBeVisible();
      expect(status).toHaveTextContent(message);
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).not.toHaveClass("lane-drop-indicator-invalid");
      const feedbackId = status.id;

      rerender(
        <WeekLayout
          weekStart={weekStart}
          weekEnd={weekEnd}
          laneDropFeedback={{ laneKey, valid: false, message: "Move rejected" }}
        />,
      );
      expect(lane).toHaveAttribute("data-drop-state", "invalid");
      expect(lane).toHaveClass("drop-zone-invalid");
      expect(lane).not.toHaveClass("drop-zone-valid");
      expect(screen.getByRole("status")).toHaveAttribute("id", feedbackId);
      expect(screen.getByRole("status")).toHaveClass(
        "lane-drop-indicator-invalid",
      );
      expect(screen.getByRole("status")).toHaveTextContent("Move rejected");

      rerender(<WeekLayout weekStart={weekStart} weekEnd={weekEnd} />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(lane).not.toHaveAttribute("aria-describedby");
      expect(lane).not.toHaveAttribute("data-drop-state");
      expect(lane).not.toHaveClass("drop-zone-invalid");
      (lane as HTMLElement).focus();
      expect(lane).toHaveFocus();
    },
  );

  it("moves feedback between lanes and ignores a hidden lane", () => {
    const { container, rerender } = render(
      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        laneDropFeedback={{
          laneKey: "2026-07-27",
          valid: true,
          message: "Monday end",
        }}
      />,
    );
    rerender(
      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        laneDropFeedback={{
          laneKey: "shared",
          valid: true,
          message: "Shared end",
        }}
      />,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Shared end");
    expect(
      container.querySelector('[data-lane-key="2026-07-27"]'),
    ).not.toHaveAttribute("data-drop-state");

    rerender(
      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        laneDropFeedback={{
          laneKey: "2026-08-01",
          valid: true,
          message: "Saturday end",
        }}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("forwards article drag events once per lane from its section wrapper", () => {
    const onDayLaneDragOver = vi.fn();
    const onDayLaneDrop = vi.fn();
    const onWeekLaneDragOver = vi.fn();
    const onWeekLaneDrop = vi.fn();
    const onLaneDragLeave = vi.fn();
    render(
      <WeekLayout
        weekStart={weekStart}
        weekEnd={weekEnd}
        onDayLaneDragOver={onDayLaneDragOver}
        onDayLaneDrop={onDayLaneDrop}
        onWeekLaneDragOver={onWeekLaneDragOver}
        onWeekLaneDrop={onWeekLaneDrop}
        onLaneDragLeave={onLaneDragLeave}
      />,
    );
    const dayArticle = screen
      .getAllByRole("region", { name: /Monday/ })
      .find((element) => element.tagName === "ARTICLE")!;
    const weekArticle = screen.getByRole("region", { name: "Week Tasks" });
    fireEvent.dragOver(dayArticle);
    fireEvent.drop(dayArticle);
    fireEvent.dragLeave(dayArticle);
    expect(onDayLaneDragOver).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      "2026-07-27",
    );
    expect(onDayLaneDrop).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      "2026-07-27",
    );
    expect(onLaneDragLeave).toHaveBeenCalledTimes(1);

    fireEvent.dragOver(weekArticle);
    fireEvent.drop(weekArticle);
    fireEvent.dragLeave(weekArticle);
    expect(onWeekLaneDragOver).toHaveBeenCalledTimes(1);
    expect(onWeekLaneDrop).toHaveBeenCalledTimes(1);
    expect(onLaneDragLeave).toHaveBeenCalledTimes(2);
  });

  it("keeps feedback ids unique across repeated component instances", () => {
    const feedback = { valid: true, message: "Drop here at the end" };
    render(
      <>
        <DayColumn date={weekStart} dayName="Monday" dropFeedback={feedback} />
        <DayColumn date={weekStart} dayName="Monday" dropFeedback={feedback} />
        <WeekSection
          weekStart={weekStart}
          weekEnd={weekEnd}
          dropFeedback={feedback}
        />
        <WeekSection
          weekStart={weekStart}
          weekEnd={weekEnd}
          dropFeedback={feedback}
        />
      </>,
    );
    const statuses = screen.getAllByRole("status");
    expect(new Set(statuses.map((status) => status.id)).size).toBe(4);
    for (const status of statuses) {
      expect(status.closest("section")).toHaveAttribute(
        "aria-describedby",
        status.id,
      );
    }
  });

  it.each([true, false])(
    "appends feedback after existing day and shared content (valid=%s)",
    (valid) => {
      const feedback = {
        valid,
        message: valid ? "Drop here at the end" : "Task cannot move here",
      };
      render(
        <>
          <DayColumn date={weekStart} dayName="Monday" dropFeedback={feedback}>
            <div>Completed day task</div>
          </DayColumn>
          <WeekSection
            weekStart={weekStart}
            weekEnd={weekEnd}
            dropFeedback={feedback}
          >
            <div>Not done shared task</div>
          </WeekSection>
        </>,
      );
      expect(screen.getByText("Completed day task")).toBeVisible();
      expect(screen.getByText("Not done shared task")).toBeVisible();
      for (const status of screen.getAllByRole("status")) {
        expect(status).toBeVisible();
        expect(status.parentElement?.lastElementChild).toBe(status);
      }
    },
  );
});
