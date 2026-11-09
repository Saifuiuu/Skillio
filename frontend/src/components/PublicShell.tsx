"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import TopNav from "@/components/TopNav";

function PublicShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main
        key={pathname}
        className="page-transition mx-auto max-w-6xl px-4 py-8 md:py-10"
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
