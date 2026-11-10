"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkButton } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-4 w-48" />
      <LinkButton href="/jobs" variant="ghost" size="sm">
        Browse jobs
      </LinkButton>
      <span className="sr-only">Loading</span>
    </main>
  );
}
