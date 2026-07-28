import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { WeekLayout } from "../features/board/components";
import {
  useWeekCalculation,
  formatWeekDisplay,
} from "../features/board/hooks/useWeekCalculation";

export function BoardPage() {
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const { weekStart, weekEnd } = useWeekCalculation();
  const weekDisplay = formatWeekDisplay(weekStart, weekEnd);

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
        <h1>Board - Week of {weekDisplay}</h1>
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
