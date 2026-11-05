import type { Job, JobCategory, JobStatus, JobType, WorkMode } from "@/lib/api";

export const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

export const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "onsite", label: "Onsite" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

export const JOB_CATEGORIES: { value: JobCategory; label: string }[] = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "fullstack", label: "Full stack" },
  { value: "mobile", label: "Mobile" },
  { value: "data_science", label: "Data science" },
  { value: "devops", label: "DevOps" },
  { value: "qa", label: "QA" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

export function labelJobType(v: JobType) {
  return JOB_TYPES.find((x) => x.value === v)?.label ?? v;
}

export function labelWorkMode(v: WorkMode) {
  return WORK_MODES.find((x) => x.value === v)?.label ?? v;
}

export function labelCategory(v: JobCategory) {
  return JOB_CATEGORIES.find((x) => x.value === v)?.label ?? v;
}

export function labelJobStatus(v: JobStatus) {
  if (v === "closed_filled") return "Filled";
  if (v === "inactive") return "Inactive";
  return "Active";
}

export function formatSalary(job: Pick<Job, "salary_min" | "salary_max" | "currency">) {
  const cur = job.currency || "PKR";
  if (job.salary_min == null && job.salary_max == null) return "Salary not listed";
  if (job.salary_min != null && job.salary_max != null) {
    return `${cur} ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}`;
  }
  if (job.salary_min != null) return `${cur} ${job.salary_min.toLocaleString()}+`;
  return `Up to ${cur} ${job.salary_max!.toLocaleString()}`;
}

export function formatPostedDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function normalizeSkillsInput(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const skill = item.trim().toLowerCase();
    if (!skill || seen.has(skill)) continue;
    seen.add(skill);
    out.push(skill);
  }
  return out.slice(0, 20);
}
