import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  isLoggedIn?: boolean;
  layout?: "horizontal" | "vertical";
  className?: string;
  onClick?: () => void;
};

export default function Logo({
  href,
  isLoggedIn = false,
  layout = "horizontal",
  className,
  onClick,
}: LogoProps) {
  const targetHref = href ?? (isLoggedIn ? "/dashboard" : "/");

  if (layout === "vertical") {
    return (
      <Link
        href={targetHref}
        onClick={onClick}
        aria-label="Skillio home"
        className={cn(
          "group inline-flex flex-col items-center justify-center gap-2 select-none transition-all duration-150 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl p-1",
          className
        )}
      >
        <div className="relative size-11 overflow-hidden rounded-xl shadow-sm transition-transform duration-150 group-hover:scale-105">
          <Image
            src="/logo.svg"
            alt="Skillio mark"
            width={44}
            height={44}
            priority
            className="size-full object-contain"
          />
        </div>
        <span className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Skillio
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={targetHref}
      onClick={onClick}
      aria-label="Skillio home"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full px-2.5 py-1 select-none transition-all duration-150 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        className
      )}
    >
      <div className="relative size-7 shrink-0 overflow-hidden rounded-lg shadow-xs transition-transform duration-150 group-hover:scale-105">
        <Image
          src="/logo.svg"
          alt="Skillio mark"
          width={28}
          height={28}
          priority
          className="size-full object-contain"
        />
      </div>
      <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
        Skillio
      </span>
    </Link>
  );
}
