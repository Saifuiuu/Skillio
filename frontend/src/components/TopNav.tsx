"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { NAV_BY_ROLE, PUBLIC_NAV } from "@/lib/nav";
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

type TopNavProps = {
  user?: { email: string; role: Role; name?: string; avatarUrl?: string | null } | null;
  onLogout?: () => void;
};

function TopNavInner({ user, onLogout }: TopNavProps) {
  const pathname = usePathname();
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const links = user
    ? NAV_BY_ROLE[user.role].filter((i) => i.enabled)
    : PUBLIC_NAV;

  const activeHref = links.find((item) =>
    pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
  )?.href;

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      if (!activeHref) {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }
      const el = linkRefs.current[activeHref];
      if (el) {
        setIndicatorStyle({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
          opacity: 1,
        });
      } else {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [activeHref]);

  useEffect(() => {
    function onResize() {
      if (!activeHref) return;
      const el = linkRefs.current[activeHref];
      if (el) {
        setIndicatorStyle({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
          opacity: 1,
        });
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeHref]);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-6 md:pt-4">
      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur md:px-4">
        <Logo isLoggedIn={!!user} />

        <nav
          aria-label="Primary"
          className="relative hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex"
        >
          {/* Absolutely-positioned sliding active background pill */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full bg-ink transition-all duration-200 ease-out"
            style={{
              left: `${indicatorStyle.left}px`,
              top: `${indicatorStyle.top}px`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
            }}
          />

          {links.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                ref={(el) => {
                  linkRefs.current[item.href] = el;
                }}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
                  active
                    ? "text-ink-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          {user ? (
            <UserMenu user={user} onLogout={onLogout} />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-foreground transition-all duration-150 hover:brightness-95 active:scale-95 cursor-pointer shadow-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function TopNav(props: TopNavProps) {
  return (
    <Suspense fallback={<header className="sticky top-0 z-40 px-3 pt-3 md:px-6 md:pt-4" />}>
      <TopNavInner {...props} />
    </Suspense>
  );
}
