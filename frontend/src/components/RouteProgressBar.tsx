"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [animating, setAnimating] = useState(false);
  const [stage, setStage] = useState<"idle" | "running" | "finishing">("idle");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setAnimating(true);
    setStage("running");

    const t1 = setTimeout(() => {
      setStage("finishing");
    }, 180);

    const t2 = setTimeout(() => {
      setAnimating(false);
      setStage("idle");
    }, 450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname, searchParams]);

  if (!animating) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[99999] h-[2.5px] pointer-events-none overflow-hidden"
    >
      <div
        className={cn(
          "h-full bg-brand transition-all duration-200 ease-out",
          stage === "running" && "w-3/4 opacity-100",
          stage === "finishing" && "w-full opacity-0",
          stage === "idle" && "w-0 opacity-0"
        )}
      />
    </div>
  );
}

export default function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
