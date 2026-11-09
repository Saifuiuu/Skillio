import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Search,
  ShieldCheck,
  UserCircle2,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/api";

export type NavItem = {
  href: string;
  label: string;
  /** When false, item is visible but not navigable. */
  enabled: boolean;
  icon: LucideIcon;
};

/** Role-specific sidebar / rail / top-nav items. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  candidate: [
    { href: "/dashboard", label: "Dashboard", enabled: true, icon: LayoutDashboard },
    { href: "/jobs", label: "Browse jobs", enabled: true, icon: Search },
    { href: "/candidate/resumes", label: "My CVs", enabled: true, icon: FileText },
    {
      href: "/applications",
      label: "Applications",
      enabled: false,
      icon: ClipboardList,
    },
    { href: "/profile", label: "Profile", enabled: false, icon: UserCircle2 },
  ],
  employer: [
    { href: "/dashboard", label: "Dashboard", enabled: true, icon: LayoutDashboard },
    { href: "/employer/jobs", label: "My Jobs", enabled: true, icon: Briefcase },
    { href: "/jobs", label: "Browse jobs", enabled: true, icon: Search },
    { href: "/candidates", label: "Candidates", enabled: false, icon: Users },
    { href: "/company", label: "Company", enabled: false, icon: Building2 },
  ],
  interviewer: [
    { href: "/dashboard", label: "Dashboard", enabled: true, icon: LayoutDashboard },
    {
      href: "/interviews",
      label: "Interviews",
      enabled: false,
      icon: ClipboardList,
    },
    {
      href: "/availability",
      label: "Availability",
      enabled: false,
      icon: CalendarDays,
    },
    { href: "/profile", label: "Profile", enabled: false, icon: UserCircle2 },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard", enabled: true, icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", enabled: true, icon: Users },
    {
      href: "/admin/verifications",
      label: "Verifications",
      enabled: true,
      icon: ShieldCheck,
    },
    { href: "/jobs", label: "Jobs", enabled: false, icon: Briefcase },
  ],
};

export const PUBLIC_NAV: { href: string; label: string }[] = [
  { href: "/jobs", label: "Browse jobs" },
];

export function displayNameFromEmail(email: string, name?: string): string {
  if (name?.trim()) return name.trim().split(/\s+/)[0] ?? name.trim();
  const local = email.split("@")[0] ?? "there";
  const part = local.split(/[._-]/)[0] ?? local;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function greetingForNow(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
