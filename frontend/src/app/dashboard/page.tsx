"use client";

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
  listJobs,
  listMyJobs,
  listResumes,
  resendVerification,
  type Job,
  type Resume,
  type User,
} from "@/lib/api";
import { displayNameFromEmail, greetingForNow } from "@/lib/nav";
import { useAuth } from "@/components/AuthProvider";

type DashStats = {
  chips: { label: string; value: string | number }[];
  loading: boolean;
  error: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<DashStats>({
    chips: [],
    loading: true,
    error: null,
  });
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);

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
          const [cvs, jobsRes] = await Promise.all([
            listResumes("active"),
            listJobs({ page: 1, page_size: 1 }),
          ]);
          if (cancelled) return;
          setResumes(cvs);
          setStats({
            loading: false,
            error: null,
            chips: [
              { label: "Active CVs", value: cvs.length },
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
          setStats({
            loading: false,
            error: null,
            chips: [
              { label: "Active jobs", value: active },
              { label: "Filled jobs", value: filled },
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
    } catch {
      /* generic */
    } finally {
      setResendMsg("If that email needs verification, a new link has been sent.");
      setResendLoading(false);
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  const first = displayNameFromEmail(user.email);
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
            <SurfaceCard variant="feature" className="md:col-span-2">
              <CardHeader
                title="Applications"
                subtitle="Track applications in one place"
              />
              <p className="text-sm text-ink-foreground/80">Coming soon</p>
              <HatchedPlaceholder dark />
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
            <SurfaceCard variant="feature">
              <CardHeader
                title="Applicants"
                subtitle="Review candidate matches"
              />
              <p className="text-sm text-ink-foreground/80">Coming soon</p>
              <HatchedPlaceholder dark />
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
