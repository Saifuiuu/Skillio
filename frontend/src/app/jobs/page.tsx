"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { inputClass } from "@/components/AuthCard";
import PublicShell from "@/components/PublicShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPostedDate,
  formatSalary,
  JOB_CATEGORIES,
  JOB_TYPES,
  labelJobType,
  labelWorkMode,
  WORK_MODES,
} from "@/lib/jobs";
import {
  listJobs,
  type Job,
  type JobCategory,
  type JobType,
  type WorkMode,
} from "@/lib/api";

const PAGE_SIZE = 10;

export default function JobsPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<JobCategory | "">("");
  const [jobType, setJobType] = useState<JobType | "">("");
  const [workMode, setWorkMode] = useState<WorkMode | "">("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listJobs({
          q: debouncedQ || undefined,
          location: location.trim() || undefined,
          category: category || undefined,
          job_type: jobType || undefined,
          work_mode: workMode || undefined,
          skills: skills.trim() || undefined,
          experience: experience === "" ? undefined : Number(experience),
          salary_min: salaryMin === "" ? undefined : Number(salaryMin),
          page,
          page_size: PAGE_SIZE,
        });
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      } catch {
        if (cancelled) return;
        setError("Something went wrong. Please try again.");
        setItems([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedQ,
    location,
    category,
    jobType,
    workMode,
    skills,
    experience,
    salaryMin,
    page,
  ]);

  function resetPage() {
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PublicShell>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Browse jobs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search IT roles across Pakistan and remote teams.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-brand underline">
            Dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl border border-border bg-card p-4 md:grid-cols-2 lg:grid-cols-3">
          <input
            className={inputClass}
            placeholder="Search title or description"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Location"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              resetPage();
            }}
          />
          <input
            className={inputClass}
            placeholder="Skills (comma separated)"
            value={skills}
            onChange={(e) => {
              setSkills(e.target.value);
              resetPage();
            }}
          />
          <select
            className={inputClass}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as JobCategory | "");
              resetPage();
            }}
          >
            <option value="">All categories</option>
            {JOB_CATEGORIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={jobType}
            onChange={(e) => {
              setJobType(e.target.value as JobType | "");
              resetPage();
            }}
          >
            <option value="">All job types</option>
            {JOB_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={workMode}
            onChange={(e) => {
              setWorkMode(e.target.value as WorkMode | "");
              resetPage();
            }}
          >
            <option value="">All work modes</option>
            {WORK_MODES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="Experience (years)"
            value={experience}
            onChange={(e) => {
              setExperience(e.target.value);
              resetPage();
            }}
          />
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="Min salary"
            value={salaryMin}
            onChange={(e) => {
              setSalaryMin(e.target.value);
              resetPage();
            }}
          />
        </div>

        <div className="mt-6 space-y-3">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-4">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="mt-3 h-4 w-40" />
                <Skeleton className="mt-3 h-4 w-full" />
              </div>
            ))}

          {!loading && error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-destructive">
              {error}
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No jobs found
            </p>
          )}

          {!loading &&
            !error &&
            items.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="card-interactive block rounded-3xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{job.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {job.company_name} · {job.location}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatPostedDate(job.created_at)}</p>
                </div>
                <p className="mt-2 text-sm text-foreground/80">
                  {labelJobType(job.job_type)} · {labelWorkMode(job.work_mode)} ·{" "}
                  {formatSalary(job)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.skills.slice(0, 8).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground/80"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
        </div>

        {!loading && total > PAGE_SIZE && (
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <button
              type="button"
              disabled={page >= totalPages}
              className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
    </PublicShell>
  );
}
