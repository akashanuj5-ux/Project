import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, CloudUpload, FileSpreadsheet, Pencil, Save, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deviationToExportRow, EXPORT_COLUMNS, useDeviations } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { Deviation } from "@/lib/types";
import { PageHeader, FusionBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import {
  TicketFilters,
  emptyTicketFilters,
  filterDeviationRows,
  type TicketFilterState,
} from "@/components/TicketFilters";

export const Route = createFileRoute("/_authenticated/oracle-sync")({
  component: OracleSyncPage,
});

type SyncChoice = "SYNCED" | "NOT_SYNCED";

type Draft = {
  eco: string;
  status: SyncChoice;
};

function normalized(value: unknown): string {
  return String(value ?? "").trim();
}

function OracleSyncPage() {
  const { canView, can } = useAuth();
  const { data: all = [], isLoading } = useDeviations();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filters, setFilters] = useState<TicketFilterState>(emptyTicketFilters);
  const [fusionStatus, setFusionStatus] = useState("all");
  const canSync = can("oracleSync", "canSync");

  const rows = all.filter((deviation) => Boolean(deviation.eco_no));
  const filteredRows = filterDeviationRows(rows, filters, "ppc_reviewed_at").filter((row) => {
    if (fusionStatus === "synced") return row.fusion_sync === "SYNCED";
    if (fusionStatus === "raised") return row.fusion_sync !== "SYNCED";
    return true;
  });

  if (!canView("oracleSync")) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You do not have access to this page.
      </p>
    );
  }

  function draftFor(deviation: Deviation): Draft {
    return (
      drafts[deviation.id] ?? {
        eco: deviation.eco_no ?? "",
        status: deviation.fusion_sync === "SYNCED" ? "SYNCED" : "NOT_SYNCED",
      }
    );
  }

  async function updateRows(updates: { id: string; eco: string; status: SyncChoice }[]) {
    await Promise.all(
      updates.map(async ({ id, eco, status }) => {
        const { error } = await supabase
          .from("deviations")
          .update({
            eco_no: eco,
            fusion_sync: status,
            fusion_synced_at: status === "SYNCED" ? new Date().toISOString() : null,
          })
          .eq("id", id);
        if (error) throw error;
      }),
    );
    await queryClient.invalidateQueries({ queryKey: ["deviations"] });
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const headers = records.length
        ? Object.keys(records[0]!).map((key) => key.trim().toUpperCase())
        : [];
      if (!headers.includes("ECO") || !headers.includes("FUSION")) {
        throw new Error("The upload must contain ECO and FUSION columns.");
      }

      const byEco = new Map(rows.map((row) => [normalized(row.eco_no), row]));
      const updates: { id: string; eco: string; status: SyncChoice }[] = [];
      let skipped = 0;
      for (const record of records) {
        const values = Object.fromEntries(
          Object.entries(record).map(([key, value]) => [key.trim().toUpperCase(), value]),
        );
        const eco = normalized(values.ECO);
        const row = byEco.get(eco);
        if (!eco || !row) {
          skipped += 1;
          continue;
        }
        updates.push({
          id: row.id,
          eco,
          status: normalized(values.FUSION).toUpperCase() === "SYNCED" ? "SYNCED" : "NOT_SYNCED",
        });
      }

      if (!updates.length) {
        throw new Error("No uploaded ECO numbers matched approved tickets.");
      }
      await updateRows(updates);
      toast.success(
        `${updates.length} Fusion status${updates.length === 1 ? "" : "es"} updated${skipped ? `; ${skipped} row(s) skipped` : ""}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import the file");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function saveRow(deviation: Deviation) {
    const draft = draftFor(deviation);
    if (!/^\d+$/.test(draft.eco)) {
      toast.error("ECO Number must contain numeric characters only");
      return;
    }
    setBusy(true);
    try {
      await updateRows([{ id: deviation.id, eco: draft.eco, status: draft.status }]);
      setEditingId(null);
      toast.success("Oracle Fusion changes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(id: string, patch: Partial<Draft>, deviation: Deviation) {
    setDrafts((current) => ({ ...current, [id]: { ...draftFor(deviation), ...patch } }));
  }

  return (
    <div>
      <PageHeader
        title="Oracle Fusion Sync"
        subtitle="Update ECO routing status from Oracle Fusion exports or correct records manually."
      />

      <section className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-200">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <CloudUpload className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Bulk upload</h2>
            <p className="text-xs text-slate-400">
              Upload a CSV or XLSX file with ECO and FUSION columns.
            </p>
          </div>
        </div>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void importFile(file);
          }}
          className={`rounded-lg border border-dashed p-8 text-center transition-colors ${
            dragging ? "border-cyan-400 bg-cyan-400/10" : "border-slate-600 bg-slate-950/40"
          }`}
        >
          <FileSpreadsheet className="mx-auto mb-2 size-7 text-slate-400" />
          <p className="text-sm font-medium">Drop your Oracle export here</p>
          <p className="mt-1 text-xs text-slate-500">
            Blank FUSION values remain Raised; Synced values become Synced.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={busy || !canSync}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="mr-2 size-4" /> Choose CSV / XLSX
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <TicketFilters
          filters={filters}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          showAgeing={false}
          statusValue={fusionStatus}
          onStatusChange={setFusionStatus}
          statusOptions={[
            { value: "all", label: "All Statuses" },
            { value: "raised", label: "Raised" },
            { value: "synced", label: "Fusion synced" },
          ]}
          exportLabel="Export Filtered CSV"
          onExport={() =>
            downloadCSV(
              "oracle-fusion-sync.csv",
              toCSV(filteredRows.map(deviationToExportRow), EXPORT_COLUMNS),
            )
          }
        />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Manual sync table</h2>
            <p className="text-xs text-muted-foreground">
              {filteredRows.length} of {rows.length} approved ticket{rows.length === 1 ? "" : "s"}{" "}
              with ECO numbers
            </p>
          </div>
          <Check className="size-5 text-emerald-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary/60 text-[10px] tracking-widest uppercase">
              <tr>
                {[
                  "Ticket ID",
                  "Item Code",
                  "ECO Number",
                  "Approval Date",
                  "Fusion Status",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-3 py-2 text-left font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No ECO numbers have been approved yet.
                  </td>
                </tr>
              ) : (
                filteredRows.map((deviation) => {
                  const editing = editingId === deviation.id;
                  const draft = draftFor(deviation);
                  return (
                    <tr key={deviation.id} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold">{deviation.ticket_no}</td>
                      <td className="px-3 py-2">{deviation.item_name}</td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <input
                            value={draft.eco}
                            inputMode="numeric"
                            onChange={(event) =>
                              updateDraft(
                                deviation.id,
                                { eco: event.target.value.replace(/\D/g, "") },
                                deviation,
                              )
                            }
                            className="h-8 w-36 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs focus:border-cyan-500 focus:outline-none"
                          />
                        ) : (
                          deviation.eco_no
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {deviation.ppc_reviewed_at
                          ? new Date(deviation.ppc_reviewed_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              updateDraft(
                                deviation.id,
                                { status: event.target.value as SyncChoice },
                                deviation,
                              )
                            }
                            className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="SYNCED">Synced</option>
                            <option value="NOT_SYNCED">Raised</option>
                          </select>
                        ) : (
                          <FusionBadge status={deviation.fusion_sync} hasEco />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <Button size="sm" disabled={busy} onClick={() => void saveRow(deviation)}>
                            <Save className="mr-2 size-3.5" /> Save Changes
                          </Button>
                        ) : canSync ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit ECO or Fusion status"
                            onClick={() => setEditingId(deviation.id)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
