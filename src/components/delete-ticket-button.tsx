import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
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

/**
 * Administrator-only "Delete Ticket" action. Renders nothing for non-admins
 * (backend also enforces ADMIN via 403). Shows the required confirmation and
 * deletes the ticket via DELETE /api/deviations/:id. The backend removes the
 * ticket's stored attachment rows (ticket_attachments) in the same operation.
 * Used on every ticket view.
 */
export function DeleteTicketButton({
  ticketId,
  ticketNo,
  size = "sm",
  variant = "destructive",
}: {
  ticketId: string;
  ticketNo: string;
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
      // The backend also deletes this ticket's attachment file(s) — only this
      // ticket's own rows, never unrelated files.
      await apiFetch<{ message: string }>(`/api/deviations/${ticketId}`, {
        method: "DELETE",
      });
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
