"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import Tabs from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatUserDate,
  labelRole,
  labelUserStatus,
  statusBadgeClass,
} from "@/lib/admin";
import {
  approveUser,
  listAdminUsers,
  updateUserStatus,
  type Role,
  type User,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const PAGE_SIZE = 20;

type Tab = "pending" | "rejected";

async function loadMerged(
  status: "pending_verification" | "suspended",
  page: number
): Promise<{ items: User[]; total: number }> {
  const [employers, interviewers] = await Promise.all([
    listAdminUsers({
      page: 1,
      page_size: 100,
      role: "employer",
      status,
    }),
    listAdminUsers({
      page: 1,
      page_size: 100,
      role: "interviewer",
      status,
    }),
  ]);

  let merged = [...employers.items, ...interviewers.items];
  if (status === "suspended") {
    merged = merged.filter((u) => !u.approved_at);
  }
  merged.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const start = (page - 1) * PAGE_SIZE;
  return {
    total: merged.length,
    items: merged.slice(start, start + PAGE_SIZE),
  };
}

export default function AdminVerificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      const status =
        tab === "pending" ? "pending_verification" : "suspended";
      const res = await loadMerged(status, page);
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setError("Something went wrong. Please try again.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user?.role === "admin") {
      let cancelled = false;
      loadUsers().then(() => { if (cancelled) return; });
      return () => { cancelled = true; };
    }
  }, [user, loadUsers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onApprove(target: User) {
    setActingId(target.id);
    setMessage(null);
    setError(null);
    try {
      await approveUser(target.id);
      setMessage(`${target.email} has been approved.`);
      await loadUsers();
    } catch {
      setError("Could not approve this user. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function onReject(target: User) {
    if (
      !window.confirm(
        `Reject ${target.email}? Their status will be set to suspended. A rejection reason is not stored yet.`
      )
    ) {
      return;
    }
    setActingId(target.id);
    setMessage(null);
    setError(null);
    try {
      await updateUserStatus(target.id, "suspended");
      setMessage(`${target.email} has been rejected.`);
      await loadUsers();
    } catch {
      setError("Could not reject this user. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardShell>
      <h2 className="text-2xl font-semibold text-foreground">Verifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Approve or reject employers and interviewers waiting for review.
      </p>

      <div className="mt-6">
        <Tabs<Tab>
          value={tab}
          onChange={(newTab) => {
            setTab(newTab);
            setPage(1);
            setLoading(true);
          }}
          items={[
            { value: "pending", label: "Pending" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </div>

      {message && (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Email verified</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-4 py-3" colSpan={6}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}

            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {tab === "pending"
                    ? "No pending verifications"
                    : "No rejected accounts"}
                </td>
              </tr>
            )}

            {!loading &&
              items.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-foreground">{row.email}</td>
                  <td className="px-4 py-3 text-foreground/80">
                    {labelRole(row.role as Role)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {labelUserStatus(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    <div>{row.email_verified ? "Yes" : "No"}</div>
                    {!row.email_verified && (
                      <p className="mt-1 text-xs text-amber-700">
                        Email not verified yet
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    {formatUserDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actingId === row.id}
                        onClick={() => onApprove(row)}
                        className="rounded-full border border-border px-3 py-1 text-xs font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actingId === row.id ? "…" : "Approve"}
                      </button>
                      {tab === "pending" && (
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => onReject(row)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && total > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.max(1, p - 1));
            }}
          >
            Previous
          </button>
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            disabled={page >= totalPages}
            className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setLoading(true);
              setPage((p) => p + 1);
            }}
          >
            Next
          </button>
        </div>
      )}
    </DashboardShell>
  );
}
