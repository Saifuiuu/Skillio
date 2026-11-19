"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Code2,
  FileText,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { LinkButton } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

type AudienceTab = "candidates" | "employers" | "interviewers";

export default function Home() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AudienceTab>("candidates");

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl space-y-16 py-4 md:py-8">
        {/* Hero Section */}
        <section className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">
              <Sparkles className="size-3.5 text-brand" />
              Verified IT hiring platform
            </span>

            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl leading-[1.1]">
              Practical hiring for software teams.
            </h1>

            <p className="max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
              Find verified IT roles, analyze and structure your CV with local AI, and track applications directly from submission to offer.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <LinkButton
                href="/jobs"
                variant="brand"
                size="lg"
                className="rounded-full shadow-sm text-sm"
              >
                <Search className="mr-1.5 size-4" />
                Browse open jobs
              </LinkButton>
              {user ? (
                <LinkButton
                  href="/dashboard"
                  variant="outline"
                  size="lg"
                  className="rounded-full text-sm"
                >
                  Go to dashboard
                  <ArrowRight className="ml-1.5 size-4" />
                </LinkButton>
              ) : (
                <LinkButton
                  href="/register"
                  variant="outline"
                  size="lg"
                  className="rounded-full text-sm"
                >
                  Create an account
                  <ArrowRight className="ml-1.5 size-4" />
                </LinkButton>
              )}
            </div>
          </div>

          {/* Interactive UI Mock Preview */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl border border-border bg-card p-5 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3.5">
                <div>
                  <span className="text-xs font-medium text-brand">Featured Role</span>
                  <h3 className="text-base font-semibold text-foreground">
                    Senior Full-Stack Engineer
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    CloudCore Labs · Karachi (Hybrid)
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Active
                </span>
              </div>

              {/* Skills Tags */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Required Stack
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["TypeScript", "FastAPI", "PostgreSQL", "Docker", "Next.js"].map(
                    (skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground"
                      >
                        {skill}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* AI Parser Match Callout */}
              <div className="rounded-2xl border border-border bg-muted/40 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-medium text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-brand" />
                    CV Parser Result
                  </span>
                  <span className="text-brand font-semibold">92% IT relevance</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Extracted 5 key skills · 4.5 years estimated experience
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-foreground">
                  $1,400 – $2,000{" "}
                  <span className="text-muted-foreground font-normal">/ month</span>
                </span>
                <span className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground shadow-xs">
                  Apply Now
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              How Skillio works
            </h2>
            <p className="text-sm text-muted-foreground">
              A transparent, step-by-step workflow built specifically for technical hiring.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-border/80 pb-3">
            {(
              [
                { id: "candidates", label: "For Candidates" },
                { id: "employers", label: "For Employers" },
                { id: "interviewers", label: "For Interviewers" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-all cursor-pointer",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Candidate Workflow */}
          {activeTab === "candidates" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  1
                </span>
                <h3 className="text-sm font-semibold text-foreground">Upload CV</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload a PDF or Word document. Skillio extracts raw document text immediately.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  2
                </span>
                <h3 className="text-sm font-semibold text-foreground">AI CV Analysis</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Local AI structures your technical skills, experience history, and degree credentials.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  3
                </span>
                <h3 className="text-sm font-semibold text-foreground">Browse Jobs</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Search positions by role, category, location, work mode, and technology stack.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  4
                </span>
                <h3 className="text-sm font-semibold text-foreground">Apply & Track</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Apply in one click with your active CV. Track real review, shortlist, or selection stages.
                </p>
              </SurfaceCard>
            </div>
          )}

          {/* Employer Workflow */}
          {activeTab === "employers" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  1
                </span>
                <h3 className="text-sm font-semibold text-foreground">Admin Verification</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Register with your company email. Administrators review employer accounts to keep jobs authentic.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  2
                </span>
                <h3 className="text-sm font-semibold text-foreground">Publish Roles</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Post detailed software positions with salary ranges, work mode, and required skills.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  3
                </span>
                <h3 className="text-sm font-semibold text-foreground">Review Candidates</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inspect incoming applicants, read cover notes, and download original candidate CV files.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  4
                </span>
                <h3 className="text-sm font-semibold text-foreground">Update Pipeline</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Move candidates through Under Review, Shortlist, Interview, or Selected states.
                </p>
              </SurfaceCard>
            </div>
          )}

          {/* Interviewer Workflow */}
          {activeTab === "interviewers" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  1
                </span>
                <h3 className="text-sm font-semibold text-foreground">Verified Onboarding</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Interviewers register and await administrator approval to join the evaluation team.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  2
                </span>
                <h3 className="text-sm font-semibold text-foreground">Technical Review</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Access parsed candidate technical strengths, project histories, and experience depth.
                </p>
              </SurfaceCard>
              <SurfaceCard className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                    3
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Coming soon
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Live Sessions</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dedicated scheduling, availability management, and structured interview rubrics.
                </p>
              </SurfaceCard>
            </div>
          )}
        </section>

        {/* What Is Built vs In Progress */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Platform Features
            </h2>
            <p className="text-sm text-muted-foreground">
              A clear look at live working capabilities and upcoming roadmap items.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SurfaceCard className="space-y-2">
              <div className="flex items-center justify-between">
                <Code2 className="size-5 text-brand" />
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Live
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Job Search & Filtering
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Keyword search across title, description, and requirements with instant location, work mode, and category filters.
              </p>
            </SurfaceCard>

            <SurfaceCard className="space-y-2">
              <div className="flex items-center justify-between">
                <FileText className="size-5 text-brand" />
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Live
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                CV Upload & Text Extraction
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Support for PDF and DOCX documents with automated server-side content extraction and preview.
              </p>
            </SurfaceCard>

            <SurfaceCard className="space-y-2">
              <div className="flex items-center justify-between">
                <Sparkles className="size-5 text-brand" />
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Live
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Local AI CV Parsing
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Privacy-focused local LLM extraction of skills, career timeline, education, and domain relevance score.
              </p>
            </SurfaceCard>

            <SurfaceCard className="space-y-2">
              <div className="flex items-center justify-between">
                <Layers className="size-5 text-brand" />
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Live
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Application Pipeline Tracking
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Full lifecycle tracking: Applied, Under Review, Shortlisted, Interview, Selected, Rejected, and Withdrawn.
              </p>
            </SurfaceCard>

            <SurfaceCard className="space-y-2">
              <div className="flex items-center justify-between">
                <ShieldCheck className="size-5 text-brand" />
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Live
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Admin Verification & Governance
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Employer account reviews, user status controls, and role-based permissions preventing spam postings.
              </p>
            </SurfaceCard>

            <SurfaceCard className="space-y-2">
              <div className="flex items-center justify-between">
                <Users className="size-5 text-muted-foreground" />
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                  In progress
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Automated Candidate Matching
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Multi-factor matching score comparing candidate extracted skills with posted job requirements.
              </p>
            </SurfaceCard>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/80 pt-8 pb-12 text-xs text-muted-foreground">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground tracking-tight text-sm">
                  Skillio
                </span>
                <span>·</span>
                <span>Final year project, SZABIST</span>
              </div>
              <p>Designed and built for modern IT recruitment.</p>
            </div>

            <div className="flex flex-wrap gap-4 pt-1 sm:pt-0">
              <Link href="/jobs" className="hover:text-foreground transition-colors">
                Browse jobs
              </Link>
              <Link href="/login" className="hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="hover:text-foreground transition-colors">
                Create account
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </PublicShell>
  );
}
