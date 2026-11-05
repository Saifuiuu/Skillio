"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { buttonClass } from "@/components/AuthCard";
import {
  closeJob,
  fetchMe,
  listMyJobs,
  logout as apiLogout,
  type Job,
  type User,
} from "@/lib/api";
import { formatPostedDate, formatSalary, labelJobStatus } from "@/lib/jobs";

export default function EmployerJobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me.role !== "employer") {
          router.replace("/dashboard");
          return;
        }
        setUser(me);
        return loadJobs();
      })
      .catch(() => router.replace("/login"));
  }, [router, loadJobs]);

  async function logout() {
    try {
      await apiLogout();
    } finally {
      router.replace("/login?loggedOut=1");
    }
  }

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
      await loadJobs();
    } catch {
      setError("Could not close this job. Please try again.");
    } finally {
      setClosingId(null);
    }
  }

  if (!user) return <DashboardSkeleton />;

  return (
    <DashboardShell email={user.email} role={user.role} onLogout={logout}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">My Jobs</h2>
        <Link href="/employer/jobs/new" className={`${buttonClass} w-auto px-4`}>
          New Job
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-slate-600">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="mt-6 rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
          You have not posted any jobs yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                  <p className="text-sm text-slate-600">
                    {job.location} · {formatSalary(job)} · Posted{" "}
                    {formatPostedDate(job.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.status === "active"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {labelJobStatus(job.status)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.status === "active" && (
                  <>
                    <Link
                      href={`/employer/jobs/${job.id}/edit`}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={closingId === job.id}
                      onClick={() => onClose(job)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
                    >
                      {closingId === job.id ? "Closing..." : "Mark as Filled"}
                    </button>
                  </>
                )}
                <Link
                  href={`/jobs/${job.id}`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
