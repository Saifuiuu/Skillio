"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { NAV_BY_ROLE } from "@/lib/nav";
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

function IconRailInner({
  role,
  onLogout,
}: {
  role: Role;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <aside
      aria-label="Shortcut navigation"
      className="fixed top-1/2 left-4 z-30 hidden -translate-y-1/2 flex-col md:flex"
    >
      <div className="flex flex-col items-center gap-1.5 rounded-full bg-rail px-2 py-3 text-rail-foreground shadow-xl">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.enabled &&
            (pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)));

          if (!item.enabled) {
            return (
              <div key={item.href} className="group relative flex items-center">
                <span
                  aria-disabled="true"
                  className="inline-flex size-10 min-h-[40px] min-w-[40px] cursor-not-allowed items-center justify-center rounded-full opacity-35"
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full ml-3 z-50 rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md whitespace-nowrap opacity-0 -translate-x-1 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:translate-x-0"
                >
                  {item.label} (coming soon)
                </span>
              </div>
            );
          }

          return (
            <div key={item.href} className="group relative flex items-center">
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex size-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-full transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer",
                  active
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-rail-foreground/80 hover:bg-white/15 hover:scale-105 hover:text-rail-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
              </Link>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full ml-3 z-50 rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md whitespace-nowrap opacity-0 -translate-x-1 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0"
              >
                {item.label}
              </span>
            </div>
          );
        })}

        <div className="my-1 h-px w-6 bg-white/15" />

        <div className="group relative flex items-center">
          <ThemeToggle variant="rail" />
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full ml-3 z-50 rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md whitespace-nowrap opacity-0 -translate-x-1 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0"
          >
            Toggle theme
          </span>
        </div>

        <div className="group relative flex items-center">
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            className="inline-flex size-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-rail-foreground/80 transition-all duration-150 hover:bg-white/15 hover:scale-105 hover:text-rail-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full ml-3 z-50 rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md whitespace-nowrap opacity-0 -translate-x-1 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0"
          >
            Log out
          </span>
        </div>
      </div>
    </aside>
  );
}

export default function IconRail(props: { role: Role; onLogout: () => void }) {
  return (
    <Suspense fallback={null}>
      <IconRailInner {...props} />
    </Suspense>
  );
}
