import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateOnly, getBoardForWeek } from "../api/board";
import { useAuth } from "../auth/useAuth";
import { WeekLayout } from "../features/board/components";
import {
  useWeekCalculation,
  formatWeekDisplay,
  shiftDateByDays,
} from "../features/board/hooks/useWeekCalculation";
import { getToken } from "../lib/session";

export function BoardPage() {
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const token = getToken();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { weekStart, weekEnd } = useWeekCalculation(selectedDate);
  const weekStartDateParam = formatDateOnly(weekStart);
  const weekDisplay = formatWeekDisplay(weekStart, weekEnd);

  useEffect(() => {
    if (!token) {
      return;
    }

    const sessionToken = token;
    let isCurrentRequest = true;
    const weekStartDate = new Date(`${weekStartDateParam}T00:00:00`);

    async function loadBoardWeek() {
      try {
        await getBoardForWeek(sessionToken, weekStartDate);
        if (!isCurrentRequest) {
          return;
        }
        // Board data loaded successfully
      } catch (error: unknown) {
        if (!isCurrentRequest) {
          return;
        }
        // Error loading board data - will be displayed by backend error boundaries if needed
      }
    }

    void loadBoardWeek();

    return () => {
      isCurrentRequest = false;
    };
  }, [token, weekStartDateParam]);

  function handlePreviousWeek() {
    // Functional updates ensure rapid clicks apply in order without stale state.
    setSelectedDate((current) => shiftDateByDays(current, -7));
  }

  function handleNextWeek() {
    // Functional updates ensure rapid clicks apply in order without stale state.
    setSelectedDate((current) => shiftDateByDays(current, 7));
  }

  function handleCurrentWeek() {
    // Return to the actual current week.
    setSelectedDate(new Date());
  }

  function handleLogout() {
    const confirmed = window.confirm("Are you sure you want to log out?");
    if (!confirmed) {
      return;
    }

    logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div className="topbar-title-nav">
          <h1>{weekDisplay}</h1>
          <div className="week-nav" role="group" aria-label="Week navigation">
            <button
              type="button"
              onClick={handlePreviousWeek}
              aria-label="Go to previous week"
              title="Previous Week"
              className="nav-arrow-btn"
            >
              ◄
            </button>
            <button
              type="button"
              onClick={handleCurrentWeek}
              aria-label="Go to current week"
              title="Actual Week"
              className="nav-arrow-btn nav-square-btn"
            >
              ■
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="Go to next week"
              title="Next Week"
              className="nav-arrow-btn"
            >
              ►
            </button>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="muted">Signed in as {username ?? "unknown"}</span>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <WeekLayout weekStart={weekStart} weekEnd={weekEnd} />
    </main>
  );
}
