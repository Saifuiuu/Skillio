"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { LinkButton } from "@/components/ui/button";
import {
  closeJob,
  listMyJobs,
  type Job,
} from "@/lib/api";
import { formatPostedDate, formatSalary, labelJobStatus } from "@/lib/jobs";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { EmployerJobsSkeleton } from "@/components/PageSkeletons";
import { Briefcase, Loader2 } from "lucide-react";

export default function EmployerJobsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "employer") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const loadJobs = useCallback(async () => {
    setError(null);
    try {
      const res = await listMyJobs(1, 50);
      setJobs(res.items);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user?.role === "employer") {
      let cancelled = false;
      loadJobs().then(() => { if (cancelled) return; });
      return () => { cancelled = true; };
    }
  }, [user, loadJobs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onClose(job: Job) {
    if (
      !window.confirm(
        `Mark "${job.title}" as filled? Candidates will no longer see this job.`
      )
    ) {
      return;
    }
    setClosingId(job.id);
    try {
      await closeJob(job.id);
      toast.info("Job marked as filled");
      await loadJobs();
    } catch {
      setError("Could not close this job. Please try again.");
      toast.error("Could not close this job");
    } finally {
      setClosingId(null);
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-foreground">My Jobs</h2>
        <LinkButton href="/employer/jobs/new" variant="brand">
          New Job
        </LinkButton>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {loading && jobs.length === 0 ? (
        <div className="mt-6">
          <EmployerJobsSkeleton />
        </div>
      ) : jobs.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-border bg-card p-10 text-center space-y-3">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Briefcase className="size-5" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No posted jobs yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Create your first technical role to start receiving candidate applications.
          </p>
          <LinkButton
            href="/employer/jobs/new"
            variant="brand"
            size="sm"
            className="rounded-full shadow-sm"
          >
            Post a job
          </LinkButton>
        </div>
      ) : (
        <>
          {loading && jobs.length > 0 && (
            <div className="mt-4 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-brand" />
              <span>Updating jobs…</span>
            </div>
          )}
          <ul className="mt-6 space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-3xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {job.location} · {formatSalary(job)} · Posted{" "}
                    {formatPostedDate(job.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.status === "active"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-muted text-foreground/80"
                  }`}
                >
                  {labelJobStatus(job.status)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <LinkButton
                  href={`/employer/jobs/${job.id}/applicants`}
                  variant="secondary"
                  size="sm"
                >
                  Applicants
                </LinkButton>
                {job.status === "active" && (
                  <>
                    <Link
                      href={`/employer/jobs/${job.id}/edit`}
                      className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={closingId === job.id}
                      onClick={() => onClose(job)}
                      className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {closingId === job.id ? "Closing..." : "Mark as Filled"}
                    </button>
                  </>
                )}
                <Link
                  href={`/jobs/${job.id}`}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </DashboardShell>
  );
}
