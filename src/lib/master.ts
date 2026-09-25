import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MasterRow } from "./types";

export type LookupKind = "all" | "item" | "op_code" | "op_desc" | "dept_code" | "dept_desc";
export type LookupMode = "prefix" | "contains";

export interface Suggestion {
  value: string;
  pair?: string | null;
  row: Partial<MasterRow>;
}

const MASTER_COLUMNS: (keyof MasterRow)[] = [
  "item",
  "op_code",
  "op_desc",
  "dept_code",
  "dept_desc",
];

async function fetchAllMasterRows(): Promise<MasterRow[]> {
  const rows: MasterRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("master_routing")
      .select("id,item,op_code,op_desc,dept_code,dept_desc")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as MasterRow[]));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const ALL_KINDS: Exclude<LookupKind, "all">[] = [
  "item",
  "op_code",
  "op_desc",
  "dept_code",
  "dept_desc",
] as const;

const PAIR: Record<Exclude<LookupKind, "all">, keyof MasterRow | null> = {
  item: null,
  op_code: "op_desc",
  op_desc: "op_code",
  dept_code: "dept_desc",
  dept_desc: "dept_code",
};

export async function searchMaster(
  kind: LookupKind,
  term: string,
  mode: LookupMode = "prefix",
): Promise<Suggestion[]> {
  const rows = await fetchAllMasterRows();
  return buildSuggestions(rows, kind, term, mode);
}

function buildSuggestions(
  items: MasterRow[],
  kind: LookupKind,
  term: string,
  _mode: LookupMode,
): Suggestion[] {
  const search = term.toLowerCase().trim();
  const candidates: Exclude<LookupKind, "all">[] = kind === "all" ? ALL_KINDS : [kind];
  const seen = new Set<string>();
  const results: Suggestion[] = [];
  const maxResults = search ? 50 : 30;

  for (const raw of items) {
    const matches =
      !search ||
      MASTER_COLUMNS.some((column) => {
        const value = String(raw[column] ?? "").toLowerCase();
        return value.includes(search);
      });
    if (!matches) continue;

    for (const candidate of candidates) {
      const value = String(raw[candidate] ?? "").trim();
      if (!value) continue;
      const key = `${candidate}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const pairKey = PAIR[candidate];
      const pairValue = pairKey ? ((raw[pairKey] as string | null) ?? null) : null;
      results.push({ value, pair: pairValue, row: raw });
      if (results.length >= maxResults) return results;
    }
  }

  return results.sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

export function useMasterSuggestions(
  kind: LookupKind,
  term: string,
  enabled = true,
  mode: LookupMode = "prefix",
) {
  const deferredTerm = useDeferredValue(term);
  const debounced = useDebounced(deferredTerm);
  const catalog = useQuery({
    queryKey: ["master-catalog"],
    queryFn: fetchAllMasterRows,
    staleTime: 60_000,
  });
  const data = useMemo(
    () => (enabled ? buildSuggestions(catalog.data ?? [], kind, debounced, mode) : []),
    [catalog.data, debounced, enabled, kind, mode],
  );

  return { ...catalog, data, isFetching: catalog.isFetching };
}
