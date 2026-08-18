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
