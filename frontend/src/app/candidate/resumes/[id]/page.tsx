"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Clock,
  GraduationCap,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  CardHeader,
  SurfaceCard,
} from "@/components/ui/SurfaceCard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import {
  ApiError,
  getResume,
  parseResume,
  type ResumeDetail,
} from "@/lib/api";
import {
  extractionBadgeClass,
  formatDurationText,
  formatFileSize,
  formatResumeDate,
  formatSkill,
  formatText,
  labelExtraction,
  labelParseStatus,
  parseStatusBadgeClass,
} from "@/lib/resumes";
import { cn } from "@/lib/utils";

const PREVIEW_CHARS = 2000;

function ResumeDetailSkeleton() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 pt-4">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function ResumeDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Parse state & polling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseActionError, setParseActionError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [confirmReanalyzeOpen, setConfirmReanalyzeOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "candidate") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await getResume(params.id);
        if (!cancelled) setResume(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, params.id, router]);

  // Polling: Poll every 3 seconds while parse_status === "parsing", up to ~3 minutes (60 iterations)
  const isParsing = resume?.parse_status === "parsing";

  useEffect(() => {
    if (!isParsing || !resume?.id) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 * 3s = 180s (~3 minutes)

    const timer = setInterval(async () => {
      attempts += 1;
      if (typeof document !== "undefined" && document.hidden) return;

      if (attempts > maxAttempts) {
        clearInterval(timer);
        if (!cancelled) setTimedOut(true);
        return;
      }

      try {
        const updated = await getResume(resume.id);
        if (cancelled) return;
        setResume(updated);
        if (updated.parse_status !== "parsing") {
          clearInterval(timer);
          if (updated.parse_status === "ok") {
            toast.success("CV analysis finished");
          } else if (updated.parse_status === "failed") {
            toast.error("CV analysis failed. Please try again.");
          }
        }
      } catch {
        // network glitch on poll tick: keep polling until maxAttempts
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isParsing, resume?.id, toast]);

  async function handleStartParsing() {
    if (!resume) return;
    setParseActionError(null);
    setIsSubmitting(true);
    setTimedOut(false);

    try {
      await parseResume(resume.id);
      setResume((prev) =>
        prev ? { ...prev, parse_status: "parsing", parse_error: null } : prev
      );
      toast.info("CV analysis started");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const detail = (err.message || "").toLowerCase();
          if (detail.includes("already") || detail.includes("parsing")) {
            // Already parsing: start polling silently
            setResume((prev) =>
              prev ? { ...prev, parse_status: "parsing", parse_error: null } : prev
            );
            return;
          }
          if (detail.includes("readable") || detail.includes("text")) {
            const msg = "No readable text in this CV";
            setParseActionError(msg);
            toast.error(msg);
            return;
          }
          const msg = "CV cannot be analyzed right now.";
          setParseActionError(msg);
          toast.error(msg);
          return;
        }
        if (err.status === 429) {
          const msg = "Too many attempts. Try again later.";
          setParseActionError(msg);
          toast.error(msg);
          return;
        }
      }
      const genericMsg = "Could not start CV analysis. Please try again later.";
      setParseActionError(genericMsg);
      toast.error(genericMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || (!user && !notFound)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-4 w-48" />
        <Skeleton className="mt-8 h-40 w-full" />
      </main>
    );
  }

  if (notFound || (!loading && !resume)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">CV not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This CV may have been removed or the link is invalid.
        </p>
        <Link
          href="/candidate/resumes"
          className="mt-6 text-sm font-medium text-brand underline"
        >
          Back to My CVs
        </Link>
      </main>
    );
  }

  if (loading || !resume) return <ResumeDetailSkeleton />;

  const text = resume.extracted_text ?? "";
  const needsTruncate = text.length > PREVIEW_CHARS;
  const preview =
    expanded || !needsTruncate ? text : `${text.slice(0, PREVIEW_CHARS)}…`;

  const parsedData = resume.parsed_data;
  const skills = parsedData?.skills ?? [];
  const experience = parsedData?.experience ?? [];
  const education = parsedData?.education ?? [];
  const totalExp = parsedData?.total_experience_years;
  const confidence = parsedData?.it_domain_confidence ?? 0;
  const confidencePct = Math.round(confidence * 100);

  const isActive = resume.status === "active";
  const hasReadableText =
    resume.extraction_status === "ok" && Boolean(resume.extracted_text);

  return (
    <DashboardShell>
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/candidate/resumes"
          className="text-sm font-medium text-brand hover:underline"
        >
          ← Back to My CVs
        </Link>
      </div>

      <div className="mt-4">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {resume.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {resume.original_filename} · {formatFileSize(resume.file_size_bytes)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Status: {isActive ? "Active" : "Archived"} · Uploaded{" "}
          {formatResumeDate(resume.created_at)}
          {resume.archived_at && (
            <> · Archived {formatResumeDate(resume.archived_at)}</>
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
              extractionBadgeClass(resume.extraction_status)
            )}
          >
            {labelExtraction(resume.extraction_status)}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              parseStatusBadgeClass(resume.parse_status)
            )}
          >
            {resume.parse_status === "parsing" && (
              <span className="mr-1.5 inline-block h-2 w-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {labelParseStatus(resume.parse_status)}
          </span>
        </div>
      </div>

      {/* AI CV Analysis Section */}
      <section className="mt-8 space-y-4">
        <SurfaceCard>
          <CardHeader
            title="AI CV Analysis"
            subtitle="Automatic breakdown of your skills, career experience, and education"
            action={
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                  parseStatusBadgeClass(resume.parse_status)
                )}
              >
                {resume.parse_status === "parsing" && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                {labelParseStatus(resume.parse_status)}
              </span>
            }
          />

          {parseActionError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{parseActionError}</p>
            </div>
          )}

          {/* State 1: Not Parsed */}
          {resume.parse_status === "not_parsed" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Extract your skills, experience and education automatically with our local AI model.
              </p>

              {!isActive ? (
                <p className="text-xs text-muted-foreground">
                  Only active CVs can be analyzed.
                </p>
              ) : !hasReadableText ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="brand"
                    disabled
                    className="rounded-full shadow-sm"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze CV
                  </Button>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    No readable text in this CV
                  </p>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="brand"
                  disabled={isSubmitting}
                  onClick={handleStartParsing}
                  className="rounded-full shadow-sm"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Starting…" : "Analyze CV"}
                </Button>
              )}
            </div>
          )}

          {/* State 2: Parsing / Analyzing */}
          {resume.parse_status === "parsing" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Analyzing your CV…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This can take up to 2 minutes while our AI processes your document.
                  </p>
                </div>
              </div>

              {timedOut && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">
                    Taking longer than usual. Refresh the page to check again.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="mt-3 rounded-full"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Refresh now
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* State 3: Failed */}
          {resume.parse_status === "failed" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200">
                <p className="font-medium">
                  We could not analyze this CV. Please try again.
                </p>
                {resume.parse_error && (
                  <p className="mt-1 text-xs opacity-90">{resume.parse_error}</p>
                )}
              </div>

              {isActive && hasReadableText && (
                <Button
                  type="button"
                  variant="brand"
                  disabled={isSubmitting}
                  onClick={handleStartParsing}
                  className="rounded-full shadow-sm"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Retrying…" : "Try again"}
                </Button>
              )}
            </div>
          )}

          {/* State 4: Analyzed / OK */}
          {resume.parse_status === "ok" && parsedData && (
            <div className="space-y-6">
              {/* IT Domain Relevance */}
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2 text-sm font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Sparkles className="h-4 w-4 text-brand" />
                    IT Domain Relevance
                  </span>
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                    IT relevance {confidencePct}%
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, confidencePct))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  AI estimate, may be wrong
                </p>
              </div>

              {/* Skills */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-brand" />
                  Skills {skills.length > 0 && `(${skills.length})`}
                </h4>
                {skills.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Not found</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-xs"
                      >
                        {formatSkill(skill)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Experience */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Briefcase className="h-4 w-4 text-brand" />
                    Experience
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Total:{" "}
                      {totalExp !== null && totalExp !== undefined
                        ? `${totalExp} ${totalExp === 1 ? "year" : "years"}`
                        : "Not found"}
                    </span>
                  </div>
                </div>

                {experience.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Not found</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border/60">
                    {experience.map((exp, idx) => (
                      <li key={idx} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-1">
                          <p className="text-sm font-semibold text-foreground">
                            {formatText(exp.title)}
                          </p>
                          {exp.duration_text && (
                            <span className="text-xs text-muted-foreground">
                              {formatDurationText(exp.duration_text)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatText(exp.company)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Education */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <GraduationCap className="h-4 w-4 text-brand" />
                  Education {education.length > 0 && `(${education.length})`}
                </h4>
                {education.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Not found</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border/60">
                    {education.map((edu, idx) => (
                      <li key={idx} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-1">
                          <p className="text-sm font-semibold text-foreground">
                            {formatText(edu.degree)}
                          </p>
                          {edu.year && (
                            <span className="text-xs text-muted-foreground">
                              {edu.year}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatText(edu.institution)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer info & Re-analyze action */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Analyzed by{" "}
                  <span className="font-medium text-foreground">
                    {resume.parsed_by || "AI"}
                  </span>
                  {resume.parsed_at && (
                    <> on {formatResumeDate(resume.parsed_at)}</>
                  )}
                </p>

                {isActive && hasReadableText && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => setConfirmReanalyzeOpen(true)}
                    className="rounded-full cursor-pointer self-start sm:self-auto"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Re-analyze
                  </Button>
                )}
              </div>
            </div>
          )}
        </SurfaceCard>
      </section>

      {/* Extracted Text Section */}
      <section className="mt-8">
        <h3 className="text-lg font-semibold text-foreground">Extracted text</h3>
        {!text ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Text could not be read from this file
          </p>
        ) : (
          <>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
              {preview}
            </pre>
            {needsTruncate && (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-brand hover:underline cursor-pointer"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </>
        )}
      </section>

      {/* Confirm Re-analyze Sheet */}
      <Sheet open={confirmReanalyzeOpen} onOpenChange={setConfirmReanalyzeOpen}>
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-3xl sm:rounded-3xl p-6 sm:bottom-6">
          <SheetHeader>
            <SheetTitle>Re-analyze CV?</SheetTitle>
            <SheetDescription>
              This replaces the current result with a fresh analysis.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setConfirmReanalyzeOpen(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={isSubmitting}
              onClick={async () => {
                setConfirmReanalyzeOpen(false);
                await handleStartParsing();
              }}
              className="rounded-full shadow-sm"
            >
              {isSubmitting ? "Starting…" : "Confirm Re-analyze"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardShell>
  );
}

export default function ResumeDetailPage() {
  return (
    <Suspense fallback={<ResumeDetailSkeleton />}>
      <ResumeDetailContent />
    </Suspense>
  );
}
