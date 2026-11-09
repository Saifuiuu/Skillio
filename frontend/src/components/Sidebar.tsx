"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NAV_BY_ROLE } from "@/lib/nav";
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

type SidebarProps = {
  email: string;
  role: Role;
  name?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  onNavigate?: () => void;
  className?: string;
};

function SidebarInner({
  email,
  role,
  name,
  avatarUrl,
  onLogout,
  onNavigate,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <div className={cn("flex h-full flex-col bg-card", className)}>
      <div className="px-4 pt-5 pb-3">
        <Logo
          isLoggedIn={true}
          onClick={() => onNavigate?.()}
          className="px-0 py-0 text-xl font-semibold inline-block"
        />
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted p-3">
          <Avatar email={email} name={name} avatarUrl={avatarUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {email}
            </p>
            <p className="text-xs capitalize text-muted-foreground">{role}</p>
          </div>
        </div>
      </div>

      <Separator />

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.enabled &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            if (!item.enabled) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground/50"
                  >
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onNavigate?.()}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium outline-none transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                    active
                      ? "bg-ink text-ink-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-2 border-t border-border p-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start rounded-full border-border"
          onClick={onLogout}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense
      fallback={<div className="h-full bg-card" aria-hidden />}
    >
      <SidebarInner {...props} />
    </Suspense>
  );
}
