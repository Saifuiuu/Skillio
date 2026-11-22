"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  createdAt: number;
  duration: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4500;
const ERROR_DURATION = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const isHoveredRef = useRef(false);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    const existing = timeoutsRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      if (timeoutsRef.current.has(id)) {
        clearTimeout(timeoutsRef.current.get(id)!);
      }
      const timeout = setTimeout(() => {
        dismiss(id);
      }, duration);
      timeoutsRef.current.set(id, timeout);
    },
    [dismiss]
  );

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const duration = type === "error" ? ERROR_DURATION : DEFAULT_DURATION;

      const newToast: ToastItem = {
        id,
        type,
        message,
        title,
        createdAt: Date.now(),
        duration,
      };

      setToasts((prev) => {
        const next = [...prev, newToast];
        if (next.length > MAX_TOASTS) {
          const removed = next.slice(0, next.length - MAX_TOASTS);
          removed.forEach((t) => {
            const timeout = timeoutsRef.current.get(t.id);
            if (timeout) {
              clearTimeout(timeout);
              timeoutsRef.current.delete(t.id);
            }
          });
          return next.slice(-MAX_TOASTS);
        }
        return next;
      });

      if (!isHoveredRef.current) {
        scheduleDismiss(id, duration);
      }
    },
    [scheduleDismiss]
  );

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    const now = Date.now();
    toasts.forEach((t) => {
      const elapsed = now - t.createdAt;
      const remaining = Math.max(1500, t.duration - elapsed);
      scheduleDismiss(t.id, remaining);
    });
  }, [toasts, scheduleDismiss]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const hasError = toasts.some((t) => t.type === "error");

  const toast = useMemo(
    () => ({
      success: (msg: string, title?: string) => addToast("success", msg, title),
      error: (msg: string, title?: string) => addToast("error", msg, title),
      info: (msg: string, title?: string) => addToast("info", msg, title),
    }),
    [addToast]
  );

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 && (
        <div
          role="region"
          aria-label="Notifications"
          aria-live={hasError ? "assertive" : "polite"}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="pointer-events-none fixed z-[9999] flex flex-col gap-2.5 max-w-sm w-full p-4 bottom-0 inset-x-0 sm:bottom-auto sm:top-18 sm:right-6 sm:inset-x-auto"
        >
          {toasts.map((item) => (
            <div
              key={item.id}
              role={item.type === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto relative flex items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all duration-200",
                "bg-card/95 text-card-foreground border-border",
                item.type === "success" && "border-emerald-500/30",
                item.type === "error" && "border-destructive/30",
                item.type === "info" && "border-brand/30"
              )}
            >
              <div className="shrink-0 pt-0.5">
                {item.type === "success" && (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                )}
                {item.type === "error" && (
                  <AlertCircle className="size-4 text-destructive" />
                )}
                {item.type === "info" && (
                  <Info className="size-4 text-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0 pr-2">
                {item.title && (
                  <p className="text-xs font-semibold text-foreground tracking-tight">
                    {item.title}
                  </p>
                )}
                <p className="text-xs text-foreground/90 leading-relaxed break-words">
                  {item.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="shrink-0 -mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
