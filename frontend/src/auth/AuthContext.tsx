import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getCurrentUser, login as loginRequest } from "../api/auth";
import { clearToken, getToken, saveToken } from "../lib/session";

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitializing: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsInitializing(false);
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
