"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import PublicShell from "@/components/PublicShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPostedDate,
  formatSalary,
  labelCategory,
  labelJobType,
  labelWorkMode,
} from "@/lib/jobs";
import { ApiError, getJob, type Job } from "@/lib/api";

function JobDetailSkeleton() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-4 w-48" />
        <Skeleton className="mt-8 h-40 w-full" />
      </div>
    </PublicShell>
  );
}

function JobDetailContent() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setNotFound(false);
      setJob(null);
      try {
        const data = await getJob(params.id);
        if (!cancelled) setJob(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return <JobDetailSkeleton />;
  }

  if (notFound || !job) {
    return (
      <PublicShell>
        <div className="mx-auto flex max-w-3xl flex-col items-start justify-center py-10">
          <h1 className="text-2xl font-semibold text-foreground">Job not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This job may be closed or the link is invalid.
          </p>
          <Link href="/jobs" className="mt-6 text-sm font-medium text-brand underline">
            Back to jobs
          </Link>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-6 md:p-8">
        <Link
          href="/jobs"
          className="text-sm font-medium text-brand underline-offset-2 hover:underline transition-colors duration-150 cursor-pointer"
        >
          ← Back to jobs
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-foreground">{job.title}</h1>
        <p className="mt-2 text-muted-foreground">
          {job.company_name} · {job.location}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Posted {formatPostedDate(job.created_at)} · {labelCategory(job.category)}
        </p>

        <div className="mt-6 grid gap-3 text-sm text-foreground/80 sm:grid-cols-2">
          <p>
            <span className="font-medium">Type:</span> {labelJobType(job.job_type)}
          </p>
          <p>
            <span className="font-medium">Work mode:</span> {labelWorkMode(job.work_mode)}
          </p>
          <p>
            <span className="font-medium">Experience:</span>{" "}
            {job.experience_min_years}–{job.experience_max_years} years
          </p>
          <p>
            <span className="font-medium">Salary:</span> {formatSalary(job)}
          </p>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-foreground/80">{job.description}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.skills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills listed.</p>
            )}
            {job.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-muted px-3 py-1 text-xs text-foreground/80"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      <JobDetailContent />
    </Suspense>
  );
}
