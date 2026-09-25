import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { ALL_ROLES, ROLE_LABELS, type AppRole, type ProfileRow } from "@/lib/types";
import { PageHeader } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { ManagePermissionsDialog } from "@/components/manage-permissions-dialog";
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
  const profiles = data?.profiles ?? [];
  const roles = data?.roles ?? [];
  const roleOf = (id: string) =>
    (roles.find((r) => r.user_id === id)?.role as AppRole | undefined) ?? "REQUESTER";

  if (!canView("userAccounts")) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You do not have access to this page.
      </p>
    );
  }

  async function changeRole(userId: string, role: AppRole) {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Role updated");
  }

  async function toggleActive(userId: string, isActive: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
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
                      disabled={!canManage}
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canManage}
                      onClick={() => toggleActive(p.id, p.is_active)}
                    >
                      {p.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canManage}
                      onClick={() => setPermissionUser(p)}
                    >
                      Permissions
                    </Button>
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
    </div>
  );
}
