"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
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
    <div className="flex min-h-screen bg-[#FAFAF9]">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 md:flex md:flex-col">
        <Skeleton className="h-7 w-24" />
        <div className="mt-6 flex items-center gap-3 rounded-md bg-slate-50 p-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="mt-auto pt-6">
          <Skeleton className="h-9 w-full" />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center border-b border-slate-200 bg-white px-4 md:hidden">
          <Skeleton className="size-8" />
          <Skeleton className="ml-3 h-5 w-20" />
        </div>
        <div className="flex-1 space-y-4 p-6 md:p-10">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-20 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-3/4 max-w-lg" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardShell({
  email,
  role,
  name,
  avatarUrl,
  onLogout,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  // Open only while pathname matches — route changes close the drawer without setState-in-effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const mobileOpen = openPath === pathname;

  const sidebarProps = {
    email,
    role,
    name,
    avatarUrl,
    onLogout,
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF9]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 md:block">
        <Sidebar {...sidebarProps} />
      </aside>

      <div className="flex min-h-screen w-full flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
          <Sheet
            open={mobileOpen}
            onOpenChange={(open) => setOpenPath(open ? pathname : null)}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-md border-slate-300 focus-visible:ring-[#1E3A5F]"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              onClick={() => setOpenPath(pathname)}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
            <SheetContent
              side="left"
              showCloseButton
              className="w-64 max-w-[85vw] p-0 sm:max-w-64"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <Sidebar
                {...sidebarProps}
                onNavigate={() => setOpenPath(null)}
              />
            </SheetContent>
          </Sheet>
          <span className="text-lg font-semibold text-[#1E3A5F]">Skillio</span>
        </header>

        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
