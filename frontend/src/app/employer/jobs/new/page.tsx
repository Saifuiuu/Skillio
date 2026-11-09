"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import JobForm from "@/components/JobForm";
import {
  ApiError,
  createJob,
  fetchMe,
  logout as apiLogout,
  type JobWritePayload,
  type User,
} from "@/lib/api";

const FORBIDDEN_MSG =
  "Your account must have a verified email and admin approval before you can post jobs.";

export default function NewJobPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);

  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me.role !== "employer") {
          router.replace("/dashboard");
          return;
        }
        setUser(me);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    try {
      await apiLogout();
    } finally {
      router.replace("/login?loggedOut=1");
    }
  }

  async function onSubmit(payload: JobWritePayload) {
    setForbidden(null);
    try {
      await createJob(payload);
      router.push("/employer/jobs");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(FORBIDDEN_MSG);
        throw new Error(FORBIDDEN_MSG);
      }
      throw err;
    }
  }

  if (!user) return <DashboardSkeleton />;

  return (
    <DashboardShell email={user.email} role={user.role} onLogout={logout}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-foreground">Post a job</h2>
        <Link href="/employer/jobs" className="text-sm font-medium text-brand underline">
          Back to My Jobs
        </Link>
      </div>
      {forbidden && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {forbidden}
        </p>
      )}
      <JobForm submitLabel="Publish job" onSubmit={onSubmit} />
    </DashboardShell>
  );
}
