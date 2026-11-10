"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import TopNav from "@/components/TopNav";
import IconRail from "@/components/IconRail";
import { useAuth } from "@/components/AuthProvider";

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/select-role",
];

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen bg-background">
      <TopNav />
      {user && <IconRail role={user.role} onLogout={logout} />}
      {children}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}
