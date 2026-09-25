import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EXPORT_COLUMNS, deviationToExportRow, logAudit, useDeviations } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { CHANGE_TYPES, EDITABLE_FIELDS, type Deviation } from "@/lib/types";
import { AgeBadge, FusionBadge, PageHeader, StatusBadge } from "@/components/badges";
import {
  TicketFilters,
  emptyTicketFilters,
  filterDeviationRows,
  type TicketFilterState,
} from "@/components/TicketFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ReviewBoard({ level }: { level: "floor" | "ppc" }) {
  const { data: all = [], isLoading } = useDeviations();
  const { canView, can } = useAuth();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [filters, setFilters] = useState<TicketFilterState>(emptyTicketFilters);

  const scope = level === "floor" ? all : all.filter((d) => d.floor_status === "APPROVED");
  const statusKey = level === "floor" ? "floor_status" : "ppc_status";
  const filteredScope = filterDeviationRows(scope, filters);
  const pending = filteredScope.filter((d) => d[statusKey] === "PENDING");
  const done = filteredScope.filter((d) => d[statusKey] !== "PENDING");
  const rows = tab === "pending" ? pending : done;
  const page = level === "floor" ? "floorReview" : "ppcReview";
  const canTakeAction = level === "floor" ? can(page, "canApproveL1") : can(page, "canApproveL2");

  if (!canView(page)) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You do not have access to this page.
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title={level === "floor" ? "Floor Review (L1)" : "PPC Review (L2)"}
        subtitle={
          level === "floor"
            ? "First-level approval. You may correct any field before approving — every change is logged."
            : "Second-level approval. Only floor-approved tickets appear here. Approving issues an ECO number."
        }
      />

      <TicketFilters
        filters={filters}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        tabs={[
          {
            value: "pending",
            label: level === "floor" ? "Awaiting L1" : "Awaiting L2",
            count: pending.length,
          },
          { value: "done", label: "Actioned", count: done.length },
        ]}
        activeTab={tab}
        onTabChange={(value) => setTab(value as "pending" | "done")}
        onExport={() =>
          downloadCSV(`${level}-review.csv`, toCSV(rows.map(deviationToExportRow), EXPORT_COLUMNS))
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing here right now.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <ReviewCard key={d.id} deviation={d} level={level} canTakeAction={canTakeAction} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  deviation,
  level,
  canTakeAction,
}: {
  deviation: Deviation;
  level: "floor" | "ppc";
  canTakeAction: boolean;
}) {
  const { session, userName, userEmail, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [ecoDialogOpen, setEcoDialogOpen] = useState(false);
  const [ecoNumber, setEcoNumber] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>(() => snapshot(deviation));

  const statusKey = level === "floor" ? "floor_status" : "ppc_status";
  const actionable = deviation[statusKey] === "PENDING";

  function snapshot(d: Deviation) {
    const out: Record<string, string> = {};
    for (const f of EDITABLE_FIELDS)
      out[f.key as string] = d[f.key] === null || d[f.key] === undefined ? "" : String(d[f.key]);
    return out;
  }

  async function saveEdits() {
    if (!session) return;
    const changes: { field: string; old: string; new: string }[] = [];
    const patch: Record<string, unknown> = {};
    for (const f of EDITABLE_FIELDS) {
      const key = f.key as string;
      const oldVal =
        deviation[f.key] === null || deviation[f.key] === undefined ? "" : String(deviation[f.key]);
      const newVal = draft[key] ?? "";
      if (oldVal !== newVal) {
        changes.push({ field: f.label, old: oldVal || "—", new: newVal || "—" });
        patch[key] = f.type === "number" ? (newVal ? Number(newVal) : null) : newVal || null;
      }
    }
    if (changes.length === 0) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("deviations").update(patch).eq("id", deviation.id);
      if (error) throw error;
      await logAudit({
        deviation_id: deviation.id,
        action: level === "floor" ? "EDITED_BY_FLOOR" : "EDITED_BY_PPC",
        actor_id: session.user.id,
        actor_name: userName,
        actor_email: userEmail,
        actor_role: activeRole ?? "",
        remarks: `${changes.length} field(s) corrected`,
        changes,
      });
      await queryClient.invalidateQueries({ queryKey: ["deviations"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      toast.success("Changes saved and logged to the audit trail");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    if (!session) return;
    if (approve && level === "ppc" && !/^\d+$/.test(ecoNumber)) {
      toast.error("Enter a numeric ECO number before approving");
      return;
    }
    if (!approve && !remarks.trim()) {
      toast.error("A reason is required to reject");
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> =
        level === "floor"
          ? {
              floor_status: approve ? "APPROVED" : "REJECTED",
              floor_reviewed_by: session.user.id,
              floor_reviewer_name: userName,
              floor_reviewed_at: now,
              floor_remarks: remarks || null,
              ...(approve ? {} : { ppc_status: "NA" }),
            }
          : {
              ppc_status: approve ? "APPROVED" : "REJECTED",
              ppc_reviewed_by: session.user.id,
              ppc_reviewer_name: userName,
              ppc_reviewed_at: now,
              ppc_remarks: remarks || null,
              ...(approve
                ? { eco_no: ecoNumber, fusion_sync: "NOT_SYNCED", fusion_synced_at: null }
                : {}),
            };
      const { error } = await supabase.from("deviations").update(patch).eq("id", deviation.id);
      if (error) throw error;
      await logAudit({
        deviation_id: deviation.id,
        action: `${level === "floor" ? "FLOOR" : "PPC"}_${approve ? "APPROVED" : "REJECTED"}`,
        actor_id: session.user.id,
        actor_name: userName,
        actor_email: userEmail,
        actor_role: activeRole ?? "",
        remarks: remarks || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["deviations"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      toast.success(`${deviation.ticket_no} ${approve ? "approved" : "rejected"}`);
      setRemarks("");
      setEcoNumber("");
      setEcoDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={ecoDialogOpen} onOpenChange={setEcoDialogOpen}>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-lg font-bold tracking-wide">
            {deviation.ticket_no}
          </span>
          <AgeBadge since={deviation.submitted_at} />
          <span className="text-sm text-muted-foreground">
            {deviation.requester_name} · Item {deviation.item_name}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={deviation.floor_status} label={`L1 ${deviation.floor_status}`} />
            <StatusBadge status={deviation.ppc_status} label={`L2 ${deviation.ppc_status}`} />
          </div>
        </div>

        {!editing ? (
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key as string}>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                  {f.label}
                </p>
                <p className="truncate">{String(deviation[f.key] ?? "") || "—"}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key as string} className="space-y-1.5">
                <Label className="text-[10px] tracking-widest uppercase">{f.label}</Label>
                {f.type === "select" ? (
                  <Select
                    value={draft[f.key as string] || "Permanent"}
                    onValueChange={(v) => setDraft((p) => ({ ...p, [f.key as string]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANGE_TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={draft[f.key as string] ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, [f.key as string]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {deviation.eco_no && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
              {deviation.eco_no}
            </span>
            <FusionBadge status={deviation.fusion_sync} hasEco={Boolean(deviation.eco_no)} />
          </div>
        )}

        {actionable && canTakeAction && (
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            <Textarea
              rows={2}
              placeholder="Reviewer remarks (required to reject)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={saveEdits} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}{" "}
                    Save changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraft(snapshot(deviation));
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 size-4" /> Correct fields
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => (level === "ppc" ? setEcoDialogOpen(true) : void decide(true))}
                disabled={busy || editing}
              >
                <Check className="mr-2 size-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => decide(false)}
                disabled={busy || editing}
              >
                <X className="mr-2 size-4" /> Reject
              </Button>
            </div>
          </div>
        )}
        {actionable && !canTakeAction && (
          <span className="mt-4 inline-flex rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            View Only
          </span>
        )}

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {deviation.ticket_no}</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the numeric ECO number before approving this ticket. Fusion status will start as
              Raised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`eco-number-${deviation.id}`}>Enter ECO Number (Numeric only)</Label>
            <Input
              id={`eco-number-${deviation.id}`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={ecoNumber}
              onChange={(event) => setEcoNumber(event.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 20260925001"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button onClick={() => decide(true)} disabled={busy || !/^\d+$/.test(ecoNumber)}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm approval
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </div>
    </AlertDialog>
  );
}
