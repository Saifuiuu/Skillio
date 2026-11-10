"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { inputClass } from "@/components/AuthCard";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ADMIN_ROLES,
  ADMIN_STATUSES,
  formatUserDate,
  labelRole,
  labelUserStatus,
  needsVerificationManage,
  statusBadgeClass,
} from "@/lib/admin";
import {
  listAdminUsers,
  updateUserStatus,
  type Role,
  type User,
  type UserStatus,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<UserStatus | "">("");
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
      const res = await listAdminUsers({
        page,
        page_size: PAGE_SIZE,
        role: role || undefined,
        status: status || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setError("Something went wrong. Please try again.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, role, status]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user?.role === "admin") {
      let cancelled = false;
      loadUsers().then(() => { if (cancelled) return; });
      return () => { cancelled = true; };
    }
  }, [user, loadUsers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onToggleStatus(target: User) {
    const next = target.status === "suspended" ? "active" : "suspended";
    const action = next === "suspended" ? "Suspend" : "Activate";
    if (
      !window.confirm(
        `${action} ${target.email}?${
          next === "suspended" ? " Their sessions will be invalidated." : ""
        }`
      )
    ) {
      return;
    }
    setActingId(target.id);
    setMessage(null);
    setError(null);
    try {
      await updateUserStatus(target.id, next);
      setMessage(
        next === "suspended"
          ? `${target.email} has been suspended.`
          : `${target.email} has been activated.`
      );
      await loadUsers();
    } catch {
      setError("Could not update user status. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  if (authLoading || !user) return <DashboardSkeleton />;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardShell>
      <h2 className="text-2xl font-semibold text-foreground">Users</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        View accounts and suspend or activate users.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <select
          className={inputClass}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
            setLoading(true);
          }}
        >
          <option value="">All roles</option>
          {ADMIN_ROLES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as UserStatus | "");
            setPage(1);
            setLoading(true);
          }}
        >
          <option value="">All statuses</option>
          {ADMIN_STATUSES.map((o) => (
            <option key={o.value} value={o.value}>
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
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
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
                  <td className="px-4 py-3" colSpan={7}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}

            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No users found
                </td>
              </tr>
            )}

            {!loading &&
              items.map((row) => {
                const isSelf = row.id === user.id;
                const manageElsewhere = needsVerificationManage(row);
                const canSuspend = !isSelf && !manageElsewhere && row.status === "active";
                const canActivate =
                  !isSelf && !manageElsewhere && row.status === "suspended";

                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-foreground font-medium">
                      {row.full_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.email}</td>
                    <td className="px-4 py-3 text-foreground/80">
                      {labelRole(row.role)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {labelUserStatus(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {row.email_verified ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {formatUserDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {manageElsewhere && !isSelf && (
                        <span className="text-xs text-muted-foreground">
                          Manage in Verifications
                        </span>
                      )}
                      {canSuspend && (
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => onToggleStatus(row)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actingId === row.id ? "…" : "Suspend"}
                        </button>
                      )}
                      {canActivate && (
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          onClick={() => onToggleStatus(row)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium transition-all duration-150 hover:bg-muted active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actingId === row.id ? "…" : "Activate"}
                        </button>
                      )}
                      {isSelf && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
