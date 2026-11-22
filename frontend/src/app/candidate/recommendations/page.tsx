"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FileText, Plus, Search, Sparkles } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { RecommendationsSkeleton } from "@/components/PageSkeletons";
import { Button, LinkButton } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, getRecommendations, type JobMatch } from "@/lib/api";
import { formatPostedDate, formatSalary, labelJobType, labelWorkMode } from "@/lib/jobs";
import { formatSkill } from "@/lib/resumes";
import { cn } from "@/lib/utils";
import MatchBadge from "@/components/matching/MatchBadge";
import MatchInfoNotice from "@/components/matching/MatchInfoNotice";
import MatchResumeSelector from "@/components/matching/MatchResumeSelector";
import { useMatchResume } from "@/components/matching/useMatchResume";

const PAGE_SIZE = 15;

type ScoreFilter = undefined | 50 | 75;

const FILTER_CHIPS: { label: string; value: ScoreFilter }[] = [
  { label: "All matches", value: undefined },
  { label: "50%+ Partial match", value: 50 },
  { label: "75%+ Strong match", value: 75 },
];

function RecommendationsContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    parsedResumes,
    selectedResumeId,
    selectResume,
    loading: loadingResumes,
    hasParsedCV,
  } = useMatchResume();

  const [minScore, setMinScore] = useState<ScoreFilter>(undefined);
  const [page, setPage] = useState<number>(1);
  const [items, setItems] = useState<JobMatch[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Role gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "candidate") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const loadRecommendations = useCallback(async () => {
    await Promise.resolve();
    if (!selectedResumeId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await getRecommendations({
        resume_id: selectedResumeId,
        page,
        page_size: PAGE_SIZE,
        min_score: minScore,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Your selected CV has not been analyzed yet. Please run analysis on your CV.");
      } else {
        setError("Unable to load recommended jobs. Please try again.");
      }
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedResumeId, page, minScore]);

  useEffect(() => {
    if (user?.role === "candidate" && selectedResumeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadRecommendations();
    }
  }, [user?.role, selectedResumeId, loadRecommendations]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authLoading || (loadingResumes && !selectedResumeId)) {
    return <RecommendationsSkeleton />;
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Sparkles className="size-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                Recommended jobs
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Jobs ranked by how closely their listed skills and experience requirements align with your CV.
            </p>
            <div className="mt-2">
              <MatchInfoNotice size="default" />
            </div>
          </div>

          {/* CV Selector */}
          {hasParsedCV && (
            <div className="shrink-0 pt-1 sm:pt-0">
              <MatchResumeSelector
                parsedResumes={parsedResumes}
                selectedResumeId={selectedResumeId}
                onSelect={(id) => {
                  selectResume(id);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>

        {/* When candidate has no parsed CVs */}
        {!loadingResumes && !hasParsedCV && (
          <SurfaceCard className="p-8 sm:p-12 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <FileText className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Analyze your CV to see recommendations
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Skillio calculates your baseline match by comparing the skills and experience
                in your analyzed CV with job requirements.
              </p>
            </div>
            <div className="pt-2">
              <LinkButton href="/candidate/resumes" variant="brand" className="rounded-full">
                Upload & analyze your CV →
              </LinkButton>
            </div>
          </SurfaceCard>
        )}

        {/* When candidate has parsed CV */}
        {hasParsedCV && (
          <>
            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground mr-1">
                Filter by match:
              </span>
              {FILTER_CHIPS.map((chip) => {
                const active = minScore === chip.value;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setMinScore(chip.value);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer border select-none",
                      active
                        ? "border-brand bg-brand text-brand-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Error state */}
            {error && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-3">
                <p>{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadRecommendations()}
                  className="rounded-full text-xs"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SurfaceCard key={i} className="p-6 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="h-5 w-56 bg-muted animate-pulse rounded-md" />
                        <div className="h-4 w-40 bg-muted animate-pulse rounded-md" />
                      </div>
                      <div className="h-7 w-28 bg-muted animate-pulse rounded-full" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                      <div className="h-6 w-24 bg-muted animate-pulse rounded-full" />
                    </div>
                  </SurfaceCard>
                ))}
              </div>
            )}

            {/* Empty list state */}
            {!loading && !error && items.length === 0 && (
              <SurfaceCard className="p-10 text-center space-y-3">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Search className="size-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  No matching jobs found
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {minScore !== undefined
                    ? "No jobs meet the selected match threshold. Try viewing all matches."
                    : "No jobs are currently available for recommendation."}
                </p>
                {minScore !== undefined && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMinScore(undefined);
                      setPage(1);
                    }}
                    className="rounded-full text-xs"
                  >
                    View all matches
                  </Button>
                )}
              </SurfaceCard>
            )}

            {/* Jobs List */}
            {!loading && !error && items.length > 0 && (
              <div className="space-y-4">
                {items.map((job) => {
                  const matched = job.match.matched_skills ?? [];
                  const missing = job.match.missing_skills ?? [];
                  const topMatched = matched.slice(0, 3);
                  const topMissing = missing.slice(0, 3);
                  const remainingMatched = matched.length - topMatched.length;
                  const remainingMissing = missing.length - topMissing.length;

                  return (
                    <SurfaceCard
                      key={job.id}
                      className="p-5 sm:p-6 transition-all duration-150 hover:border-foreground/30 space-y-4"
                    >
                      {/* Top row */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="text-base sm:text-lg font-semibold text-foreground hover:text-brand transition-colors line-clamp-1"
                          >
                            {job.title}
                          </Link>
                          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                            {job.company_name} · {job.location}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/80">
                            <span>{labelJobType(job.job_type)}</span>
                            <span className="text-muted-foreground" aria-hidden>·</span>
                            <span>{labelWorkMode(job.work_mode)}</span>
                            <span className="text-muted-foreground" aria-hidden>·</span>
                            <span>{formatSalary(job)}</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex sm:flex-col sm:items-end gap-2">
                          <MatchBadge score={job.match.score} size="default" />
                        </div>
                      </div>

                      {/* Skills breakdown chips */}
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        {topMatched.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground shrink-0 mr-1">
                              Matched:
                            </span>
                            {topMatched.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                              >
                                <Check className="size-2.5 shrink-0" aria-hidden />
                                <span>{formatSkill(s)}</span>
                              </span>
                            ))}
                            {remainingMatched > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +{remainingMatched} more
                              </span>
                            )}
                          </div>
                        )}

                        {topMissing.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground shrink-0 mr-1">
                              Skills to build:
                            </span>
                            {topMissing.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                              >
                                <Plus className="size-2.5 shrink-0 opacity-70" aria-hidden />
                                <span>{formatSkill(s)}</span>
                              </span>
                            ))}
                            {remainingMissing > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +{remainingMissing} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom row */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">
                          Posted {formatPostedDate(job.created_at)}
                        </span>
                        <LinkButton
                          href={`/jobs/${job.id}`}
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                        >
                          View job →
                        </LinkButton>
                      </div>
                    </SurfaceCard>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)} of {total} jobs
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-full text-xs"
                  >
                    <ChevronLeft className="size-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-full text-xs"
                  >
                    Next
                    <ChevronRight className="size-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<RecommendationsSkeleton />}>
      <RecommendationsContent />
    </Suspense>
  );
}
