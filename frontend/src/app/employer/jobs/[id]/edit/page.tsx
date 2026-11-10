"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import JobForm from "@/components/JobForm";
import { LinkButton } from "@/components/ui/button";
import {
  ApiError,
  getJob,
  updateJob,
  type Job,
  type JobWritePayload,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const FORBIDDEN_MSG =
  "Your account must have a verified email and admin approval before you can post jobs.";

function EditJobContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "employer") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const data = await getJob(params.id);
        if (data.employer_id !== user!.id) {
          setLoadError("Job not found");
          return;
        }
        setJob(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setLoadError("Job not found");
        } else {
          setLoadError("Something went wrong. Please try again.");
        }
      }
    }
    void load();
  }, [user, params.id]);

  async function onSubmit(payload: JobWritePayload) {
    setForbidden(null);
    try {
      await updateJob(params.id, payload);
      router.push("/employer/jobs");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(FORBIDDEN_MSG);
        throw new Error(FORBIDDEN_MSG);
      }
      if (err instanceof ApiError && err.status === 400) {
        throw new Error("Only active jobs can be edited.");
      }
      throw err;
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  return (
    <DashboardShell>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-foreground">Edit job</h2>
        <LinkButton href="/employer/jobs" variant="ghost" size="sm">
          ← Back to My Jobs
        </LinkButton>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {job && job.status !== "active" && (
        <p className="mb-4 rounded-md border border-border bg-muted p-3 text-sm text-foreground/80">
          This job is marked as filled and can no longer be edited.
        </p>
      )}

      {forbidden && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {forbidden}
        </p>
      )}

      {job && job.status === "active" && (
        <JobForm
          submitLabel="Save changes"
          initial={{
            title: job.title,
            company_name: job.company_name,
            description: job.description,
            location: job.location,
            job_type: job.job_type,
            work_mode: job.work_mode,
            category: job.category,
            experience_min_years: job.experience_min_years,
            experience_max_years: job.experience_max_years,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            currency: job.currency,
            skills: job.skills,
            apply_url: job.apply_url,
          }}
          onSubmit={onSubmit}
        />
      )}
    </DashboardShell>
  );
}

export default function EditJobPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <EditJobContent />
    </Suspense>
  );
}
