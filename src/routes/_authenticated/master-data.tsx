import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const term = useDebounced(q);

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
                  ["Item", "Operation Code", "Operation Description", "Department Code", "Department Description"],
                ),
              )
            }
          >
            <Download className="mr-2 size-4" /> Export page
          </Button>
        }
      />

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
              {["Item", "Op code", "Operation description", "Dept code", "Department description"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 text-sm">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
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
