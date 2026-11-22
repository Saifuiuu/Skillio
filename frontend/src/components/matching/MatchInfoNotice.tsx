"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MatchInfoNoticeProps {
  className?: string;
  size?: "sm" | "default";
}

export default function MatchInfoNotice({
  className,
  size = "default",
}: MatchInfoNoticeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center gap-1.5 text-muted-foreground", className)}
    >
      <span
        className={cn(
          "font-medium",
          size === "sm" ? "text-xs" : "text-xs sm:text-sm"
        )}
      >
        Estimated match (baseline)
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="About estimated match"
        aria-expanded={open}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
      >
        <Info className="size-3.5" aria-hidden />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          Compares the skills and experience in your analyzed CV with the job&apos;s
          skills list. It is an estimate and does not read the job description.
        </div>
      )}
    </div>
  );
}
