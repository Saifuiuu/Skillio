"use client";

import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/components/AuthProvider";
import { getDisplayName } from "@/lib/nav";
import { cn } from "@/lib/utils";

function PublicShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const mobileOpen = openPath === pathname;

  return (
    <div>
      {user && (
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
                email={user.email}
                role={user.role}
                name={getDisplayName(user)}
                avatarUrl={null}
                onLogout={logout}
                onNavigate={() => setOpenPath(null)}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}

      <main
        key={pathname}
        className={cn(
          "page-transition mx-auto max-w-6xl px-4",
          user ? "py-6 pb-16 md:pl-24 md:pr-6" : "py-8 md:py-10"
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PublicShellInner>{children}</PublicShellInner>
    </Suspense>
  );
}
