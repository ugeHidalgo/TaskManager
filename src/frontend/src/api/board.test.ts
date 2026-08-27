import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTask,
  formatDateOnly,
  getBoardForWeek,
  getTasksForWeek,
  updateTask,
} from "./board";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("board api", () => {
  it("formats dates as yyyy-mm-dd", () => {
    const date = new Date(2026, 7, 3);
    expect(formatDateOnly(date)).toBe("2026-08-03");
  });

  it("requests board using week_start_date query", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ data: { weekStartDate: "2026-08-03", lanes: [] } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await getBoardForWeek("jwt-token", new Date(2026, 7, 3));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("week_start_date=2026-08-03"),
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      },
    );
  });

  it("requests tasks using the selected week", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await getTasksForWeek("jwt-token", new Date(2026, 7, 3));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/tasks?weekStartDate=2026-08-03"),
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      },
    );
  });

  it("creates a task with the authenticated request contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "task-id" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await createTask("jwt-token", {
      weekStartDate: "2026-08-03",
      title: "Plan release",
      dayDate: null,
      notes: "Review checklist",
      status: "Not Started",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/tasks$/),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          weekStartDate: "2026-08-03",
          title: "Plan release",
          dayDate: null,
          notes: "Review checklist",
          status: "Not Started",
        }),
      }),
    );
  });

  it("updates a task and exposes API errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "task.validation", message: "Title is required." },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      updateTask("jwt-token", "task-id", {
        weekStartDate: "2026-08-03",
        title: "Updated title",
        dayDate: "2026-08-04",
        notes: null,
        status: "In Progress",
      }),
    ).rejects.toThrow("Title is required.");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/tasks\/task-id$/),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
