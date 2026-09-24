import { useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMasterSuggestions, type LookupKind, type LookupMode } from "@/lib/master";
import type { MasterRow } from "@/lib/types";

interface Props {
  kind: LookupKind;
  value: string;
  onChange: (value: string) => void;
  onPick?: (value: string, pair: string | null) => void;
  onPickRow?: (row: Partial<MasterRow>) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  mode?: LookupMode;
  minChars?: number;
}

export function MasterCombobox({
  kind,
  value,
  onChange,
  onPick,
  onPickRow,
  placeholder,
  id,
  required,
  disabled,
  mode = "prefix",
  minChars = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = value.trim().length >= minChars;
  const { data, isFetching } = useMasterSuggestions(kind, value, open && ready, mode);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          required={required}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          className="pl-8"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
        />
        {isFetching && open && (
          <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && !ready && (
        <p className="mt-1 text-[11px] text-muted-foreground">Type at least {minChars} characters for suggestions</p>
      )}

      {open && ready && (data?.length ?? 0) > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {data!.map((s) => (
            <li key={s.value}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.value);
                  onPick?.(s.value, s.pair ?? null);
                  onPickRow?.(s.row);
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{s.value}</span>
                {s.pair && <span className="truncate text-xs text-muted-foreground">{s.pair}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
