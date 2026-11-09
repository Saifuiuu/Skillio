"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import AuthCard, { buttonClass } from "@/components/AuthCard";
import { ApiError, completeGoogleSignup } from "@/lib/api";

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

export default function SelectRolePage() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLoginLink, setShowLoginLink] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setError(null);
    setShowLoginLink(false);
    setLoading(true);
    try {
      await completeGoogleSignup(role);
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
