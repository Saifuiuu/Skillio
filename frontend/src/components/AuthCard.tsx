import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export const inputClass =
  "w-full rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-all duration-150 hover:border-foreground/30 focus:border-brand focus:ring-2 focus:ring-brand/30 placeholder:text-stone-500 dark:placeholder:text-stone-400 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonClass =
  "w-full rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-150 hover:brightness-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none shadow-sm";

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
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="flex justify-center mb-4">
          <Logo href="/" layout="vertical" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground text-center">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">
          {subtitle}
        </p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
