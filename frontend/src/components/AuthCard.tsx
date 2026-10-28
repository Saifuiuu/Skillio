import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]";

export const buttonClass =
  "w-full rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#16304f] disabled:opacity-60";

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#1E3A5F]">Skillio</h1>
        <h2 className="mt-6 text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}