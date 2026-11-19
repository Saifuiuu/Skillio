import { ArrowLeft, Search } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center px-4">
        <span className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">
          404 Error
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
          The link you followed may be broken or the page may have been moved or removed.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href="/" variant="brand" className="rounded-full shadow-sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to home
          </LinkButton>
          <LinkButton href="/jobs" variant="outline" className="rounded-full">
            <Search className="mr-1.5 size-4" />
            Browse jobs
          </LinkButton>
        </div>
      </div>
    </PublicShell>
  );
}
