import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useAuditTrail, useDeviations } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { PageHeader } from "@/components/badges";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/audit-log")({
  component: AuditLog,
});

function AuditLog() {
  const { data: entries = [], isLoading } = useAuditTrail();
  const { data: devs = [] } = useDeviations();
  const ticketOf = (id: string | null) => devs.find((d) => d.id === id)?.ticket_no ?? "—";

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        subtitle="Every submission, correction, approval and sync, with the person and role who did it."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV(
                "audit-trail.csv",
                toCSV(
                  entries.map((e) => ({
                    When: new Date(e.created_at).toLocaleString(),
                    Ticket: ticketOf(e.deviation_id),
                    Action: e.action,
                    By: e.actor_name,
                    Email: e.actor_email,
                    Role: e.actor_role,
                    Remarks: e.remarks ?? "",
                    Changes: e.changes.map((c) => `${c.field}: ${c.old} -> ${c.new}`).join(" | "),
                  })),
                  ["When", "Ticket", "Action", "By", "Email", "Role", "Remarks", "Changes"],
                ),
              )
            }
          >
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                  {e.action.replace(/_/g, " ")}
                </span>
                <span className="font-semibold">{ticketOf(e.deviation_id)}</span>
                <span className="text-muted-foreground">
                  {e.actor_name} ({e.actor_role || "—"})
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              {e.remarks && <p className="mt-1 text-muted-foreground italic">“{e.remarks}”</p>}
              {e.changes?.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {e.changes.map((c, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">{c.field}:</span>{" "}
                      <span className="text-red-300 line-through">{c.old}</span>{" "}
                      <span className="text-emerald-300">{c.new}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
