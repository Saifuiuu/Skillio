"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors quietly in development
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        An unexpected error occurred while loading this view. You can try refreshing or return to the main dashboard.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          variant="brand"
          className="rounded-full shadow-sm"
        >
          <RefreshCw className="mr-1.5 size-4" />
          Try again
        </Button>
        <LinkButton href="/" variant="outline" className="rounded-full">
          <Home className="mr-1.5 size-4" />
          Return home
        </LinkButton>
      </div>
    </div>
  );
}
