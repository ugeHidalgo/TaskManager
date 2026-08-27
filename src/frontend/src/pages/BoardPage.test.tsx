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

function buildBoardResponseFromUrl(input: string, tasks: unknown[] = []) {
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
    const dailyTaskTitle = await screen.findByText("Plan Monday work");
    expect(dailyTaskTitle.closest(".task-item")).toHaveTextContent(
      "Review priorities",
    );
  });

  it("opens the editor, validates the title, and cancels without saving", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        buildBoardResponseFromUrl(String(input)),
      );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Add task to shared week" }),
    );
    expect(
      screen.getByRole("dialog", { name: "New task" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Title is required.");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates a task from a day context and refreshes the board", async () => {
    const user = userEvent.setup();
    const weekStart = getWeekRange(new Date()).weekStart;
    const dayDate = formatDateOnly(weekStart);
    const createdTask = {
      id: "created-task",
      weekWorkspaceId: "workspace-id",
      dayDate,
      title: "Write report",
      notes: "Use the latest data",
      status: "Not Started",
      createdAtUtc: "2026-08-26T10:00:00Z",
      updatedAtUtc: "2026-08-26T10:00:00Z",
    };
    let storedTasks: unknown[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/tasks")) {
        if (init?.method === "POST") {
          storedTasks = [createdTask];
          return new Response(JSON.stringify({ data: createdTask }), {
            status: 201,
          });
        }
        return new Response(JSON.stringify({ data: storedTasks }), {
          status: 200,
        });
      }
      return buildBoardResponseFromUrl(String(input));
    });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Add task to Monday" }),
    );
    await user.type(screen.getByLabelText("Title"), "Write report");
    await user.type(screen.getByLabelText("Notes"), "Use the latest data");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Write report")).toBeInTheDocument();
    expect(screen.getByText(/Use the latest data/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Task created.");
  });

  it("edits a task and keeps the draft open when saving fails", async () => {
    const user = userEvent.setup();
    const task = {
      id: "existing-task",
      weekWorkspaceId: "workspace-id",
      dayDate: null,
      title: "Old title",
      notes: "Existing notes",
      status: "Not Started",
      createdAtUtc: "2026-08-26T10:00:00Z",
      updatedAtUtc: "2026-08-26T10:00:00Z",
    };
    let saveFailed = false;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/tasks")) {
        return new Response(JSON.stringify({ data: [task] }), { status: 200 });
      }
      if (init?.method === "PUT" && !saveFailed) {
        saveFailed = true;
        return new Response(
          JSON.stringify({ error: { message: "Task could not be saved." } }),
          { status: 500 },
        );
      }
      return new Response(JSON.stringify({ data: task }), { status: 200 });
    });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Edit task" }));
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Task could not be saved.",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("New title");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Task updated.");
  });

  it("keeps weekend tasks visible when switching to full-week mode", async () => {
    const user = userEvent.setup();
    const weekStart = getWeekRange(new Date()).weekStart;
    const weekendDate = formatDateOnly(shiftDateByDays(weekStart, 6));
    const weekendTask = {
      id: "weekend-task",
      weekWorkspaceId: "workspace-id",
      dayDate: weekendDate,
      title: "Weekend planning",
      notes: null,
      status: "Not Started",
      createdAtUtc: "2026-08-26T10:00:00Z",
      updatedAtUtc: "2026-08-26T10:00:00Z",
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      buildBoardResponseFromUrl(String(input), [weekendTask]),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Weekend planning")).toBeNull();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "View" }),
      "fullweek",
    );
    expect(await screen.findByText("Weekend planning")).toBeInTheDocument();
  });
});
