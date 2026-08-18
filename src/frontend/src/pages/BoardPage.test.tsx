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

function buildBoardResponseFromUrl(input: string): Response {
  const url = new URL(input);
  const weekStartDate = url.searchParams.get("week_start_date") ?? "";

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
    vi.restoreAllMocks();
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

    expect(initialTitle).toContain("Board - Week of");

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
});
