import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Search, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { downloadCSV, toCSV } from "@/lib/csv";
import { useDebounced } from "@/lib/master";
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
      let query = supabase
        .from("master_routing")
        .select("id,item,op_code,op_desc,dept_code,dept_desc", { count: "exact" })
        .order("item")
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (term.trim()) {
        const t = term.trim();
        query = query.or(
          `item.ilike.%${t}%,op_code.ilike.%${t}%,op_desc.ilike.%${t}%,dept_code.ilike.%${t}%,dept_desc.ilike.%${t}%`,
        );
      }
      const { data: rows, count, error } = await query;
      if (error) throw error;
      return { rows: (rows ?? []) as unknown as MasterRow[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const count = data?.count ?? 0;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["master-page"] });
    await queryClient.invalidateQueries({ queryKey: ["master-search"] });
    await queryClient.invalidateQueries({ queryKey: ["master-catalog"] });
  };

  const addRows = useMutation({
    mutationFn: async (newRows: Array<Omit<MasterRow, "id">>) => {
      const { error } = await supabase.from("master_routing").insert(newRows);
      if (error) throw error;
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
      const { error } = await supabase.from("master_routing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Master data deleted");
    },
    onError: (error) => toast.error(`Could not delete master data: ${error.message}`),
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
        const { error: deleteError } = await supabase
          .from("master_routing")
          .delete()
          .not("id", "is", null);
        if (deleteError) throw deleteError;
      }
      const { error } = await supabase.from("master_routing").insert(parsed);
      if (error) throw error;
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
              downloadCSV(
                "master-routing-page.csv",
                toCSV(
                  rows.map((r) => ({
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
              )
            }
          >
            <Download className="mr-2 size-4" /> Export page
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
                addRows.mutate({
                  item: manualRow.item.trim() || null,
                  op_code: manualRow.op_code.trim() || null,
                  op_desc: manualRow.op_desc.trim() || null,
                  dept_code: manualRow.dept_code.trim() || null,
                  dept_desc: manualRow.dept_desc.trim() || null,
                })
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
                  <td className="px-3 py-2 font-medium">{r.item}</td>
                  <td className="px-3 py-2">{r.op_code ?? "—"}</td>
                  <td className="px-3 py-2">{r.op_desc ?? "—"}</td>
                  <td className="px-3 py-2">{r.dept_code ?? "—"}</td>
                  <td className="px-3 py-2">{r.dept_desc ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete row"
                      disabled={!canEdit || deleteRow.isPending}
                      onClick={() => deleteRow.mutate(r.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
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
