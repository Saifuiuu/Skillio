"use client";

import { Check, Plus } from "lucide-react";
import { formatSkill } from "@/lib/resumes";
import { cn } from "@/lib/utils";

export interface SkillGapPanelProps {
  matchedSkills: string[];
  missingSkills: string[];
  className?: string;
}

export default function SkillGapPanel({
  matchedSkills,
  missingSkills,
  className,
}: SkillGapPanelProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Matched skills */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Matched skills ({matchedSkills.length})
        </h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {matchedSkills.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No direct skill matches found in your analyzed CV.
            </p>
          ) : (
            matchedSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300"
              >
                <Check className="size-3 shrink-0" aria-hidden />
                <span>{formatSkill(skill)}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Skills to build */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Skills to build ({missingSkills.length})
        </h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {missingSkills.length === 0 ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              All required skills are covered in your analyzed CV.
            </p>
          ) : (
            missingSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300"
              >
                <Plus className="size-3 shrink-0 opacity-70" aria-hidden />
                <span>{formatSkill(skill)}</span>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
