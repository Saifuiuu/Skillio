"use client";

import { cn } from "@/lib/utils";

export interface MatchBadgeProps {
  score: number;
  size?: "sm" | "default" | "lg";
  className?: string;
  showTierOnly?: boolean;
}

export function getMatchTier(score: number): {
  tier: "strong" | "partial" | "low";
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  if (score >= 75) {
    return {
      tier: "strong",
      label: "Strong match",
      badgeClass:
        "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25",
      dotClass: "bg-emerald-600 dark:bg-emerald-400",
    };
  }
  if (score >= 50) {
    return {
      tier: "partial",
      label: "Partial match",
      badgeClass:
        "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25",
      dotClass: "bg-amber-600 dark:bg-amber-400",
    };
  }
  return {
    tier: "low",
    label: "Low match",
    badgeClass: "bg-muted text-muted-foreground border border-border",
    dotClass: "bg-muted-foreground/60",
  };
}

export default function MatchBadge({
  score,
  size = "default",
  className,
  showTierOnly = false,
}: MatchBadgeProps) {
  const { label, badgeClass, dotClass } = getMatchTier(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors select-none",
        size === "sm" && "px-2.5 py-0.5 text-xs",
        size === "default" && "px-3 py-1 text-xs",
        size === "lg" && "px-3.5 py-1.5 text-sm",
        badgeClass,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", dotClass)} aria-hidden />
      {!showTierOnly && <span className="font-semibold">{score}%</span>}
      {!showTierOnly && <span className="opacity-60" aria-hidden>·</span>}
      <span>{label}</span>
    </span>
  );
}
