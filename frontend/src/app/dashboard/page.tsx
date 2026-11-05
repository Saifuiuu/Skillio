"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import {
  fetchMe,
  logout as apiLogout,
  resendVerification,
  type Role,
  type User,
} from "@/lib/api";

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
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

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

  async function onResendVerification() {
    if (!user) return;
    setResendMsg(null);
    setResendLoading(true);
    try {
      await resendVerification(user.email);
    } catch {
      // Always show the same generic message.
    } finally {
      setResendMsg("If that email needs verification, a new link has been sent.");
      setResendLoading(false);
    }
  }

  if (!user) {
    return <DashboardSkeleton />;
  }

  return (
    <DashboardShell email={user.email} role={user.role} onLogout={logout}>
      <h2 className="text-2xl font-semibold text-slate-900">Welcome to Skillio</h2>

      {!user.email_verified && (
        <div className="mt-4 rounded-md border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Please verify your email</p>
            <button
              type="button"
              disabled={resendLoading}
              onClick={onResendVerification}
              className="shrink-0 rounded-md bg-[#1E3A5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#16304f] disabled:opacity-60"
            >
              {resendLoading ? "Sending..." : "Resend verification email"}
            </button>
          </div>
          {resendMsg && <p className="mt-2 text-sky-900">{resendMsg}</p>}
        </div>
      )}

      {user.status === "pending_verification" && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your account is waiting for verification. An admin will review it
          before you can use all features.
        </div>
      )}

      <p className="mt-4 max-w-xl text-slate-700">{WELCOME[user.role]}</p>

      <p className="mt-6">
        <Link href="/jobs" className="text-sm font-medium text-[#1E3A5F] underline">
          Browse jobs
        </Link>
        {user.role === "employer" && (
          <>
            {" · "}
            <Link
              href="/employer/jobs"
              className="text-sm font-medium text-[#1E3A5F] underline"
            >
              My Jobs
            </Link>
          </>
        )}
      </p>
    </DashboardShell>
  );
}
