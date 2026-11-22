"use client";

import { useState, useSyncExternalStore } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Sparkles,
  X,
} from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Role, UserStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  actionHref?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  note?: string;
  disabled?: boolean;
}

interface GettingStartedProps {
  userId: string;
  role: Role;
  hasName: boolean;
  emailVerified: boolean;
  userStatus: UserStatus;
  // candidate metrics
  cvCount?: number;
  hasAnalyzedCv?: boolean;
  applicationsCount?: number;
  // employer metrics
  jobsCount?: number;
  applicantsCount?: number;
  onAddNameClick?: () => void;
}

export default function GettingStartedCard({
  userId,
  role,
  hasName,
  emailVerified,
  userStatus,
  cvCount = 0,
  hasAnalyzedCv = false,
  applicationsCount = 0,
  jobsCount = 0,
  applicantsCount = 0,
  onAddNameClick,
}: GettingStartedProps) {
  const [userDismissed, setUserDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const storageKey = `skillio_onboarding_dismissed_${userId}`;

  const isDismissedInStorage = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
    () => {
      try {
        return localStorage.getItem(storageKey) === "true";
      } catch {
        return false;
      }
    },
    () => true
  );

  function handleDismiss() {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // LocalStorage unavailable
    }
    setUserDismissed(true);
  }

  if (userDismissed || isDismissedInStorage || role === "admin") {
    return null;
  }

  // Define steps according to role
  let steps: OnboardingStep[] = [];

  if (role === "candidate") {
    steps = [
      {
        id: "name",
        title: "Add your full name",
        description: "Help employers identify and address you properly.",
        completed: hasName,
        actionLabel: "Add name",
        onActionClick: onAddNameClick,
      },
      {
        id: "email",
        title: "Verify your email address",
        description: "Confirm your email to enable job applications.",
        completed: emailVerified,
      },
      {
        id: "upload_cv",
        title: "Upload a CV",
        description: "Upload a PDF or Word document to your profile.",
        completed: cvCount > 0,
        actionHref: "/candidate/resumes",
        actionLabel: "Upload CV",
      },
      {
        id: "analyze_cv",
        title: "Analyze your CV with AI",
        description: "Extract and verify technical skills and experience.",
        completed: hasAnalyzedCv,
        actionHref: "/candidate/resumes",
        actionLabel: "Analyze CV",
      },
      {
        id: "apply",
        title: "Apply to your first IT job",
        description: "Browse curated positions and submit your profile.",
        completed: applicationsCount > 0,
        actionHref: "/jobs",
        actionLabel: "Browse jobs",
      },
    ];
  } else if (role === "employer") {
    const isApproved = userStatus === "active";
    steps = [
      {
        id: "name",
        title: "Add your company contact name",
        description: "Personalise your hiring profile.",
        completed: hasName,
        actionLabel: "Add name",
        onActionClick: onAddNameClick,
      },
      {
        id: "email",
        title: "Verify your work email",
        description: "Required for receiving applicant updates.",
        completed: emailVerified,
      },
      {
        id: "approval",
        title: "Wait for admin approval",
        completed: isApproved,
        note: !isApproved
          ? "An admin will review your account. You can post jobs after approval."
          : undefined,
      },
      {
        id: "post_job",
        title: "Post your first IT role",
        description: "Publish requirements and start attracting talent.",
        completed: jobsCount > 0,
        actionHref: "/employer/jobs/new",
        actionLabel: "Post a job",
        disabled: !isApproved,
        note: !isApproved ? "Available after approval" : undefined,
      },
      {
        id: "review_applicants",
        title: "Review applicants",
        description: "Screen CVs, shortlist candidates, or change hiring status.",
        completed: applicantsCount > 0,
        actionHref: "/employer/jobs",
        actionLabel: "Review applicants",
        disabled: !isApproved,
        note: !isApproved ? "Available after approval" : undefined,
      },
    ];
  } else if (role === "interviewer") {
    const isApproved = userStatus === "active";
    steps = [
      {
        id: "name",
        title: "Add your full name",
        completed: hasName,
        actionLabel: "Add name",
        onActionClick: onAddNameClick,
      },
      {
        id: "email",
        title: "Verify your email",
        completed: emailVerified,
      },
      {
        id: "approval",
        title: "Wait for admin verification",
        completed: isApproved,
        note: "Interview scheduling tools will appear as soon as your account is reviewed.",
      },
    ];
  }

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const allCompleted = completedCount === totalCount;

  return (
    <SurfaceCard className="relative overflow-hidden transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Sparkles className="size-3.5" />
            </span>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Getting started with Skillio
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {allCompleted
              ? "You're all set! You have completed all onboarding steps."
              : `${completedCount} of ${totalCount} steps completed`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand onboarding steps" : "Collapse onboarding steps"}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            {collapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss onboarding card"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
          style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
        />
      </div>

      {/* Steps List */}
      {!collapsed && (
        <div className="mt-4 divide-y divide-border/60">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium leading-snug",
                      step.completed
                        ? "text-muted-foreground line-through decoration-border"
                        : "text-foreground"
                    )}
                  >
                    {idx + 1}. {step.title}
                  </p>
                  {step.description && !step.completed && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                  {step.note && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      {step.note}
                    </p>
                  )}
                </div>
              </div>

              {!step.completed && (step.actionHref || step.onActionClick || step.disabled) && (
                <div className="shrink-0 pl-7 sm:pl-0">
                  {step.disabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      className="rounded-full text-xs h-7 px-3"
                    >
                      {step.actionLabel ?? "Open"}
                    </Button>
                  ) : step.actionHref ? (
                    <LinkButton
                      href={step.actionHref}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs h-7 px-3"
                    >
                      {step.actionLabel ?? "Open"}
                    </LinkButton>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={step.onActionClick}
                      className="rounded-full text-xs h-7 px-3"
                    >
                      {step.actionLabel ?? "Start"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
