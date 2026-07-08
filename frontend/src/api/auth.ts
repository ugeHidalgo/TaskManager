export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  expiresAtUtc: string;
  username: string;
}

interface ApiSuccess<T> {
  data: T;
}

interface ApiError {
  error?: {
    code?: string;
    message?: string;
  };
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function login(payload: LoginPayload): Promise<LoginResult> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Login failed. Please verify your credentials.";

    try {
      const body = (await response.json()) as ApiError;
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Keep generic fallback if the server does not return JSON.
    }

    throw new Error(message);
  }

  const body = (await response.json()) as ApiSuccess<LoginResult>;
  return body.data;
}

export async function getCurrentUser(token: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Session expired");
  }

  const body = (await response.json()) as ApiSuccess<{ username: string }>;
  return body.data.username;
}
