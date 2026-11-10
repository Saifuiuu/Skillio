"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/AuthProvider";
import { NAV_BY_ROLE, PUBLIC_NAV } from "@/lib/nav";
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

type TopNavProps = {
  user?: { email: string; role: Role; name?: string; avatarUrl?: string | null } | null;
  onLogout?: () => void;
};

// Module-level cache so route changes or remounts remember the last pill position
let cachedIndicator = { left: 0, top: 0, width: 0, height: 0, opacity: 0 };

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function TopNavInner({ user: propUser, onLogout: propOnLogout }: TopNavProps) {
  const pathname = usePathname();
  const { user: authUser, loading: authLoading, logout: authLogout } = useAuth();

  const user = propUser !== undefined ? propUser : authUser;
  const onLogout = propOnLogout ?? authLogout;
  const isPendingAuth = propUser === undefined && authLoading;

  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState(cachedIndicator);

  const links = user
    ? NAV_BY_ROLE[user.role].filter((i) => i.enabled)
    : PUBLIC_NAV;

  // Longest matching prefix so /jobs/[id] matches /jobs, /employer/jobs/new matches /employer/jobs
  const activeItem = links.reduce<
    (typeof links)[number] | null
  >((best, item) => {
    const isMatch =
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`));
    if (!isMatch) return best;
    if (!best || item.href.length > best.href.length) return item;
    return best;
  }, null);

  const activeHref = activeItem?.href;

  const measureAndApply = () => {
    if (!activeHref) {
      setIndicatorStyle((prev) => {
        const next = { ...prev, opacity: 0 };
        cachedIndicator = next;
        return next;
      });
      return;
    }
    const el = linkRefs.current[activeHref];
    if (el) {
      const next = {
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        opacity: 1,
      };
      cachedIndicator = next;
      setIndicatorStyle(next);
    }
  };

  useIsomorphicLayoutEffect(() => {
    measureAndApply();
  }, [activeHref, links.length]);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      measureAndApply();
    });

    observer.observe(navEl);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHref]);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-6 md:pt-4">
      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur md:px-4">
        <Logo isLoggedIn={Boolean(user)} />

        <nav
          ref={navRef}
          aria-label="Primary"
          className="relative hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex"
        >
          {/* Smooth sliding active background pill */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full bg-ink transition-[left,width,top,opacity] duration-200 ease-out"
            style={{
              left: `${indicatorStyle.left}px`,
              top: `${indicatorStyle.top}px`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
            }}
          />

          {isPendingAuth ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          ) : (
            links.map((item) => {
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
            })
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />

          {isPendingAuth ? (
            <Skeleton className="size-9 rounded-full" />
          ) : user ? (
            <UserMenu user={user} onLogout={onLogout} />
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer min-h-[36px] flex items-center"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-all duration-150 hover:brightness-95 active:scale-95 cursor-pointer shadow-sm min-h-[36px] flex items-center"
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
    <Suspense
      fallback={<header className="sticky top-0 z-40 px-3 pt-3 md:px-6 md:pt-4" />}
    >
      <TopNavInner {...props} />
    </Suspense>
  );
}
