import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileText, Loader2, Paperclip, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
  ATTACHMENT_MAX_BYTES,
  deleteAttachment,
  fallbackFileName,
  fetchAttachmentContent,
  saveBlobAs,
  uploadDeviationAttachment,
} from "@/lib/attachments";
import { useAuth } from "@/lib/auth";
import { EXPORT_COLUMNS, deviationToExportRow, logAudit, useDeviations } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { CHANGE_TYPES, EDITABLE_FIELDS, type Deviation } from "@/lib/types";
import { AgeBadge, FusionBadge, PageHeader, StatusBadge } from "@/components/badges";
import { DeleteTicketButton } from "@/components/delete-ticket-button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function attachmentUrlFor(deviation: Deviation): string | null {
  if (deviation.eco_attachment_url) return deviation.eco_attachment_url;
  const fallback = deviation.custom_fields?.["eco_attachment_url"];
  return typeof fallback === "string" ? fallback : null;
}

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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      await apiFetch(`/api/deviations/${deviation.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
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
    let uploadedAttachmentId: string | null = null;
    let approvalSaved = false;
    try {
      const now = new Date().toISOString();
      let attachmentUrl: string | null = null;
      if (approve && level === "ppc" && attachment) {
        // 1) Upload FIRST and wait for the backend to confirm the file is
        //    fully stored in MySQL — the approval only continues afterwards,
        //    so it can never complete before the upload finishes.
        setUploading(true);
        try {
          const stored = await uploadDeviationAttachment(deviation.id, attachment);
          attachmentUrl = stored.url;
          uploadedAttachmentId = stored.id;
        } finally {
          setUploading(false);
        }
      }
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
                ? {
                    eco_no: ecoNumber,
                    eco_attachment_url: attachmentUrl,
                    fusion_sync: "NOT_SYNCED",
                    fusion_synced_at: null,
                  }
                : {}),
            };
      // MySQL schema includes eco_attachment_url, so the legacy column-missing
      // fallback chain for legacy missing-column cases is no longer reachable.
      await apiFetch(`/api/deviations/${deviation.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      approvalSaved = true;
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
      setAttachment(null);
      setEcoDialogOpen(false);
    } catch (e) {
      if (uploadedAttachmentId && !approvalSaved) {
        // The approval did not save — roll the upload back so no orphaned
        // file remains, then surface the original error.
        try {
          await deleteAttachment(uploadedAttachmentId);
        } catch {
          // Best-effort cleanup only.
        }
      }
      const message =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "Could not update";
      toast.error(message);
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
          <AgeBadge since={deviation.submitted_at} ticket={deviation} />
          <span className="text-sm text-muted-foreground">
            {deviation.requester_name} · Item {deviation.item_name}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={deviation.floor_status} label={`L1 ${deviation.floor_status}`} />
            <StatusBadge status={deviation.ppc_status} label={`L2 ${deviation.ppc_status}`} />
            <DeleteTicketButton
              ticketId={deviation.id}
              ticketNo={deviation.ticket_no}
              size="icon"
              variant="ghost"
            />
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
            {attachmentUrlFor(deviation) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => setAttachmentOpen(true)}
              >
                <Paperclip className="mr-1.5 size-3" /> View Attachment
              </Button>
            )}
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
          {level === "ppc" && (
            <div className="space-y-2">
              <Label htmlFor={`eco-attachment-${deviation.id}`}>
                Attach Reference Image / Document (Optional)
              </Label>
              <Input
                id={`eco-attachment-${deviation.id}`}
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > ATTACHMENT_MAX_BYTES) {
                    toast.error("Attachment must be 10 MB or smaller");
                    event.currentTarget.value = "";
                    setAttachment(null);
                    return;
                  }
                  setAttachment(file);
                }}
                className="cursor-pointer text-xs"
              />
              {attachment && (
                <div className="flex items-center justify-between rounded border border-border bg-muted/40 px-2 py-1.5 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <FileText className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{attachment.name}</span>
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6 shrink-0"
                    title="Remove attachment"
                    onClick={() => setAttachment(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button onClick={() => decide(true)} disabled={busy || !/^\d+$/.test(ecoNumber)}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {uploading ? "Uploading attachment…" : "Confirm approval"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </div>
      <AttachmentPreview
        url={attachmentUrlFor(deviation)}
        open={attachmentOpen}
        onOpenChange={setAttachmentOpen}
      />
    </AlertDialog>
  );
}

type AttachmentPreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unsupported"; blob: Blob | null; fileName: string | null; mime: string }
  | { kind: "ready"; renderUrl: string; blob: Blob; fileName: string | null; mime: string };

/**
 * Preview/download dialog for a stored ticket attachment.
 * Fetches the ORIGINAL bytes (authenticated Express endpoint or legacy inline
 * data URL) so the exact server MIME type is preserved: PNG/JPG render as an
 * image, PDFs in an iframe, anything else shows "Preview unavailable" with a
 * Download option.
 */
function AttachmentPreview({
  url,
  open,
  onOpenChange,
}: {
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<AttachmentPreviewState>({ kind: "idle" });

  useEffect(() => {
    if (!open || !url) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ kind: "loading" });
    (async () => {
      try {
        const content = await fetchAttachmentContent(url);
        if (cancelled) return;
        if (!content) {
          // External/hosted URL — never fetched (no external storage dependency).
          setState({ kind: "unsupported", blob: null, fileName: null, mime: "" });
          return;
        }
        const { blob, mime, fileName } = content;
        const renderable =
          mime === "image/png" || mime === "image/jpeg" || mime === "application/pdf";
        if (!renderable) {
          setState({ kind: "unsupported", blob, fileName, mime });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setState({ kind: "ready", renderUrl: objectUrl, blob, fileName, mime });
      } catch (e) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not load the attachment",
        });
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, url]);

  if (!url) return null;

  const downloadable = state.kind === "ready" || (state.kind === "unsupported" && state.blob);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] w-[min(96vw,1100px)] max-w-none">
        <DialogHeader>
          <DialogTitle>Reference Attachment</DialogTitle>
          <DialogDescription>Preview the attachment linked to this ECO approval.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-black/20 p-2">
          {state.kind === "loading" && (
            <div className="flex h-full min-h-[65vh] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading attachment…
            </div>
          )}
          {state.kind === "error" && (
            <div className="flex h-full min-h-[65vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {state.message}
            </div>
          )}
          {state.kind === "unsupported" && (
            <div className="flex h-full min-h-[65vh] flex-col items-center justify-center gap-1 px-6 text-center">
              <span className="text-sm font-medium text-foreground">Preview unavailable</span>
              <span className="text-xs text-muted-foreground">
                Download the file to open it in a native application.
              </span>
            </div>
          )}
          {state.kind === "ready" &&
            (state.mime === "application/pdf" ? (
              <iframe
                title="Reference document"
                src={state.renderUrl}
                className="h-full min-h-[65vh] w-full"
              />
            ) : (
              <img
                src={state.renderUrl}
                alt="ECO reference attachment"
                className="mx-auto max-h-[70vh] max-w-full object-contain"
              />
            ))}
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!downloadable}
            onClick={() => {
              if (state.kind === "ready") {
                saveBlobAs(state.blob, state.fileName ?? fallbackFileName(state.mime));
              } else if (state.kind === "unsupported" && state.blob) {
                saveBlobAs(state.blob, state.fileName ?? fallbackFileName(state.mime));
              }
            }}
          >
            <Download className="mr-2 size-4" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
