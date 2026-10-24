import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateOnly, type TaskPayload } from "../api/board";
import {
  getWeekRange,
  shiftDateByDays,
} from "../features/board/hooks/useWeekCalculation";
import { BoardPage } from "./BoardPage";

// Exercise the real page, editor and API adapter; only external boundaries are mocked.
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

function dates() {
  const monday = getWeekRange(new Date()).weekStart;
  return {
    week: formatDateOnly(monday),
    tuesday: formatDateOnly(shiftDateByDays(monday, 1)),
    wednesday: formatDateOnly(shiftDateByDays(monday, 2)),
    thursday: formatDateOnly(shiftDateByDays(monday, 3)),
  };
}

function makeTask(
  id: string,
  dayDate: string | null,
  overrides: Partial<TaskPayload> = {},
): TaskPayload {
  return {
    id,
    weekWorkspaceId: "workspace-id",
    dayDate,
    orderIndex: 0,
    title: "Original day task",
    notes: "Original notes",
    status: "Not Started",
    executionTime: "08:30",
    createdAtUtc: "2026-08-26T10:00:00Z",
    updatedAtUtc: "2026-08-26T10:00:00Z",
    ...overrides,
  };
}

const draft = {
  title: "Converted daily task",
  notes: "Keep this conversion draft",
  status: "In Progress" as const,
  executionTime: "10:15",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface RecordedRequest {
  url: URL;
  method: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function fakeHttp(original: TaskPayload, failFirstConversion = false) {
  const { week, tuesday, wednesday, thursday } = dates();
  const shared = makeTask("shared-task", null, {
    title: "Unrelated shared task",
    notes: null,
    executionTime: "",
  });
  const sibling = makeTask("source-sibling", original.dayDate, {
    title: "Unrelated day task",
    orderIndex: 1,
    executionTime: "12:00",
  });
  // Model both server identity rules independently of the request payload.
  const retainedDate = [tuesday, wednesday, thursday].includes(
    original.dayDate!,
  )
    ? original.dayDate
    : tuesday;
  const batch = [tuesday, wednesday, thursday].map((dayDate, index) =>
    makeTask(
      dayDate === retainedDate ? original.id : `batch-${index}`,
      dayDate,
      {
        ...draft,
        createdAtUtc: original.createdAtUtc,
      },
    ),
  );
  let storedTasks = [original, sibling, shared];
  let conversionAttempts = 0;
  const requests: RecordedRequest[] = [];

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL
        ? String(input)
        : input.url,
    );
    const method = init?.method ?? "GET";
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : {};
    requests.push({ url, method, headers: new Headers(init?.headers), body });

    if (method === "GET" && url.pathname.endsWith("/board")) {
      return jsonResponse({
        data: { weekStartDate: week, lanes: [], snapshotVersion: "snapshot-1" },
      });
    }
    if (method === "GET" && url.pathname.endsWith("/tasks")) {
      return jsonResponse({ data: storedTasks });
    }
    if (
      method === "POST" &&
      url.pathname.endsWith(`/tasks/${original.id}/recurring`)
    ) {
      conversionAttempts += 1;
      if (failFirstConversion && conversionAttempts === 1) {
        return jsonResponse(
          {
            error: {
              code: "task.conversion.failed",
              message: "Conversion failed. Try again.",
            },
          },
          500,
        );
      }
      storedTasks = [...batch, sibling, shared];
      return jsonResponse(
        {
          data: {
            createdCount: batch.length,
            tasks: batch,
            affectedWeekStartDates: [week],
          },
        },
        201,
      );
    }
    if (method === "PUT" && url.pathname.endsWith(`/tasks/${original.id}`)) {
      // Let the old buggy route complete too: assertions must reject PUT,
      // rather than pass because an unhandled mock request threw an error.
      const updated = { ...original, ...body } as TaskPayload;
      storedTasks = [updated, sibling, shared];
      return jsonResponse({ data: updated });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  return {
    requests,
    batch,
    shared,
    sibling,
    mutations: () => requests.filter((request) => request.method !== "GET"),
    taskReads: () =>
      requests.filter(
        (request) =>
          request.method === "GET" && request.url.pathname.endsWith("/tasks"),
      ),
  };
}

function lane(key: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `section[data-lane-key="${key}"]`,
  );
  expect(element, `Expected lane ${key}`).not.toBeNull();
  return element!;
}

function card(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-task-reorder-id="${id}"]`,
  );
  expect(element, `Expected task card ${id}`).not.toBeNull();
  return element!;
}

function laneIds(key: string) {
  return Array.from(
    lane(key).querySelectorAll<HTMLElement>("[data-task-reorder-id]"),
  ).map((element) => element.dataset.taskReorderId);
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  render(
    <MemoryRouter>
      <BoardPage />
    </MemoryRouter>,
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Task 1: Edit task: Original day task",
    }),
  );
  return within(screen.getByRole("dialog", { name: "Edit task" }));
}

async function fillConversion(
  user: ReturnType<typeof userEvent.setup>,
  editor: ReturnType<typeof within>,
) {
  await user.clear(editor.getByLabelText("Title"));
  await user.type(editor.getByLabelText("Title"), draft.title);
  await user.clear(editor.getByLabelText("Notes"));
  await user.type(editor.getByLabelText("Notes"), draft.notes);
  await user.clear(editor.getByLabelText("Execution time"));
  await user.type(editor.getByLabelText("Execution time"), draft.executionTime);
  await user.selectOptions(editor.getByLabelText("Status"), draft.status);
  await user.click(editor.getByRole("checkbox", { name: "Recurring task" }));
  fireEvent.change(editor.getByLabelText("Start date"), {
    target: { value: dates().tuesday },
  });
  fireEvent.change(editor.getByLabelText("End date"), {
    target: { value: dates().thursday },
  });
}

function expectConversionRequest(request: RecordedRequest, taskId: string) {
  expect(request.method).toBe("POST");
  expect(request.url.pathname).toMatch(
    new RegExp(`/tasks/${taskId}/recurring$`),
  );
  expect(request.headers.get("Authorization")).toBe("Bearer jwt-token");
  expect(request.headers.get("Content-Type")).toBe("application/json");
  expect(request.headers.get("Idempotency-Key")).toEqual(expect.any(String));
  expect(request.headers.get("Idempotency-Key")?.trim().length).toBeGreaterThan(
    0,
  );
  expect(request.body).toEqual({
    weekStartDate: dates().week,
    startDate: dates().tuesday,
    endDate: dates().thursday,
    ...draft,
  });
}

async function expectConvertedBoard(http: ReturnType<typeof fakeHttp>) {
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: "Edit task" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("3 tasks in recurring batch.")).toBeInTheDocument();
  });
  expect(http.taskReads()).toHaveLength(2);
  expect(http.taskReads()[1].url.searchParams.get("weekStartDate")).toBe(
    dates().week,
  );
  expect(http.requests.indexOf(http.taskReads()[1])).toBeGreaterThan(
    http.requests.indexOf(http.mutations().at(-1)!),
  );
  for (const task of http.batch) {
    expect(laneIds(task.dayDate!)).toContain(task.id);
    expect(card(task.id)).toHaveTextContent(draft.title);
    expect(card(task.id)).toHaveTextContent(draft.executionTime);
  }
  expect(laneIds("shared")).toEqual([http.shared.id]);
  expect(laneIds(http.sibling.dayDate!)).toContain(http.sibling.id);
  expect(card(http.sibling.id)).toHaveTextContent("Unrelated day task");
  expect(card(http.sibling.id)).toHaveTextContent("12:00");
  expect(document.querySelectorAll("[data-task-reorder-id]")).toHaveLength(5);
}

describe("BoardPage normal task conversion to recurring", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("POSTs conversion, refetches tasks and places the original ID on range start when its date is outside the range, never in shared week", async () => {
    const user = userEvent.setup();
    const original = makeTask("original-task", dates().week);
    const http = fakeHttp(original);
    const editor = await openEditor(user);
    await fillConversion(user, editor);

    await user.click(editor.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(http.mutations()).toHaveLength(1));
    expectConversionRequest(http.mutations()[0], original.id);
    await expectConvertedBoard(http);
    expect(laneIds(dates().tuesday)).toContain(original.id);
    expect(laneIds(dates().week)).not.toContain(original.id);
    expect(laneIds("shared")).not.toContain(original.id);
    expect(http.mutations()).toHaveLength(1);
  });

  it("keeps the original ID on its existing date when that date is inside the range returned by the server", async () => {
    const user = userEvent.setup();
    const original = makeTask("original-task", dates().wednesday);
    const http = fakeHttp(original);
    const editor = await openEditor(user);
    await fillConversion(user, editor);

    await user.click(editor.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(http.mutations()).toHaveLength(1));
    expectConversionRequest(http.mutations()[0], original.id);
    await expectConvertedBoard(http);
    expect(laneIds(dates().wednesday)).toContain(original.id);
    expect(laneIds(dates().tuesday)).not.toContain(original.id);
    expect(laneIds("shared")).not.toContain(original.id);
    expect(http.mutations()).toHaveLength(1);
  });

  it("retains original placement/time and the full draft/range after a 500, then retries POST with the same idempotency key and accepts 201", async () => {
    const user = userEvent.setup();
    const original = makeTask("original-task", dates().week);
    const http = fakeHttp(original, true);
    const editor = await openEditor(user);
    await fillConversion(user, editor);

    await user.click(editor.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(http.mutations()).toHaveLength(1));
    const firstRequest = http.mutations()[0];
    expectConversionRequest(firstRequest, original.id);
    expect(await editor.findByRole("alert")).toHaveTextContent(
      "Conversion failed. Try again.",
    );
    expect(editor.getByLabelText("Title")).toHaveValue(draft.title);
    expect(editor.getByLabelText("Notes")).toHaveValue(draft.notes);
    expect(editor.getByLabelText("Status")).toHaveValue(draft.status);
    expect(editor.getByLabelText("Execution time")).toHaveValue(
      draft.executionTime,
    );
    expect(
      editor.getByRole("checkbox", { name: "Recurring task" }),
    ).toBeChecked();
    expect(editor.getByLabelText("Start date")).toHaveValue(dates().tuesday);
    expect(editor.getByLabelText("End date")).toHaveValue(dates().thursday);
    expect(laneIds(dates().week)).toContain(original.id);
    expect(laneIds("shared")).not.toContain(original.id);
    expect(card(original.id)).toHaveTextContent(original.title);
    expect(card(original.id)).toHaveTextContent(original.executionTime);
    expect(card(original.id)).not.toHaveTextContent(draft.title);
    expect(card(original.id)).not.toHaveTextContent(draft.executionTime);
    expect(document.querySelectorAll("[data-task-reorder-id]")).toHaveLength(3);
    expect(http.taskReads()).toHaveLength(1);
    expect(
      screen.queryByText("3 tasks in recurring batch."),
    ).not.toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(http.mutations()).toHaveLength(2));
    const retry = http.mutations()[1];
    expectConversionRequest(retry, original.id);
    expect(retry.headers.get("Idempotency-Key")).toBe(
      firstRequest.headers.get("Idempotency-Key"),
    );
    expect(retry.body).toEqual(firstRequest.body);
    await expectConvertedBoard(http);
    expect(http.mutations()).toHaveLength(2);
  });

  it("still PUTs exactly one task for an ordinary edit with recurring unchecked", async () => {
    const user = userEvent.setup();
    const original = makeTask("original-task", dates().week);
    const http = fakeHttp(original);
    const editor = await openEditor(user);
    expect(
      editor.getByRole("checkbox", { name: "Recurring task" }),
    ).not.toBeChecked();
    await user.clear(editor.getByLabelText("Title"));
    await user.type(editor.getByLabelText("Title"), "Edited single task");

    await user.click(editor.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Edit task" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Task updated.")).toBeInTheDocument();
    });
    expect(http.mutations()).toHaveLength(1);
    const request = http.mutations()[0];
    expect(request.method).toBe("PUT");
    expect(request.url.pathname).toMatch(/\/tasks\/original-task$/);
    expect(request.headers.get("Authorization")).toBe("Bearer jwt-token");
    expect(request.body).toEqual({
      weekStartDate: dates().week,
      title: "Edited single task",
      dayDate: original.dayDate,
      notes: original.notes,
      status: original.status,
      executionTime: original.executionTime,
    });
    expect(http.taskReads()).toHaveLength(2);
    expect(card(original.id)).toHaveTextContent("Edited single task");
    expect(card(original.id)).toHaveTextContent(original.executionTime);
    expect(laneIds(dates().week)).toEqual([original.id, http.sibling.id]);
    expect(laneIds("shared")).toEqual([http.shared.id]);
    expect(document.querySelectorAll("[data-task-reorder-id]")).toHaveLength(3);
  });
});
