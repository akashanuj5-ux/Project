import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ROLES, ROLE_LABELS, type AppRole, type ProfileRow } from "@/lib/types";
import {
  mergePermissions,
  ROLE_PERMISSION_PRESETS,
  type PermissionPage,
  type UserPermissions,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_LABELS: Record<PermissionPage, string> = {
  dashboard: "Dashboard",
  newDeviation: "New Deviation",
  myRequests: "My Requests",
  floorReview: "Floor Review",
  ppcReview: "PPC Review",
  oracleSync: "Oracle Sync",
  masterData: "Master Data",
  formBuilder: "Form Builder",
  userAccounts: "User Accounts",
  auditLog: "Audit Log",
  settings: "Settings",
};

const ACTION_LABELS: Partial<Record<PermissionPage, string>> = {
  newDeviation: "Can submit",
  floorReview: "Can approve/reject L1",
  ppcReview: "Can approve/reject L2",
  oracleSync: "Can sync",
  masterData: "Can edit",
  formBuilder: "Can edit",
  userAccounts: "Can manage",
};

interface ManagePermissionsDialogProps {
  profile: ProfileRow;
  role: AppRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePermissionsDialog({
  profile,
  role,
  open,
  onOpenChange,
}: ManagePermissionsDialogProps) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<UserPermissions>(() =>
    mergePermissions(role, profile.permissions),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPermissions(mergePermissions(role, profile.permissions));
  }, [open, profile.permissions, role]);

  function applyPreset(presetRole: AppRole) {
    setPermissions(ROLE_PERMISSION_PRESETS[presetRole]);
  }

  function setPermission(page: PermissionPage, key: string, value: boolean) {
    setPermissions((current) => ({
      ...current,
      [page]: { ...current[page], [key]: value },
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ permissions: permissions as unknown as Record<string, unknown> })
        .eq("id", profile.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["me", profile.id] });
      toast.success(`Permissions updated for ${profile.full_name || profile.email}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Permissions</DialogTitle>
          <DialogDescription>
            {profile.full_name || profile.email}: page visibility is separate from action authority.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          <span className="self-center text-xs text-muted-foreground">Apply preset:</span>
          {ALL_ROLES.map((presetRole) => (
            <Button
              key={presetRole}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyPreset(presetRole)}
            >
              {ROLE_LABELS[presetRole]}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          {(Object.keys(PAGE_LABELS) as PermissionPage[]).map((page) => {
            const actionKey =
              page === "newDeviation"
                ? "canSubmit"
                : page === "floorReview"
                  ? "canApproveL1"
                  : page === "ppcReview"
                    ? "canApproveL2"
                    : page === "oracleSync"
                      ? "canSync"
                      : page === "masterData" || page === "formBuilder"
                        ? "canEdit"
                        : page === "userAccounts"
                          ? "canManage"
                          : null;
            return (
              <div
                key={page}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-3"
              >
                <span className="min-w-40 flex-1 text-sm font-medium">{PAGE_LABELS[page]}</span>
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={permissions[page].canView}
                    onCheckedChange={(value) => setPermission(page, "canView", value)}
                  />
                  Page Access
                </label>
                {actionKey && ACTION_LABELS[page] && (
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={Boolean((permissions[page] as Record<string, boolean>)[actionKey])}
                      onCheckedChange={(value) => setPermission(page, actionKey, value)}
                    />
                    {ACTION_LABELS[page]}
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
