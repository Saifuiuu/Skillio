export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Role = "candidate" | "employer" | "admin" | "interviewer";
export type UserStatus = "active" | "pending_verification" | "suspended";

export type JobType = "full_time" | "part_time" | "contract" | "internship";
export type WorkMode = "onsite" | "remote" | "hybrid";
export type JobCategory =
  | "frontend"
  | "backend"
  | "fullstack"
  | "mobile"
  | "data_science"
  | "devops"
  | "qa"
  | "security"
  | "other";
export type JobStatus = "active" | "closed_filled" | "inactive";
export type JobSource = "employer_posted" | "admin_added" | "scraped";

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status: UserStatus;
  email_verified: boolean;
  approved_at: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  employer_id: string;
  title: string;
  company_name: string;
  description: string;
  location: string;
  job_type: JobType;
  work_mode: WorkMode;
  category: JobCategory;
  experience_min_years: number;
  experience_max_years: number;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  skills: string[];
  source: JobSource;
  status: JobStatus;
  apply_url: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedJobs = {
  items: Job[];
  total: number;
  page: number;
  page_size: number;
};

export type JobWritePayload = {
  title: string;
  company_name: string;
  description: string;
  location: string;
  job_type: JobType;
  work_mode: WorkMode;
  category: JobCategory;
  experience_min_years: number;
  experience_max_years: number;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  skills: string[];
  apply_url?: string | null;
};

export type JobListParams = {
  q?: string;
  location?: string;
  job_type?: JobType;
  work_mode?: WorkMode;
  category?: JobCategory;
  company?: string;
  skills?: string;
  experience?: number;
  salary_min?: number;
  page?: number;
  page_size?: number;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function errorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: (string | number)[] };
    const field = first.loc?.[first.loc.length - 1];
    const msg = (first.msg ?? "Invalid input").replace(/^Value error, /, "");
    return field ? `${field}: ${msg}` : msg;
  }
  return "Something went wrong";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  // Let the browser set multipart boundary for FormData.
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Something went wrong. Please check your internet connection or try again later.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(data?.detail));
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshing) {
    refreshing = request<void>("/auth/refresh", { method: "POST" })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function authed<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && (await refreshAccessToken())) {
      return request<T>(path, options);
    }
    throw e;
  }
}

export async function login(email: string, password: string) {
  await request<void>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  await request<void>("/auth/logout", { method: "POST" });
}

export async function register(
  email: string,
  password: string,
  role: "candidate" | "employer" | "interviewer",
  full_name: string
) {
  await request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role, full_name }),
  });
}

export async function forgotPassword(email: string) {
  await request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  await request<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function verifyEmail(token: string) {
  await request<void>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email: string) {
  await request<void>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function completeGoogleSignup(
  role: "candidate" | "employer" | "interviewer",
  full_name?: string
) {
  return request<User>("/auth/google/complete", {
    method: "POST",
    body: JSON.stringify({ role, full_name: full_name ?? null }),
  });
}

export async function getGooglePending(): Promise<{ full_name: string | null }> {
  try {
    return await authed<{ full_name: string | null }>("/auth/google/pending");
  } catch {
    return { full_name: null };
  }
}

export async function updateMe(payload: { full_name: string }): Promise<User> {
  return authed<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchMe() {
  return authed<User>("/auth/me");
}

export type PaginatedUsers = {
  items: User[];
  total: number;
  page: number;
  page_size: number;
};

export type AdminUserListParams = {
  page?: number;
  page_size?: number;
  role?: Role;
  status?: UserStatus;
};

function toQuery(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    sp.set(key, String(value));
  });
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function listJobs(params: JobListParams = {}) {
  return request<PaginatedJobs>(
    `/jobs${toQuery(params as Record<string, string | number | undefined | null>)}`
  );
}

export function getJob(id: string) {
  return request<Job>(`/jobs/${id}`);
}

export function listMyJobs(page = 1, pageSize = 20) {
  return authed<PaginatedJobs>(
    `/jobs/mine${toQuery({ page, page_size: pageSize })}`
  );
}

export function createJob(payload: JobWritePayload) {
  return authed<Job>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateJob(id: string, payload: Partial<JobWritePayload>) {
  return authed<Job>(`/jobs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function closeJob(id: string) {
  return authed<Job>(`/jobs/${id}/close`, { method: "POST" });
}

export function listAdminUsers(params: AdminUserListParams = {}) {
  return authed<PaginatedUsers>(
    `/admin/users${toQuery(params as Record<string, string | number | undefined | null>)}`
  );
}

export function updateUserStatus(
  userId: string,
  status: Extract<UserStatus, "active" | "suspended">
) {
  return authed<User>(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function approveUser(userId: string) {
  return authed<User>(`/admin/users/${userId}/approve`, { method: "POST" });
}

export type ExtractionStatus = "ok" | "empty" | "failed";
export type ResumeStatus = "active" | "archived";

export type Resume = {
  id: string;
  title: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  extraction_status: ExtractionStatus;
  status: ResumeStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ResumeDetail = Resume & {
  extracted_text: string | null;
};

export function listResumes(status: ResumeStatus = "active") {
  return authed<Resume[]>(`/resumes?status=${status}`);
}

export function getResume(id: string) {
  return authed<ResumeDetail>(`/resumes/${id}`);
}

export function uploadResume(title: string, file: File) {
  const body = new FormData();
  body.append("title", title);
  body.append("file", file);
  return authed<Resume>("/resumes", { method: "POST", body });
}

export function renameResume(id: string, title: string) {
  return authed<Resume>(`/resumes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function archiveResume(id: string) {
  return authed<Resume>(`/resumes/${id}/archive`, { method: "POST" });
}

async function fetchAuthedBlob(path: string): Promise<Response> {
  const doFetch = () =>
    fetch(`${API_URL}${path}`, { credentials: "include" });

  let res = await doFetch();
  if (res.status === 401 && (await refreshAccessToken())) {
    res = await doFetch();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(data?.detail));
  }
  return res;
}

export async function downloadResumeFile(id: string, fallbackName: string) {
  const res = await fetchAuthedBlob(`/resumes/${id}/file`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plainMatch = /filename="([^"]+)"/i.exec(disposition);
  const filename = utfMatch
    ? decodeURIComponent(utfMatch[1])
    : plainMatch?.[1] ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
