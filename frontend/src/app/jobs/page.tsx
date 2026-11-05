"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { inputClass } from "@/components/AuthCard";
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
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Browse jobs</h1>
            <p className="mt-1 text-sm text-slate-600">
              Search IT roles across Pakistan and remote teams.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-[#1E3A5F] underline">
            Dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
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
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="mt-3 h-4 w-40" />
                <Skeleton className="mt-3 h-4 w-full" />
              </div>
            ))}

          {!loading && error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              No jobs found
            </p>
          )}

          {!loading &&
            !error &&
            items.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-[#1E3A5F]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{job.title}</h2>
                    <p className="text-sm text-slate-600">
                      {job.company_name} · {job.location}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">{formatPostedDate(job.created_at)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {labelJobType(job.job_type)} · {labelWorkMode(job.work_mode)} ·{" "}
                  {formatSalary(job)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.skills.slice(0, 8).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
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
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </p>
            <button
              type="button"
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
