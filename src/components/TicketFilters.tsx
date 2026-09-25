import { Download, Search, X } from "lucide-react";
import type { Deviation } from "@/lib/types";
import { ageMinutes, isOpen } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TicketStage =
  "all" | "pending_l1" | "pending_l2" | "eco_issued" | "rejected" | "closed";
export type TicketAgeing = "all" | "lt24" | "24to48" | "gt48";

export interface TicketFilterState {
  search: string;
  stage: TicketStage;
  ageing: TicketAgeing;
  fromDate: string;
  toDate: string;
}

export interface FilterTab {
  value: string;
  label: string;
  count?: number;
}

interface TicketFiltersProps {
  filters: TicketFilterState;
  onChange: (patch: Partial<TicketFilterState>) => void;
  onExport?: () => void;
  showStages?: boolean;
  showAgeing?: boolean;
  statusValue?: string;
  statusOptions?: { value: string; label: string }[];
  onStatusChange?: (value: string) => void;
  tabs?: FilterTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  exportLabel?: string;
}

const STAGES: { value: TicketStage; label: string }[] = [
  { value: "all", label: "All Stages" },
  { value: "pending_l1", label: "Pending L1" },
  { value: "pending_l2", label: "Pending L2" },
  { value: "eco_issued", label: "ECO Issued" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

const AGEING: { value: TicketAgeing; label: string }[] = [
  { value: "all", label: "Any Age" },
  { value: "lt24", label: "< 24 Hours" },
  { value: "24to48", label: "24h - 48h" },
  { value: "gt48", label: "> 48 Hours" },
];

const controlClass =
  "h-9 rounded-md border border-slate-700 bg-slate-900/60 px-2.5 text-xs text-slate-200 outline-none focus:border-cyan-500";

export const emptyTicketFilters = (): TicketFilterState => ({
  search: "",
  stage: "all",
  ageing: "all",
  fromDate: "",
  toDate: "",
});

export function TicketFilters({
  filters,
  onChange,
  onExport,
  showStages = false,
  showAgeing = true,
  statusValue,
  statusOptions,
  onStatusChange,
  tabs,
  activeTab,
  onTabChange,
  exportLabel = "Export CSV",
}: TicketFiltersProps) {
  const hasDates = Boolean(filters.fromDate || filters.toDate);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-xs">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search ticket, item, ECO, requester, operation"
          className={`${controlClass} w-full pl-8`}
        />
      </div>

      {tabs?.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onTabChange?.(tab.value)}
          className={`h-9 rounded-md border px-3 text-xs font-semibold transition-colors ${
            activeTab === tab.value
              ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
              : "border-slate-700 text-slate-300 hover:border-slate-500"
          }`}
        >
          {tab.label}
          {tab.count === undefined ? "" : ` (${tab.count})`}
        </button>
      ))}

      {showStages && (
        <select
          value={filters.stage}
          onChange={(event) => onChange({ stage: event.target.value as TicketStage })}
          className={controlClass}
          aria-label="Stages"
        >
          {STAGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {statusOptions && onStatusChange && (
        <select
          value={statusValue ?? "all"}
          onChange={(event) => onStatusChange(event.target.value)}
          className={controlClass}
          aria-label="Fusion status"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {showAgeing && (
        <select
          value={filters.ageing}
          onChange={(event) => onChange({ ageing: event.target.value as TicketAgeing })}
          className={controlClass}
          aria-label="Ageing"
        >
          {AGEING.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      <label className="flex h-9 items-center gap-1.5 text-slate-400">
        <span>From</span>
        <input
          type="date"
          value={filters.fromDate}
          onChange={(event) => onChange({ fromDate: event.target.value })}
          className={controlClass}
          aria-label="From date"
        />
      </label>
      <span className="text-slate-500">to</span>
      <label className="flex h-9 items-center gap-1.5 text-slate-400">
        <span>To</span>
        <input
          type="date"
          value={filters.toDate}
          onChange={(event) => onChange({ toDate: event.target.value })}
          className={controlClass}
          aria-label="To date"
        />
      </label>

      {hasDates && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-xs text-slate-300 hover:text-white"
          onClick={() => onChange({ fromDate: "", toDate: "" })}
        >
          <X className="mr-1 size-3.5" /> Clear
        </Button>
      )}

      {onExport && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-9"
          onClick={onExport}
        >
          <Download className="mr-2 size-3.5" /> {exportLabel}
        </Button>
      )}
    </div>
  );
}

export function filterDeviationRows(
  rows: Deviation[],
  filters: TicketFilterState,
  dateField: keyof Deviation = "submitted_at",
): Deviation[] {
  const search = filters.search.toLowerCase().trim();
  const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : null;
  const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`).getTime() : null;

  return rows.filter((row) => {
    const haystack = [
      row.ticket_no,
      row.item_name,
      row.eco_no,
      row.requester_name,
      row.proposed_operation,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (search && !haystack.includes(search)) return false;

    if (filters.stage === "pending_l1" && row.floor_status !== "PENDING") return false;
    if (
      filters.stage === "pending_l2" &&
      !(row.floor_status === "APPROVED" && row.ppc_status === "PENDING")
    )
      return false;
    if (filters.stage === "eco_issued" && !row.eco_no) return false;
    if (
      filters.stage === "rejected" &&
      row.floor_status !== "REJECTED" &&
      row.ppc_status !== "REJECTED"
    )
      return false;
    if (filters.stage === "closed" && !(row.ppc_status === "APPROVED" && !isOpen(row)))
      return false;

    const hours = ageMinutes(row.submitted_at) / 60;
    if (filters.ageing === "lt24" && hours >= 24) return false;
    if (filters.ageing === "24to48" && (hours < 24 || hours > 48)) return false;
    if (filters.ageing === "gt48" && hours <= 48) return false;

    const rawDate = row[dateField];
    const timestamp = rawDate ? new Date(String(rawDate)).getTime() : NaN;
    if (from !== null && (Number.isNaN(timestamp) || timestamp < from)) return false;
    if (to !== null && (Number.isNaN(timestamp) || timestamp > to)) return false;
    return true;
  });
}
