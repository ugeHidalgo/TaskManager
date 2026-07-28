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
  const [isInitializing, setIsInitializing] = useState(() =>
    Boolean(getToken()),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
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
        setIsAuthenticated(false);
        setUsername(null);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  const login = useCallback(async (inputUsername: string, password: string) => {
    const result = await loginRequest({ username: inputUsername, password });
    saveToken(result.token);
    setUsername(result.username);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUsername(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isInitializing,
      username,
      login,
      logout,
    }),
    [isAuthenticated, isInitializing, login, logout, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
