import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, Download, FileClock, XCircle } from "lucide-react";
import { useDeviations, deviationToExportRow, EXPORT_COLUMNS } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { ageMinutes, isOpen } from "@/lib/types";
import { AgeBadge, FusionBadge, PageHeader, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: all = [], isLoading } = useDeviations();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [aging, setAging] = useState("all");

  const rows = useMemo(() => {
    return all.filter((d) => {
      const hay =
        `${d.ticket_no} ${d.item_name} ${d.requester_name} ${d.supervisor_name} ${d.proposed_operation} ${d.next_dept_desc ?? ""} ${d.eco_no ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (stage === "floor_pending" && d.floor_status !== "PENDING") return false;
      if (stage === "ppc_pending" && !(d.floor_status === "APPROVED" && d.ppc_status === "PENDING"))
        return false;
      if (stage === "approved" && d.ppc_status !== "APPROVED") return false;
      if (stage === "rejected" && d.floor_status !== "REJECTED" && d.ppc_status !== "REJECTED")
        return false;
      if (stage === "synced" && d.fusion_sync !== "SYNCED") return false;
      const hrs = ageMinutes(d.submitted_at) / 60;
      if (aging === "lt24" && hrs >= 24) return false;
      if (aging === "24to48" && (hrs < 24 || hrs > 48)) return false;
      if (aging === "gt48" && hrs <= 48) return false;
      return true;
    });
  }, [all, q, stage, aging]);

  const open = all.filter(isOpen);
  const kpis = [
    { label: "Open tickets", value: open.length, icon: FileClock, tone: "text-amber-300" },
    {
      label: "Awaiting floor (L1)",
      value: all.filter((d) => d.floor_status === "PENDING").length,
      icon: AlarmClock,
      tone: "text-amber-300",
    },
    {
      label: "Awaiting PPC (L2)",
      value: all.filter((d) => d.floor_status === "APPROVED" && d.ppc_status === "PENDING").length,
      icon: AlarmClock,
      tone: "text-primary",
    },
    {
      label: "ECO issued",
      value: all.filter((d) => !!d.eco_no).length,
      icon: CheckCircle2,
      tone: "text-emerald-300",
    },
    {
      label: "Rejected",
      value: all.filter((d) => d.floor_status === "REJECTED" || d.ppc_status === "REJECTED").length,
      icon: XCircle,
      tone: "text-red-300",
    },
    {
      label: "Ageing > 48h",
      value: open.filter((d) => ageMinutes(d.submitted_at) / 60 > 48).length,
      icon: AlarmClock,
      tone: "text-red-300",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Control Dashboard"
        subtitle="Live status of every routing deviation across both approval levels."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV("deviations.csv", toCSV(rows.map(deviationToExportRow), EXPORT_COLUMNS))
            }
          >
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-4">
            <k.icon className={`size-4 ${k.tone}`} />
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">{k.value}</p>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search ticket, item, ECO, requester…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="floor_pending">Awaiting floor (L1)</SelectItem>
            <SelectItem value="ppc_pending">Awaiting PPC (L2)</SelectItem>
            <SelectItem value="approved">Fully approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="synced">Fusion synced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={aging} onValueChange={setAging}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any age</SelectItem>
            <SelectItem value="lt24">Under 24h</SelectItem>
            <SelectItem value="24to48">24–48h</SelectItem>
            <SelectItem value="gt48">Over 48h</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-secondary/60 text-[10px] tracking-widest uppercase">
            <tr>
              {[
                "Ticket",
                "Item",
                "Requester",
                "Proposed operation",
                "Age",
                "L1",
                "L2",
                "ECO",
                "Fusion",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No tickets match these filters.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{d.ticket_no}</td>
                  <td className="px-3 py-2">{d.item_name}</td>
                  <td className="px-3 py-2">{d.requester_name}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">{d.proposed_operation}</td>
                  <td className="px-3 py-2">
                    <AgeBadge since={d.submitted_at} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.floor_status} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.ppc_status} />
                  </td>
                  <td className="px-3 py-2 text-xs">{d.eco_no ?? "—"}</td>
                  <td className="px-3 py-2">
                    <FusionBadge status={d.fusion_sync} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
