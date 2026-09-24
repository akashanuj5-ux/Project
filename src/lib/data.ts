import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AuditEntry, Deviation, FormField, ProfileRow } from "./types";
import { formatAge } from "./types";

export function useDeviations() {
  return useQuery({
    queryKey: ["deviations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deviations")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Deviation[];
    },
  });
}

export function useFormFields() {
  return useQuery({
    queryKey: ["form-fields"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_fields").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as FormField[];
    },
  });
}

export function useAuditTrail(deviationId?: string) {
  return useQuery({
    queryKey: ["audit", deviationId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("audit_trail").select("*").order("created_at", { ascending: false }).limit(500);
      if (deviationId) q = q.eq("deviation_id", deviationId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AuditEntry[];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return {
        profiles: (profiles ?? []) as unknown as ProfileRow[],
        roles: (roles ?? []) as unknown as { user_id: string; role: string }[],
      };
    },
  });
}

export const EXPORT_COLUMNS = [
  "Ticket No",
  "Submitted At",
  "Waiting Time",
  "Requester",
  "Requester Email",
  "Supervisor Name",
  "Item Name",
  "Last Seq No",
  "Last Operation Name",
  "Next Dept Code",
  "Next Dept Description",
  "Next Seq No",
  "Next Operation Code",
  "Proposed Operation",
  "Movement Date",
  "Change Type",
  "Remarks",
  "Floor Status",
  "Floor Reviewed By",
  "Floor Reviewed At",
  "Floor Remarks",
  "PPC Status",
  "PPC Reviewed By",
  "PPC Reviewed At",
  "PPC Remarks",
  "ECO No",
  "Fusion Sync",
  "Fusion Synced At",
];

export function deviationToExportRow(d: Deviation): Record<string, string> {
  return {
    "Ticket No": d.ticket_no,
    "Submitted At": new Date(d.submitted_at).toLocaleString(),
    "Waiting Time": formatAge(d.submitted_at),
    Requester: d.requester_name,
    "Requester Email": d.requester_email,
    "Supervisor Name": d.supervisor_name,
    "Item Name": d.item_name,
    "Last Seq No": d.last_seq_no?.toString() ?? "",
    "Last Operation Name": d.last_operation_name ?? "",
    "Next Dept Code": d.next_dept_code ?? "",
    "Next Dept Description": d.next_dept_desc ?? "",
    "Next Seq No": d.next_seq_no?.toString() ?? "",
    "Next Operation Code": d.next_op_code ?? "",
    "Proposed Operation": d.proposed_operation,
    "Movement Date": d.movement_date ?? "",
    "Change Type": d.change_type,
    Remarks: d.remarks ?? "",
    "Floor Status": d.floor_status,
    "Floor Reviewed By": d.floor_reviewer_name ?? "",
    "Floor Reviewed At": d.floor_reviewed_at ? new Date(d.floor_reviewed_at).toLocaleString() : "",
    "Floor Remarks": d.floor_remarks ?? "",
    "PPC Status": d.ppc_status,
    "PPC Reviewed By": d.ppc_reviewer_name ?? "",
    "PPC Reviewed At": d.ppc_reviewed_at ? new Date(d.ppc_reviewed_at).toLocaleString() : "",
    "PPC Remarks": d.ppc_remarks ?? "",
    "ECO No": d.eco_no ?? "",
    "Fusion Sync": d.fusion_sync,
    "Fusion Synced At": d.fusion_synced_at ? new Date(d.fusion_synced_at).toLocaleString() : "",
  };
}

export function generateEcoNumber(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `ECO-${new Date().getFullYear()}-FUS-${n}`;
}

export async function logAudit(entry: {
  deviation_id: string;
  action: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  remarks?: string | null;
  changes?: { field: string; old: string; new: string }[];
}) {
  const { error } = await supabase.from("audit_trail").insert({
    deviation_id: entry.deviation_id,
    action: entry.action,
    actor_id: entry.actor_id,
    actor_name: entry.actor_name,
    actor_email: entry.actor_email,
    actor_role: entry.actor_role,
    remarks: entry.remarks ?? null,
    changes: entry.changes ?? [],
  });
  if (error) throw error;
}
