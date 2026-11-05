import { cn } from "@/lib/utils";

const MUTED_PALETTE = [
  "#1E3A5F",
  "#2C3E50",
  "#334155",
  "#3B4F6B",
  "#475569",
  "#1A365D",
  "#2D3748",
  "#4A5568",
] as const;

function hashEmail(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h * 31 + email.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initialsFrom({ email, name }: { email: string; name?: string }): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    if (parts[0] && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts[0]) return (parts[0][0]! + parts[0][0]!).toUpperCase();
  }
  const local = email.split("@")[0] ?? "??";
  const letters = local.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || "??").toUpperCase();
}

type AvatarProps = {
  email: string;
  name?: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
};

export default function Avatar({
  email,
  name,
  avatarUrl,
  size = 40,
  className,
}: AvatarProps) {
  const bg = MUTED_PALETTE[hashEmail(email.toLowerCase()) % MUTED_PALETTE.length];
  const initials = initialsFrom({ email, name });

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white",
        className
      )}
      style={{ width: size, height: size, backgroundColor: avatarUrl ? undefined : bg }}
      aria-hidden={!avatarUrl}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          width={size}
          height={size}
        />
      ) : (
        <span className="text-xs font-semibold tracking-wide" style={{ fontSize: size * 0.32 }}>
          {initials}
        </span>
      )}
    </span>
  );
}
