import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateOnly, getBoardForWeek, getTasksForWeek } from "./board";

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
});
