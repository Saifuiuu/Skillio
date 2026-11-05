"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import AuthCard, { buttonClass, inputClass } from "@/components/AuthCard";
import { resendVerification, verifyEmail } from "@/lib/api";

type Status = "loading" | "success" | "error";

const RESEND_OK =
  "If that email needs verification, a new link has been sent.";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<Status>(() => (token ? "loading" : "error"));
  const [email, setEmail] = useState("");
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  async function onResend(e: FormEvent) {
    e.preventDefault();
    setResendMsg(null);
    setResendLoading(true);
    try {
      await resendVerification(email);
    } catch {
      // Always show the same generic message.
    } finally {
      setResendMsg(RESEND_OK);
      setResendLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <AuthCard title="Verify email" subtitle="Confirming your verification link…">
        <p className="text-sm text-slate-600">Please wait a moment.</p>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard title="Email verified" subtitle="Your email address has been confirmed.">
        <Link href="/login" className={`${buttonClass} inline-block text-center`}>
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verification failed"
      subtitle={
        token
          ? "This link is invalid or has expired. Request a new verification email below."
          : "Verification link is missing. Request a new verification email below."
      }
    >
      <form onSubmit={onResend} className="space-y-4">
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
        {resendMsg && <p className="text-sm text-slate-700">{resendMsg}</p>}
        <button type="submit" disabled={resendLoading} className={buttonClass}>
          {resendLoading ? "Sending..." : "Resend verification email"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-[#1E3A5F] underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">
          Loading...
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
