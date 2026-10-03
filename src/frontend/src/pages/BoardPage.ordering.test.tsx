import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sha256 } from "js-sha256";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateOnly, type TaskPayload } from "../api/board";
import {
  getWeekRange,
  shiftDateByDays,
} from "../features/board/hooks/useWeekCalculation";
import { BoardPage } from "./BoardPage";

// Keep this suite independent of BoardPage.test.tsx and exercise the real API
// adapter (including BoardMutationError), rather than mocking board functions.
const navigateMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type Route = "board" | "tasks" | "reorder" | "move" | "delete";
type PendingRequest = ReturnType<typeof deferred<Response>> & {
  route: Route;
  method: string;
  week: string;
  url: URL;
  body: Record<string, unknown>;
  init: RequestInit | undefined;
  settleBoardWork: () => Promise<void>;
};

function fakeHttp() {
  const requests: PendingRequest[] = [];
  // Preserve real hashing, but await it before making negative race assertions.
  // Otherwise a stale write/focus scheduled after an async digest could escape
  // an assertion that happens to run before that work completes.
  const digests: Promise<ArrayBuffer>[] = [];
  if (globalThis.crypto?.subtle) {
    const realDigest = globalThis.crypto.subtle.digest.bind(
      globalThis.crypto.subtle,
    );
    vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(
      (...args) => {
        const promise = realDigest(...args);
        digests.push(promise);
        return promise;
      },
    );
  }
  async function settleBoardWork() {
    await act(async () => {
      await Promise.all(digests);
      // Run after any focus-restoration callbacks queued by this response.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input, init) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL
          ? String(input)
          : input.url,
      );
      const method = init?.method ?? "GET";
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      let route: Route;
      if (method === "GET" && url.pathname.endsWith("/board")) {
        route = "board";
      } else if (method === "GET" && url.pathname.endsWith("/tasks")) {
        route = "tasks";
      } else if (method === "PUT" && url.pathname.endsWith("/tasks/reorder")) {
        route = "reorder";
      } else if (
        method === "POST" &&
        /\/tasks\/[^/]+\/move$/.test(url.pathname)
      ) {
        route = "move";
      } else if (method === "DELETE" && /\/tasks\/[^/]+$/.test(url.pathname)) {
        route = "delete";
      } else {
        throw new Error(`Unexpected request: ${method} ${url}`);
      }
      const request: PendingRequest = {
        ...deferred<Response>(),
        route,
        method,
        week:
          url.searchParams.get("week_start_date") ??
          url.searchParams.get("weekStartDate") ??
          String(body.weekStartDate ?? body.sourceWeekStartDate ?? ""),
        url,
        body,
        init,
        settleBoardWork,
      };
      requests.push(request);
      return request.promise;
    });

  function matching(route: Route, week: string) {
    return requests.filter(
      (request) => request.route === route && request.week === week,
    );
  }

  async function pending(route: Route, week: string, occurrence = 0) {
    // Never resolve a request before the relevant effect/prefetch has run.
    await waitFor(() => {
      expect(matching(route, week).length).toBeGreaterThan(occurrence);
    });
    return matching(route, week)[occurrence];
  }

  async function loadWeek(
    week: string,
    tasks: TaskPayload[],
    occurrence = 0,
    snapshotVersion: string | null = `snapshot-${week}-${occurrence}`,
  ) {
    const [boardRequest, taskRequest] = await Promise.all([
      pending("board", week, occurrence),
      pending("tasks", week, occurrence),
    ]);
    await act(async () => {
      boardRequest.resolve(
        jsonResponse({
          data: { weekStartDate: week, lanes: [], snapshotVersion },
        }),
      );
      taskRequest.resolve(jsonResponse({ data: tasks }));
    });
    await waitFor(() => {
      for (const task of tasks) expect(card(task.id)).toBeInTheDocument();
    });
  }

  return { fetchMock, requests, matching, pending, loadWeek };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function succeed(request: PendingRequest, data: unknown) {
  await act(async () => {
    request.resolve(jsonResponse({ data }));
  });
  await request.settleBoardWork();
}

async function fail(request: PendingRequest, status: number | "network") {
  await act(async () => {
    if (status === "network") {
      request.reject(new TypeError("Failed to fetch"));
    } else {
      request.resolve(
        jsonResponse(
          {
            error: {
              code: "task.reorder.conflict",
              message: "Order could not be saved. Reload and try again.",
            },
          },
          status,
        ),
      );
    }
  });
  await request.settleBoardWork();
}

function dates() {
  const monday = getWeekRange(new Date()).weekStart;
  return {
    week: formatDateOnly(monday),
    tuesday: formatDateOnly(shiftDateByDays(monday, 1)),
    nextWeek: formatDateOnly(shiftDateByDays(monday, 7)),
  };
}

function makeTask(
  id: string,
  dayDate: string | null,
  orderIndex: number,
  overrides: Partial<TaskPayload> = {},
): TaskPayload {
  return {
    id,
    weekWorkspaceId: "workspace-id",
    title: `Task ${id}`,
    dayDate,
    orderIndex,
    notes: null,
    status: "Not Started",
    executionTime: "",
    createdAtUtc: "2026-08-26T10:00:00Z",
    updatedAtUtc: "2026-08-26T10:00:00Z",
    ...overrides,
  };
}

function ordered(tasks: TaskPayload[], ids: string[]) {
  return ids.map((id, orderIndex) => ({
    ...tasks.find((task) => task.id === id)!,
    orderIndex,
  }));
}

// These fixtures use whole-second UTC timestamps. Build the server contract
// independently so stale, uncompacted client indexes cannot pass as a version.
function snapshotHash(week: string, tasks: TaskPayload[]) {
  const sorted = [...tasks].sort(
    (left, right) =>
      (left.dayDate ?? "0000-00-00").localeCompare(
        right.dayDate ?? "0000-00-00",
      ) ||
      (left.orderIndex ?? 0) - (right.orderIndex ?? 0) ||
      left.id.localeCompare(right.id),
  );
  const content = sorted.reduce((snapshot, task) => {
    const ticks =
      621355968000000000n + BigInt(Date.parse(task.updatedAtUtc)) * 10000n;
    return `${snapshot}|${task.id}|${task.dayDate ?? "shared"}|${task.orderIndex ?? 0}|${task.title}|${task.notes ?? ""}|${task.status}|${task.executionTime}|${ticks}`;
  }, week);
  return sha256(content).toUpperCase();
}

function card(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-task-reorder-id="${id}"]`,
  );
  expect(element, `Expected task card ${id}`).not.toBeNull();
  return element!;
}

function lane(key: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `section[data-lane-key="${key}"]`,
  );
  expect(element, `Expected lane ${key}`).not.toBeNull();
  return element!;
}

function laneOrder(key = "shared") {
  return Array.from(
    lane(key).querySelectorAll<HTMLElement>("[data-task-reorder-id]"),
  ).map((element) => element.dataset.taskReorderId);
}

function expectDescribedStatus(element: HTMLElement, message: string) {
  const descriptionId = element.getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  const status = document.getElementById(descriptionId!);
  expect(status).toHaveAttribute("role", "status");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveTextContent(message);
  expect(element).toHaveAccessibleDescription(message);
}

function dragOnto(sourceId: string, target: HTMLElement) {
  fireEvent.dragStart(card(sourceId));
  fireEvent.dragOver(target);
  fireEvent.drop(target);
}

function renderBoard() {
  return render(
    <MemoryRouter>
      <BoardPage />
    </MemoryRouter>,
  );
}

async function startReorder(
  http: ReturnType<typeof fakeHttp>,
  week: string,
  sourceId: string,
  targetId: string,
) {
  expect(card(sourceId)).toHaveAttribute("draggable", "true");
  const occurrence = http.matching("reorder", week).length;
  dragOnto(sourceId, card(targetId));
  return http.pending("reorder", week, occurrence);
}

async function finishReorder(
  request: PendingRequest,
  tasks: TaskPayload[],
  dayDate: string | null = null,
) {
  await succeed(request, { weekStartDate: request.week, dayDate, tasks });
}

async function startMove(
  http: ReturnType<typeof fakeHttp>,
  week: string,
  tasks: TaskPayload[],
  sourceId: string,
  destination: HTMLElement,
) {
  dragOnto(sourceId, destination);
  // Move preflight reads are sequential: tasks first, then board snapshot.
  await succeed(await http.pending("tasks", week, 1), tasks);
  await succeed(await http.pending("board", week, 1), {
    weekStartDate: week,
    lanes: [],
    snapshotVersion: "move-source-snapshot",
  });
  return http.pending("move", week);
}

function moveResponse(week: string, taskId: string, tasks: TaskPayload[]) {
  const snapshot = {
    weekStartDate: week,
    snapshotVersion: "after-move",
    tasks,
  };
  return { taskId, source: snapshot, destination: snapshot };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BoardPage ordering bug regressions", () => {
  it.each(["success", "conflict"] as const)(
    "shows a cross-week pending move's %s snapshot while the destination initial GET is delayed, and ignores that late GET",
    async (outcome) => {
      const user = userEvent.setup();
      const { week, nextWeek } = dates();
      const http = fakeHttp();
      const sourceTasks = [makeTask("moving", week, 0)];
      const destinationTasks = [makeTask("destination", null, 0)];
      const authoritative = [
        { ...sourceTasks[0], dayDate: null, orderIndex: 0 },
        { ...destinationTasks[0], orderIndex: 1 },
      ];
      renderBoard();
      await http.loadWeek(week, sourceTasks);
      await user.click(
        screen.getByRole("button", { name: "More actions for Task moving" }),
      );
      await user.click(screen.getByRole("menuitem", { name: "Move" }));
      await user.click(screen.getByRole("button", { name: "Go to next week" }));
      const initialBoard = await http.pending("board", nextWeek);
      const initialTasks = await http.pending("tasks", nextWeek);
      expect(screen.queryByText("Task moving")).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Move here to shared week" }),
      );
      await succeed(await http.pending("tasks", week, 1), sourceTasks);
      await succeed(await http.pending("board", week, 1), {
        weekStartDate: week,
        lanes: [],
        snapshotVersion: "source-before-move",
      });
      await succeed(await http.pending("tasks", nextWeek, 1), destinationTasks);
      const request = await http.pending("move", week);
      expect(request.body).toMatchObject({
        sourceWeekStartDate: week,
        destinationWeekStartDate: nextWeek,
        destinationDayDate: null,
        destinationIndex: 0,
        sourceSnapshotVersion: "source-before-move",
        destinationSnapshotVersion: snapshotHash(nextWeek, destinationTasks),
      });
      if (outcome === "success") {
        await succeed(request, {
          taskId: "moving",
          source: {
            weekStartDate: week,
            snapshotVersion: "source-after",
            tasks: [],
          },
          destination: {
            weekStartDate: nextWeek,
            snapshotVersion: "destination-after",
            tasks: authoritative,
          },
        });
      } else {
        await fail(request, 409);
        await succeed(await http.pending("tasks", nextWeek, 2), authoritative);
        await succeed(await http.pending("board", nextWeek, 1), {
          weekStartDate: nextWeek,
          lanes: [],
          snapshotVersion: "reconciled-destination",
        });
      }
      const message =
        outcome === "success"
          ? "Task moved."
          : "The latest board has been loaded.";
      await waitFor(() => {
        expect(laneOrder()).toEqual(["moving", "destination"]);
        expect(card("moving")).toHaveFocus();
        expect(card("moving")).toHaveAttribute("draggable", "true");
        expect(screen.getByRole("status")).toHaveTextContent(message);
      });
      const requestsBeforeLateLoad = http.requests.length;
      await succeed(initialTasks, [makeTask("stale-destination", null, 0)]);
      await succeed(initialBoard, {
        weekStartDate: nextWeek,
        lanes: [],
        snapshotVersion: "stale-initial-version",
      });
      expect(laneOrder()).toEqual(["moving", "destination"]);
      expect(
        screen.queryByText("Task stale-destination"),
      ).not.toBeInTheDocument();
      expect(card("moving")).toHaveFocus();
      expect(screen.getByRole("status")).toHaveTextContent(message);
      expect(http.requests).toHaveLength(requestsBeforeLateLoad);
      const reorder = await startReorder(
        http,
        nextWeek,
        "destination",
        "moving",
      );
      expect(reorder.body.snapshotVersion).toBe(
        outcome === "success" ? "destination-after" : "reconciled-destination",
      );
      await finishReorder(
        reorder,
        ordered(authoritative, ["destination", "moving"]),
      );
    },
  );

  it.each(["server version", "hash fallback"] as const)(
    "refetches compacted B/C after deleting A and reorders C/B without a false conflict using %s",
    async (versionSource) => {
      const user = userEvent.setup();
      const { week } = dates();
      const http = fakeHttp();
      const original = [
        makeTask("a", null, 0),
        makeTask("b", null, 1),
        makeTask("c", null, 2),
      ];
      const compacted = ordered(original, ["b", "c"]);
      const expectedVersion = snapshotHash(week, compacted);
      expect(expectedVersion).not.toBe(snapshotHash(week, original.slice(1)));
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderBoard();
      await http.loadWeek(week, original, 0, snapshotHash(week, original));
      await user.click(
        within(card("a")).getByRole("button", { name: /Delete task:/ }),
      );
      const deletion = await http.pending("delete", week);
      expect(deletion.url.pathname).toMatch(/\/tasks\/a$/);
      await act(async () =>
        deletion.resolve(new Response(null, { status: 204 })),
      );
      const refetchBoard = await http.pending("board", week, 1);
      const refetchTasks = await http.pending("tasks", week, 1);
      expect(screen.queryByText("Task a")).not.toBeInTheDocument();
      expect(card("c")).toHaveAttribute("draggable", "false");
      await succeed(refetchTasks, compacted);
      expect(card("c")).toHaveAttribute("draggable", "false");
      await succeed(refetchBoard, {
        weekStartDate: week,
        lanes: [],
        snapshotVersion:
          versionSource === "server version" ? expectedVersion : null,
      });
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          /^Task deleted\.$/,
        );
        expect(card("c")).toHaveAttribute("draggable", "true");
      });
      expect(laneOrder()).toEqual(["b", "c"]);
      const reorder = await startReorder(http, week, "c", "b");
      expect(reorder.body).toEqual({
        weekStartDate: week,
        dayDate: null,
        taskIds: ["c", "b"],
        snapshotVersion: expectedVersion,
      });
      const reordered = ordered(compacted, ["c", "b"]);
      await finishReorder(reorder, reordered);
      expect(laneOrder()).toEqual(["c", "b"]);
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Task order updated\.$/,
      );
      // The next version must also be built from the authoritative compacted tasks.
      const nextReorder = await startReorder(http, week, "b", "c");
      expect(nextReorder.body.snapshotVersion).toBe(
        snapshotHash(week, reordered),
      );
      await finishReorder(nextReorder, compacted);
      expect(http.matching("board", week)).toHaveLength(2);
      expect(http.matching("tasks", week)).toHaveLength(2);
      expect(http.matching("delete", week)).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Task order updated\.$/,
      );
    },
  );

  it("reorders with portable SHA256 when crypto.subtle is undefined, including the next snapshot hash", async () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(
      globalThis.crypto,
    );
    vi.stubGlobal("crypto", { getRandomValues, subtle: undefined });
    expect(globalThis.crypto.subtle).toBeUndefined();
    const { week } = dates();
    const http = fakeHttp();
    const original = [makeTask("a", null, 0), makeTask("b", null, 1)];
    renderBoard();
    await http.loadWeek(week, original, 0, null);
    const reorder = await startReorder(http, week, "b", "a");
    expect(reorder.body.snapshotVersion).toBe(snapshotHash(week, original));
    const reordered = ordered(original, ["b", "a"]);
    await finishReorder(reorder, reordered);
    expect(laneOrder()).toEqual(["b", "a"]);
    expect(card("b")).toHaveFocus();
    expect(card("b")).toHaveAttribute("draggable", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      /^Task order updated\.$/,
    );
    const nextReorder = await startReorder(http, week, "a", "b");
    expect(nextReorder.body.snapshotVersion).toBe(
      snapshotHash(week, reordered),
    );
    await finishReorder(nextReorder, original);
    expect(laneOrder()).toEqual(["a", "b"]);
    expect(http.matching("board", week)).toHaveLength(1);
    expect(http.matching("tasks", week)).toHaveLength(1);
  });

  it.each(["success", "conflict"] as const)(
    "does not steal focus from a remounted board when an unmounted reorder resolves with %s",
    async (outcome) => {
      const { week } = dates();
      const http = fakeHttp();
      const original = [makeTask("a", null, 0), makeTask("b", null, 1)];
      const firstMount = renderBoard();
      await http.loadWeek(week, original);
      const oldRequest = await startReorder(http, week, "b", "a");
      firstMount.unmount();
      renderBoard();
      // Reuse task IDs: an old global focus query would find these new cards.
      await http.loadWeek(week, original, 1, "remounted-version");
      card("a").focus();
      const requestsBeforeResponse = http.requests.length;
      if (outcome === "success") {
        await finishReorder(oldRequest, ordered(original, ["b", "a"]));
      } else {
        await fail(oldRequest, 409);
      }
      expect(card("a")).toHaveFocus();
      expect(laneOrder()).toEqual(["a", "b"]);
      expect(card("b")).toHaveAttribute("draggable", "true");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(http.requests).toHaveLength(requestsBeforeResponse);
    },
  );

  it.each(["success", "conflict"] as const)(
    "invalidates a pending reorder on logout before its late %s, without refetch or focus theft",
    async (outcome) => {
      const user = userEvent.setup();
      const { week } = dates();
      const http = fakeHttp();
      const original = [makeTask("a", null, 0), makeTask("b", null, 1)];
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderBoard();
      await http.loadWeek(week, original);
      const request = await startReorder(http, week, "b", "a");
      await user.click(screen.getByRole("button", { name: "Logout" }));
      expect(logoutMock).toHaveBeenCalledOnce();
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
      const logoutButton = screen.getByRole("button", { name: "Logout" });
      expect(logoutButton).toHaveFocus();
      const requestsBeforeResponse = http.requests.length;
      if (outcome === "success") {
        await finishReorder(request, ordered(original, ["b", "a"]));
      } else {
        await fail(request, 409);
      }
      expect(logoutButton).toHaveFocus();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(http.requests).toHaveLength(requestsBeforeResponse);
    },
  );
});

describe("BoardPage US3.3 authoritative order and navigation generations", () => {
  it("reconciles a 409 with a different authoritative order, explains the conflict and restores source focus", async () => {
    const { week } = dates();
    const http = fakeHttp();
    const original = [
      makeTask("a", null, 0),
      makeTask("b", null, 1),
      makeTask("c", null, 2),
    ];
    const authoritative = ordered(original, ["b", "a", "c"]);
    renderBoard();
    await http.loadWeek(week, original);

    const request = await startReorder(http, week, "c", "a");
    expect(request.body).toEqual({
      weekStartDate: week,
      dayDate: null,
      taskIds: ["c", "a", "b"],
      snapshotVersion: `snapshot-${week}-0`,
    });
    expect(laneOrder()).toEqual(["c", "a", "b"]);
    await fail(request, 409);

    const [refetchBoard, refetchTasks] = await Promise.all([
      http.pending("board", week, 1),
      http.pending("tasks", week, 1),
    ]);
    expect(card("c")).toHaveAttribute("draggable", "false");
    await succeed(refetchTasks, authoritative);
    // Promise.all must not settle the board from a partial snapshot.
    expect(laneOrder()).toEqual(["c", "a", "b"]);
    expect(
      screen.getByRole("button", { name: "Add task to shared week" }),
    ).toBeDisabled();
    await succeed(refetchBoard, {
      weekStartDate: week,
      lanes: [],
      snapshotVersion: "refetched-version",
    });

    await waitFor(() => {
      expect(laneOrder()).toEqual(["b", "a", "c"]);
      expect(screen.getByRole("status")).toHaveTextContent(
        "The board changed.",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "The latest board has been loaded.",
      );
      expect(card("c")).toHaveFocus();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Order could not be saved.",
    );
    expect(card("c")).toHaveAttribute("draggable", "true");
    expect(http.matching("tasks", week)).toHaveLength(2);
    expect(http.matching("board", week)).toHaveLength(2);
    expect(document.querySelectorAll("[data-task-reorder-id]")).toHaveLength(3);
  });

  it("ignores a late successful move after navigation without replacing the new week's tasks or focus", async () => {
    const user = userEvent.setup();
    const { week, nextWeek } = dates();
    const http = fakeHttp();
    const sourceTasks = [makeTask("moving", week, 0)];
    const newTasks = [makeTask("new-week", null, 0)];
    renderBoard();
    await http.loadWeek(week, sourceTasks);
    const request = await startMove(
      http,
      week,
      sourceTasks,
      "moving",
      lane("shared"),
    );
    expect(request.body).toMatchObject({
      sourceWeekStartDate: week,
      destinationWeekStartDate: week,
      destinationDayDate: null,
    });

    await user.click(screen.getByRole("button", { name: "Go to next week" }));
    await http.loadWeek(nextWeek, newTasks);
    const heading = screen.getByRole("heading", { level: 1 }).textContent;
    card("new-week").focus();
    const readsBeforeResponse = http.requests.filter(
      (entry) => entry.method === "GET",
    ).length;
    await succeed(
      request,
      moveResponse(week, "moving", [{ ...sourceTasks[0], dayDate: null }]),
    );

    await waitFor(() => {
      expect(laneOrder()).toEqual(["new-week"]);
      expect(card("new-week")).toHaveFocus();
      expect(screen.queryByText("Task moving")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      heading!,
    );
    expect(
      http.requests.filter((entry) => entry.method === "GET"),
    ).toHaveLength(readsBeforeResponse);
    expect(card("new-week")).toHaveAttribute("draggable", "true");
  });

  it.each([409, 500, "network"] as const)(
    "ignores a late failed reorder (%s) after navigation: no rollback, refetch, announcement or focus theft",
    async (failure) => {
      const user = userEvent.setup();
      const { week, nextWeek } = dates();
      const http = fakeHttp();
      const original = [makeTask("old-a", null, 0), makeTask("old-b", null, 1)];
      const newTasks = [
        makeTask("fresh-a", null, 0),
        makeTask("fresh-b", null, 1),
      ];
      renderBoard();
      await http.loadWeek(week, original);
      const request = await startReorder(http, week, "old-b", "old-a");
      expect(laneOrder()).toEqual(["old-b", "old-a"]);

      await user.click(screen.getByRole("button", { name: "Go to next week" }));
      await http.loadWeek(nextWeek, newTasks);
      const heading = screen.getByRole("heading", { level: 1 }).textContent;
      card("fresh-a").focus();
      const requestsBeforeResponse = http.requests.length;
      await fail(request, failure);

      await waitFor(() => {
        expect(laneOrder()).toEqual(["fresh-a", "fresh-b"]);
        expect(card("fresh-a")).toHaveFocus();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(http.requests).toHaveLength(requestsBeforeResponse);
      });
      expect(screen.queryByText("Task old-a")).not.toBeInTheDocument();
      expect(screen.queryByText("Task old-b")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        heading!,
      );
      expect(card("fresh-b")).toHaveAttribute("draggable", "true");
    },
  );

  it.each(["success", "failure"] as const)(
    "ignores an already-started conflict refetch's late %s after navigation, including its rollback fallback",
    async (refetchOutcome) => {
      const user = userEvent.setup();
      const { week, nextWeek } = dates();
      const http = fakeHttp();
      const oldTasks = [makeTask("old-a", null, 0), makeTask("old-b", null, 1)];
      const newTasks = [makeTask("new-week", null, 0)];
      renderBoard();
      await http.loadWeek(week, oldTasks);
      const request = await startReorder(http, week, "old-b", "old-a");
      await fail(request, 409);
      const [refetchBoard, refetchTasks] = await Promise.all([
        http.pending("board", week, 1),
        http.pending("tasks", week, 1),
      ]);
      expect(card("old-b")).toHaveAttribute("draggable", "false");

      await user.click(screen.getByRole("button", { name: "Go to next week" }));
      await http.loadWeek(nextWeek, newTasks);
      card("new-week").focus();
      const requestsBeforeRefetch = http.requests.length;
      if (refetchOutcome === "success") {
        await succeed(refetchTasks, ordered(oldTasks, ["old-b", "old-a"]));
        await succeed(refetchBoard, {
          weekStartDate: week,
          lanes: [],
          snapshotVersion: "old-refetched",
        });
      } else {
        await fail(refetchTasks, 500);
        await fail(refetchBoard, 500);
      }

      expect(laneOrder()).toEqual(["new-week"]);
      expect(card("new-week")).toHaveFocus();
      expect(card("new-week")).toHaveAttribute("draggable", "true");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(http.requests).toHaveLength(requestsBeforeRefetch);
      expect(http.matching("tasks", nextWeek)).toHaveLength(1);
      expect(http.matching("board", nextWeek)).toHaveLength(1);
    },
  );

  it.each(["success", "conflict"] as const)(
    "allows a new reorder after navigation and ignores the old %s while the new mutation is pending",
    async (oldOutcome) => {
      const user = userEvent.setup();
      const { week, nextWeek } = dates();
      const http = fakeHttp();
      const oldTasks = [makeTask("old-a", null, 0), makeTask("old-b", null, 1)];
      const newTasks = [makeTask("new-a", null, 0), makeTask("new-b", null, 1)];
      renderBoard();
      await http.loadWeek(week, oldTasks);
      const oldRequest = await startReorder(http, week, "old-b", "old-a");
      await user.click(screen.getByRole("button", { name: "Go to next week" }));
      await http.loadWeek(nextWeek, newTasks);
      const newRequest = await startReorder(http, nextWeek, "new-b", "new-a");
      expect(newRequest.body).toMatchObject({
        weekStartDate: nextWeek,
        taskIds: ["new-b", "new-a"],
        snapshotVersion: `snapshot-${nextWeek}-0`,
      });
      const requestsBeforeResponse = http.requests.length;
      if (oldOutcome === "success") {
        await finishReorder(oldRequest, ordered(oldTasks, ["old-b", "old-a"]));
      } else {
        await fail(oldRequest, 409);
      }

      expect(laneOrder()).toEqual(["new-b", "new-a"]);
      expect(card("new-b")).toHaveAttribute("draggable", "false");
      expect(
        screen.getByRole("button", { name: "Add task to shared week" }),
      ).toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(http.requests).toHaveLength(requestsBeforeResponse);
      await finishReorder(newRequest, ordered(newTasks, ["new-b", "new-a"]));
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          "Task order updated.",
        );
        expect(card("new-b")).toHaveFocus();
        expect(card("new-b")).toHaveAttribute("draggable", "true");
      });
      expect(laneOrder()).toEqual(["new-b", "new-a"]);
    },
  );

  it.each(["success", "conflict"] as const)(
    "preserves a settled newer reorder when the old %s arrives out of order",
    async (oldOutcome) => {
      const user = userEvent.setup();
      const { week, nextWeek } = dates();
      const http = fakeHttp();
      const oldTasks = [makeTask("old-a", null, 0), makeTask("old-b", null, 1)];
      const newTasks = [makeTask("new-a", null, 0), makeTask("new-b", null, 1)];
      renderBoard();
      await http.loadWeek(week, oldTasks);
      const oldRequest = await startReorder(http, week, "old-b", "old-a");
      await user.click(screen.getByRole("button", { name: "Go to next week" }));
      await http.loadWeek(nextWeek, newTasks);
      const newRequest = await startReorder(http, nextWeek, "new-b", "new-a");
      await finishReorder(newRequest, ordered(newTasks, ["new-b", "new-a"]));
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          "Task order updated.",
        );
        expect(card("new-b")).toHaveFocus();
      });
      const requestsBeforeResponse = http.requests.length;
      if (oldOutcome === "success") {
        await finishReorder(oldRequest, ordered(oldTasks, ["old-b", "old-a"]));
      } else {
        await fail(oldRequest, 409);
      }

      expect(laneOrder()).toEqual(["new-b", "new-a"]);
      expect(card("new-b")).toHaveFocus();
      expect(card("new-b")).toHaveAttribute("draggable", "true");
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Task order updated\.$/,
      );
      expect(http.requests).toHaveLength(requestsBeforeResponse);
      expect(document.querySelectorAll("[data-task-reorder-id]")).toHaveLength(
        2,
      );
    },
  );
});

describe("BoardPage US3.3 drop semantics, cancellation and completed presentation", () => {
  it("marks a self drop invalid with a described live status and rejects it without any API mutation", async () => {
    const { week } = dates();
    const http = fakeHttp();
    const tasks = [makeTask("self", null, 0), makeTask("other", null, 1)];
    renderBoard();
    await http.loadWeek(week, tasks);
    const source = card("self");
    const requestsBeforeDrop = http.fetchMock.mock.calls.length;
    fireEvent.dragStart(source);
    expect(fireEvent.dragOver(source)).toBe(true); // No preventDefault: not droppable.
    expect(source).toHaveAttribute("data-drop-state", "invalid");
    expect(source).toHaveClass("task-item-drop-invalid");
    expectDescribedStatus(
      source,
      "Cannot drop here. The task is already in this position.",
    );
    expect(lane("shared")).not.toHaveAttribute("data-drop-state");

    fireEvent.drop(source);
    fireEvent.dragEnd(source);
    await waitFor(() => {
      expect(source).toHaveFocus();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Cannot drop here. The task remains in its previous position.",
      );
    });
    expect(laneOrder()).toEqual(["self", "other"]);
    expect(source).not.toHaveAttribute("data-drop-state");
    expect(source).not.toHaveAttribute("aria-describedby");
    expect(http.fetchMock).toHaveBeenCalledTimes(requestsBeforeDrop);
  });

  it.each(["day", "shared"] as const)(
    "marks an empty %s lane valid and sends exactly one move when a nested empty-state drop bubbles to its section",
    async (destinationKind) => {
      const { week, tuesday } = dates();
      const http = fakeHttp();
      const sourceDay = destinationKind === "day" ? null : week;
      const destinationDay = destinationKind === "day" ? tuesday : null;
      const tasks = [makeTask("moving", sourceDay, 0)];
      renderBoard();
      await http.loadWeek(week, tasks);
      const destination = lane(destinationDay ?? "shared");
      const nestedTarget = within(destination).getByText(
        destinationKind === "day" ? "No tasks for Tuesday" : "No week tasks",
      );
      const source = card("moving");
      fireEvent.dragStart(source);
      expect(fireEvent.dragOver(nestedTarget)).toBe(false); // Valid section prevents default.
      expect(destination).toHaveAttribute("data-drop-state", "valid");
      expect(destination).toHaveClass("drop-zone-valid");
      expectDescribedStatus(destination, "Drop here at the end of this lane.");
      expect(within(destination).getAllByRole("status")).toHaveLength(1);
      expect(nestedTarget.closest("article")).not.toHaveAttribute(
        "data-drop-state",
      );
      fireEvent.drop(nestedTarget);
      fireEvent.dragEnd(source);

      await succeed(await http.pending("tasks", week, 1), tasks);
      await succeed(await http.pending("board", week, 1), {
        weekStartDate: week,
        lanes: [],
        snapshotVersion: "before-move",
      });
      const request = await http.pending("move", week);
      expect(request.init?.headers).toMatchObject({
        Authorization: "Bearer jwt-token",
        "Content-Type": "application/json",
      });
      expect(request.body).toEqual({
        sourceWeekStartDate: week,
        sourceDayDate: sourceDay,
        sourceIndex: 0,
        destinationWeekStartDate: week,
        destinationDayDate: destinationDay,
        destinationIndex: 0,
        sourceSnapshotVersion: "before-move",
        destinationSnapshotVersion: "before-move",
      });
      await succeed(
        request,
        moveResponse(week, "moving", [
          { ...tasks[0], dayDate: destinationDay },
        ]),
      );
      await waitFor(() => {
        expect(card("moving").closest("[data-lane-key]")).toBe(destination);
        expect(card("moving")).toHaveFocus();
        expect(screen.getByRole("status")).toHaveTextContent(/^Task moved\.$/);
      });
      expect(document.querySelectorAll("[data-task-reorder-id]")).toHaveLength(
        1,
      );
      expect(destination).not.toHaveAttribute("data-drop-state");
      expect(http.matching("move", week)).toHaveLength(1);
      expect(http.matching("reorder", week)).toHaveLength(0);
      expect(http.matching("tasks", week)).toHaveLength(2);
      expect(http.matching("board", week)).toHaveLength(2);
      expect(http.fetchMock).toHaveBeenCalledTimes(5);
    },
  );

  it.each(["Escape", "Cancel button"] as const)(
    "%s cancels the keyboard Move here flow, restores source-card focus and announces without mutating",
    async (cancelMethod) => {
      const user = userEvent.setup();
      const { week } = dates();
      const http = fakeHttp();
      const task = makeTask("cancel", week, 0);
      renderBoard();
      await http.loadWeek(week, [task]);
      const requestsBeforeMove = http.fetchMock.mock.calls.length;
      const trigger = screen.getByRole("button", {
        name: `More actions for ${task.title}`,
      });
      trigger.focus();
      await user.keyboard("{Enter}");
      const move = screen.getByRole("menuitem", { name: "Move" });
      move.focus();
      await user.keyboard("{Enter}");
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Move here to shared week" }),
        ).toHaveFocus();
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        `Moving “${task.title}”. Choose a destination lane.`,
      );
      expect(card(task.id)).toHaveAttribute("draggable", "false");
      if (cancelMethod === "Escape") {
        await user.keyboard("{Escape}");
      } else {
        const cancel = screen.getByRole("button", { name: "Cancel move" });
        cancel.focus();
        await user.keyboard("{Enter}");
      }

      await waitFor(() => {
        expect(card(task.id)).toHaveFocus();
        expect(screen.getByRole("status")).toHaveTextContent(
          `Move canceled for “${task.title}”.`,
        );
      });
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
      expect(
        screen.queryByRole("button", { name: /Move here to/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancel move" }),
      ).not.toBeInTheDocument();
      expect(card(task.id)).toHaveAttribute("draggable", "true");
      expect(laneOrder(week)).toEqual([task.id]);
      expect(http.fetchMock).toHaveBeenCalledTimes(requestsBeforeMove);
    },
  );

  it("Escape cancels a pointer drag, clears its valid marker, restores focus and announces", async () => {
    const user = userEvent.setup();
    const { week } = dates();
    const http = fakeHttp();
    const tasks = [makeTask("a", null, 0), makeTask("b", null, 1)];
    renderBoard();
    await http.loadWeek(week, tasks);
    const requestsBeforeDrag = http.fetchMock.mock.calls.length;
    fireEvent.dragStart(card("b"));
    fireEvent.dragOver(card("a"));
    expect(card("a")).toHaveAttribute("data-drop-state", "valid");
    expectDescribedStatus(card("a"), "Drop here before “Task a”.");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(card("b")).toHaveFocus();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Drag canceled. The task has not moved.",
      );
    });
    expect(card("a")).not.toHaveAttribute("data-drop-state");
    expect(card("a")).not.toHaveAttribute("aria-describedby");
    expect(laneOrder()).toEqual(["a", "b"]);
    expect(http.fetchMock).toHaveBeenCalledTimes(requestsBeforeDrag);
  });

  it("preserves a completed daily task's compact styling, execution time and checked reopen control through optimistic and authoritative reorder", async () => {
    const { week } = dates();
    const http = fakeHttp();
    const tasks = [
      makeTask("active", week, 0),
      makeTask("completed", week, 1, {
        status: "Completed",
        executionTime: "09:30",
        notes: "Hidden completed notes",
      }),
    ];
    renderBoard();
    await http.loadWeek(week, tasks);

    function expectCompletedPresentation() {
      const completed = card("completed");
      expect(completed).toHaveClass("task-item-completed");
      expect(within(completed).getByText("Task completed")).toHaveClass(
        "task-title-completed",
      );
      expect(within(completed).getByText("Task completed")).toBeVisible();
      const time = within(completed).getByText("09:30");
      expect(time.tagName).toBe("TIME");
      expect(time).toHaveAttribute("datetime", "09:30");
      expect(time).toHaveClass("task-execution-time");
      expect(
        Array.from(completed.querySelector(".task-title-row")!.children).map(
          (child) => child.textContent,
        ),
      ).toEqual(["09:30", "Task completed"]);
      expect(
        within(completed).getByRole("checkbox", {
          name: /^Task \d+: Mark as not done Task completed$/,
        }),
      ).toBeChecked();
      expect(within(completed).getByRole("checkbox")).toBeVisible();
      expect(completed.querySelector(".task-description")).toBeNull();
      expect(completed.closest("[data-lane-key]")).toBe(lane(week));
      expect(card("active")).not.toHaveClass("task-item-completed");
      expect(within(card("active")).getByRole("checkbox")).not.toBeChecked();
    }

    expectCompletedPresentation();
    const request = await startReorder(http, week, "completed", "active");
    expect(laneOrder(week)).toEqual(["completed", "active"]);
    expectCompletedPresentation();
    expect(within(card("completed")).getByRole("checkbox")).toBeDisabled();
    await finishReorder(request, ordered(tasks, ["completed", "active"]), week);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Task order updated\.$/,
      );
      expect(card("completed")).toHaveFocus();
      expect(within(card("completed")).getByRole("checkbox")).toBeEnabled();
    });
    expectCompletedPresentation();
    expect(laneOrder(week)).toEqual(["completed", "active"]);
    expect(document.querySelectorAll("[data-task-reorder-id]")).toHaveLength(2);
    expect(http.matching("reorder", week)).toHaveLength(1);
    expect(http.requests.filter((entry) => entry.method !== "GET")).toEqual([
      request,
    ]);
    expect(http.fetchMock).toHaveBeenCalledTimes(3);
  });
});
