import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskPayload } from "../../../api/board";
import { TaskEditor } from "./TaskEditor";

const weekStart = new Date(2026, 7, 17);
const validationMessage =
  "Execution time must be empty or within the range 00:00 - 23:59.";

function makeTask(executionTime: string): TaskPayload {
  return {
    id: "task-id",
    weekWorkspaceId: "workspace-id",
    dayDate: null,
    title: "Plan sprint",
    notes: null,
    status: "Not Started",
    executionTime,
    createdAtUtc: "2026-08-17T10:00:00Z",
    updatedAtUtc: "2026-08-17T10:00:00Z",
  };
}

function renderEditor(
  task?: TaskPayload,
  initialDayDate: Date | null = weekStart,
) {
  const onCancel = vi.fn();
  const onSave = vi.fn();
  const { container } = render(
    <TaskEditor
      weekStart={weekStart}
      initialDayDate={initialDayDate}
      task={task}
      isSaving={false}
      errorMessage={null}
      onCancel={onCancel}
      onSave={onSave}
    />,
  );
  return { onCancel, onSave, container };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TaskEditor execution time", () => {
  it("hides execution time on a new shared-week task and submits an empty value", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(undefined, null);

    expect(
      screen.getByRole("dialog", { name: "New task" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Execution time" }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Shared task",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dayDate: null, executionTime: "" }),
    );
  });

  it("hides execution time when editing an existing shared-week task", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(makeTask("10:00"), null);

    expect(
      screen.getByRole("dialog", { name: "Edit task" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Execution time" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dayDate: null, executionTime: "" }),
    );
  });

  it("hides execution time while the task is in shared-week placement", async () => {
    const user = userEvent.setup();
    renderEditor(makeTask("10:00"), null);

    expect(
      screen.queryByRole("textbox", { name: "Execution time" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Placement"), "2026-08-17");

    expect(
      screen.getByRole("textbox", { name: "Execution time" }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Placement"), "");

    expect(
      screen.queryByRole("textbox", { name: "Execution time" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Optional, from 00:00 to 23:59."),
    ).not.toBeInTheDocument();
  });

  it("places Execution time between Title and Notes with vertically stacked arrows", () => {
    const { container } = renderEditor();
    const labels = Array.from(
      container.querySelectorAll<HTMLLabelElement>(".form-grid > label"),
    ).map((label) => label.textContent);
    const controls = container.querySelector(".execution-time-controls");

    expect(labels).toEqual([
      "Execution time",
      "Recurring task",
      "Notes",
      "Placement",
      "Status",
    ]);
    expect(container.querySelector(".task-title-row")).toBeInTheDocument();
    expect(
      container.querySelector(".task-recurring-toggle"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".task-title-row #task-recurring"),
    ).toBeNull();
    expect(controls?.children).toHaveLength(3);
    expect(controls?.children[0]).toHaveTextContent("▲");
    expect(controls?.children[0]).toHaveClass(
      "execution-time-step-button--increase",
    );
    expect(controls?.children[1]).toHaveAttribute("id", "task-execution-time");
    expect(controls?.children[2]).toHaveTextContent("▼");
    expect(controls?.children[2]).toHaveClass(
      "execution-time-step-button--decrease",
    );
    expect(
      container.querySelector(".task-title-row")?.querySelector("#task-title"),
    ).toBeTruthy();
  });

  it.each([
    ["workweek", "2026-08-21"],
    ["fullweek", "2026-08-23"],
  ] as const)(
    "uses the viewed week and %s end date for recurring tasks",
    async (viewMode, expectedEndDate) => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <TaskEditor
          weekStart={weekStart}
          viewMode={viewMode}
          initialDayDate={null}
          isSaving={false}
          errorMessage={null}
          onCancel={vi.fn()}
          onSave={onSave}
        />,
      );

      await user.click(
        screen.getByRole("checkbox", { name: "Recurring task" }),
      );

      expect(screen.getByLabelText("Start date")).toHaveValue("2026-08-17");
      expect(screen.getByLabelText("End date")).toHaveValue(expectedEndDate);
      expect(screen.getByText("Start date").parentElement).toHaveClass(
        "recurring-date-row",
      );
      expect(screen.getByText("End date").parentElement).toBe(
        screen.getByText("Start date").parentElement,
      );
      expect(screen.queryByLabelText("Placement")).not.toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "Execution time" }),
      ).toBeInTheDocument();
    },
  );

  it("restores editable placement when recurring task is unchecked", async () => {
    const user = userEvent.setup();
    renderEditor(undefined, null);
    const recurringCheckbox = screen.getByRole("checkbox", {
      name: "Recurring task",
    });

    await user.click(recurringCheckbox);
    expect(screen.queryByLabelText("Placement")).not.toBeInTheDocument();

    await user.click(recurringCheckbox);
    expect(screen.getByLabelText("Placement")).toBeEnabled();
    expect(screen.getByLabelText("Placement")).toHaveValue("");
  });

  it("validates an inverted recurring date range without saving", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(undefined, null);

    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Daily task",
    );
    await user.click(screen.getByRole("checkbox", { name: "Recurring task" }));
    expect(
      screen.getByRole("checkbox", { name: "Recurring task" }),
    ).toBeChecked();
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-08-23" },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Start date must be on or before end date.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("initializes with the existing time and supports 30-minute steps", async () => {
    const user = userEvent.setup();
    renderEditor(makeTask("10:00"));
    const executionTime = screen.getByRole("textbox", {
      name: "Execution time",
    });

    expect(executionTime).toHaveValue("10:00");
    await user.click(
      screen.getByRole("button", {
        name: "Increase execution time by 30 minutes",
      }),
    );
    expect(executionTime).toHaveValue("10:30");
    await user.click(
      screen.getByRole("button", {
        name: "Decrease execution time by 30 minutes",
      }),
    );
    expect(executionTime).toHaveValue("10:00");
  });

  it("keeps the increment and decrement controls within the accepted range", async () => {
    const user = userEvent.setup();
    renderEditor(makeTask("23:30"));
    const executionTime = screen.getByRole("textbox", {
      name: "Execution time",
    });
    const increase = screen.getByRole("button", {
      name: "Increase execution time by 30 minutes",
    });

    expect(increase).toBeDisabled();
    await user.click(increase);
    expect(executionTime).toHaveValue("23:30");

    await user.clear(executionTime);
    await user.type(executionTime, "00:00");
    const decrease = screen.getByRole("button", {
      name: "Decrease execution time by 30 minutes",
    });
    expect(decrease).toBeDisabled();
    await user.click(decrease);
    expect(executionTime).toHaveValue("00:00");
  });

  it("submits an empty value and permits clearing an existing time", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(makeTask("08:30"));
    const executionTime = screen.getByRole("textbox", {
      name: "Execution time",
    });

    await user.clear(executionTime);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ executionTime: "" }),
    );
  });

  it("submits manually entered times at the upper valid boundary", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Plan sprint",
    );
    const executionTime = screen.getByRole("textbox", {
      name: "Execution time",
    });
    expect(executionTime).toHaveValue("");
    await user.type(executionTime, "23:59");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ executionTime: "23:59" }),
    );
  });

  it("shows an accessible error and stays open on invalid save or close until cleared", async () => {
    const user = userEvent.setup();
    const { onCancel, onSave } = renderEditor();
    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Plan sprint",
    );
    const executionTime = screen.getByRole("textbox", {
      name: "Execution time",
    });
    await user.type(executionTime, "24:00");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent(validationMessage);
    expect(executionTime).toHaveAttribute("aria-invalid", "true");
    expect(executionTime).toHaveAttribute(
      "aria-describedby",
      "execution-time-error",
    );
    expect(
      screen.getByRole("dialog", { name: "New task" }),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("dialog", { name: "New task" }),
    ).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();

    await user.clear(executionTime);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("dialog", { name: "New task" }),
    ).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("rejects malformed manual time entry with the range guidance", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Plan sprint",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Execution time" }),
      "9:30",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(validationMessage);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the execution-time error visible after its 15-second blink", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Plan sprint",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Execution time" }),
      "25:00",
    );
    let finishBlink: (() => void) | undefined;
    const timeoutSpy = vi
      .spyOn(window, "setTimeout")
      .mockImplementation((callback, delay) => {
        if (delay === 15_000) {
          finishBlink = callback as () => void;
        }
        return 1;
      });
    const form = screen.getByRole("button", { name: "Save" }).closest("form");
    if (!form) {
      throw new Error("The task editor form was not found.");
    }
    fireEvent.submit(form);

    const error = screen.getByRole("alert");
    expect(error).toHaveClass("execution-time-error--blinking");
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
    act(() => finishBlink?.());

    expect(screen.getByRole("alert")).toHaveTextContent(validationMessage);
    expect(screen.getByRole("alert")).not.toHaveClass(
      "execution-time-error--blinking",
    );
  });

  it("uses keyboard dismissal when the value is valid", async () => {
    const user = userEvent.setup();
    const { onCancel, onSave } = renderEditor(makeTask("23:59"));

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
