"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
      // Query forces a fresh login form (empty fields, no leftover autofill).
      router.replace("/login?loggedOut=1");
    }
  }

  if (!user) {
    return <p className="p-8 text-sm text-slate-600">Loading...</p>;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full flex-col justify-between border-b border-slate-200 bg-white p-4 md:w-64 md:border-b-0 md:border-r">
        <div>
          <h1 className="text-xl font-semibold text-[#1E3A5F]">Skillio</h1>
          <div className="mt-6 rounded-md bg-slate-50 p-3">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="text-xs capitalize text-slate-600">{user.role}</p>
          </div>
          <nav className="mt-6">
            <span className="block rounded-md bg-[#1E3A5F] px-3 py-2 text-sm font-medium text-white">
              Dashboard
            </span>
          </nav>
        </div>
        <button
          onClick={logout}
          className="mt-6 rounded-md border border-slate-300 px-3 py-2 text-left text-sm hover:bg-slate-50"
        >
          Log out
        </button>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <h2 className="text-2xl font-semibold">Welcome to Skillio</h2>

        {user.status === "pending_verification" && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Your account is waiting for verification. An admin will review it
            before you can use all features.
          </div>
        )}

        <p className="mt-4 max-w-xl text-slate-700">{WELCOME[user.role]}</p>
      </main>
    </div>
  );
}