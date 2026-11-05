"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Avatar from "@/components/Avatar";
import { NAV_BY_ROLE } from "@/lib/nav";
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

type SidebarProps = {
  email: string;
  role: Role;
  name?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  /** Called after an enabled nav link is activated (e.g. close mobile drawer). */
  onNavigate?: () => void;
  className?: string;
};

export default function Sidebar({
  email,
  role,
  name,
  avatarUrl,
  onLogout,
  onNavigate,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <div className={cn("flex h-full flex-col bg-white", className)}>
      <div className="px-4 pt-5 pb-3">
        <p className="text-xl font-semibold text-[#1E3A5F]">Skillio</p>
        <div className="mt-5 flex items-center gap-3 rounded-md bg-slate-50 p-3">
          <Avatar email={email} name={name} avatarUrl={avatarUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{email}</p>
            <p className="text-xs capitalize text-slate-600">{role}</p>
          </div>
        </div>
      </div>

      <Separator />

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              item.enabled &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            if (!item.enabled) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    className="block cursor-not-allowed rounded-md px-3 py-2 text-sm text-slate-400"
                  >
                    {item.label}
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onNavigate?.()}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2",
                    active
                      ? "bg-[#1E3A5F] text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t border-slate-200 p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start rounded-md border-slate-300 text-slate-800 focus-visible:ring-[#1E3A5F]"
          onClick={onLogout}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
