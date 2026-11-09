"use client";

import { Suspense, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import IconRail from "@/components/IconRail";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/api";

type DashboardShellProps = {
  email: string;
  role: Role;
  name?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  children: ReactNode;
};

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 md:pl-24">
        <Skeleton className="h-10 w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    </div>
  );
}

function DashboardShellInner({
  email,
  role,
  name,
  avatarUrl,
  onLogout,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const mobileOpen = openPath === pathname;

  const user = { email, role, name, avatarUrl };

  return (
    <div className="min-h-screen bg-background">
      <TopNav user={user} onLogout={onLogout} />
      <IconRail role={role} onLogout={onLogout} />

      <div className="mx-auto max-w-6xl px-4 pt-3 md:hidden">
        <Sheet
          open={mobileOpen}
          onOpenChange={(open) => setOpenPath(open ? pathname : null)}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full border-border"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setOpenPath(pathname)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <SheetContent
            side="left"
            showCloseButton
            className="w-72 max-w-[85vw] rounded-r-3xl border-border bg-card p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <Sidebar
              email={email}
              role={role}
              name={name}
              avatarUrl={avatarUrl}
              onLogout={onLogout}
              onNavigate={() => setOpenPath(null)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <main key={pathname} className="page-transition mx-auto max-w-6xl px-4 py-6 pb-16 md:pl-24 md:pr-6">
        {children}
      </main>
    </div>
  );
}

export default function DashboardShell(props: DashboardShellProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardShellInner {...props} />
    </Suspense>
  );
}
