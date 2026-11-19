"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { inputClass } from "@/components/AuthCard";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { JobDetailSkeleton } from "@/components/PageSkeletons";
import {
  ApiError,
  applyToJob,
  getJob,
  listMyApplications,
  listResumes,
  type Application,
  type Job,
  type Resume,
} from "@/lib/api";
import { labelApplicationStatus, statusBadgeClass } from "@/lib/applications";
import {
  formatPostedDate,
  formatSalary,
  labelCategory,
  labelJobType,
  labelWorkMode,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

function JobDetailContent() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Application state for logged-in candidate
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [activeCVs, setActiveCVs] = useState<Resume[]>([]);
  const [loadingCVs, setLoadingCVs] = useState(false);
  const [selectedCVId, setSelectedCVId] = useState<string>("");
  const [coverNote, setCoverNote] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

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

  // Check if candidate already applied to this job
  useEffect(() => {
    if (!user || user.role !== "candidate" || !job) {
      return;
    }
    let cancelled = false;

    async function checkMyApplication() {
      try {
        const res = await listMyApplications({ page: 1, page_size: 50 });
        if (cancelled) return;
        const existing = res.items.find(
          (a) => a.job_id === job?.id && a.status !== "withdrawn"
        );
        setMyApplication(existing ?? null);
      } catch {
        // Silently ignore check errors
      }
    }

    void checkMyApplication();
    return () => {
      cancelled = true;
    };
  }, [user, job]);

  async function handleOpenApply() {
    setApplyError(null);
    setCoverNote("");
    setIsApplyOpen(true);
    setLoadingCVs(true);
    try {
      const cvs = await listResumes("active");
      setActiveCVs(cvs);
      if (cvs.length > 0) {
        setSelectedCVId(cvs[0].id);
      }
    } catch {
      setActiveCVs([]);
    } finally {
      setLoadingCVs(false);
    }
  }

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!job || !selectedCVId) return;

    setApplying(true);
    setApplyError(null);

    try {
      const app = await applyToJob({
        job_id: job.id,
        resume_id: selectedCVId,
        cover_note: coverNote.trim() || null,
      });
      setMyApplication(app);
      setIsApplyOpen(false);
      toast.success("Application submitted successfully");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setApplyError("Verify your email before applying");
        } else if (err.status === 409) {
          setApplyError("You have already applied");
        } else if (err.status === 404) {
          setApplyError("This job is no longer available");
        } else if (err.status === 429) {
          setApplyError("Too many attempts, try later");
        } else {
          setApplyError(err.message || "Something went wrong. Please try again.");
        }
      } else {
        setApplyError("Something went wrong. Please try again.");
      }
    } finally {
      setApplying(false);
    }
  }

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

  const isScraped = job.source === "scraped" || Boolean(job.apply_url);
  const isCandidate = user?.role === "candidate";
  const isEmailVerified = user?.email_verified ?? false;

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-6 md:p-8">
        <Link
          href="/jobs"
          className="text-sm font-medium text-brand underline-offset-2 hover:underline transition-colors duration-150 cursor-pointer"
        >
          ← Back to jobs
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{job.title}</h1>
            <p className="mt-2 text-muted-foreground">
              {job.company_name} · {job.location}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Posted {formatPostedDate(job.created_at)} · {labelCategory(job.category)}
            </p>
          </div>

          {/* Action buttons */}
          <div className="shrink-0">
            {isScraped && job.apply_url ? (
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground shadow-sm hover:brightness-95 active:scale-95 transition-all cursor-pointer"
              >
                Apply on original site
                <ExternalLink className="size-4" aria-hidden />
              </a>
            ) : myApplication ? (
              <div className="flex flex-col sm:items-end gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium",
                    statusBadgeClass(myApplication.status)
                  )}
                >
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Applied · {labelApplicationStatus(myApplication.status)}
                </span>
                <Link
                  href="/candidate/applications"
                  className="text-xs font-medium text-brand hover:underline"
                >
                  View my applications →
                </Link>
              </div>
            ) : !authLoading && !user ? (
              <LinkButton href="/login" variant="brand">
                Log in to apply
              </LinkButton>
            ) : isCandidate ? (
              !isEmailVerified ? (
                <div className="flex flex-col sm:items-end gap-1">
                  <Button
                    disabled
                    variant="outline"
                    className="cursor-not-allowed opacity-60 rounded-full"
                  >
                    Apply now
                  </Button>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Verify your email to apply
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleOpenApply}
                  variant="brand"
                  className="rounded-full shadow-sm"
                >
                  Apply now
                </Button>
              )
            ) : null}
          </div>
        </div>

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

        {/* Bottom apply trigger if not applied yet */}
        {isCandidate && !myApplication && !isScraped && isEmailVerified && (
          <div className="mt-10 rounded-2xl border border-border bg-muted/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Interested in this role?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Apply with one of your saved CVs in seconds.
              </p>
            </div>
            <Button onClick={handleOpenApply} variant="brand" className="rounded-full shrink-0">
              Apply now
            </Button>
          </div>
        )}
      </div>

      {/* Apply Sheet / Dialog */}
      <Sheet open={isApplyOpen} onOpenChange={setIsApplyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Apply to {job.title}</SheetTitle>
            <SheetDescription>
              {job.company_name} · {job.location}
            </SheetDescription>
          </SheetHeader>

          {loadingCVs ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : activeCVs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center my-6">
              <p className="text-sm text-muted-foreground mb-4">
                You do not have any active CVs on your profile yet.
              </p>
              <LinkButton href="/candidate/resumes" variant="brand" size="sm">
                Upload a CV first
              </LinkButton>
            </div>
          ) : (
            <form onSubmit={handleSubmitApplication} className="space-y-5 py-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Choose CV <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={selectedCVId}
                  onChange={(e) => setSelectedCVId(e.target.value)}
                  className={inputClass}
                >
                  {activeCVs.map((cv) => (
                    <option key={cv.id} value={cv.id}>
                      {cv.title} ({cv.original_filename})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The employer will receive this CV.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Cover note <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {coverNote.length} / 1000
                  </span>
                </div>
                <textarea
                  maxLength={1000}
                  rows={4}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Introduce yourself or highlight key qualifications..."
                  className={cn(inputClass, "resize-y min-h-[100px]")}
                />
              </div>

              {applyError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  {applyError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsApplyOpen(false)}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  disabled={applying || !selectedCVId}
                  className="rounded-full shadow-sm"
                >
                  {applying ? "Submitting…" : "Submit Application"}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
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
