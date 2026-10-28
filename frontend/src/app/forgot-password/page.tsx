"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import AuthCard, { buttonClass, inputClass } from "@/components/AuthCard";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your email and we will send a reset link if an account exists."
    >
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            If that email is registered, a reset link has been sent. Check your inbox
            (and the backend console if SMTP is not configured).
          </p>
          <Link href="/login" className={`${buttonClass} inline-block text-center`}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-[#1E3A5F] underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
