"use client";

import { useEffect, useState } from "react";
import { Sparkles, Briefcase } from "lucide-react";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkButton } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, getJobMatch, type Match } from "@/lib/api";
import MatchBadge from "./MatchBadge";
import MatchInfoNotice from "./MatchInfoNotice";
import SkillGapPanel from "./SkillGapPanel";
import MatchResumeSelector from "./MatchResumeSelector";
import { useMatchResume } from "./useMatchResume";

export interface JobMatchCardProps {
  jobId: string;
}

export default function JobMatchCard({ jobId }: JobMatchCardProps) {
  const { user } = useAuth();
  const {
    parsedResumes,
    selectedResumeId,
    selectResume,
    loading: loadingResumes,
    hasParsedCV,
  } = useMatchResume();

  const [match, setMatch] = useState<Match | null>(null);
  const [loadingMatch, setLoadingMatch] = useState<boolean>(false);
  const [hidden, setHidden] = useState<boolean>(false);
  const [needsAnalysis, setNeedsAnalysis] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMatch() {
      await Promise.resolve();
      if (cancelled) return;

      if (!user || user.role !== "candidate" || !selectedResumeId) {
        setMatch(null);
        return;
      }

      setLoadingMatch(true);
      setHidden(false);
      setNeedsAnalysis(false);

      try {
        const data = await getJobMatch(jobId, selectedResumeId!);
        if (!cancelled) {
          setMatch(data);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 404) {
            // Quietly hide card on 404
            setHidden(true);
            setMatch(null);
          } else if (err.status === 409) {
            // CV not parsed or needs analysis
            setNeedsAnalysis(true);
            setMatch(null);
          } else {
            setHidden(true);
            setMatch(null);
          }
        } else {
          setHidden(true);
          setMatch(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingMatch(false);
        }
      }
    }

    void loadMatch();
    return () => {
      cancelled = true;
    };
  }, [user, jobId, selectedResumeId]);

  // Employer, admin, or logged-out users NEVER see this card
  if (!user || user.role !== "candidate" || hidden) {
    return null;
  }

  // Loading initial resume list
  if (loadingResumes) {
    return (
      <SurfaceCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </SurfaceCard>
    );
  }

  // Candidate has no parsed CV yet
  if (!hasParsedCV) {
    return (
      <SurfaceCard className="p-6 border-dashed border-border bg-card/60">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">
              See how your CV matches this job
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Analyze your CV to view your match score, matched skills, and skills to build.
            </p>
            <div className="mt-3">
              <LinkButton
                href="/candidate/resumes"
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
              >
                Analyze your CV to see your match →
              </LinkButton>
            </div>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  // 409 Conflict: CV needs analysis
  if (needsAnalysis) {
    return (
      <SurfaceCard className="p-6 border-dashed border-border bg-card/60">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Analyze your CV first
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              This CV has not been analyzed yet. Run analysis on your CV to view your match score and skill breakdown.
            </p>
            <div className="mt-3">
              <LinkButton
                href="/candidate/resumes"
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
              >
                Go to My CVs →
              </LinkButton>
            </div>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  // Loading match calculation
  if (loadingMatch) {
    return (
      <SurfaceCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-4 w-60" />
      </SurfaceCard>
    );
  }

  if (!match) {
    return null;
  }

  // Format experience note
  let experienceNote: string;
  if (!match.experience_known) {
    experienceNote = "Experience not found in your CV";
  } else {
    const candidateYears = match.candidate_experience_years ?? 0;
    const yearLabel = candidateYears === 1 ? "year" : "years";
    experienceNote = `Your CV indicates ${candidateYears} ${yearLabel} of experience (Job requires ${match.job_experience_min}–${match.job_experience_max} years).`;
  }

  return (
    <SurfaceCard className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Your match</h3>
            <MatchBadge score={match.score} size="default" />
          </div>
          <div className="mt-1">
            <MatchInfoNotice size="sm" />
          </div>
        </div>

        {/* CV Selector if multiple */}
        {parsedResumes.length > 1 && (
          <div className="shrink-0 pt-1 sm:pt-0">
            <MatchResumeSelector
              parsedResumes={parsedResumes}
              selectedResumeId={selectedResumeId}
              onSelect={selectResume}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Experience fit */}
      <div className="flex items-center gap-2 text-xs text-foreground/80">
        <Briefcase className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium text-muted-foreground">Experience fit:</span>
        <span>{experienceNote}</span>
      </div>

      {/* Skills breakdown */}
      <SkillGapPanel
        matchedSkills={match.matched_skills}
        missingSkills={match.missing_skills}
      />
    </SurfaceCard>
  );
}
