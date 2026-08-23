import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getCurrentUser, login as loginRequest } from "../api/auth";
import { AuthContext } from "./auth-context";
import { clearToken, getToken, saveToken } from "../lib/session";

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [isInitializing, setIsInitializing] = useState(() => Boolean(token));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    getCurrentUser(token)
      .then((currentUsername) => {
        setUsername(currentUsername);
        setIsAuthenticated(true);
      })
      .catch(() => {
        clearToken();
        setToken(null);
        setIsAuthenticated(false);
        setUsername(null);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [token]);

  const login = useCallback(async (inputUsername: string, password: string) => {
    const result = await loginRequest({ username: inputUsername, password });
    saveToken(result.token);
    setToken(result.token);
    setUsername(result.username);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUsername(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isInitializing,
      token,
      username,
      login,
      logout,
    }),
    [isAuthenticated, isInitializing, login, logout, token, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
