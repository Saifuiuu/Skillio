"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchMe, logout as apiLogout, ApiError, type User } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isLoggingOutRef = useRef(false);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser().then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [refreshUser]);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await apiLogout();
      if (typeof window !== "undefined") {
        window.location.replace("/login?loggedOut=1");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        if (typeof window !== "undefined") {
          window.location.replace("/login?loggedOut=1");
        }
        return;
      }
      toast.error("Could not log out. Check your connection and try again.");
    } finally {
      isLoggingOutRef.current = false;
    }
  }, [toast]);

  return (
    <AuthContext.Provider
      value={{ user, loading, refreshUser, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
