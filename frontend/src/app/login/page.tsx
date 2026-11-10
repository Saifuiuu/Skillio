"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import AuthCard, { buttonClass, inputClass } from "@/components/AuthCard";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PasswordInput from "@/components/PasswordInput";
import { login } from "@/lib/api";

const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_state: "Google sign-in failed (invalid state). Try again.",
  google_exchange: "Could not complete Google sign-in. Try again.",
  google_email: "Google did not provide a verified email.",
  google_create: "Could not create your account from Google.",
  account_suspended: "This account is suspended.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loggedOut = Boolean(searchParams.get("loggedOut"));

  // Remount a fresh empty form after logout (avoids setState-in-effect lint + autofill).
  const [formKey] = useState(() => (loggedOut ? Date.now() : 0));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowAutofill, setAllowAutofill] = useState(false);

  const oauthError = useMemo(() => {
    const key = searchParams.get("error");
    return key ? GOOGLE_ERRORS[key] ?? "Google sign-in failed." : null;
  }, [searchParams]);

  // Strip ?loggedOut=1 without touching form state (form already mounted empty).
  useEffect(() => {
    if (!loggedOut) return;
    router.replace("/login", { scroll: false });
  }, [loggedOut, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Sign in" subtitle="Welcome back. Enter your details to continue.">
      <div className="space-y-4">
        <GoogleSignInButton />
        <div className="relative py-1 text-center text-xs uppercase tracking-wide text-muted-foreground">
          <span className="relative z-10 bg-card px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 border-t border-border" />
        </div>

        <form
          key={formKey}
          onSubmit={onSubmit}
          className="space-y-4"
          autoComplete="off"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              name="skillio-email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setAllowAutofill(true)}
              className={inputClass}
              autoComplete="off"
              readOnly={!allowAutofill}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium">Password</label>
              <Link href="/forgot-password" className="text-xs font-medium text-brand underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              autoComplete="off"
              readOnly={!allowAutofill}
              onFocus={() => setAllowAutofill(true)}
            />
          </div>
          {(error || oauthError) && (
            <p className="text-sm text-destructive">{error ?? oauthError}</p>
          )}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Skillio?{" "}
        <Link href="/register" className="font-medium text-brand underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
