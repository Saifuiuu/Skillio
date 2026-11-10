"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import AuthCard, { buttonClass, inputClass } from "@/components/AuthCard";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PasswordInput from "@/components/PasswordInput";
import { login, register } from "@/lib/api";

type SignupRole = "candidate" | "employer" | "interviewer";

const ROLES: { value: SignupRole; label: string; hint: string }[] = [
  { value: "candidate", label: "Candidate", hint: "I am looking for a job" },
  { value: "employer", label: "Employer", hint: "I want to hire people" },
  { value: "interviewer", label: "Interviewer", hint: "I want to conduct interviews" },
];

function validateName(name: string): string | null {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Full name is required";
  if (cleaned.length < 2) return "Name must be at least 2 characters";
  if (cleaned.length > 80) return "Name must be at most 80 characters";
  if (/[<>]/.test(cleaned)) return "Name contains invalid characters";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("candidate");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const nameError = validateName(fullName);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, role, fullName.trim().replace(/\s+/g, " "));
      await login(email, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthCard
        title="Account created"
        subtitle="Check your email to verify your address before continuing."
      >
        <p className="mb-4 text-sm text-foreground/80">
          We sent a verification link to your inbox. You can continue to the
          dashboard now; a reminder will appear until you verify.
        </p>
        <button
          type="button"
          className={buttonClass}
          onClick={() => router.push("/dashboard")}
        >
          Continue to dashboard
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Choose how you want to use Skillio.">
      <div className="space-y-4">
        <GoogleSignInButton label="Continue with Google" />
        <p className="text-center text-xs text-muted-foreground">
          Google sign-up creates a candidate account. You can change role later.
        </p>
        <div className="relative py-1 text-center text-xs uppercase tracking-wide text-muted-foreground">
          <span className="relative z-10 bg-card px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 border-t border-border" />
        </div>

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
                </span>
              </label>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              required
              autoComplete="name"
              maxLength={80}
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
