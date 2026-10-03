import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateOnly, type TaskStatus } from "../api/board";
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

function makeTask(
  id: string,
  title: string,
  dayDate: string | null,
  status: TaskStatus = "Not Started",
  executionTime = "",
) {
  return {
    id,
    weekWorkspaceId: "workspace-id",
    dayDate,
    title,
    notes: null,
    status,
    executionTime,
    createdAtUtc: "2026-08-26T10:00:00Z",
    updatedAtUtc: "2026-08-26T10:00:00Z",
  };
}

function withOrder(task: ReturnType<typeof makeTask>, orderIndex: number) {
  return { ...task, orderIndex };
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

  it("moves a task across day lanes through direct drag and drop", async () => {
    const initialWeekStart = getWeekRange(new Date()).weekStart;
    const sourceDay = formatDateOnly(initialWeekStart);
    const destinationDay = formatDateOnly(shiftDateByDays(initialWeekStart, 1));
    const tasks = [
      makeTask("task-1", "Plan Monday work", sourceDay),
      makeTask("task-2", "Plan Tuesday work", destinationDay),
    ];

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes("/tasks/task-1/move")) {
          return new Response(
            JSON.stringify({
              data: {
                taskId: "task-1",
                source: {
                  weekStartDate: sourceDay,
                  snapshotVersion: "source-version",
                  tasks: tasks.filter((task) => task.id !== "task-1"),
                },
                destination: {
                  weekStartDate: sourceDay,
                  snapshotVersion: "destination-version",
                  tasks: [
                    ...tasks.filter((task) => task.id !== "task-1"),
                    { ...tasks[0], dayDate: destinationDay },
                  ],
                },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return buildBoardResponseFromUrl(url, tasks);
      });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const sourceCard = (await screen.findByText("Plan Monday work")).closest(
      ".task-item",
    );
    const destinationCard = screen
      .getByText("Plan Tuesday work")
      .closest(".task-item");

    expect(sourceCard).not.toBeNull();
    expect(destinationCard).not.toBeNull();
    fireEvent.dragStart(sourceCard as HTMLElement);
    fireEvent.dragOver(destinationCard as HTMLElement);
    fireEvent.drop(destinationCard as HTMLElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/tasks/task-1/move"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer jwt-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });
    await waitFor(() => {
      const movedCard = screen
        .getByText("Plan Monday work")
        .closest(".task-item");
      expect(screen.getAllByText("Plan Monday work")).toHaveLength(1);
      expect(
        movedCard?.closest(".day-column")?.getAttribute("aria-label"),
      ).toContain("Tuesday");
    });
  });

  it("does not send a move request when a task is dropped back into its own lane", async () => {
    const initialWeekStart = getWeekRange(new Date()).weekStart;
    const sourceDay = formatDateOnly(initialWeekStart);
    const task = makeTask("task-1", "Stay on Monday", sourceDay);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        if (String(input).includes("/tasks/task-1/move")) {
          return new Response(JSON.stringify({ data: {} }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return buildBoardResponseFromUrl(String(input), [task]);
      });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const taskCard = (await screen.findByText("Stay on Monday")).closest(
      ".task-item",
    ) as HTMLElement;
    fireEvent.dragStart(taskCard);
    fireEvent.drop(taskCard);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("/move")),
      ).toBe(false);
    });
    expect(screen.getAllByText("Stay on Monday")).toHaveLength(1);
  });

  it.each(["day-to-shared", "shared-to-day"] as const)(
    "moves a task through a valid %s drop target",
    async (moveDirection) => {
      const initialWeekStart = getWeekRange(new Date()).weekStart;
      const sourceDay = formatDateOnly(initialWeekStart);
      const destinationDay = formatDateOnly(
        shiftDateByDays(initialWeekStart, 1),
      );
      const isDayToShared = moveDirection === "day-to-shared";
      const task = makeTask(
        "task-1",
        isDayToShared ? "Day to shared" : "Shared to day",
        isDayToShared ? sourceDay : null,
      );
      let moveRequest: Record<string, unknown> | null = null;
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) => {
          if (String(input).includes("/tasks/task-1/move")) {
            moveRequest = JSON.parse(String(init?.body)) as Record<
              string,
              unknown
            >;
            const movedTask = {
              ...task,
              dayDate: isDayToShared ? null : destinationDay,
              orderIndex: 0,
            };
            return new Response(
              JSON.stringify({
                data: {
                  taskId: task.id,
                  source: {
                    weekStartDate: sourceDay,
                    snapshotVersion: "v1",
                    tasks: [movedTask],
                  },
                  destination: {
                    weekStartDate: sourceDay,
                    snapshotVersion: "v1",
                    tasks: [movedTask],
                  },
                },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          return buildBoardResponseFromUrl(String(input), [task]);
        });

      render(
        <MemoryRouter>
          <BoardPage />
        </MemoryRouter>,
      );

      const taskCard = (await screen.findByText(task.title)).closest(
        ".task-item",
      ) as HTMLElement;
      const destination = isDayToShared
        ? (document.querySelector(".week-section-content") as HTMLElement)
        : (screen
            .getByText(/^No tasks for Tuesday$/)
            .closest(".day-column-content") as HTMLElement);
      fireEvent.dragStart(taskCard);
      fireEvent.dragOver(destination);
      fireEvent.drop(destination);

      await waitFor(() => {
        expect(moveRequest).toMatchObject({
          sourceDayDate: isDayToShared ? sourceDay : null,
          destinationDayDate: isDayToShared ? null : destinationDay,
          destinationIndex: 0,
        });
        expect(screen.getAllByText(task.title)).toHaveLength(1);
      });
      const movedCard = screen.getByText(task.title).closest(".task-item");
      expect(
        movedCard
          ?.closest(isDayToShared ? ".week-section-content" : ".day-column")
          ?.getAttribute("class"),
      ).toContain(isDayToShared ? "week-section-content" : "day-column");
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/tasks/task-1/move"),
        ),
      ).toBe(true);
    },
  );

  it("moves a task to another week with the context-menu Move here flow", async () => {
    const user = userEvent.setup();
    const sourceWeek = getWeekRange(new Date()).weekStart;
    const destinationWeek = shiftDateByDays(sourceWeek, 7);
    const sourceWeekParam = formatDateOnly(sourceWeek);
    const destinationWeekParam = formatDateOnly(destinationWeek);
    const sourceDay = sourceWeekParam;
    const destinationDay = formatDateOnly(shiftDateByDays(destinationWeek, 1));
    const sourceTask = withOrder(
      makeTask("task-1", "Move across weeks", sourceDay),
      0,
    );
    const destinationTask = withOrder(
      makeTask("task-2", "Already planned", destinationDay),
      0,
    );
    let moveRequest: Record<string, unknown> | null = null;
    let hasMoved = false;

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/tasks/task-1/move")) {
          hasMoved = true;
          moveRequest = JSON.parse(String(init?.body)) as Record<
            string,
            unknown
          >;
          return new Response(
            JSON.stringify({
              data: {
                taskId: "task-1",
                source: {
                  weekStartDate: sourceWeekParam,
                  snapshotVersion: "source-after-move",
                  tasks: [],
                },
                destination: {
                  weekStartDate: destinationWeekParam,
                  snapshotVersion: "destination-after-move",
                  tasks: [
                    destinationTask,
                    {
                      ...sourceTask,
                      weekWorkspaceId: "destination-workspace",
                      dayDate: destinationDay,
                      orderIndex: 1,
                    },
                  ],
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.pathname.endsWith("/tasks")) {
          const requestedWeek = url.searchParams.get("weekStartDate");
          const movedTask = {
            ...sourceTask,
            weekWorkspaceId: "destination-workspace",
            dayDate: destinationDay,
            orderIndex: 1,
          };
          return buildBoardResponseFromUrl(
            String(input),
            requestedWeek === sourceWeekParam
              ? hasMoved
                ? []
                : [sourceTask]
              : hasMoved
                ? [destinationTask, movedTask]
                : [destinationTask],
          );
        }

        return buildBoardResponseFromUrl(String(input));
      });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "More actions for Move across weeks",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Move" }));
    expect(
      screen.getByRole("button", { name: "Cancel move" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move here to Saturday" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Go to next week" }));
    await user.click(
      await screen.findByRole("button", { name: "Move here to Tuesday" }),
    );

    await waitFor(() => {
      expect(moveRequest).toMatchObject({
        sourceWeekStartDate: sourceWeekParam,
        sourceDayDate: sourceDay,
        sourceIndex: 0,
        destinationWeekStartDate: destinationWeekParam,
        destinationDayDate: destinationDay,
        destinationIndex: 1,
      });
    });
    expect(await screen.findAllByText("Move across weeks")).toHaveLength(1);
    expect(screen.getAllByText("Already planned")).toHaveLength(1);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/tasks?weekStartDate="),
      ),
    ).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Go to previous week" }),
    );
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(`/tasks?weekStartDate=${sourceWeekParam}`),
        ),
      ).toBe(true);
      expect(screen.queryByText("Move across weeks")).toBeNull();
    });
    await user.click(screen.getByRole("button", { name: "Go to next week" }));
    expect(await screen.findAllByText("Move across weeks")).toHaveLength(1);
  });

  it("clears pending move on cancel and outside click without mutating", async () => {
    const user = userEvent.setup();
    const initialWeekStart = getWeekRange(new Date()).weekStart;
    const task = makeTask(
      "task-1",
      "Cancel this move",
      formatDateOnly(initialWeekStart),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        buildBoardResponseFromUrl(String(input), [task]),
      );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "More actions for Cancel this move",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Move" }));
    await user.click(screen.getByRole("button", { name: "Cancel move" }));
    expect(
      screen.queryByRole("button", { name: "Move here to Tuesday" }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "More actions for Cancel this move" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Move" }));
    await user.click(screen.getByText("Signed in as admin"));

    expect(screen.queryByRole("button", { name: "Cancel move" })).toBeNull();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("/move")),
    ).toBe(false);
  });

  it("keeps the source task exactly once and refetches after a failed move", async () => {
    const initialWeekStart = getWeekRange(new Date()).weekStart;
    const sourceDay = formatDateOnly(initialWeekStart);
    const task = makeTask("task-1", "Move conflict task", sourceDay);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        if (String(input).includes("/tasks/task-1/move")) {
          return new Response(
            JSON.stringify({
              error: {
                code: "task.move.conflict",
                message: "Reload and try again.",
              },
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
        return buildBoardResponseFromUrl(String(input), [task]);
      });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const sourceCard = (await screen.findByText("Move conflict task")).closest(
      ".task-item",
    ) as HTMLElement;
    const destinationCard = screen
      .getByText(/^No tasks for Tuesday$/)
      .closest(".day-column-content") as HTMLElement;
    fireEvent.dragStart(sourceCard);
    fireEvent.dragOver(destinationCard);
    fireEvent.drop(destinationCard);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Reload and try again.",
      );
      expect(screen.getAllByText("Move conflict task")).toHaveLength(1);
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).includes("/tasks?weekStartDate="),
        ).length,
      ).toBeGreaterThanOrEqual(2);
    });
    expect(
      screen
        .getByText("Move conflict task")
        .closest(".day-column")
        ?.getAttribute("aria-label"),
    ).toContain("Monday");
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
        status: "In Progress",
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
    expect(dailyTaskTitle.closest(".task-item")).toHaveTextContent(
      "In progress",
    );
    expect(
      screen.getByRole("checkbox", {
        name: "Task 2: Complete Plan Monday work",
      }),
    ).not.toBeChecked();
  });

  it("suppresses shared-week execution time rendering even with an older 00:00 value", async () => {
    const task = {
      ...makeTask("shared-task", "Shared task", null, "Not Started", "00:00"),
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      buildBoardResponseFromUrl(String(input), [task]),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Shared task")).toBeInTheDocument();
    expect(screen.queryByText("00:00")).not.toBeInTheDocument();
    expect(
      screen.getByText("Shared task").closest(".task-title-row"),
    ).not.toHaveTextContent("00:00");
  });

  it.each(["workweek", "fullweek"] as const)(
    "renders execution time before the title without a clock control in %s view",
    async (viewMode) => {
      window.localStorage.setItem("taskmanager.boardViewMode", viewMode);
      const monday = formatDateOnly(getWeekRange(new Date()).weekStart);
      const timedTask = makeTask(
        "timed-task",
        "Timed Monday task",
        monday,
        "Not Started",
        "09:30",
      );
      const untimedTask = makeTask(
        "untimed-task",
        "Untimed Monday task",
        monday,
      );
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
        buildBoardResponseFromUrl(String(input), [timedTask, untimedTask]),
      );

      render(
        <MemoryRouter>
          <BoardPage />
        </MemoryRouter>,
      );

      const timedTitle = await screen.findByText("Timed Monday task");
      const timedRow = timedTitle.closest(".task-title-row") as HTMLElement;
      expect(
        Array.from(timedRow.children).map((child) => child.textContent),
      ).toEqual(["09:30", "Timed Monday task"]);
      expect(timedRow.querySelector(".task-execution-time")).toHaveTextContent(
        "09:30",
      );
      expect(within(timedRow).queryByRole("button")).toBeNull();

      const untimedTitle = await screen.findByText("Untimed Monday task");
      const untimedRow = untimedTitle.closest(".task-title-row") as HTMLElement;
      expect(Array.from(untimedRow.children)).toEqual([untimedTitle]);
      expect(untimedRow.querySelector(".task-execution-time")).toBeNull();
    },
  );

  it.each([
    ["workweek", "shared"],
    ["workweek", "day"],
    ["fullweek", "shared"],
    ["fullweek", "day"],
  ] as const)(
    "keeps the task editor positioned and keyboard focus usable in %s %s context",
    async (viewMode, placement) => {
      const user = userEvent.setup();
      window.localStorage.setItem("taskmanager.boardViewMode", viewMode);
      const monday = formatDateOnly(getWeekRange(new Date()).weekStart);
      const task = makeTask(
        "focus-task",
        "Task to edit",
        placement === "day" ? monday : null,
        "Not Started",
        "09:00",
      );
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
        buildBoardResponseFromUrl(String(input), [task]),
      );

      render(
        <MemoryRouter>
          <BoardPage />
        </MemoryRouter>,
      );

      const trigger = await screen.findByRole("button", {
        name: "Task 1: Edit task: Task to edit",
      });
      await user.click(trigger);

      const dialog = screen.getByRole("dialog", { name: "Edit task" });
      const titleInput = screen.getByLabelText("Title");
      expect(titleInput).toHaveFocus();
      const backdrop = dialog.closest(".task-editor-backdrop");
      expect(backdrop).not.toBeNull();
      expect(backdrop?.parentElement).toBe(
        document.querySelector("main.screen"),
      );

      await waitFor(() => {
        expect(titleInput).toHaveFocus();
      });
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(
        trigger.closest(placement === "day" ? ".day-column" : ".week-section"),
      ).not.toBeNull();
    },
  );

  it("cycles task status with the keyboard and persists each status", async () => {
    const user = userEvent.setup();
    const task = makeTask(
      "keyboard-task",
      "Keyboard task",
      null,
      "Not Started",
      "09:30",
    );
    let storedTasks = [task];
    const savedStatuses: string[] = [];
    const savedExecutionTimes: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as {
          status: TaskStatus;
          executionTime: string;
        };
        savedStatuses.push(body.status);
        savedExecutionTimes.push(body.executionTime);
        storedTasks = storedTasks.map((storedTask) => ({
          ...storedTask,
          status: body.status,
        }));
        return new Response(JSON.stringify({ data: storedTasks[0] }), {
          status: 200,
        });
      }
      if (url.pathname.endsWith("/tasks")) {
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

    const completionCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Start Keyboard task",
    });
    completionCheckbox.focus();
    expect(completionCheckbox).toHaveFocus();
    await user.keyboard(" ");

    const inProgressCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Complete Keyboard task",
    });
    await waitFor(() => expect(inProgressCheckbox).not.toBeChecked());
    expect(screen.getByRole("status")).toHaveTextContent("Task started.");
    expect(screen.getByRole("status")).toHaveClass(
      "save-message-status-change",
    );
    expect(savedStatuses).toEqual(["In Progress"]);

    inProgressCheckbox.focus();
    await user.keyboard(" ");

    const completedTaskCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Mark as not done Keyboard task",
    });
    await waitFor(() => expect(completedTaskCheckbox).toBeChecked());
    expect(screen.getByRole("status")).toHaveTextContent("Task completed.");
    expect(savedStatuses).toEqual(["In Progress", "Completed"]);

    completedTaskCheckbox.focus();
    await user.keyboard(" ");

    const notDoneCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Reopen Keyboard task",
    });
    await waitFor(() => expect(notDoneCheckbox).not.toBeChecked());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Task marked not done.",
    );
    expect(savedStatuses).toEqual(["In Progress", "Completed", "Not done"]);

    notDoneCheckbox.focus();
    await user.keyboard(" ");

    const reopenedCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Start Keyboard task",
    });
    await waitFor(() => expect(reopenedCheckbox).not.toBeChecked());
    expect(screen.getByRole("status")).toHaveTextContent("Task reopened.");
    expect(savedStatuses).toEqual([
      "In Progress",
      "Completed",
      "Not done",
      "Not Started",
    ]);
    expect(savedExecutionTimes).toEqual(["09:30", "09:30", "09:30", "09:30"]);
    expect(storedTasks[0].status).toBe("Not Started");
  });

  it("prevents editing a task while its completion update is pending", async () => {
    const user = userEvent.setup();
    const task = makeTask("pending-task", "Pending task", null);
    const otherTask = makeTask("other-task", "Other task", null);
    let finishUpdate: (() => void) | undefined;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = new URL(String(input));
      if (init?.method === "PUT") {
        return new Promise<Response>((resolve) => {
          finishUpdate = () =>
            resolve(
              new Response(
                JSON.stringify({ data: { ...task, status: "Completed" } }),
                { status: 200 },
              ),
            );
        });
      }
      if (url.pathname.endsWith("/tasks")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: [task, otherTask] }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(buildBoardResponseFromUrl(String(input)));
    });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const completionCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Start Pending task",
    });
    await user.click(completionCheckbox);

    expect(completionCheckbox).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Task 1: Edit task: Pending task",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Task 2: Edit task: Other task",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add task to shared week" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add task to Monday" }),
    ).toBeDisabled();

    finishUpdate?.();

    expect(
      await screen.findByRole("checkbox", {
        name: "Task 1: Complete Pending task",
        checked: false,
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Task 1: Edit task: Pending task",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Task 2: Edit task: Other task",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Add task to shared week" }),
    ).toBeEnabled();
  });

  it("shows completed tasks with accessible state, compact styling, and visible controls", async () => {
    const completedTask = makeTask(
      "completed-task",
      "Completed task title",
      null,
      "Completed",
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      buildBoardResponseFromUrl(String(input), [completedTask]),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const reopenCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Mark as not done Completed task title",
      checked: true,
    });
    const card = screen.getByText("Completed task title").closest(".task-item");

    expect(card).toHaveClass("task-item-completed");
    expect(screen.getByText("Completed task title")).toBeVisible();
    expect(
      within(card as HTMLElement).getByRole("button", {
        name: "Task 1: Edit task: Completed task title",
      }),
    ).toBeVisible();
    expect(reopenCheckbox).toBeVisible();
  });

  it("renders task cards in three rows and minimizes completed cards", async () => {
    const tasks = [
      {
        ...makeTask(
          "in-progress-task",
          "In progress title",
          null,
          "In Progress",
        ),
        notes: "In progress notes",
      },
      {
        ...makeTask("not-started-task", "Not started title", null),
        notes: "Not started notes",
      },
      {
        ...makeTask("completed-task", "Completed title", null, "Completed"),
        notes: "Completed notes",
      },
      {
        ...makeTask("not-done-task", "Not done title", null, "Not done"),
        notes: "Not done notes",
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

    const inProgressCard = (
      await screen.findByText("In progress title")
    ).closest(".task-item") as HTMLElement;
    const inProgressRows = inProgressCard.querySelectorAll(
      ".task-title-row, .task-controls-row, .task-description",
    );
    expect(inProgressRows).toHaveLength(3);
    expect(inProgressRows[0]).toHaveTextContent("In progress title");
    expect(inProgressRows[0].querySelector(".task-progress-label")).toBeNull();
    expect(inProgressRows[1]).toHaveTextContent("In progress");
    expect(inProgressRows[2]).toHaveTextContent("In progress notes");
    expect(
      Array.from(inProgressRows[1].children).map((child) => child.className),
    ).toEqual([
      "task-drag-handle",
      "task-completion-checkbox",
      "edit-task-button",
      "delete-task-button",
      "task-menu-button",
      "task-progress-label",
    ]);
    expect(
      within(inProgressRows[1] as HTMLElement).getByRole("checkbox"),
    ).toBeInTheDocument();
    expect(
      within(inProgressRows[1] as HTMLElement).getAllByRole("button"),
    ).toHaveLength(4);

    const notStartedCard = screen
      .getByText("Not started title")
      .closest(".task-item") as HTMLElement;
    const notStartedControls = notStartedCard.querySelector(
      ".task-controls-row",
    ) as HTMLElement;
    expect(notStartedControls).toHaveTextContent("Not Started");
    expect(
      Array.from(notStartedControls.children).map((child) => child.className),
    ).toEqual([
      "task-drag-handle",
      "task-completion-checkbox",
      "edit-task-button",
      "delete-task-button",
      "task-menu-button",
      "task-not-started-label",
    ]);
    expect(notStartedCard.querySelector(".task-progress-label")).toBeNull();

    const completedCard = screen
      .getByText("Completed title")
      .closest(".task-item") as HTMLElement;
    expect(completedCard).toHaveClass("task-item-completed");
    expect(
      completedCard.querySelectorAll(".task-title-row, .task-controls-row"),
    ).toHaveLength(2);
    expect(completedCard.querySelector(".task-description")).toBeNull();
    expect(
      completedCard.querySelector(
        ".task-progress-label, .task-not-started-label",
      ),
    ).toBeNull();
    expect(completedCard.querySelector(".task-title")).toHaveClass(
      "task-title-completed",
    );
    expect(completedCard.querySelector(".task-title")).not.toHaveClass(
      "task-title-not-done",
    );
    expect(
      within(completedCard).getByRole("checkbox", {
        name: "Task 3: Mark as not done Completed title",
      }),
    ).toBeVisible();
    expect(
      within(completedCard).getByRole("button", {
        name: "Task 3: Edit task: Completed title",
      }),
    ).toBeVisible();
    expect(
      within(completedCard).getByRole("button", {
        name: "Task 3: Delete task: Completed title",
      }),
    ).toBeVisible();
    expect(within(completedCard).getAllByRole("button")).toHaveLength(4);

    const notDoneCard = screen
      .getByText("Not done title")
      .closest(".task-item") as HTMLElement;
    expect(notDoneCard).toHaveClass("task-item-not-done");
    expect(notDoneCard.querySelector(".task-title")).toHaveClass(
      "task-title-not-done",
    );
    expect(notDoneCard.querySelector(".task-description")).toHaveTextContent(
      "Not done notes",
    );
    expect(notDoneCard.querySelector(".task-not-done-label")).toHaveTextContent(
      "Not done",
    );
    expect(
      within(notDoneCard).getByRole("checkbox", {
        name: "Task 4: Reopen Not done title",
      }),
    ).not.toBeChecked();
  });

  it("cancels or confirms permanent task deletion", async () => {
    const user = userEvent.setup();
    const task = makeTask("delete-task", "Task to delete", null, "Not Started");
    let storedTasks = [task];
    const confirmMock = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        if (init?.method === "DELETE") {
          storedTasks = [];
          return new Response(null, { status: 204 });
        }

        return buildBoardResponseFromUrl(String(input), storedTasks);
      });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const deleteButton = await screen.findByRole("button", {
      name: "Task 1: Delete task: Task to delete",
    });
    expect(deleteButton).toHaveTextContent("✕");
    await user.click(deleteButton);
    expect(screen.getByText("Task to delete")).toBeInTheDocument();

    await user.click(deleteButton);
    await waitFor(() =>
      expect(screen.queryByText("Task to delete")).not.toBeInTheDocument(),
    );
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/delete-task?weekStartDate="),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("distinguishes accessible controls for tasks with duplicate titles", async () => {
    const firstTask = makeTask("task-1", "Duplicate title", null);
    const secondTask = makeTask("task-2", "Duplicate title", null);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      buildBoardResponseFromUrl(String(input), [firstTask, secondTask]),
    );

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("checkbox", {
        name: "Task 1: Start Duplicate title",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Task 2: Start Duplicate title",
      }),
    ).toBeInTheDocument();
  });

  it("preserves completed task order, placement, view mode, and persistence after reload", async () => {
    const user = userEvent.setup();
    const weekStart = getWeekRange(new Date()).weekStart;
    const mondayDate = formatDateOnly(weekStart);
    const sundayDate = formatDateOnly(shiftDateByDays(weekStart, 6));
    let storedTasks = [
      makeTask("shared-first", "Shared first", null, "Completed"),
      makeTask("shared-second", "Shared second", null),
      makeTask("monday-task", "Monday completed", mondayDate, "Completed"),
      makeTask("sunday-task", "Sunday completed", sundayDate, "Completed"),
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { status: TaskStatus };
        const taskId = url.pathname.split("/").pop();
        storedTasks = storedTasks.map((task) =>
          task.id === taskId ? { ...task, status: body.status } : task,
        );
        const updatedTask = storedTasks.find((task) => task.id === taskId);
        return new Response(JSON.stringify({ data: updatedTask }), {
          status: 200,
        });
      }
      if (url.pathname.endsWith("/tasks")) {
        return new Response(JSON.stringify({ data: storedTasks }), {
          status: 200,
        });
      }
      return buildBoardResponseFromUrl(String(input));
    });

    const { container, unmount } = render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await screen.findByText("Shared first");
    expect(screen.queryByText("Sunday completed")).toBeNull();
    const weekSection = container.querySelector(".week-section-content");
    expect(
      Array.from(weekSection?.querySelectorAll(".task-title") ?? []).map(
        (title) => title.textContent,
      ),
    ).toEqual(["Shared first", "Shared second"]);
    expect(
      screen.getByText("Monday completed").closest(".day-column"),
    ).toHaveTextContent("Monday completed");

    await user.click(
      screen.getByRole("checkbox", {
        name: "Task 2: Start Shared second",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", {
          name: "Task 2: Complete Shared second",
        }),
      ).not.toBeChecked(),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "View" }),
      "fullweek",
    );
    expect(await screen.findByText("Sunday completed")).toBeVisible();

    unmount();
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("combobox", { name: "View" })).toHaveValue(
      "fullweek",
    );
    expect(await screen.findByText("Sunday completed")).toBeVisible();
    expect(
      screen.getByRole("checkbox", {
        name: "Task 2: Complete Shared second",
      }),
    ).not.toBeChecked();
    expect(
      screen.getByText("Monday completed").closest(".day-column"),
    ).toHaveTextContent("Monday completed");
    const reloadedWeekSection = document.querySelector(".week-section-content");
    expect(
      Array.from(
        reloadedWeekSection?.querySelectorAll(".task-title") ?? [],
      ).map((title) => title.textContent),
    ).toEqual(["Shared first", "Shared second"]);
  });

  it("retains completed presentation and announces update failures", async () => {
    const user = userEvent.setup();
    const task = makeTask(
      "failure-task",
      "Keep completed task",
      null,
      "Completed",
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            error: { message: "Task could not be updated. Try again." },
          }),
          { status: 500 },
        );
      }
      return buildBoardResponseFromUrl(String(input), [task]);
    });

    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    const reopenCheckbox = await screen.findByRole("checkbox", {
      name: "Task 1: Mark as not done Keep completed task",
    });
    await user.click(reopenCheckbox);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Task could not be updated. Try again.",
    );
    expect(reopenCheckbox).toBeChecked();
    expect(reopenCheckbox.closest(".task-item")).toHaveClass(
      "task-item-completed",
    );
  });

  it("reorders a task with mouse drag and drop and persists the lane", async () => {
    const firstTask = withOrder(makeTask("first-task", "First task", null), 0);
    const secondTask = withOrder(
      makeTask("second-task", "Second task", null),
      1,
    );
    let storedTasks = [firstTask, secondTask];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "PUT" && url.pathname.endsWith("/reorder")) {
        const body = JSON.parse(String(init.body)) as { taskIds: string[] };
        storedTasks = body.taskIds.map((id, orderIndex) => ({
          ...storedTasks.find((task) => task.id === id)!,
          orderIndex,
        }));
        return new Response(
          JSON.stringify({
            data: {
              weekStartDate: "2026-09-28",
              dayDate: null,
              tasks: storedTasks,
            },
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith("/tasks")) {
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

    const secondCard = (await screen.findByText("Second task")).closest(
      ".task-item",
    );
    const firstCard = screen.getByText("First task").closest(".task-item");
    expect(secondCard).not.toBeNull();
    expect(firstCard).not.toBeNull();
    fireEvent.dragStart(secondCard as HTMLElement);
    fireEvent.dragOver(firstCard as HTMLElement);
    fireEvent.drop(firstCard as HTMLElement);

    await waitFor(() => {
      expect(
        Array.from(
          document.querySelectorAll(".week-section-content .task-title"),
        ).map((title) => title.textContent),
      ).toEqual(["Second task", "First task"]);
    });
    expect(storedTasks.map((task) => task.id)).toEqual([
      "second-task",
      "first-task",
    ]);
  });

  it("restores the previous lane order and announces reorder failures", async () => {
    const firstTask = withOrder(makeTask("first-task", "First task", null), 0);
    const secondTask = withOrder(
      makeTask("second-task", "Second task", null),
      1,
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "PUT" && url.pathname.endsWith("/reorder")) {
        return new Response(
          JSON.stringify({ error: { message: "Order could not be saved." } }),
          { status: 409 },
        );
      }
      if (url.pathname.endsWith("/tasks")) {
        return new Response(JSON.stringify({ data: [firstTask, secondTask] }), {
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

    const secondCard = (await screen.findByText("Second task")).closest(
      ".task-item",
    );
    const firstCard = screen.getByText("First task").closest(".task-item");
    expect(secondCard).not.toBeNull();
    expect(firstCard).not.toBeNull();
    fireEvent.dragStart(secondCard as HTMLElement);
    fireEvent.dragOver(firstCard as HTMLElement);
    fireEvent.drop(firstCard as HTMLElement);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Order could not be saved.",
      );
      expect(
        Array.from(
          document.querySelectorAll(".week-section-content .task-title"),
        ).map((title) => title.textContent),
      ).toEqual(["First task", "Second task"]);
    });
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
      executionTime: "13:45",
      createdAtUtc: "2026-08-26T10:00:00Z",
      updatedAtUtc: "2026-08-26T10:00:00Z",
    };
    let saveFailed = false;
    const savedExecutionTimes: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/tasks")) {
        return new Response(JSON.stringify({ data: [task] }), { status: 200 });
      }
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { executionTime: string };
        savedExecutionTimes.push(body.executionTime);
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

    await user.click(
      await screen.findByRole("button", {
        name: "Task 1: Edit task: Old title",
      }),
    );
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
    expect(savedExecutionTimes).toEqual(["", ""]);
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
