"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  getResume,
  type ResumeDetail,
} from "@/lib/api";
import {
  extractionBadgeClass,
  formatFileSize,
  formatResumeDate,
  labelExtraction,
} from "@/lib/resumes";
import { useAuth } from "@/components/AuthProvider";

const PREVIEW_CHARS = 2000;

function ResumeDetailSkeleton() {
  return <DashboardSkeleton />;
}

function ResumeDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "candidate") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await getResume(params.id);
        if (!cancelled) setResume(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, params.id, router]);

  if (authLoading || (!user && !notFound)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-4 w-48" />
        <Skeleton className="mt-8 h-40 w-full" />
      </main>
    );
  }

  if (notFound || (!loading && !resume)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">CV not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This CV may have been removed or the link is invalid.
        </p>
        <Link
          href="/candidate/resumes"
          className="mt-6 text-sm font-medium text-brand underline"
        >
          Back to My CVs
        </Link>
      </main>
    );
  }

  if (loading || !resume) return <ResumeDetailSkeleton />;

  const text = resume.extracted_text ?? "";
  const needsTruncate = text.length > PREVIEW_CHARS;
  const preview =
    expanded || !needsTruncate ? text : `${text.slice(0, PREVIEW_CHARS)}…`;

  return (
    <DashboardShell>
      <Link
        href="/candidate/resumes"
        className="text-sm font-medium text-brand underline"
      >
        Back to My CVs
      </Link>
      <h2 className="mt-4 text-2xl font-semibold text-foreground">{resume.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {resume.original_filename} · {formatFileSize(resume.file_size_bytes)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Status: {resume.status === "active" ? "Active" : "Archived"} · Uploaded{" "}
        {formatResumeDate(resume.created_at)}
        {resume.archived_at && (
          <> · Archived {formatResumeDate(resume.archived_at)}</>
        )}
      </p>
      <p className="mt-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${extractionBadgeClass(resume.extraction_status)}`}
        >
          {labelExtraction(resume.extraction_status)}
        </span>
      </p>

      <section className="mt-8">
        <h3 className="text-lg font-semibold text-foreground">Extracted text</h3>
        {!text ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Text could not be read from this file
          </p>
        ) : (
          <>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-4 text-sm text-foreground">
              {preview}
            </pre>
            {needsTruncate && (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-brand underline"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </>
        )}
      </section>
    </DashboardShell>
  );
}

export default function ResumeDetailPage() {
  return (
    <Suspense fallback={<ResumeDetailSkeleton />}>
      <ResumeDetailContent />
    </Suspense>
  );
}
