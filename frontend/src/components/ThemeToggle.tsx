"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export default function ThemeToggle({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "rail";
}) {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const dark = mounted ? theme === "dark" : false;
  const label = mounted
    ? dark
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle color theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className={cn(
        "relative inline-flex size-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-full transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
        variant === "rail"
          ? "text-rail-foreground/80 hover:bg-white/15 hover:scale-105 hover:text-rail-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <span className="relative size-4 flex items-center justify-center overflow-hidden">
        <Sun
          className={cn(
            "absolute size-4 transition-all duration-200 ease-out",
            mounted && dark
              ? "rotate-0 scale-100 opacity-100"
              : mounted && !dark
              ? "-rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-70"
          )}
          aria-hidden
        />
        <Moon
          className={cn(
            "absolute size-4 transition-all duration-200 ease-out",
            mounted && dark
              ? "rotate-90 scale-0 opacity-0"
              : mounted && !dark
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-0 scale-0 opacity-0"
          )}
          aria-hidden
        />
      </span>
    </button>
  );
}
