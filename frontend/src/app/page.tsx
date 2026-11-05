"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMe } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    fetchMe()
      .then(() => router.replace("/dashboard"))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FAFAF9] px-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-4 w-48" />
      <span className="sr-only">Loading</span>
    </main>
  );
}
