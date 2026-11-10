import { ApiError, type ExtractionStatus } from "@/lib/api";

export const MAX_ACTIVE_RESUMES = 3;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_EXT = [".pdf", ".docx"] as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatResumeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function labelExtraction(status: ExtractionStatus): string {
  switch (status) {
    case "ok":
      return "Text extracted";
    case "empty":
      return "No text found";
    case "failed":
      return "Extraction failed";
    default:
      return status;
  }
}

export function extractionBadgeClass(status: ExtractionStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-50 text-emerald-800";
    case "empty":
      return "bg-amber-50 text-amber-900";
    case "failed":
      return "bg-red-50 text-red-800";
    default:
      return "bg-muted text-foreground/80";
  }
}

export function resumeUploadErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  switch (err.status) {
    case 400:
      return "Please upload a valid PDF or DOCX file.";
    case 413:
      return "File is too large (max 5 MB).";
    case 409:
      return "You already have 3 active CVs. Archive one first.";
    case 429:
      return "Too many uploads. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function validateResumeFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okExt = ALLOWED_RESUME_EXT.some((ext) => name.endsWith(ext));
  if (!okExt) return "Please upload a valid PDF or DOCX file.";
  if (file.size > MAX_RESUME_BYTES) return "File is too large (max 5 MB).";
  return null;
}
