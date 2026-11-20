"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { Button, LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { inputClass } from "@/components/AuthCard";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { MyApplicationsSkeleton } from "@/components/PageSkeletons";
import {
  ApiError,
  listMyApplications,
  withdrawApplication,
  type Application,
} from "@/lib/api";
import {
  formatApplicationDate,
  labelApplicationStatus,
  statusBadgeClass,
} from "@/lib/applications";
import { labelJobType, labelWorkMode } from "@/lib/jobs";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "active" | "closed";

const ACTIVE_STATUSES = new Set([
  "applied",
  "under_review",
  "shortlisted",
  "interview",
]);

function ApplicationsListContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Withdraw dialog state
  const [withdrawTarget, setWithdrawTarget] = useState<Application | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "candidate") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const loadApplications = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await listMyApplications({
        page,
        page_size: pageSize,
      });
      setApplications(res.items);
      setTotal(res.total);
    } catch {
      setError("Failed to load your applications. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user?.role === "candidate") {
      let cancelled = false;
      loadApplications().then(() => {
        if (cancelled) return;
      });
      return () => {
        cancelled = true;
      };
    }
  }, [user, loadApplications]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredApplications = useMemo(() => {
    if (activeTab === "all") return applications;
    if (activeTab === "active") {
      return applications.filter((a) => ACTIVE_STATUSES.has(a.status));
    }
    return applications.filter((a) => !ACTIVE_STATUSES.has(a.status));
  }, [applications, activeTab]);

  const counts = useMemo(() => {
    let active = 0;
    let closed = 0;
    applications.forEach((a) => {
      if (ACTIVE_STATUSES.has(a.status)) active++;
      else closed++;
    });
    return { all: applications.length, active, closed };
  }, [applications]);

  const tabs: TabItem<FilterTab>[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "active", label: "Active", count: counts.active },
    { value: "closed", label: "Closed", count: counts.closed },
  ];

  function openWithdraw(app: Application) {
    setWithdrawTarget(app);
    setWithdrawReason("");
    setWithdrawError(null);
  }

  async function handleConfirmWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawTarget) return;

    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await withdrawApplication(withdrawTarget.id, withdrawReason.trim() || null);
      setWithdrawTarget(null);
      toast.info("Application withdrawn");
      await loadApplications();
    } catch (err) {
      if (err instanceof ApiError) {
        setWithdrawError(err.message || "Could not withdraw application.");
        toast.error(err.message || "Could not withdraw application");
      } else {
        setWithdrawError("Failed to withdraw. Please try again.");
        toast.error("Failed to withdraw application");
      }
    } finally {
      setWithdrawing(false);
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage your submitted job applications.
          </p>
        </div>
        <LinkButton href="/jobs" variant="brand">
          Browse jobs
        </LinkButton>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <Tabs
          items={tabs}
          value={activeTab}
          onChange={(v) => setActiveTab(v)}
          aria-label="Application filters"
        />
        <p className="text-xs text-muted-foreground">
          Showing {filteredApplications.length} of {total} total
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadApplications()}>
            Retry
          </Button>
        </div>
      )}

      {loading && applications.length === 0 && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-border bg-card p-5 space-y-3"
            >
              <Skeleton className="h-6 w-60 rounded-full" />
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="h-4 w-80 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {loading && applications.length > 0 && (
        <div className="mt-4 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-brand" />
          <span>Updating applications…</span>
        </div>
      )}

      {!loading && filteredApplications.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
          <h2 className="text-base font-semibold text-foreground">No applications found</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {activeTab === "all"
              ? "You haven't submitted any job applications yet."
              : `No applications found under "${activeTab}".`}
          </p>
          <div className="mt-5">
            <LinkButton href="/jobs" variant="brand" size="sm">
              Find open jobs
            </LinkButton>
          </div>
        </div>
      )}

      {filteredApplications.length > 0 && (
        <div className="mt-6 space-y-3">
          {filteredApplications.map((app) => {
            const canWithdraw =
              app.status === "applied" || app.status === "shortlisted";
            const isJobClosed = app.job_status !== "active";

            return (
              <div
                key={app.id}
                className="rounded-3xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/jobs/${app.job_id}`}
                        className="text-lg font-semibold text-foreground hover:text-brand transition-colors line-clamp-1"
                      >
                        {app.job_title}
                      </Link>
                      {isJobClosed && (
                        <span className="rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-2.5 py-0.5 text-xs font-medium shrink-0">
                          Job closed
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {app.company_name} · {app.location} · {labelJobType(app.job_type)} · {labelWorkMode(app.work_mode)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Applied {formatApplicationDate(app.created_at)}</span>
                      <span>·</span>
                      <span>CV: <span className="font-medium text-foreground">{app.resume_title}</span></span>
                    </div>

                    {app.cover_note && (
                      <div className="mt-3 rounded-2xl bg-muted/50 p-3 text-xs text-foreground/80">
                        <span className="font-medium text-foreground block mb-0.5">Your cover note:</span>
                        <p className="whitespace-pre-wrap">{app.cover_note}</p>
                      </div>
                    )}

                    {app.status === "withdrawn" && app.withdraw_reason && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Withdrawal reason: &ldquo;{app.withdraw_reason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        statusBadgeClass(app.status)
                      )}
                    >
                      {labelApplicationStatus(app.status)}
                    </span>

                    <div className="flex items-center gap-2">
                      <LinkButton
                        href={`/jobs/${app.job_id}`}
                        variant="ghost"
                        size="sm"
                      >
                        View job
                      </LinkButton>
                      {canWithdraw && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openWithdraw(app)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          Withdraw
                        </Button>
                      )}
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

      {/* Withdraw Modal Sheet */}
      <Sheet
        open={Boolean(withdrawTarget)}
        onOpenChange={(open) => {
          if (!open) setWithdrawTarget(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Withdraw Application</SheetTitle>
            <SheetDescription>
              Are you sure you want to withdraw your application for{" "}
              <span className="font-semibold text-foreground">
                {withdrawTarget?.job_title}
              </span>{" "}
              at {withdrawTarget?.company_name}?
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleConfirmWithdraw} className="space-y-4 py-4">
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. You will not be considered further for
              this role unless you reapply.
            </p>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  Reason for withdrawal <span className="text-muted-foreground">(optional)</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {withdrawReason.length} / 200
                </span>
              </div>
              <textarea
                maxLength={200}
                rows={3}
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="e.g., Accepted another offer, relocation, etc."
                className={cn(inputClass, "resize-y min-h-[80px]")}
              />
            </div>

            {withdrawError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                {withdrawError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={withdrawing}
                onClick={() => setWithdrawTarget(null)}
                className="rounded-full"
              >
                Keep Application
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={withdrawing}
                className="rounded-full shadow-sm"
              >
                {withdrawing ? "Withdrawing…" : "Confirm Withdrawal"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </DashboardShell>
  );
}

export default function CandidateApplicationsPage() {
  return (
    <Suspense fallback={<MyApplicationsSkeleton />}>
      <ApplicationsListContent />
    </Suspense>
  );
}
