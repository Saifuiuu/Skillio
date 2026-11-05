import type { Role } from "@/lib/api";

export type NavItem = {
  href: string;
  label: string;
  /** When false, item is visible but not navigable. */
  enabled: boolean;
};

/** Role-specific sidebar items. Only Dashboard is enabled until other pages exist. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  candidate: [
    { href: "/dashboard", label: "Dashboard", enabled: true },
    { href: "/jobs", label: "Jobs", enabled: false },
    { href: "/applications", label: "Applications", enabled: false },
    { href: "/profile", label: "Profile", enabled: false },
  ],
  employer: [
    { href: "/dashboard", label: "Dashboard", enabled: true },
    { href: "/jobs", label: "Job posts", enabled: false },
    { href: "/candidates", label: "Candidates", enabled: false },
    { href: "/company", label: "Company", enabled: false },
  ],
  interviewer: [
    { href: "/dashboard", label: "Dashboard", enabled: true },
    { href: "/interviews", label: "Interviews", enabled: false },
    { href: "/availability", label: "Availability", enabled: false },
    { href: "/profile", label: "Profile", enabled: false },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard", enabled: true },
    { href: "/users", label: "Users", enabled: false },
    { href: "/verifications", label: "Verifications", enabled: false },
    { href: "/jobs", label: "Jobs", enabled: false },
  ],
};
