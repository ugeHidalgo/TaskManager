import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateOnly } from "../api/board";
import {
  getWeekRange,
  shiftDateByDays,
} from "../features/board/hooks/useWeekCalculation";
import { BoardPage } from "./BoardPage";

const navigateMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isInitializing: false,
    username: "admin",
    login: vi.fn(),
    logout: logoutMock,
  }),
}));

vi.mock("../lib/session", () => ({
  getToken: () => "jwt-token",
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

function buildBoardResponseFromUrl(
  input: string,
  tasks: unknown[] = [],
): Response {
  const url = new URL(input);
  const weekStartDate = url.searchParams.get("week_start_date") ?? "";

  if (url.pathname.endsWith("/tasks")) {
    return new Response(JSON.stringify({ data: tasks }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      data: {
        weekStartDate,
        lanes: [],
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("BoardPage week navigation", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("switches between workweek and full-week columns and persists the mode", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      buildBoardResponseFromUrl(String(input)),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/^No tasks for /i)).toHaveLength(5);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "View" }),
      "fullweek",
    );

    expect(screen.getAllByText(/^No tasks for /i)).toHaveLength(7);
    expect(window.localStorage.getItem("taskmanager.boardViewMode")).toBe(
      "fullweek",
    );
  });

  it("restores the persisted board view mode", () => {
    window.localStorage.setItem("taskmanager.boardViewMode", "fullweek");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      buildBoardResponseFromUrl(String(input)),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("combobox", { name: "View" })).toHaveValue(
      "fullweek",
    );
    expect(screen.getAllByText(/^No tasks for /i)).toHaveLength(7);
  });

  it("updates week range and requests the selected week_start_date", async () => {
    const user = userEvent.setup();
    const initialWeekStart = getWeekRange(new Date()).weekStart;
    const nextWeekStart = shiftDateByDays(initialWeekStart, 7);
    const initialWeekStartParam = formatDateOnly(initialWeekStart);
    const nextWeekStartParam = formatDateOnly(nextWeekStart);

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        return buildBoardResponseFromUrl(String(input));
      });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const title = screen.getByRole("heading", { level: 1 });
    const initialTitle = title.textContent;

    expect(initialTitle).toMatch(/\w{3} \d+ - \w{3} \d+/);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`week_start_date=${initialWeekStartParam}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer jwt-token",
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Go to next week" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).not.toBe(
        initialTitle,
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`week_start_date=${nextWeekStartParam}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer jwt-token",
          }),
        }),
      );
    });

    await user.click(
      screen.getByRole("button", { name: "Go to previous week" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        initialTitle,
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`week_start_date=${initialWeekStartParam}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer jwt-token",
          }),
        }),
      );
    });
  });

  it("renders shared and daily tasks in their matching sections", async () => {
    const initialWeekStart = getWeekRange(new Date()).weekStart;
    const dailyTaskDate = formatDateOnly(initialWeekStart);
    const tasks = [
      {
        id: "shared-task",
        weekWorkspaceId: "workspace-id",
        dayDate: null,
        title: "Plan shared work",
        notes: null,
        status: "Not Started",
        createdAtUtc: "2026-08-26T10:00:00Z",
        updatedAtUtc: "2026-08-26T10:00:00Z",
      },
      {
        id: "daily-task",
        weekWorkspaceId: "workspace-id",
        dayDate: dailyTaskDate,
        title: "Plan Monday work",
        notes: "Review priorities",
        status: "Not Started",
        createdAtUtc: "2026-08-26T10:00:00Z",
        updatedAtUtc: "2026-08-26T10:00:00Z",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      buildBoardResponseFromUrl(String(input), tasks),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Plan shared work")).toBeInTheDocument();
    expect(await screen.findByText("Plan Monday work")).toBeInTheDocument();
    expect(screen.getByText("Review priorities")).toBeInTheDocument();
  });
});
