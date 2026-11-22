"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardHeader, SurfaceCard } from "@/components/ui/SurfaceCard";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MatchBadge from "./MatchBadge";
import { useMatchResume } from "./useMatchResume";
import { getRecommendations, type JobMatch } from "@/lib/api";

interface CandidateTopMatchesCardProps {
  className?: string;
}

export default function CandidateTopMatchesCard({
  className,
}: CandidateTopMatchesCardProps) {
  const { selectedResumeId, hasParsedCV, loading: resumeLoading } = useMatchResume();
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTopMatches() {
      await Promise.resolve();
      if (cancelled || !selectedResumeId) return;
      setLoading(true);
      setError(false);
      try {
        const res = await getRecommendations({
          resume_id: selectedResumeId,
          page: 1,
          page_size: 3,
        });
        if (!cancelled) {
          setMatches(res.items);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setMatches([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (hasParsedCV && selectedResumeId) {
      void loadTopMatches();
    }

    return () => {
      cancelled = true;
    };
  }, [hasParsedCV, selectedResumeId]);

  return (
    <SurfaceCard className={className}>
      <CardHeader
        title="Top matches"
        subtitle="Roles matching your skills and experience"
        action={
          hasParsedCV && matches.length > 0 ? (
            <LinkButton
              href="/candidate/recommendations"
              variant="ghost"
              size="sm"
            >
              View all
            </LinkButton>
          ) : undefined
        }
      />

      {/* Skeletons: while checking resumes or loading recommendations */}
      {(resumeLoading || (loading && matches.length === 0)) && (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      )}

      {/* No parsed CV CTA */}
      {!resumeLoading && !hasParsedCV && (
        <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
          <p>Analyze your CV to see your top job matches.</p>
          <LinkButton href="/candidate/resumes" variant="brand" size="sm">
            Analyze your CV
          </LinkButton>
        </div>
      )}

      {/* Error state */}
      {!resumeLoading && hasParsedCV && !loading && error && (
        <div className="py-2 text-sm text-muted-foreground">
          <p>Could not load recommendations at this time.</p>
        </div>
      )}

      {/* Empty state: parsed CV but 0 matches */}
      {!resumeLoading && hasParsedCV && !loading && !error && matches.length === 0 && (
        <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
          <p>No matching jobs found right now. Check back as new jobs are posted.</p>
          <LinkButton href="/jobs" variant="outline" size="sm">
            Browse all jobs
          </LinkButton>
        </div>
      )}

      {/* Loaded matches */}
      {!resumeLoading && hasParsedCV && !error && matches.length > 0 && (
        <div className="space-y-3">
          <ul className="divide-y divide-border/60">
            {matches.map((job) => (
              <li
                key={job.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="truncate block text-sm font-medium text-foreground hover:underline"
                  >
                    {job.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {job.company_name} · {job.location}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 pt-1 sm:pt-0">
                  <MatchBadge score={job.match.score} size="sm" />
                  <LinkButton href={`/jobs/${job.id}`} variant="outline" size="sm">
                    View job
                  </LinkButton>
                </div>
              </li>
            ))}
          </ul>
          <div className="pt-1">
            <LinkButton
              href="/candidate/recommendations"
              variant="outline"
              size="sm"
            >
              View all recommendations
            </LinkButton>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
