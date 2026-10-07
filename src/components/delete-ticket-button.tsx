import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Extract the Supabase Storage object path from a public URL for deletion. */
function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url || url.startsWith("data:")) return null;
  const marker = "/deviation-attachments/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  return path || null;
}

/**
 * Administrator-only "Delete Ticket" action. Renders nothing for non-admins
 * (backend also enforces ADMIN via 403). Shows the required confirmation,
 * deletes the ticket via DELETE /api/deviations/:id, then removes ONLY that
 * ticket's Supabase Storage attachment (if any). Used on every ticket view.
 */
export function DeleteTicketButton({
  ticketId,
  ticketNo,
  attachmentUrl,
  size = "sm",
  variant = "destructive",
}: {
  ticketId: string;
  ticketNo: string;
  attachmentUrl?: string | null;
  size?: "sm" | "icon";
  variant?: "destructive" | "ghost";
}) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function confirmDelete() {
    setBusy(true);
    try {
      const result = await apiFetch<{ message: string; attachmentUrl: string | null }>(
        `/api/deviations/${ticketId}`,
        { method: "DELETE" },
      );
      // Delete ONLY this ticket's own Storage attachment (never unrelated files).
      const url = attachmentUrl ?? result.attachmentUrl;
      const path = storagePathFromUrl(url);
      if (path) {
        try {
          await supabase.storage.from("deviation-attachments").remove([path]);
        } catch {
          // Attachment cleanup is best-effort; the ticket itself is already deleted.
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete ticket");
      setBusy(false);
      return;
    }
    setBusy(false);
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["deviations"] });
    toast.success(`Ticket ${ticketNo} deleted`);
  }

  return (
    <>
      {size === "icon" ? (
        <Button size="icon" variant={variant} title="Delete Ticket" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 size-3.5" /> Delete Ticket
        </Button>
      )}
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (!v && !busy) setOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ticket {ticketNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this ticket permanently? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {busy ? "Deleting…" : "Delete Ticket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
