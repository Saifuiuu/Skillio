import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatChip({
  label,
  value,
  loading,
  className,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return <Skeleton className={cn("h-9 w-28 rounded-full", className)} />;
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm shadow-sm",
        className
      )}
    >
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
