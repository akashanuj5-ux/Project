import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, Plus, Pencil, Search, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { downloadCSV, toCSV } from "@/lib/csv";
import { apiFetch, apiFetchWithHeaders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchAllMasterRows, useDebounced } from "@/lib/master";
import type { MasterRow } from "@/lib/types";
import { PageHeader } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/master-data")({
  component: MasterData,
});

const PAGE = 50;

function MasterData() {
  const { canView, can } = useAuth();
  const canEdit = can("masterData", "canEdit");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<Record<"item" | "op_code" | "op_desc" | "dept_code" | "dept_desc", string>>>({});
  const [manualRow, setManualRow] = useState({
    item: "",
    op_code: "",
    op_desc: "",
    dept_code: "",
    dept_desc: "",
  });
  const term = useDebounced(q);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["master-page", term, page],
    queryFn: async () => {
      const path =
        `/api/master-routing?offset=${page * PAGE}&limit=${PAGE}` +
        (term.trim() ? `&q=${encodeURIComponent(term.trim())}` : "");
      const { data: rows, headers } = await apiFetchWithHeaders<MasterRow[]>(path);
      return { rows, count: Number(headers.get("X-Total-Count") ?? rows.length) };
    },
  });

  const rows = data?.rows ?? [];
  const count = data?.count ?? 0;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["master-page"] });
    await queryClient.invalidateQueries({ queryKey: ["master-search"] });
    await queryClient.invalidateQueries({ queryKey: ["master-catalog"] });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRow({});
  };

  const addRows = useMutation({
    mutationFn: async (newRows: Array<Omit<MasterRow, "id">>) => {
      await apiFetch("/api/master-routing", {
        method: "POST",
        body: JSON.stringify(newRows.map(({ item, op_code, op_desc, dept_code, dept_desc }) => ({ item, op_code, op_desc, dept_code, dept_desc }))),
      });
    },
    onSuccess: async () => {
      setManualRow({ item: "", op_code: "", op_desc: "", dept_code: "", dept_desc: "" });
      await refresh();
      toast.success("Master data added");
    },
    onError: (error) => toast.error(`Could not add master data: ${error.message}`),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/master-routing/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Master data deleted");
    },
    onError: (error) => toast.error(`Could not delete master data: ${error.message}`),
  });

  const updateRow = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Record<string, string | null> }) => {
      await apiFetch(`/api/master-routing/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Master data updated");
    },
    onError: (error) => toast.error(`Could not update master data: ${error.message}`),
  });

  const importRows = useMutation({
    mutationFn: async ({ file, replace }: { file: File; replace: boolean }) => {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!];
      if (!sheet) throw new Error("The selected file has no worksheet");
      const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const headers = (values[0] ?? []).map((value) => normalizeHeader(String(value)));
      const indexOf = (names: string[]) =>
        names
          .map(normalizeHeader)
          .map((name) => headers.indexOf(name))
          .find((index) => index >= 0) ?? -1;
      const indexes = {
        item: indexOf(["item"]),
        op_code: indexOf(["operation code", "op code", "op_code"]),
        op_desc: indexOf(["operation description", "op desc", "op_desc"]),
        dept_code: indexOf(["department code", "dept code", "dept_code"]),
        dept_desc: indexOf(["department description", "dept desc", "dept_desc"]),
      };
      const parsed = values
        .slice(1)
        .map((row) => ({
          item: cell(row, indexes.item),
          op_code: cell(row, indexes.op_code),
          op_desc: cell(row, indexes.op_desc),
          dept_code: cell(row, indexes.dept_code),
          dept_desc: cell(row, indexes.dept_desc),
        }))
        .filter((row) => Object.values(row).some((value) => value !== null));
      if (parsed.length === 0) throw new Error("The file contains no populated master-data rows");
      if (replace) {
        await apiFetch("/api/master-routing", { method: "DELETE" });
      }
      await apiFetch("/api/master-routing", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      return parsed.length;
    },
    onSuccess: async (numberOfRows, variables) => {
      await refresh();
      toast.success(
        `${numberOfRows.toLocaleString()} rows ${variables.replace ? "replaced" : "added"}`,
      );
    },
    onError: (error) => toast.error(`Could not import master data: ${error.message}`),
  });

  const chooseFile = (replace: boolean) => {
    if (replace && !window.confirm("Replace all existing master data with this file?")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) importRows.mutate({ file, replace });
    };
    input.click();
  };

  if (!canView("masterData")) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You do not have access to this page.
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title="Master Routing Data"
        subtitle={`${count.toLocaleString()} matching records from MASTER ROUTING.xlsx`}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              void (async () => {
                if (exporting) return;
                setExporting(true);
                const toastId = toast.loading(
                  term.trim() ? "Exporting filtered master data…" : "Exporting complete master data…",
                );
                try {
                  const all = term.trim()
                    ? await (async () => {
                        const out = [];
                        const pageSize = 1000;
                        for (let offset = 0; ; offset += pageSize) {
                          const page = await apiFetch(
                            `/api/master-routing?offset=${offset}&limit=${pageSize}&q=${encodeURIComponent(term.trim())}`,
                          );
                          out.push(...page);
                          if (page.length < pageSize) break;
                        }
                        return out;
                      })()
                    : await fetchAllMasterRows();
                  downloadCSV(
                    term.trim() ? "master-routing-filtered.csv" : "master-routing-complete.csv",
                    toCSV(
                      all.map((r) => ({
                        Item: r.item,
                        "Operation Code": r.op_code ?? "",
                        "Operation Description": r.op_desc ?? "",
                        "Department Code": r.dept_code ?? "",
                        "Department Description": r.dept_desc ?? "",
                      })),
                      [
                    "Item",
                    "Operation Code",
                    "Operation Description",
                    "Department Code",
                    "Department Description",
                  ],
                    ),
                  );
                  toast.success(`Exported ${all.length.toLocaleString("en-IN")} rows`, { id: toastId });
                } catch (e) {
                  toast.error(`Export failed: ${e.message}`, { id: toastId });
                } finally {
                  setExporting(false);
                }
              })()
            }
          >
            <Download className="mr-2 size-4" /> {exporting ? "Exporting…" : term.trim() ? "Export Filtered" : `Export Complete (${count.toLocaleString("en-IN")})`} page
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold tracking-wide uppercase">Add row manually</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["item", "Item"],
                ["op_code", "Operation Code"],
                ["op_desc", "Operation Description"],
                ["dept_code", "Department Code"],
                ["dept_desc", "Department Description"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                placeholder={label}
                value={manualRow[key]}
                onChange={(event) => setManualRow((row) => ({ ...row, [key]: event.target.value }))}
              />
            ))}
            <Button
              className="sm:col-span-2"
              disabled={
                !canEdit ||
                !Object.values(manualRow).some((value) => value.trim()) ||
                addRows.isPending
              }
              onClick={() =>
                addRows.mutate([
                  {
                    item: manualRow.item.trim() || null,
                    op_code: manualRow.op_code.trim() || null,
                    op_desc: manualRow.op_desc.trim() || null,
                    dept_code: manualRow.dept_code.trim() || null,
                    dept_desc: manualRow.dept_desc.trim() || null,
                  },
                ])
              }
            >
              <Plus className="mr-2 size-4" /> Add
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase">
            Upload Excel / CSV file
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Columns: Item, Operation Code, Operation Description, Department Code, Department
            Description.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canEdit || importRows.isPending} onClick={() => chooseFile(false)}>
              <Upload className="mr-2 size-4" /> Add to existing
            </Button>
            <Button
              variant="outline"
              disabled={!canEdit || importRows.isPending}
              onClick={() => chooseFile(true)}
            >
              <Upload className="mr-2 size-4" /> Replace all
            </Button>
          </div>
        </section>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search item, operation or department"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-secondary/60 text-[10px] tracking-widest uppercase">
            <tr>
              {[
                "Item",
                "Op code",
                "Operation description",
                "Dept code",
                "Department description",
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
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {editingId === r.id ? (
                      <Input
                        className="bg-background border-input text-sm h-7"
                        value={editRow.item ?? ""}
                        onChange={(e) => setEditRow((o) => ({ ...o, item: e.target.value }))}
                        autoFocus
                      />
                    ) : (
                      r.item
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === r.id ? (
                      <Input
                        className="bg-background border-input text-sm h-7"
                        value={editRow.op_code ?? ""}
                        onChange={(e) => setEditRow((o) => ({ ...o, op_code: e.target.value }))}
                      />
                    ) : (
                      r.op_code ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === r.id ? (
                      <Input
                        className="bg-background border-input text-sm h-7"
                        value={editRow.op_desc ?? ""}
                        onChange={(e) => setEditRow((o) => ({ ...o, op_desc: e.target.value }))}
                      />
                    ) : (
                      r.op_desc ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === r.id ? (
                      <Input
                        className="bg-background border-input text-sm h-7"
                        value={editRow.dept_code ?? ""}
                        onChange={(e) => setEditRow((o) => ({ ...o, dept_code: e.target.value }))}
                      />
                    ) : (
                      r.dept_code ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === r.id ? (
                      <Input
                        className="bg-background border-input text-sm h-7"
                        value={editRow.dept_desc ?? ""}
                        onChange={(e) => setEditRow((o) => ({ ...o, dept_desc: e.target.value }))}
                      />
                    ) : (
                      r.dept_desc ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editingId === r.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            const changes: Record<string, string | null> = {};
                            const rd = r as Record<string, string>;
                            for (const key of ["item", "op_code", "op_desc", "dept_code", "dept_desc"] as const) {
                              const v = (editRow[key] ?? "").trim();
                              if (v !== "" && v !== rd[key]) changes[key] = v;
                            }
                            if (Object.keys(changes).length > 0) updateRow.mutate({ id: r.id, changes });
                            cancelEdit();
                          }}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit row"
                          disabled={!canEdit || updateRow.isPending}
                          onClick={() => {
                            setEditingId(r.id);
                            setEditRow({
                              item: r.item,
                              op_code: r.op_code ?? "",
                              op_desc: r.op_desc ?? "",
                              dept_code: r.dept_code ?? "",
                              dept_desc: r.dept_desc ?? "",
                            });
                          }}
                        >
                          <Pencil className="size-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete row"
                          disabled={!canEdit || deleteRow.isPending}
                          onClick={() => deleteRow.mutate(r.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-muted-foreground">
          Page {page + 1} of {Math.max(1, Math.ceil(count / PAGE))}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={(page + 1) * PAGE >= count}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function cell(row: unknown[], index: number): string | null {
  if (index < 0) return null;
  const value = row[index];
  return value === undefined || value === null || String(value).trim() === ""
    ? null
    : String(value).trim();
}
