"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import {
  CardHeader,
  HatchedPlaceholder,
  SurfaceCard,
} from "@/components/ui/SurfaceCard";
import StatChip from "@/components/ui/StatChip";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkButton } from "@/components/ui/button";
import {
  listAdminUsers,
  listJobApplications,
  listJobs,
  listMyApplications,
  listMyJobs,
  listResumes,
  resendVerification,
  updateMe,
  type Application,
  type Job,
  type Resume,
  type User,
} from "@/lib/api";
import {
  formatApplicationDate,
  labelApplicationStatus,
  statusBadgeClass,
} from "@/lib/applications";
import { getFirstName, greetingForNow } from "@/lib/nav";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import GettingStartedCard from "@/components/GettingStartedCard";
import { cn } from "@/lib/utils";

type DashStats = {
  chips: { label: string; value: string | number }[];
  loading: boolean;
  error: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { toast } = useToast();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [nameDismissed, setNameDismissed] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashStats>({
    chips: [],
    loading: true,
    error: null,
  });
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [applicationsTotal, setApplicationsTotal] = useState(0);
  const [activeApplicationsCount, setActiveApplicationsCount] = useState(0);
  const [employerTotalApplicants, setEmployerTotalApplicants] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setStats((s) => ({ ...s, loading: true, error: null }));
      try {
        if (user!.role === "candidate") {
          const [cvs, jobsRes, appsRes] = await Promise.all([
            listResumes("active"),
            listJobs({ page: 1, page_size: 1 }),
            listMyApplications({ page: 1, page_size: 5 }),
          ]);
          if (cancelled) return;
          setResumes(cvs);
          setMyApplications(appsRes.items);
          setApplicationsTotal(appsRes.total);
          const activeCount = appsRes.items.filter((a) =>
            ["applied", "under_review", "shortlisted", "interview"].includes(
              a.status
            )
          ).length;
          setActiveApplicationsCount(activeCount);
          setStats({
            loading: false,
            error: null,
            chips: [
              { label: "Active CVs", value: cvs.length },
              { label: "Applications", value: appsRes.total },
              { label: "Open jobs", value: jobsRes.total },
            ],
          });
        } else if (user!.role === "employer") {
          const mine = await listMyJobs(1, 50);
          if (cancelled) return;
          setJobs(mine.items);
          const active = mine.items.filter((j) => j.status === "active").length;
          const filled = mine.items.filter(
            (j) => j.status === "closed_filled"
          ).length;

          let totalApplicants = 0;
          const sampleJobs = mine.items.slice(0, 10);
          if (sampleJobs.length > 0) {
            try {
              const appCounts = await Promise.all(
                sampleJobs.map((j) =>
                  listJobApplications(j.id, { page: 1, page_size: 1 })
                )
              );
              totalApplicants = appCounts.reduce(
                (sum, res) => sum + res.total,
                0
              );
            } catch {
              // ignore count error
            }
          }
          if (cancelled) return;
          setEmployerTotalApplicants(totalApplicants);
          setStats({
            loading: false,
            error: null,
            chips: [
              { label: "Active jobs", value: active },
              { label: "Filled jobs", value: filled },
              { label: "Total applicants", value: totalApplicants },
            ],
          });
        } else if (user!.role === "admin") {
          const [all, pending] = await Promise.all([
            listAdminUsers({ page: 1, page_size: 1 }),
            listAdminUsers({
              page: 1,
              page_size: 5,
              status: "pending_verification",
            }),
          ]);
          if (cancelled) return;
          setPendingUsers(pending.items);
          setStats({
            loading: false,
            error: null,
            chips: [
              { label: "Total users", value: all.total },
              { label: "Pending", value: pending.total },
            ],
          });
        } else {
          setStats({ loading: false, error: null, chips: [] });
        }
      } catch {
        if (!cancelled) {
          setStats({
            loading: false,
            error: "Could not load dashboard stats.",
            chips: [],
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onResendVerification() {
    if (!user) return;
    setResendMsg(null);
    setResendLoading(true);
    try {
      await resendVerification(user.email);
      toast.info("Verification email sent");
    } catch {
      toast.error("Could not send verification email");
    } finally {
      setResendMsg("If that email needs verification, a new link has been sent.");
      setResendLoading(false);
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = nameInput.trim().replace(/\s+/g, " ");
    if (cleaned.length < 2 || cleaned.length > 80 || /[<>]/.test(cleaned)) {
      setNameError("Please enter a valid name (2–80 characters).");
      return;
    }
    setNameError(null);
    setNameSaving(true);
    try {
      await updateMe({ full_name: cleaned });
      await refreshUser();
      toast.success("Name updated successfully");
    } catch {
      setNameError("Could not update name. Please try again.");
      toast.error("Could not update name");
    } finally {
      setNameSaving(false);
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  const first = getFirstName(user);
  const greeting = `${greetingForNow()}, ${first}`;

  return (
    <DashboardShell>
      <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {greeting}
      </h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        {user.role === "candidate" &&
          "Track your CVs and discover open roles."}
        {user.role === "employer" &&
          "Manage postings and grow your hiring pipeline."}
        {user.role === "admin" &&
          "Review accounts and keep the platform healthy."}
        {user.role === "interviewer" &&
          "Your interview tools will appear here soon."}
      </p>

      {!user.full_name && !nameDismissed && (
        <div className="mt-5 rounded-3xl border border-border bg-card p-4 text-foreground shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Add your name to personalise your account</p>
            <button
              type="button"
              onClick={() => setNameDismissed(true)}
              aria-label="Dismiss banner"
              className="text-muted-foreground hover:text-foreground cursor-pointer text-sm p-1"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSaveName} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your full name"
              maxLength={80}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={nameSaving || !nameInput.trim()}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition-all hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {nameSaving ? "Saving..." : "Save"}
            </button>
          </form>
          {nameError && <p className="mt-2 text-xs text-destructive">{nameError}</p>}
        </div>
      )}

      {!user.email_verified && (
        <div className="mt-5 rounded-3xl border border-sky-300/60 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Please verify your email</p>
            <button
              type="button"
              disabled={resendLoading}
              onClick={onResendVerification}
              className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-foreground transition-all duration-150 hover:brightness-95 active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              {resendLoading ? "Sending..." : "Resend verification email"}
            </button>
          </div>
          {resendMsg && <p className="mt-2">{resendMsg}</p>}
        </div>
      )}

      {user.status === "pending_verification" && (
        <div className="mt-5 rounded-3xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Your account is waiting for verification. An admin will review it
          before you can use all features.
        </div>
      )}

      {user.role !== "admin" && (
        <div className="mt-5">
          <GettingStartedCard
            userId={user.id}
            role={user.role}
            hasName={Boolean(user.full_name)}
            emailVerified={user.email_verified}
            userStatus={user.status}
            cvCount={resumes.length}
            hasAnalyzedCv={resumes.some((r) => r.parse_status === "ok")}
            applicationsCount={applicationsTotal}
            jobsCount={jobs.length}
            applicantsCount={employerTotalApplicants ?? 0}
            onAddNameClick={() => {
              setNameDismissed(false);
            }}
          />
        </div>
      )}

      {stats.error && (
        <p className="mt-4 text-sm text-destructive">{stats.error}</p>
      )}

      {stats.chips.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {stats.chips.map((c) => (
            <StatChip
              key={c.label}
              label={c.label}
              value={c.value}
              loading={stats.loading}
            />
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {user.role === "candidate" && (
          <>
            <SurfaceCard>
              <CardHeader
                title="Your CVs"
                subtitle="Active resumes on your profile"
                action={
                  <LinkButton href="/candidate/resumes" variant="ghost" size="sm">
                    Manage
                  </LinkButton>
                }
              />
              {stats.loading ? (
                <Skeleton className="h-20 w-full rounded-2xl" />
              ) : resumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No CVs yet. Upload your first CV.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {resumes.slice(0, 3).map((r) => (
                    <li key={r.id} className="truncate text-foreground">
                      {r.title}
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>
            <SurfaceCard>
              <CardHeader
                title="Find jobs"
                subtitle="Browse open IT roles"
              />
              <LinkButton href="/jobs" variant="brand">
                Browse jobs
              </LinkButton>
            </SurfaceCard>
            <SurfaceCard className="md:col-span-2">
              <CardHeader
                title="Applications"
                subtitle={
                  applicationsTotal > 0
                    ? `${applicationsTotal} submitted · ${activeApplicationsCount} in progress`
                    : "Track applications in one place"
                }
                action={
                  <LinkButton
                    href="/candidate/applications"
                    variant="ghost"
                    size="sm"
                  >
                    View all
                  </LinkButton>
                }
              />
              {stats.loading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : myApplications.length === 0 ? (
                <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
                  <p>You have not applied to any jobs yet.</p>
                  <LinkButton href="/jobs" variant="brand" size="sm">
                    Browse jobs
                  </LinkButton>
                </div>
              ) : (
                <div className="space-y-3">
                  <ul className="divide-y divide-border/60">
                    {myApplications.slice(0, 3).map((app) => (
                      <li
                        key={app.id}
                        className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/jobs/${app.job_id}`}
                            className="truncate text-sm font-medium text-foreground hover:underline"
                          >
                            {app.job_title}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {app.company_name} · Applied{" "}
                            {formatApplicationDate(app.created_at)}
                          </p>
                        </div>
                        <div className="shrink-0 pt-1 sm:pt-0">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border capitalize",
                              statusBadgeClass(app.status)
                            )}
                          >
                            {labelApplicationStatus(app.status)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <LinkButton
                      href="/candidate/applications"
                      variant="outline"
                      size="sm"
                    >
                      View all applications ({applicationsTotal})
                    </LinkButton>
                  </div>
                </div>
              )}
            </SurfaceCard>
          </>
        )}

        {user.role === "employer" && (
          <>
            <SurfaceCard>
              <CardHeader
                title="Your jobs"
                subtitle="Latest postings"
                action={
                  <LinkButton href="/employer/jobs" variant="ghost" size="sm">
                    View all
                  </LinkButton>
                }
              />
              {stats.loading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have not posted any jobs yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {jobs.slice(0, 5).map((j) => (
                    <li
                      key={j.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{j.title}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                        {j.status.replace("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <LinkButton href="/employer/jobs/new" variant="brand" className="mt-4">
                Post a job
              </LinkButton>
            </SurfaceCard>
            <SurfaceCard>
              <CardHeader
                title="Applicants"
                subtitle={
                  employerTotalApplicants !== null && employerTotalApplicants > 0
                    ? `${employerTotalApplicants} total candidate application${
                        employerTotalApplicants === 1 ? "" : "s"
                      }`
                    : "Review candidates who applied"
                }
                action={
                  <LinkButton href="/employer/jobs" variant="ghost" size="sm">
                    Manage jobs
                  </LinkButton>
                }
              />
              {stats.loading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Post a job to start receiving applications.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {employerTotalApplicants !== null && employerTotalApplicants > 0
                      ? `${employerTotalApplicants} candidate application${
                          employerTotalApplicants === 1 ? "" : "s"
                        } across your recent postings.`
                      : "No candidate applications yet on your posted jobs."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <LinkButton href="/employer/jobs" variant="brand" size="sm">
                      Review applicants
                    </LinkButton>
                  </div>
                </div>
              )}
            </SurfaceCard>
          </>
        )}

        {user.role === "admin" && (
          <>
            <SurfaceCard>
              <CardHeader
                title="Pending verifications"
                subtitle="Employers & interviewers awaiting review"
                action={
                  <LinkButton href="/admin/verifications" variant="ghost" size="sm">
                    Open
                  </LinkButton>
                }
              />
              {stats.loading ? (
                <Skeleton className="h-20 w-full rounded-2xl" />
              ) : pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending verifications.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {pendingUsers.slice(0, 5).map((u) => (
                    <li key={u.id} className="truncate">
                      {u.email}{" "}
                      <span className="text-muted-foreground">· {u.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>
            <SurfaceCard>
              <CardHeader title="Users" subtitle="Browse and manage accounts" />
              <LinkButton href="/admin/users" variant="brand">
                Manage users
              </LinkButton>
            </SurfaceCard>
            <SurfaceCard variant="feature" className="md:col-span-2">
              <CardHeader title="Platform" subtitle="Insights across Skillio" />
              <p className="text-sm text-ink-foreground/80">
                Analytics coming soon
              </p>
              <HatchedPlaceholder dark />
            </SurfaceCard>
          </>
        )}

        {user.role === "interviewer" && (
          <>
            <SurfaceCard>
              <CardHeader
                title="Welcome"
                subtitle="Your interviewer workspace"
              />
              <p className="text-sm text-muted-foreground">
                {user.status === "pending_verification"
                  ? "Your account is pending approval. You will get full access once an admin verifies you."
                  : "Interview scheduling tools will appear here soon."}
              </p>
            </SurfaceCard>
            <SurfaceCard variant="feature">
              <CardHeader title="Interviews" subtitle="Upcoming sessions" />
              <p className="text-sm text-ink-foreground/80">Coming soon</p>
              <HatchedPlaceholder dark />
            </SurfaceCard>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
