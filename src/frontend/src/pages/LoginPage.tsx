import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
}

function resolvePostLoginPath(state: LoginLocationState | null): string {
  const path = state?.from?.pathname;
  if (!path || path === "/login") {
    return "/board";
  }

  return path;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();
  const postLoginPath = resolvePostLoginPath(
    (location.state as LoginLocationState | null) ?? null,
  );

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin123!");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(postLoginPath, { replace: true });
    }
  }, [isAuthenticated, navigate, postLoginPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login(username, password);
      navigate(postLoginPath, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Login failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="screen centered">
      <section className="card auth-card" aria-labelledby="login-title">
        <h1 id="login-title">TaskManager Login</h1>
        <p className="muted">Sign in to access your weekly planning board.</p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />

          <div className="password-label-row">
            <label htmlFor="password">Password</label>
            <label className="password-toggle" htmlFor="show-password">
              <input
                id="show-password"
                name="show-password"
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              />
              <span
                className="password-toggle-icon"
                title={showPassword ? "Hide password" : "Show password"}
                aria-hidden="true"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" role="img">
                    <path d="M1.5 12C2.7 8.7 6.8 5 12 5s9.3 3.7 10.5 7C21.3 15.3 17.2 19 12 19S2.7 15.3 1.5 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" role="img">
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11.7 11.7 0 0 1 12 5c5.2 0 9.3 3.7 10.5 7a11.8 11.8 0 0 1-3.1 4.6M6.2 6.2A11.8 11.8 0 0 0 1.5 12c1.2 3.3 5.3 7 10.5 7 1 0 2-.1 2.9-.4" />
                  </svg>
                )}
              </span>
            </label>
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
