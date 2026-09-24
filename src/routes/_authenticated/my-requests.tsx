import { createFileRoute } from "@tanstack/react-router";
import { Download, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useDeviations, deviationToExportRow, EXPORT_COLUMNS } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { AgeBadge, FusionBadge, PageHeader, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/my-requests")({
  component: MyRequests,
});

function MyRequests() {
  const { session } = useAuth();
  const { data: all = [], isLoading } = useDeviations();
  const rows = all.filter((d) => d.requester_id === session?.user.id);

  return (
    <div>
      <PageHeader
        title="My Requests"
        subtitle="Your submitted deviations. Submissions are read-only once logged."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV("my-requests.csv", toCSV(rows.map(deviationToExportRow), EXPORT_COLUMNS))
            }
          >
            <Download className="mr-2 size-4" /> Download CSV
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          You have not submitted any deviations yet.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-lg font-bold tracking-wide">{d.ticket_no}</span>
                <span className="text-sm text-muted-foreground">Item {d.item_name}</span>
                <AgeBadge since={d.submitted_at} />
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" /> Read-only
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <Info label="Supervisor" value={d.supervisor_name} />
                <Info label="Proposed Operation" value={d.proposed_operation} />
                <Info
                  label="Next Dept"
                  value={`${d.next_dept_code ?? "-"} ${d.next_dept_desc ?? ""}`}
                />
                <Info label="Change Type" value={d.change_type} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Floor (L1)</span>
                  <StatusBadge status={d.floor_status} />
                  {d.floor_reviewer_name && (
                    <span className="text-muted-foreground">by {d.floor_reviewer_name}</span>
                  )}
                  {d.floor_remarks && (
                    <span className="text-muted-foreground italic">“{d.floor_remarks}”</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">PPC (L2)</span>
                  <StatusBadge status={d.ppc_status} />
                  {d.eco_no && <span className="font-semibold text-primary">{d.eco_no}</span>}
                  {d.ppc_remarks && (
                    <span className="text-muted-foreground italic">“{d.ppc_remarks}”</span>
                  )}
                </div>
                <FusionBadge status={d.fusion_sync} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className="truncate">{value || "—"}</p>
    </div>
  );
}
