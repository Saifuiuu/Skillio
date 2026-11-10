"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
};

type TabsProps<T extends string = string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
};

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Tabs",
}: TabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillStyle, setPillStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const el = tabRefs.current[value];
      if (el) {
        setPillStyle({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
          opacity: 1,
        });
      } else {
        setPillStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [value, items]);

  useEffect(() => {
    function onResize() {
      const el = tabRefs.current[value];
      if (el) {
        setPillStyle({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
          opacity: 1,
        });
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm",
        className
      )}
    >
      {/* Sliding active pill */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full bg-ink transition-all duration-200 ease-out"
        style={{
          left: `${pillStyle.left}px`,
          top: `${pillStyle.top}px`,
          width: `${pillStyle.width}px`,
          height: `${pillStyle.height}px`,
          opacity: pillStyle.opacity,
        }}
      />

      {items.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabRefs.current[tab.value] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
              active
                ? "text-ink-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none",
                  active
                    ? "bg-white/20 text-ink-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
export default Tabs;
