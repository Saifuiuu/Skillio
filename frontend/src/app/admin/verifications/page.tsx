"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { inputClass } from "@/components/AuthCard";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatUserDate,
  labelRole,
  labelUserStatus,
  statusBadgeClass,
} from "@/lib/admin";
import {
  fetchMe,
  listAdminUsers,
  logout as apiLogout,
  updateUserStatus,
  type Role,
  type User,
} from "@/lib/api";

const PAGE_SIZE = 20;

const ROLE_OPTIONS: { value: "" | "employer" | "interviewer"; label: string }[] =
  [
    { value: "", label: "Employers & interviewers" },
    { value: "employer", label: "Employer" },
    { value: "interviewer", label: "Interviewer" },
  ];

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<"" | "employer" | "interviewer">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      if (role) {
        const res = await listAdminUsers({
          page,
          page_size: PAGE_SIZE,
          role,
          status: "pending_verification",
        });
        setItems(res.items);
        setTotal(res.total);
      } else {
        // Backend filters one role at a time; merge employer + interviewer queues.
        const [employers, interviewers] = await Promise.all([
          listAdminUsers({
            page: 1,
            page_size: 100,
            role: "employer",
            status: "pending_verification",
          }),
          listAdminUsers({
            page: 1,
            page_size: 100,
            role: "interviewer",
            status: "pending_verification",
          }),
        ]);
        const merged = [...employers.items, ...interviewers.items].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const start = (page - 1) * PAGE_SIZE;
        setTotal(merged.length);
        setItems(merged.slice(start, start + PAGE_SIZE));
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, role]);

  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setUser(me);
        return loadUsers();
      })
      .catch(() => router.replace("/login"));
  }, [router, loadUsers]);

  async function logout() {
    try {
      await apiLogout();
    } finally {
      router.replace("/login?loggedOut=1");
    }
  }

  async function onApprove(target: User) {
    setActingId(target.id);
    setMessage(null);
    setError(null);
    try {
      await updateUserStatus(target.id, "active");
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

  if (!user) return <DashboardSkeleton />;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardShell email={user.email} role={user.role} onLogout={logout}>
      <h2 className="text-2xl font-semibold text-slate-900">Verifications</h2>
      <p className="mt-1 text-sm text-slate-600">
        Approve or reject employers and interviewers waiting for review.
      </p>

      <div className="mt-6 max-w-sm">
        <select
          className={inputClass}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as "" | "employer" | "interviewer");
            setPage(1);
            setLoading(true);
          }}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                  className="px-4 py-10 text-center text-slate-600"
                >
                  No pending verifications
                </td>
              </tr>
            )}

            {!loading &&
              items.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-900">{row.email}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {labelRole(row.role as Role)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {labelUserStatus(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{row.email_verified ? "Yes" : "No"}</div>
                    {!row.email_verified && (
                      <p className="mt-1 text-xs text-amber-700">
                        Email not verified yet
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatUserDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actingId === row.id}
                        onClick={() => onApprove(row)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs disabled:opacity-60"
                      >
                        {actingId === row.id ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={actingId === row.id}
                        onClick={() => onReject(row)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs disabled:opacity-60"
                      >
                        Reject
                      </button>
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
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.max(1, p - 1));
            }}
          >
            Previous
          </button>
          <p className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            disabled={page >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
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
