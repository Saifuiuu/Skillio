import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SurfaceCard({
  children,
  className,
  variant = "default",
  interactive = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "feature";
  interactive?: boolean;
  onClick?: () => void;
}) {
  const isClickable = interactive || Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-3xl border p-5 md:p-6",
        variant === "default" &&
          "border-border bg-card text-card-foreground shadow-sm",
        variant === "feature" &&
          "border-transparent bg-ink text-ink-foreground shadow-sm",
        isClickable && "card-interactive",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function HatchedPlaceholder({ dark = false }: { dark?: boolean }) {
  return (
    <div className="mt-4 space-y-2">
      <div
        className={cn(
          "h-3 w-full rounded-full",
          dark ? "hatched-dark bg-card/5" : "hatched bg-muted"
        )}
      />
      <div
        className={cn(
          "h-3 w-4/5 rounded-full",
          dark ? "hatched-dark bg-card/5" : "hatched bg-muted"
        )}
      />
      <div
        className={cn(
          "h-3 w-3/5 rounded-full",
          dark ? "hatched-dark bg-card/5" : "hatched bg-muted"
        )}
      />
    </div>
  );
}
