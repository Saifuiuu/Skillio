"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import JobForm from "@/components/JobForm";
import { LinkButton } from "@/components/ui/button";
import {
  ApiError,
  createJob,
  type JobWritePayload,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const FORBIDDEN_MSG =
  "Your account must have a verified email and admin approval before you can post jobs.";

export default function NewJobPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [forbidden, setForbidden] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "employer") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

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

  if (authLoading || !user) return <DashboardSkeleton />;

  return (
    <DashboardShell>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-foreground">Post a job</h2>
        <LinkButton href="/employer/jobs" variant="ghost" size="sm">
          ← Back to My Jobs
        </LinkButton>
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
