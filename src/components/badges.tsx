import { CloudCheck, UploadCloud } from "lucide-react";
import { ageSeverity, formatAge, type ReviewStatus, type SyncStatus } from "@/lib/types";

export function StatusBadge({ status, label }: { status: ReviewStatus; label?: string }) {
  const styles: Record<ReviewStatus, string> = {
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    REJECTED: "bg-red-500/15 text-red-300 border-red-500/30",
    NA: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${styles[status]}`}
    >
      {label ?? status.replace("_", " ")}
    </span>
  );
}

export function AgeBadge({ since }: { since: string }) {
  const sev = ageSeverity(since);
  const styles = {
    normal: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    critical: "bg-red-500/15 text-red-300 border-red-500/30",
  } as const;
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${styles[sev]}`}
    >
      {formatAge(since)}
    </span>
  );
}

export function FusionBadge({ status, hasEco = true }: { status: SyncStatus; hasEco?: boolean }) {
  if (!hasEco) return <span className="text-muted-foreground">—</span>;
  if (status === "SYNCED")
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
        <CloudCheck className="size-3" /> Fusion synced
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
      <UploadCloud className="size-3" /> Raised
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-wide uppercase">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
