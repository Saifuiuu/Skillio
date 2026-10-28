export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Role = "candidate" | "employer" | "admin" | "interviewer";
export type UserStatus = "active" | "pending_verification" | "suspended";

export type User = {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  is_email_verified: boolean;
  created_at: string;
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
  if (options.body) headers.set("Content-Type", "application/json");

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
  role: "candidate" | "employer" | "interviewer"
) {
  await request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
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

export function fetchMe() {
  return authed<User>("/auth/me");
}
