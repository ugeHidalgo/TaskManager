import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function BoardPage() {
  const navigate = useNavigate();
  const { username, logout } = useAuth();

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
        <h1>Weekly Board</h1>
        <div className="topbar-actions">
          <span className="muted">Signed in as {username ?? "unknown"}</span>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="card">
        <h2>Board baseline ready</h2>
        <p className="muted">
          Story 1.1 authentication baseline is active. Next story will add the
          Monday-Friday board layout.
        </p>
      </section>
    </main>
  );
}
