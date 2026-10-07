import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { ALL_ROLES, ROLE_LABELS, type AppRole, type ProfileRow } from "@/lib/types";
import { PageHeader } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManagePermissionsDialog } from "@/components/manage-permissions-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/users")({
  component: Users,
});

function Users() {
  const { canView, can } = useAuth();
  const canManage = can("userAccounts", "canManage");
  const { data, isLoading } = useProfiles();
  const queryClient = useQueryClient();
  const [permissionUser, setPermissionUser] = useState<ProfileRow | null>(null);
  const [resetUser, setResetUser] = useState<ProfileRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<ProfileRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const profiles = data?.profiles ?? [];
  const roles = data?.roles ?? [];
  const roleOf = (id: string) =>
    (roles.find((r) => r.user_id === id)?.role as AppRole | undefined) ?? "REQUESTER";
  // Protected administrator — never deletable/deactivatable, role locked (UI + backend 403).
  const isProtected = (p: ProfileRow) =>
    p.email.trim().toLowerCase() === "akash.sharma@karam.in";

  if (!canView("userAccounts")) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You do not have access to this page.
      </p>
    );
  }

  async function changeRole(userId: string, role: AppRole) {
    try {
      await apiFetch(`/api/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update role");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Role updated");
  }

  async function toggleActive(userId: string, isActive: boolean) {
    try {
      await apiFetch(`/api/profiles/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !isActive }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
  }

  async function submitResetPassword() {
    if (!resetUser) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setResetBusy(true);
    try {
      await apiFetch(`/api/users/${resetUser.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword, confirm_password: confirmPassword }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset password");
      setResetBusy(false);
      return;
    }
    setResetBusy(false);
    setResetUser(null);
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password reset successfully");
  }

  async function confirmDelete() {
    if (!deleteUser) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/users/${deleteUser.id}`, { method: "DELETE" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete account");
      setDeleteBusy(false);
      return;
    }
    setDeleteBusy(false);
    setDeleteUser(null);
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Account deleted");
  }

  return (
    <div>
      <PageHeader
        title="User Accounts"
        subtitle="Assign roles and deactivate accounts. Roles are enforced by the database, not just the interface."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV(
                "users.csv",
                toCSV(
                  profiles.map((p) => ({
                    Name: p.full_name,
                    Email: p.email,
                    Role: ROLE_LABELS[roleOf(p.id)],
                    Active: p.is_active ? "Yes" : "No",
                    Created: new Date(p.created_at).toLocaleString(),
                  })),
                  ["Name", "Email", "Role", "Active", "Created"],
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-secondary/60 text-[10px] tracking-widest uppercase">
              <tr>
                {["Name", "Email", "Role", "Status", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{p.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.email}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={roleOf(p.id)}
                      onValueChange={(v) => changeRole(p.id, v as AppRole)}
                      disabled={!canManage || isProtected(p)}
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={p.is_active ? "text-emerald-300" : "text-red-300"}>
                      {p.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!isProtected(p) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canManage}
                          onClick={() => toggleActive(p.id, p.is_active)}
                        >
                          {p.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage}
                        onClick={() => {
                          setNewPassword("");
                          setConfirmPassword("");
                          setResetUser(p);
                        }}
                      >
                        Reset Password
                      </Button>
                      {!isProtected(p) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!canManage}
                          onClick={() => setDeleteUser(p)}
                        >
                          Delete Account
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage}
                        onClick={() => setPermissionUser(p)}
                      >
                        Permissions
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {permissionUser && (
        <ManagePermissionsDialog
          profile={permissionUser}
          role={roleOf(permissionUser.id)}
          open={Boolean(permissionUser)}
          onOpenChange={(open) => {
            if (!open) setPermissionUser(null);
          }}
        />
      )}
      <Dialog
        open={Boolean(resetUser)}
        onOpenChange={(open) => {
          if (!open) {
            setResetUser(null);
            setNewPassword("");
            setConfirmPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.full_name} ({resetUser?.email}). The old
              password is never shown or retrieved.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={resetBusy}
              onClick={() => {
                setResetUser(null);
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancel
            </Button>
            <Button disabled={resetBusy} onClick={submitResetPassword}>
              {resetBusy ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleteUser)}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleteUser(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {deleteUser?.full_name} ({deleteUser?.email}) and
              only that account&apos;s local sign-in records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
