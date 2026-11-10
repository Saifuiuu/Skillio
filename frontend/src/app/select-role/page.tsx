"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import AuthCard, { buttonClass, inputClass } from "@/components/AuthCard";
import { ApiError, completeGoogleSignup, getGooglePending } from "@/lib/api";

type SignupRole = "candidate" | "employer" | "interviewer";

const ROLES: {
  value: SignupRole;
  label: string;
  hint: string;
  note?: string;
}[] = [
  { value: "candidate", label: "Candidate", hint: "I am looking for a job" },
  {
    value: "employer",
    label: "Employer",
    hint: "I want to hire people",
    note: "Needs admin approval before you can post jobs / conduct interviews.",
  },
  {
    value: "interviewer",
    label: "Interviewer",
    hint: "I want to conduct interviews",
    note: "Needs admin approval before you can post jobs / conduct interviews.",
  },
];

function validateName(name: string): string | null {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Full name is required";
  if (cleaned.length < 2) return "Name must be at least 2 characters";
  if (cleaned.length > 80) return "Name must be at most 80 characters";
  if (/[<>]/.test(cleaned)) return "Name contains invalid characters";
  return null;
}

export default function SelectRolePage() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showLoginLink, setShowLoginLink] = useState(false);
  const [loading, setLoading] = useState(false);

  // Prefill name from Google token
  useEffect(() => {
    getGooglePending().then((data) => {
      if (data.full_name) setFullName(data.full_name);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setError(null);
    setShowLoginLink(false);

    const nameError = validateName(fullName);
    if (nameError) {
      setError(nameError);
      return;
    }

    setLoading(true);
    try {
      await completeGoogleSignup(role, fullName.trim().replace(/\s+/g, " "));
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 401) {
          setError(
            "Your signup session expired. Please sign in with Google again."
          );
          setShowLoginLink(true);
        } else if (err.status === 409) {
          setError("An account with this email already exists. Please log in.");
          setShowLoginLink(true);
        } else if (err.status === 422) {
          setError("Please enter a valid name (2–80 characters).");
        } else if (err.status === 429) {
          setError("Too many attempts. Please try again in a minute.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Choose your role"
      subtitle="Choose how you will use Skillio."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="full_name">
            Your name
          </label>
          <input
            id="full_name"
            type="text"
            required
            autoComplete="name"
            maxLength={80}
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition-all duration-150 ${
                role === r.value
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{r.label}</span>
                <span className="text-muted-foreground">{r.hint}</span>
                {r.note && (
                  <span className="mt-1 block text-xs text-amber-800">
                    {r.note}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        {error && (
          <div className="space-y-1 text-sm text-destructive">
            <p>{error}</p>
            {showLoginLink && (
              <p>
                <Link
                  href="/login"
                  className="font-medium text-brand underline"
                >
                  Back to sign in
                </Link>
              </p>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={!role || loading}
          className={buttonClass}
        >
          {loading ? "Continuing..." : "Continue"}
        </button>
      </form>
    </AuthCard>
  );
}
