"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LogOut, LayoutDashboard } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  user: {
    email: string;
    role: Role;
    name?: string;
    avatarUrl?: string | null;
  };
  onLogout?: () => void;
  className?: string;
};

export default function UserMenu({ user, onLogout, className }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  // Close on Escape and return focus to avatar button
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      if (!open) {
        e.preventDefault();
        setOpen(true);
      }
    }
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleButtonKeyDown}
        className="group relative flex size-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-full transition-all duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:ring-2 hover:ring-ring/50"
      >
        <Avatar
          email={user.email}
          name={user.name}
          avatarUrl={user.avatarUrl}
          size={36}
          className="transition-transform duration-150 group-hover:scale-105"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User account actions"
          aria-orientation="vertical"
          className="menu-animate-in absolute right-0 mt-2 w-60 rounded-2xl border border-border bg-card p-2 shadow-xl z-50 focus:outline-none"
        >
          {/* User info */}
          <div className="px-3 py-2 border-b border-border/60 mb-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.email}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                {user.role}
              </span>
            </div>
          </div>

          {/* Mobile dashboard link */}
          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted active:scale-[0.99] md:hidden cursor-pointer"
          >
            <LayoutDashboard className="size-4 text-muted-foreground" aria-hidden />
            <span>Dashboard</span>
          </Link>

          {/* Log out button */}
          {onLogout && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted active:scale-[0.99] cursor-pointer"
            >
              <span>Log out</span>
              <LogOut className="size-4 text-muted-foreground" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
