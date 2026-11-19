import type { ApplicationStatus } from "@/lib/api";

export const APPLICATION_STATUSES: {
  value: ApplicationStatus;
  label: string;
}[] = [
  { value: "applied", label: "Applied" },
  { value: "under_review", label: "Under review" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "selected", label: "Selected" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

export function labelApplicationStatus(status: ApplicationStatus): string {
  return APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status;
}

/**
 * Returns accessible CSS classes for status badges that work seamlessly
 * in both light and dark themes using theme-aware tokens and opacity.
 */
export function statusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case "applied":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20";
    case "under_review":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20";
    case "shortlisted":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20";
    case "interview":
      return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20";
    case "selected":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20";
    case "rejected":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20";
    case "withdrawn":
      return "bg-muted text-muted-foreground border border-border";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
}

export function formatApplicationDate(iso: string): string {
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
