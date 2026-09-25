export type AppRole = "ADMIN" | "REQUESTER" | "FLOOR_MANAGER" | "PPC_REVIEWER" | "VIEWER";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "NA";
export type SyncStatus = "NOT_SYNCED" | "SYNCED" | "FAILED";

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrator",
  REQUESTER: "Requester",
  FLOOR_MANAGER: "Floor Manager (L1)",
  PPC_REVIEWER: "PPC Reviewer (L2)",
  VIEWER: "Viewer / Management",
};

export const ALL_ROLES: AppRole[] = [
  "ADMIN",
  "REQUESTER",
  "FLOOR_MANAGER",
  "PPC_REVIEWER",
  "VIEWER",
];

export const CHANGE_TYPES = [
  "Permanent",
  "Temporary",
  "Pilot / Trial",
  "Emergency Rework",
] as const;

export interface MasterRow {
  id: string;
  item: string | null;
  op_code: string | null;
  op_desc: string | null;
  dept_code: string | null;
  dept_desc: string | null;
}

export type MasterColumn = "all" | "item" | "op_code" | "op_desc" | "dept_code" | "dept_desc";

export const MASTER_COLUMNS: { value: MasterColumn; label: string }[] = [
  { value: "all", label: "All master fields" },
  { value: "item", label: "Item" },
  { value: "op_code", label: "Operation Code" },
  { value: "op_desc", label: "Operation Description" },
  { value: "dept_code", label: "Department Code" },
  { value: "dept_desc", label: "Department Description" },
];

export interface FormField {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[];
  required: boolean;
  visible: boolean;
  is_core: boolean;
  sort_order: number;
  lookup_enabled: boolean;
  lookup_column: MasterColumn | null;
  lookup_mode: string;
  lookup_min_chars: number;
  autofill_target: string | null;
  autofill_source: MasterColumn | null;
}

export interface Deviation {
  id: string;
  ticket_no: string;
  requester_id: string | null;
  requester_name: string;
  requester_email: string;
  supervisor_name: string;
  item_name: string;
  last_seq_no: number | null;
  last_operation_name: string | null;
  next_dept_code: string | null;
  next_dept_desc: string | null;
  next_seq_no: number | null;
  next_op_code: string | null;
  proposed_operation: string;
  movement_date: string | null;
  change_type: string;
  remarks: string | null;
  custom_fields: Record<string, unknown>;
  floor_status: ReviewStatus;
  floor_reviewer_name: string | null;
  floor_reviewed_at: string | null;
  floor_remarks: string | null;
  ppc_status: ReviewStatus;
  ppc_reviewer_name: string | null;
  ppc_reviewed_at: string | null;
  ppc_remarks: string | null;
  eco_no: string | null;
  fusion_sync: SyncStatus;
  fusion_synced_at: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  deviation_id: string | null;
  action: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  remarks: string | null;
  changes: { field: string; old: string; new: string }[];
  created_at: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  permissions: import("./permissions").UserPermissions | null;
  created_at: string;
}

export const EDITABLE_FIELDS: {
  key: keyof Deviation;
  label: string;
  type: "text" | "number" | "date" | "select";
}[] = [
  { key: "supervisor_name", label: "Supervisor Name", type: "text" },
  { key: "item_name", label: "Item Name", type: "text" },
  { key: "last_seq_no", label: "Last Seq No.", type: "number" },
  { key: "last_operation_name", label: "Last Operation Name", type: "text" },
  { key: "next_dept_code", label: "Next Department Code", type: "text" },
  { key: "next_dept_desc", label: "Next Department Description", type: "text" },
  { key: "next_seq_no", label: "Next Seq No", type: "number" },
  { key: "next_op_code", label: "Next Operation Code", type: "text" },
  { key: "proposed_operation", label: "Proposed Operation", type: "text" },
  { key: "movement_date", label: "Movement Date", type: "date" },
  { key: "change_type", label: "Change Type", type: "select" },
  { key: "remarks", label: "Remarks", type: "text" },
];

export function ageMinutes(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
}

export function formatAge(iso: string): string {
  const mins = ageMinutes(iso);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = Math.floor(mins % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export type Severity = "normal" | "warning" | "critical";

export function ageSeverity(iso: string): Severity {
  const hours = ageMinutes(iso) / 60;
  if (hours > 48) return "critical";
  if (hours >= 24) return "warning";
  return "normal";
}

export function isOpen(d: Deviation): boolean {
  if (d.floor_status === "PENDING") return true;
  return d.floor_status === "APPROVED" && d.ppc_status === "PENDING";
}
