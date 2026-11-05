"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { fetchMe, logout as apiLogout, type Role, type User } from "@/lib/api";

const WELCOME: Record<Role, string> = {
  candidate:
    "Your account is active. CV upload and job recommendations will appear here soon.",
  employer:
    "Company profile and job posting will appear here once your account is verified.",
  interviewer:
    "Your availability calendar and interview requests will appear here once you are verified.",
  admin: "User, job and verification management will appear here.",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    try {
      await apiLogout();
    } finally {
      router.replace("/login?loggedOut=1");
    }
  }

  if (!user) {
    return <DashboardSkeleton />;
  }

  return (
    <DashboardShell email={user.email} role={user.role} onLogout={logout}>
      <h2 className="text-2xl font-semibold text-slate-900">Welcome to Skillio</h2>

      {user.status === "pending_verification" && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your account is waiting for verification. An admin will review it
          before you can use all features.
        </div>
      )}

      <p className="mt-4 max-w-xl text-slate-700">{WELCOME[user.role]}</p>
    </DashboardShell>
  );
}
