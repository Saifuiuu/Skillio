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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("candidate");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, role);
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Choose how you want to use Skillio.">
      <div className="space-y-4">
        <GoogleSignInButton label="Continue with Google" />
        <p className="text-center text-xs text-slate-500">
          Google sign-up creates a candidate account. You can change role later.
        </p>
        <div className="relative py-1 text-center text-xs uppercase tracking-wide text-slate-400">
          <span className="relative z-10 bg-white px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                  role === r.value
                    ? "border-[#1E3A5F] bg-slate-50"
                    : "border-slate-300"
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
                  <span className="text-slate-600">{r.hint}</span>
                </span>
              </label>
            ))}
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
            <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#1E3A5F] underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
