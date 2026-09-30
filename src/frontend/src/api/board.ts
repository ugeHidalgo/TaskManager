const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

interface ApiSuccess<T> {
  data: T;
}

interface ApiError {
  error?: {
    message?: string;
  };
}

export interface BoardPayload {
  weekStartDate: string;
  lanes: unknown[];
  snapshotVersion: string;
}

export interface TaskPayload {
  id: string;
  weekWorkspaceId: string;
  dayDate: string | null;
  orderIndex?: number;
  title: string;
  notes: string | null;
  status: string;
  executionTime: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ReorderTasksInput {
  weekStartDate: string;
  dayDate: string | null;
  taskIds: string[];
}

export interface ReorderedTaskLanePayload {
  weekStartDate: string;
  dayDate: string | null;
  tasks: TaskPayload[];
}

export interface MoveTaskRequest {
  sourceWeekStartDate: string;
  sourceDayDate: string | null;
  sourceIndex: number;
  destinationWeekStartDate: string;
  destinationDayDate: string | null;
  destinationIndex: number;
  sourceSnapshotVersion: string;
  destinationSnapshotVersion: string | null;
}

export interface WeekTaskSnapshot {
  weekStartDate: string;
  snapshotVersion: string;
  tasks: TaskPayload[];
}

export interface MoveTaskResponse {
  taskId: string;
  source: WeekTaskSnapshot;
  destination: WeekTaskSnapshot;
}

export interface SaveTaskInput {
  weekStartDate: string;
  title: string;
  dayDate: string | null;
  notes: string | null;
  status: string;
  executionTime: string;
  isRecurring?: boolean;
  startDate?: string;
  endDate?: string;
  idempotencyKey?: string;
}

export interface RecurringTasksResponse {
  createdCount: number;
  tasks: TaskPayload[];
  affectedWeekStartDates: string[];
}

export function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getBoardForWeek(
  token: string,
  weekStartDate: Date,
): Promise<BoardPayload> {
  const weekStartDateValue = formatDateOnly(weekStartDate);
  const url = `${apiBaseUrl}/board?week_start_date=${encodeURIComponent(weekStartDateValue)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = "Could not load board data for the selected week.";

    try {
      const body = (await response.json()) as ApiError;
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Keep fallback message when response is not JSON.
    }

    throw new Error(message);
  }

  const body = (await response.json()) as ApiSuccess<BoardPayload>;
  return body.data;
}

export async function getTasksForWeek(
  token: string,
  weekStartDate: Date,
): Promise<TaskPayload[]> {
  const weekStartDateValue = formatDateOnly(weekStartDate);
  const url = `${apiBaseUrl}/tasks?weekStartDate=${encodeURIComponent(weekStartDateValue)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = "Could not load tasks for the selected week.";

    try {
      const body = (await response.json()) as ApiError;
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Keep fallback message when response is not JSON.
    }

    throw new Error(message);
  }

  const body = (await response.json()) as ApiSuccess<TaskPayload[]>;
  return body.data;
}

async function saveTaskRequest<T>(
  url: string,
  method: string,
  token: string,
  input: object,
  idempotencyKey?: string,
) {
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = "Could not save the task.";

    try {
      const body = (await response.json()) as ApiError;
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Keep fallback message when response is not JSON.
    }

    throw new Error(message);
  }

  const body = (await response.json()) as ApiSuccess<T>;
  return body.data;
}

export function createTask(
  token: string,
  input: SaveTaskInput,
): Promise<TaskPayload> {
  return saveTaskRequest<TaskPayload>(
    `${apiBaseUrl}/tasks`,
    "POST",
    token,
    input,
  );
}

export function createRecurringTasks(
  token: string,
  input: SaveTaskInput,
): Promise<RecurringTasksResponse> {
  const { startDate, endDate, title, notes, status, executionTime } = input;
  return saveTaskRequest<RecurringTasksResponse>(
    `${apiBaseUrl}/tasks/recurring`,
    "POST",
    token,
    {
      startDate: startDate!,
      endDate: endDate!,
      title,
      notes,
      status,
      executionTime,
    },
    input.idempotencyKey,
  );
}

export function updateTask(
  token: string,
  taskId: string,
  input: SaveTaskInput,
): Promise<TaskPayload> {
  return saveTaskRequest<TaskPayload>(
    `${apiBaseUrl}/tasks/${encodeURIComponent(taskId)}`,
    "PUT",
    token,
    input,
  );
}

export async function reorderTasks(
  token: string,
  input: ReorderTasksInput,
): Promise<ReorderedTaskLanePayload> {
  return saveTaskRequest<ReorderedTaskLanePayload>(
    `${apiBaseUrl}/tasks/reorder`,
    "PUT",
    token,
    input,
  );
}

export async function moveTask(
  token: string,
  taskId: string,
  input: MoveTaskRequest,
): Promise<MoveTaskResponse> {
  return saveTaskRequest<MoveTaskResponse>(
    `${apiBaseUrl}/tasks/${encodeURIComponent(taskId)}/move`,
    "POST",
    token,
    input,
  );
}

export async function deleteTask(
  token: string,
  taskId: string,
  weekStartDate: string,
): Promise<void> {
  const url = `${apiBaseUrl}/tasks/${encodeURIComponent(taskId)}?weekStartDate=${encodeURIComponent(weekStartDate)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = "Could not delete the task.";

    try {
      const body = (await response.json()) as ApiError;
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Keep fallback message when response is not JSON.
    }

    throw new Error(message);
  }
}
