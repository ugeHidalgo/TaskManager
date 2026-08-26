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
}

export interface TaskPayload {
  id: string;
  weekWorkspaceId: string;
  dayDate: string | null;
  title: string;
  notes: string | null;
  status: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface SaveTaskInput {
  weekStartDate: string;
  title: string;
  dayDate: string | null;
  notes: string | null;
  status: string;
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
  input: SaveTaskInput,
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
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
