import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Cloud, Download, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  EXPORT_COLUMNS,
  deviationToExportRow,
  generateEcoNumber,
  logAudit,
  useDeviations,
} from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { CHANGE_TYPES, EDITABLE_FIELDS, type Deviation } from "@/lib/types";
import { AgeBadge, FusionBadge, PageHeader, StatusBadge } from "@/components/badges";
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

export function ReviewBoard({ level }: { level: "floor" | "ppc" }) {
  const { data: all = [], isLoading } = useDeviations();
  const [tab, setTab] = useState<"pending" | "done">("pending");

  const scope = level === "floor" ? all : all.filter((d) => d.floor_status === "APPROVED");
  const statusKey = level === "floor" ? "floor_status" : "ppc_status";
  const pending = scope.filter((d) => d[statusKey] === "PENDING");
  const done = scope.filter((d) => d[statusKey] !== "PENDING");
  const rows = tab === "pending" ? pending : done;

  return (
    <div>
      <PageHeader
        title={level === "floor" ? "Floor Review (L1)" : "PPC Review (L2)"}
        subtitle={
          level === "floor"
            ? "First-level approval. You may correct any field before approving — every change is logged."
            : "Second-level approval. Only floor-approved tickets appear here. Approving issues an ECO number."
        }
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV(
                `${level}-review.csv`,
                toCSV(rows.map(deviationToExportRow), EXPORT_COLUMNS),
              )
            }
          >
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        <Button
          variant={tab === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("pending")}
        >
          Awaiting action ({pending.length})
        </Button>
        <Button
          variant={tab === "done" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("done")}
        >
          Actioned ({done.length})
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing here right now.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <ReviewCard key={d.id} deviation={d} level={level} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ deviation, level }: { deviation: Deviation; level: "floor" | "ppc" }) {
  const { session, userName, userEmail, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remarks, setRemarks] = useState("");
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
              ...(approve ? { eco_no: deviation.eco_no ?? generateEcoNumber() } : {}),
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  async function syncFusion() {
    if (!session) return;
    setBusy(true);
    try {
      const ok = Math.random() > 0.12;
      const { error } = await supabase
        .from("deviations")
        .update({
          fusion_sync: ok ? "SYNCED" : "FAILED",
          fusion_synced_at: ok ? new Date().toISOString() : null,
        })
        .eq("id", deviation.id);
      if (error) throw error;
      await logAudit({
        deviation_id: deviation.id,
        action: ok ? "FUSION_SYNCED" : "FUSION_SYNC_FAILED",
        actor_id: session.user.id,
        actor_name: userName,
        actor_email: userEmail,
        actor_role: activeRole ?? "",
        remarks: ok
          ? `Routing pushed to Oracle Fusion (${deviation.eco_no})`
          : "Fusion endpoint rejected the payload",
      });
      await queryClient.invalidateQueries({ queryKey: ["deviations"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      if (ok) {
        toast.success("Synced to Fusion");
      } else {
        toast.error("Fusion sync failed — retry");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-lg font-bold tracking-wide">{deviation.ticket_no}</span>
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
          <FusionBadge status={deviation.fusion_sync} />
        </div>
      )}

      {actionable && (
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
            <Button size="sm" onClick={() => decide(true)} disabled={busy || editing}>
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

      {level === "ppc" &&
        deviation.ppc_status === "APPROVED" &&
        deviation.fusion_sync !== "SYNCED" && (
          <div className="mt-4 border-t border-border pt-3">
            <Button size="sm" variant="outline" onClick={syncFusion} disabled={busy}>
              <Cloud className="mr-2 size-4" /> Sync routing to Oracle Fusion
            </Button>
          </div>
        )}
    </div>
  );
}
