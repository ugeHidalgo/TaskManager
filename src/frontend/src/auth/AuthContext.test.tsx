import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";

const getCurrentUserMock = vi.fn<(token: string) => Promise<string>>();
const loginApiMock = vi.fn<
  (payload: { username: string; password: string }) => Promise<{
    token: string;
    expiresAtUtc: string;
    username: string;
  }>
>();

vi.mock("../api/auth", () => ({
  getCurrentUser: (token: string) => getCurrentUserMock(token),
  login: (payload: { username: string; password: string }) =>
    loginApiMock(payload),
}));

function Probe() {
  const auth = useAuth();

  return (
    <>
      <p data-testid="auth-state">{auth.isAuthenticated ? "yes" : "no"}</p>
      <p data-testid="auth-user">{auth.username ?? "none"}</p>
      <p data-testid="auth-token">{auth.token ?? "none"}</p>
      <button
        type="button"
        onClick={() => void auth.login("admin", "Admin123!")}
      >
        Login
      </button>
      <button type="button" onClick={() => auth.logout()}>
        Logout
      </button>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue("admin");
  });

  it("restores session from sessionStorage on app load", async () => {
    window.sessionStorage.setItem("taskmanager.jwt", "token-123");
    getCurrentUserMock.mockResolvedValueOnce("admin");

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent("yes");
    });

    expect(screen.getByTestId("auth-user")).toHaveTextContent("admin");
    expect(screen.getByTestId("auth-token")).toHaveTextContent("token-123");
  });

  it("clears session storage and auth state on logout", async () => {
    const user = userEvent.setup();
    loginApiMock.mockResolvedValueOnce({
      token: "token-logout",
      expiresAtUtc: "2026-08-23T10:00:00Z",
      username: "admin",
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(window.sessionStorage.getItem("taskmanager.jwt")).toBe(
        "token-logout",
      );
    });

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(window.sessionStorage.getItem("taskmanager.jwt")).toBeNull();
    expect(screen.getByTestId("auth-state")).toHaveTextContent("no");
    expect(screen.getByTestId("auth-user")).toHaveTextContent("none");
  });
});
