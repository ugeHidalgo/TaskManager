import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const loginMock =
  vi.fn<(username: string, password: string) => Promise<void>>();

vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isInitializing: false,
    token: null,
    username: null,
    login: loginMock,
    logout: vi.fn(),
  }),
}));

describe("LoginPage", () => {
  it("shows validation error when required fields are empty", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("Username"));
    await user.clear(screen.getByLabelText("Password"));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      screen.getByText("Username and password are required."),
    ).toBeInTheDocument();
  });

  it("redirects to board after successful login by default", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValueOnce();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/board" element={<div>Board destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Board destination")).toBeInTheDocument();
    });
  });

  it("redirects to preserved protected route after successful login", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValueOnce();

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: {
              from: { pathname: "/board" },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/board" element={<div>Protected destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Protected destination")).toBeInTheDocument();
    });
  });

  it("shows api error when login fails", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(new Error("Invalid username or password."));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(
        screen.getByText("Invalid username or password."),
      ).toBeInTheDocument();
    });
  });
});
