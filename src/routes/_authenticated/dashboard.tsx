import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, Download, FileClock, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDeviations, deviationToExportRow, EXPORT_COLUMNS } from "@/lib/data";
import { downloadCSV, toCSV } from "@/lib/csv";
import { ageMinutes, isOpen } from "@/lib/types";
import { AgeBadge, FusionBadge, PageHeader, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type ChartTooltipEntry = {
  color?: string;
  dataKey?: string;
  name?: string;
  payload?: { color?: string };
  value?: ReactNode;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: ReactNode;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs font-medium text-slate-100 shadow-xl">
      <div className="mb-1 text-slate-300">{label}</div>
      {payload.map((entry, index) => {
        const color = entry.color ?? entry.payload?.color ?? "#94a3b8";
        const name = entry.name ?? entry.dataKey ?? `Item ${index + 1}`;
        return (
          <div key={`${name}-${index}`} className="mt-1 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-200">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {name}
            </span>
            <span className="font-semibold text-white">{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function isWithinDateRange(iso: string, startDate: string, endDate: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return true;
  if (startDate && value < new Date(`${startDate}T00:00:00`)) return false;
  if (endDate && value > new Date(`${endDate}T23:59:59.999`)) return false;
  return true;
}

function Dashboard() {
  const { data: all = [], isLoading } = useDeviations();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [aging, setAging] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredByTime = useMemo(
    () => all.filter((d) => isWithinDateRange(d.submitted_at, startDate, endDate)),
    [all, startDate, endDate],
  );

  const rows = useMemo(() => {
    return filteredByTime.filter((d) => {
      const hay =
        `${d.ticket_no} ${d.item_name} ${d.requester_name} ${d.supervisor_name} ${d.proposed_operation} ${d.next_dept_desc ?? ""} ${d.eco_no ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (stage === "floor_pending" && d.floor_status !== "PENDING") return false;
      if (stage === "ppc_pending" && !(d.floor_status === "APPROVED" && d.ppc_status === "PENDING"))
        return false;
      if (stage === "approved" && d.ppc_status !== "APPROVED") return false;
      if (stage === "rejected" && d.floor_status !== "REJECTED" && d.ppc_status !== "REJECTED")
        return false;
      if (stage === "synced" && d.fusion_sync !== "SYNCED") return false;
      const hrs = ageMinutes(d.submitted_at) / 60;
      if (aging === "lt24" && hrs >= 24) return false;
      if (aging === "24to48" && (hrs < 24 || hrs > 48)) return false;
      if (aging === "gt48" && hrs <= 48) return false;
      return true;
    });
  }, [filteredByTime, q, stage, aging]);

  const open = filteredByTime.filter(isOpen);
  const kpis = [
    { label: "Open tickets", value: open.length, icon: FileClock, tone: "text-amber-300" },
    {
      label: "Awaiting floor (L1)",
      value: filteredByTime.filter((d) => d.floor_status === "PENDING").length,
      icon: AlarmClock,
      tone: "text-amber-300",
    },
    {
      label: "Awaiting PPC (L2)",
      value: filteredByTime.filter(
        (d) => d.floor_status === "APPROVED" && d.ppc_status === "PENDING",
      ).length,
      icon: AlarmClock,
      tone: "text-primary",
    },
    {
      label: "ECO issued",
      value: filteredByTime.filter((d) => !!d.eco_no).length,
      icon: CheckCircle2,
      tone: "text-emerald-300",
    },
    {
      label: "Rejected",
      value: filteredByTime.filter(
        (d) => d.floor_status === "REJECTED" || d.ppc_status === "REJECTED",
      ).length,
      icon: XCircle,
      tone: "text-red-300",
    },
    {
      label: "Ageing > 48h",
      value: open.filter((d) => ageMinutes(d.submitted_at) / 60 > 48).length,
      icon: AlarmClock,
      tone: "text-red-300",
    },
  ];

  const monthlyApprovalData = useMemo(() => {
    const monthMap = new Map<
      string,
      { month: string; monthKey: number; raised: number; ecoApproved: number; rejected: number }
    >();

    for (const d of filteredByTime) {
      const date = new Date(d.submitted_at);
      const monthKey = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
      const entry = monthMap.get(String(monthKey)) ?? {
        month: monthLabel,
        monthKey,
        raised: 0,
        ecoApproved: 0,
        rejected: 0,
      };

      entry.raised += 1;
      if (d.eco_no) entry.ecoApproved += 1;
      if (d.floor_status === "REJECTED" || d.ppc_status === "REJECTED") entry.rejected += 1;
      monthMap.set(String(monthKey), entry);
    }

    return [...monthMap.values()]
      .sort((a, b) => a.monthKey - b.monthKey)
      .slice(-6)
      .map(({ month, raised, ecoApproved, rejected }) => ({
        month,
        raised,
        ecoApproved,
        rejected,
      }));
  }, [filteredByTime]);

  const approvalRate = useMemo(() => {
    if (!filteredByTime.length) return 0;
    const approved = filteredByTime.filter((d) => d.ppc_status === "APPROVED").length;
    return Math.round((approved / filteredByTime.length) * 100);
  }, [filteredByTime]);

  const stageSplitData = useMemo(() => {
    const pendingL1 = filteredByTime.filter((d) => d.floor_status === "PENDING").length;
    const pendingL2 = filteredByTime.filter(
      (d) => d.floor_status === "APPROVED" && d.ppc_status === "PENDING",
    ).length;
    const rejected = filteredByTime.filter(
      (d) => d.floor_status === "REJECTED" || d.ppc_status === "REJECTED",
    ).length;
    const closed = filteredByTime.filter(
      (d) => d.floor_status === "APPROVED" && d.ppc_status === "APPROVED",
    ).length;

    return [
      { name: "Pending L1", value: pendingL1, color: "#f59e0b" },
      { name: "Pending L2", value: pendingL2, color: "#14b8a6" },
      { name: "Rejected", value: rejected, color: "#f87171" },
      { name: "Closed", value: closed, color: "#10b981" },
    ].filter((item) => item.value > 0);
  }, [filteredByTime]);

  const departmentData = useMemo(() => {
    const deptMap = new Map<string, number>();

    for (const d of filteredByTime) {
      const department = (d.next_dept_desc || d.next_dept_code || "Unspecified").trim();
      if (!department) continue;
      deptMap.set(department, (deptMap.get(department) ?? 0) + 1);
    }

    return [...deptMap.entries()]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredByTime]);

  const departmentChartHeight = Math.max(350, departmentData.length * 36);

  return (
    <div>
      <PageHeader
        title="Control Dashboard"
        subtitle="Live status of every routing deviation across both approval levels."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 shadow-sm">
              <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                <span>From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </label>
              <span className="text-[11px] text-slate-500">to</span>
              <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                <span>To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </label>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-[10px] font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-50"
                >
                  Reset
                </button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() =>
                downloadCSV("deviations.csv", toCSV(rows.map(deviationToExportRow), EXPORT_COLUMNS))
              }
            >
              <Download className="mr-2 size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-4">
            <k.icon className={`size-4 ${k.tone}`} />
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">{k.value}</p>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-black uppercase tracking-wide text-foreground">
              MONTHLY APPROVALS VS REJECTIONS
            </h3>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Approval Rate {approvalRate}%
            </span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyApprovalData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
                <Bar dataKey="raised" name="Raised" fill="#2f4155" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="ecoApproved"
                  name="ECO approved"
                  fill="#1a9c9d"
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="rejected" name="Rejected" fill="#d04848" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-[13px] font-black uppercase tracking-wide text-foreground">
            CURRENT STAGE SPLIT
          </h3>
          <div className="relative h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stageSplitData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="rgba(15,23,42,0.7)"
                  strokeWidth={2}
                >
                  {stageSplitData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-black text-slate-50 tabular-nums">
                {stageSplitData.reduce((sum, item) => sum + item.value, 0)}
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Tickets</div>
            </div>
          </div>
        </div>

        <div className="col-span-full rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-[13px] font-black uppercase tracking-wide text-foreground">
            DEVIATIONS BY NEXT DEPARTMENT
          </h3>
          <div className="max-h-[280px] overflow-y-auto rounded-md border border-border/60 bg-background/30 p-2">
            <div style={{ height: `${departmentChartHeight}px` }} className="min-w-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentData}
                  layout="vertical"
                  margin={{ top: 10, right: 18, left: 12, bottom: 10 }}
                  barGap={8}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.18)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="department"
                    width={110}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="#c66a2f" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="count"
                      position="right"
                      fill="#e2e8f0"
                      fontSize={11}
                      formatter={(value: number) => value}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search ticket, item, ECO, requester…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="floor_pending">Awaiting floor (L1)</SelectItem>
            <SelectItem value="ppc_pending">Awaiting PPC (L2)</SelectItem>
            <SelectItem value="approved">Fully approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="synced">Fusion synced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={aging} onValueChange={setAging}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any age</SelectItem>
            <SelectItem value="lt24">Under 24h</SelectItem>
            <SelectItem value="24to48">24–48h</SelectItem>
            <SelectItem value="gt48">Over 48h</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-secondary/60 text-[10px] tracking-widest uppercase">
            <tr>
              {[
                "Ticket",
                "Item",
                "Requester",
                "Proposed operation",
                "Age",
                "L1",
                "L2",
                "ECO",
                "Fusion",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No tickets match these filters.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{d.ticket_no}</td>
                  <td className="px-3 py-2">{d.item_name}</td>
                  <td className="px-3 py-2">{d.requester_name}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">{d.proposed_operation}</td>
                  <td className="px-3 py-2">
                    <AgeBadge since={d.submitted_at} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.floor_status} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.ppc_status} />
                  </td>
                  <td className="px-3 py-2 text-xs">{d.eco_no ?? "—"}</td>
                  <td className="px-3 py-2">
                    <FusionBadge status={d.fusion_sync} hasEco={Boolean(d.eco_no)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
