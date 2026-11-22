"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import type { Resume } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface MatchResumeSelectorProps {
  parsedResumes: Resume[];
  selectedResumeId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  size?: "sm" | "default";
}

export default function MatchResumeSelector({
  parsedResumes,
  selectedResumeId,
  onSelect,
  className,
  size = "default",
}: MatchResumeSelectorProps) {
  if (parsedResumes.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <FileText className="size-3.5 shrink-0 text-muted-foreground/70" />
        <span>No analyzed CV found.</span>
        <Link
          href="/candidate/resumes"
          className="font-medium text-brand hover:underline underline-offset-2"
        >
          Analyze your CV to see your match →
        </Link>
      </div>
    );
  }

  if (parsedResumes.length === 1) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <FileText className="size-3.5 shrink-0 text-muted-foreground/70" />
        <span>Matching against:</span>
        <span className="font-medium text-foreground truncate max-w-[200px]">
          {parsedResumes[0].title}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        htmlFor="match-resume-select"
        className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"
      >
        <FileText className="size-3.5 shrink-0 text-muted-foreground/70" />
        <span>Matching with:</span>
      </label>
      <select
        id="match-resume-select"
        value={selectedResumeId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className={cn(
          "rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer",
          size === "sm" ? "h-7 text-xs" : "h-8 text-xs"
        )}
      >
        {parsedResumes.map((resume) => (
          <option key={resume.id} value={resume.id}>
            {resume.title}
          </option>
        ))}
      </select>
    </div>
  );
}
