"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/AuthCard";
import DashboardShell, { DashboardSkeleton } from "@/components/DashboardShell";
import Tabs from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  archiveResume,
  downloadResumeFile,
  fetchMe,
  listResumes,
  logout as apiLogout,
  renameResume,
  uploadResume,
  type Resume,
  type ResumeStatus,
  type User,
} from "@/lib/api";
import {
  extractionBadgeClass,
  formatFileSize,
  formatResumeDate,
  labelExtraction,
  MAX_ACTIVE_RESUMES,
  resumeUploadErrorMessage,
  validateResumeFile,
} from "@/lib/resumes";

export default function CandidateResumesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<ResumeStatus>("active");
  const [items, setItems] = useState<Resume[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, active] = await Promise.all([
        listResumes(tab),
        tab === "active" ? Promise.resolve(null) : listResumes("active"),
      ]);
      setItems(list);
      setActiveCount(tab === "active" ? list.length : (active?.length ?? 0));
    } catch {
      setError("Something went wrong. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me.role !== "candidate") {
          router.replace("/dashboard");
          return;
        }
        setUser(me);
        return load();
      })
      .catch(() => router.replace("/login"));
  }, [router, load]);

  async function logout() {
    try {
      await apiLogout();
    } finally {
      router.replace("/login?loggedOut=1");
    }
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    setUploadError(null);
    setMessage(null);
    const cleaned = title.trim();
    if (!cleaned || cleaned.length > 100) {
      setUploadError("Title is required (max 100 characters).");
      return;
    }
    if (!file) {
      setUploadError("Please choose a PDF or DOCX file.");
      return;
    }
    const clientErr = validateResumeFile(file);
    if (clientErr) {
      setUploadError(clientErr);
      return;
    }
    if (activeCount >= MAX_ACTIVE_RESUMES) {
      setUploadError("You already have 3 active CVs. Archive one first.");
      return;
    }

    setUploading(true);
    try {
      await uploadResume(cleaned, file);
      setTitle("");
      setFile(null);
      setMessage("CV uploaded.");
      setTab("active");
      setLoading(true);
      setError(null);
      const list = await listResumes("active");
      setItems(list);
      setActiveCount(list.length);
    } catch (err) {
      setUploadError(resumeUploadErrorMessage(err));
    } finally {
      setUploading(false);
      setLoading(false);
    }
  }

  async function onRename(resume: Resume) {
    const next = renameValue.trim();
    if (!next || next.length > 100) {
      setError("Title is required (max 100 characters).");
      return;
    }
    setActingId(resume.id);
    setError(null);
    setMessage(null);
    try {
      await renameResume(resume.id, next);
      setRenamingId(null);
      setMessage("Title updated.");
      await load();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function onArchive(resume: Resume) {
    if (
      !window.confirm(
        "Archived CVs stop receiving new matches but stay in your history."
      )
    ) {
      return;
    }
    setActingId(resume.id);
    setError(null);
    setMessage(null);
    try {
      await archiveResume(resume.id);
      setMessage(`"${resume.title}" archived.`);
      setLoading(true);
      await load();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function onDownload(resume: Resume) {
    setActingId(resume.id);
    setError(null);
    try {
      await downloadResumeFile(resume.id, resume.original_filename);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("CV not found.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setActingId(null);
    }
  }

  if (!user) return <DashboardSkeleton />;

  const atLimit = activeCount >= MAX_ACTIVE_RESUMES;

  return (
    <DashboardShell email={user.email} role={user.role} onLogout={logout}>
      <h2 className="text-2xl font-semibold text-foreground">My CVs</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload up to {MAX_ACTIVE_RESUMES} active CVs for different career paths.
      </p>

      <form
        onSubmit={onUpload}
        className="mt-6 space-y-3 rounded-3xl border border-border bg-card p-4"
      >
        <h3 className="text-sm font-semibold text-foreground">Upload a CV</h3>
        {atLimit && (
          <p className="text-sm text-amber-800">
            Archive a CV to add a new one.
          </p>
        )}
        <input
          className={inputClass}
          placeholder="Title (e.g. Backend CV)"
          maxLength={100}
          value={title}
          disabled={atLimit || uploading}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={atLimit || uploading}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5"
        />
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        <button
          type="submit"
          disabled={atLimit || uploading}
          className={`${buttonClass} w-auto px-4`}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      <div className="mt-6">
        <Tabs<ResumeStatus>
          value={tab}
          onChange={(newTab) => {
            setTab(newTab);
            setLoading(true);
          }}
          items={[
            { value: "active", label: "Active", count: activeCount },
            { value: "archived", label: "Archived" },
          ]}
        />
      </div>

      {message && (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-3 h-4 w-72" />
            </div>
          ))}

        {!loading && items.length === 0 && (
          <p className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {tab === "active"
              ? "No CVs yet. Upload your first CV"
              : "No archived CVs"}
          </p>
        )}

        {!loading &&
          items.map((resume) => (
            <div
              key={resume.id}
              className="rounded-3xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {renamingId === resume.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className={`${inputClass} max-w-xs`}
                        value={renameValue}
                        maxLength={100}
                        onChange={(e) => setRenameValue(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={actingId === resume.id}
                        onClick={() => onRename(resume)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <h3 className="text-lg font-semibold text-foreground">
                      <Link
                        href={`/candidate/resumes/${resume.id}`}
                        className="hover:underline"
                      >
                        {resume.title}
                      </Link>
                    </h3>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {resume.original_filename} · {formatFileSize(resume.file_size_bytes)}{" "}
                    · Uploaded {formatResumeDate(resume.created_at)}
                  </p>
                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${extractionBadgeClass(resume.extraction_status)}`}
                    >
                      {labelExtraction(resume.extraction_status)}
                    </span>
                    {(resume.extraction_status === "empty" ||
                      resume.extraction_status === "failed") && (
                      <p className="mt-1 text-xs text-amber-700">
                        Text could not be read from this file
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {tab === "active" && renamingId !== resume.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(resume.id);
                      setRenameValue(resume.title);
                    }}
                    className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
                  >
                    Rename
                  </button>
                )}
                <button
                  type="button"
                  disabled={actingId === resume.id}
                  onClick={() => onDownload(resume)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download
                </button>
                {tab === "active" && (
                  <button
                    type="button"
                    disabled={actingId === resume.id}
                    onClick={() => onArchive(resume)}
                    className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </DashboardShell>
  );
}
