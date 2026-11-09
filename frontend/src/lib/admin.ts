import type { Role, UserStatus } from "@/lib/api";

export const ADMIN_ROLES: { value: Role; label: string }[] = [
  { value: "candidate", label: "Candidate" },
  { value: "employer", label: "Employer" },
  { value: "interviewer", label: "Interviewer" },
  { value: "admin", label: "Admin" },
];

export const ADMIN_STATUSES: { value: UserStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending_verification", label: "Pending verification" },
  { value: "suspended", label: "Suspended" },
];

export function labelRole(role: Role): string {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function labelUserStatus(status: UserStatus): string {
  return ADMIN_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function formatUserDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function statusBadgeClass(status: UserStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-800";
    case "pending_verification":
      return "bg-amber-50 text-amber-900";
    case "suspended":
      return "bg-red-50 text-red-800";
    default:
      return "bg-muted text-foreground/80";
  }
}

/** Needs Verifications flow (never approved employer/interviewer). */
export function needsVerificationManage(user: {
  role: Role;
  status: UserStatus;
  approved_at: string | null;
}): boolean {
  if (user.status === "pending_verification") return true;
  if (
    (user.role === "employer" || user.role === "interviewer") &&
    user.status === "suspended" &&
    !user.approved_at
  ) {
    return true;
  }
  return false;
}
