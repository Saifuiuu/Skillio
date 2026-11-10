"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

function PublicShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <main
      key={pathname}
      className={cn(
        "page-transition mx-auto max-w-6xl px-4 py-8 md:py-10",
        user && "md:pl-24 md:pr-6"
      )}
    >
      {children}
    </main>
  );
}

export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PublicShellInner>{children}</PublicShellInner>
    </Suspense>
  );
}
