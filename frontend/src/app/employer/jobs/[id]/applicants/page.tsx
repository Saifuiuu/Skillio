"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Download, FileText, ChevronDown, ChevronUp } from "lucide-react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/components/AuthProvider";
import {
  ApiError,
  downloadApplicationResume,
  getJob,
  listJobApplications,
  updateApplicationStatus,
  type ApplicationEmployer,
  type ApplicationStatus,
  type EmployerApplicationStatus,
  type Job,
} from "@/lib/api";
import {
  formatApplicationDate,
  labelApplicationStatus,
  statusBadgeClass,
} from "@/lib/applications";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { value: ApplicationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "applied", label: "Applied" },
  { value: "under_review", label: "Under review" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "selected", label: "Selected" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

const ALLOWED_TARGET_STATUSES: {
  value: EmployerApplicationStatus;
  label: string;
}[] = [
  { value: "under_review", label: "Under review" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "selected", label: "Selected" },
  { value: "rejected", label: "Rejected" },
];

const TERMINAL_STATUSES = new Set(["selected", "rejected", "withdrawn"]);

function ApplicantsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [jobNotFound, setJobNotFound] = useState(false);

  const [applicants, setApplicants] = useState<ApplicationEmployer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");

  // Track expanded cover notes
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Downloading state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Status change confirmation modal
  const [confirmTarget, setConfirmTarget] = useState<{
    app: ApplicationEmployer;
    targetStatus: EmployerApplicationStatus;
  } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "employer") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  // Load Job info
  useEffect(() => {
    let cancelled = false;
    async function fetchJob() {
      try {
        const j = await getJob(params.id);
        if (!cancelled) setJob(j);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            setJobNotFound(true);
          } else {
            setJobNotFound(true);
          }
        }
      }
    }
    void fetchJob();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Load Applicants
  const loadApplicants = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await listJobApplications(params.id, {
        page,
        page_size: pageSize,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setApplicants(res.items);
      setTotal(res.total);
    } catch {
      setError("Failed to load applicants. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [params.id, page, statusFilter]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user?.role === "employer") {
      let cancelled = false;
      loadApplicants().then(() => {
        if (cancelled) return;
      });
      return () => {
        cancelled = true;
      };
    }
  }, [user, loadApplicants]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleNote(id: string) {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleDownload(app: ApplicationEmployer) {
    setDownloadingId(app.id);
    try {
      const fallback = `${app.candidate_full_name || "candidate"}-cv.pdf`;
      await downloadApplicationResume(app.id, fallback);
    } catch {
      alert("Failed to download CV file. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function applyStatusChange(
    applicationId: string,
    nextStatus: EmployerApplicationStatus
  ) {
    setUpdatingId(applicationId);
    setStatusError(null);
    try {
      await updateApplicationStatus(applicationId, nextStatus);
      setConfirmTarget(null);
      await loadApplicants();
    } catch (err) {
      if (err instanceof ApiError) {
        setStatusError(err.message || "Failed to update status.");
      } else {
        setStatusError("Failed to update status.");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function handleSelectStatus(
    app: ApplicationEmployer,
    nextStatus: EmployerApplicationStatus
  ) {
    if (app.status === nextStatus) return;

    // Confirm only for terminal transitions (selected or rejected)
    if (nextStatus === "selected" || nextStatus === "rejected") {
      setConfirmTarget({ app, targetStatus: nextStatus });
    } else {
      void applyStatusChange(app.id, nextStatus);
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  if (jobNotFound) {
    return (
      <DashboardShell>
        <div className="py-12 text-center">
          <h1 className="text-xl font-semibold text-foreground">Job not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This job does not exist or you do not have permission to view its applicants.
          </p>
          <div className="mt-6">
            <Link
              href="/employer/jobs"
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-sm hover:brightness-95"
            >
              Back to My Jobs
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardShell>
      <div>
        <Link
          href="/employer/jobs"
          className="text-sm font-medium text-brand hover:underline transition-colors"
        >
          ← Back to My Jobs
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {job ? `Applicants for ${job.title}` : "Job Applicants"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {job ? `${job.company_name} · ${job.location}` : "Review candidate submissions"}
            </p>
          </div>
          <span className="rounded-full border border-border bg-card px-3.5 py-1 text-xs font-medium text-foreground">
            {total} total applicant{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="mt-6 flex flex-wrap gap-1.5 border-b border-border pb-3">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                active
                  ? "bg-ink text-ink-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {statusError && (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{statusError}</span>
          <button
            type="button"
            onClick={() => setStatusError(null)}
            className="text-destructive font-medium hover:underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadApplicants()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-border bg-card p-5 space-y-3"
            >
              <Skeleton className="h-6 w-48 rounded-full" />
              <Skeleton className="h-4 w-36 rounded-full" />
              <Skeleton className="h-4 w-72 rounded-full" />
            </div>
          ))}
        </div>
      ) : applicants.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
          <h2 className="text-base font-semibold text-foreground">No applicants yet</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "Candidates who apply to this role will appear here."
              : `No applicants currently under status "${labelApplicationStatus(statusFilter)}".`}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {applicants.map((app) => {
            const isTerminal = TERMINAL_STATUSES.has(app.status);
            const isNoteExpanded = expandedNotes[app.id] ?? false;

            return (
              <div
                key={app.id}
                className="rounded-3xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {app.candidate_full_name || "Unnamed Candidate"}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        ({app.candidate_email})
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-foreground/80 font-medium">
                        <FileText className="size-3.5 text-brand" />
                        {app.resume_title}
                      </span>
                      <span>·</span>
                      <span>Applied {formatApplicationDate(app.created_at)}</span>
                    </div>

                    {app.cover_note && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleNote(app.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline cursor-pointer"
                        >
                          {isNoteExpanded ? "Hide cover note" : "View cover note"}
                          {isNoteExpanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </button>

                        {isNoteExpanded && (
                          <div className="mt-2 rounded-2xl bg-muted/60 p-3 text-xs text-foreground/90 whitespace-pre-wrap">
                            {app.cover_note}
                          </div>
                        )}
                      </div>
                    )}

                    {app.status === "withdrawn" && app.withdraw_reason && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Candidate withdrawal note: &ldquo;{app.withdraw_reason}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium self-start sm:self-end",
                        statusBadgeClass(app.status)
                      )}
                    >
                      {labelApplicationStatus(app.status)}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status select */}
                      <select
                        aria-label="Change candidate status"
                        disabled={isTerminal || updatingId === app.id}
                        value={app.status}
                        onChange={(e) =>
                          handleSelectStatus(
                            app,
                            e.target.value as EmployerApplicationStatus
                          )
                        }
                        className={cn(
                          "rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground outline-none transition-colors",
                          isTerminal
                            ? "cursor-not-allowed opacity-50 bg-muted"
                            : "hover:border-foreground/30 cursor-pointer"
                        )}
                      >
                        {/* If status is applied, show it as selected option */}
                        {app.status === "applied" && (
                          <option value="applied" disabled>
                            Applied
                          </option>
                        )}
                        {app.status === "withdrawn" && (
                          <option value="withdrawn" disabled>
                            Withdrawn
                          </option>
                        )}
                        {ALLOWED_TARGET_STATUSES.map((target) => (
                          <option key={target.value} value={target.value}>
                            {target.label}
                          </option>
                        ))}
                      </select>

                      {/* Download CV button */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === app.id}
                        onClick={() => void handleDownload(app)}
                        className="rounded-full text-xs gap-1.5"
                      >
                        <Download className="size-3.5" />
                        {downloadingId === app.id ? "Downloading…" : "Download CV"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > pageSize && (
        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Confirmation Sheet for Terminal Status Changes */}
      <Sheet
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md p-6">
          <SheetHeader>
            <SheetTitle>Confirm Final Decision</SheetTitle>
            <SheetDescription>
              Mark candidate{" "}
              <span className="font-semibold text-foreground">
                {confirmTarget?.app.candidate_full_name || confirmTarget?.app.candidate_email}
              </span>{" "}
              as{" "}
              <span className="font-semibold text-foreground uppercase">
                {confirmTarget?.targetStatus}
              </span>
              ?
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4 text-xs text-muted-foreground">
            <p>
              Warning: <span className="font-medium text-foreground">{confirmTarget?.targetStatus}</span> is a terminal status. Once set, this decision cannot be undone or transitioned to another status.
            </p>

            <div className="pt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(updatingId)}
                onClick={() => setConfirmTarget(null)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={
                  confirmTarget?.targetStatus === "rejected"
                    ? "destructive"
                    : "brand"
                }
                disabled={Boolean(updatingId)}
                onClick={() => {
                  if (confirmTarget) {
                    void applyStatusChange(
                      confirmTarget.app.id,
                      confirmTarget.targetStatus
                    );
                  }
                }}
                className="rounded-full shadow-sm"
              >
                {updatingId ? "Updating…" : `Confirm ${confirmTarget?.targetStatus}`}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardShell>
  );
}

export default function EmployerJobApplicantsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ApplicantsContent />
    </Suspense>
  );
}
