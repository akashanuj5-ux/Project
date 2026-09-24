import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MasterRow } from "./types";

export type LookupKind = "item" | "op_code" | "op_desc" | "dept_code" | "dept_desc";
export type LookupMode = "prefix" | "contains";

export interface Suggestion {
  value: string;
  pair?: string | null;
  row: Partial<MasterRow>;
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const PAIR: Record<LookupKind, keyof MasterRow | null> = {
  item: null,
  op_code: "op_desc",
  op_desc: "op_code",
  dept_code: "dept_desc",
  dept_desc: "dept_code",
};

export async function searchMaster(kind: LookupKind, term: string, mode: LookupMode = "prefix"): Promise<Suggestion[]> {
  const pair = PAIR[kind];
  const cols = ["item", "op_code", "op_desc", "dept_code", "dept_desc"].join(",");
  let query = supabase.from("master_routing").select(cols).not(kind, "is", null).limit(200);
  const t = term.trim();
  if (t) query = query.ilike(kind, mode === "contains" ? `%${t}%` : `${t}%`);
  const { data, error } = await query;
  if (error) throw error;
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const raw of (data ?? []) as unknown as MasterRow[]) {
    const value = (raw[kind] as string | null) ?? "";
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, pair: pair ? ((raw[pair] as string | null) ?? null) : null, row: raw });
    if (out.length >= 25) break;
  }
  return out.sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

export function useMasterSuggestions(kind: LookupKind, term: string, enabled = true, mode: LookupMode = "prefix") {
  const debounced = useDebounced(term);
  return useQuery({
    queryKey: ["master-search", kind, debounced, mode],
    enabled,
    staleTime: 60_000,
    queryFn: () => searchMaster(kind, debounced, mode),
  });
}
