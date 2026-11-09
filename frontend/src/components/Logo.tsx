import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  isLoggedIn?: boolean;
  className?: string;
  onClick?: () => void;
};

export default function Logo({
  href,
  isLoggedIn = false,
  className,
  onClick,
}: LogoProps) {
  const targetHref = href ?? (isLoggedIn ? "/dashboard" : "/");

  return (
    <Link
      href={targetHref}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-lg font-semibold tracking-tight text-foreground transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
        className
      )}
    >
      Skillio
    </Link>
  );
}
