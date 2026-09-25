import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFormFields } from "@/lib/data";
import { PageHeader } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/form-builder")({
  component: FormBuilder,
});

const TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "item_lookup", label: "Item lookup" },
  { value: "op_code_lookup", label: "Operation Code lookup" },
  { value: "op_desc_lookup", label: "Operation Description lookup" },
  { value: "dept_code_lookup", label: "Department Code lookup" },
  { value: "dept_desc_lookup", label: "Department Description lookup" },
];

function FormBuilder() {
  const { canView, can } = useAuth();
  const canEdit = can("formBuilder", "canEdit");
  const { data: fields = [], isLoading } = useFormFields();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["form-fields"] });

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("form_fields").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await refresh();
  }

  async function addField(e: React.FormEvent) {
    e.preventDefault();
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!key) return toast.error("Enter a field label");
    const { error } = await supabase.from("form_fields").insert({
      field_key: `custom_${key}`,
      label,
      field_type: type,
      options:
        type === "select"
          ? options
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
      required: false,
      visible: true,
      is_core: false,
      sort_order: 100 + fields.length,
    });
    if (error) return toast.error(error.message);
    setLabel("");
    setOptions("");
    await refresh();
    toast.success("Field added to the deviation form");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("form_fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refresh();
  }

  if (!canView("formBuilder")) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You do not have access to this page.
      </p>
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Form Builder"
        subtitle="Show, hide or require any field on the deviation form, and add your own fields."
      />

      <form
        onSubmit={addField}
        className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4"
      >
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase">New field label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Tooling reference"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={!canEdit}>
            <Plus className="mr-2 size-4" /> Add field
          </Button>
        </div>
        {type === "select" && (
          <div className="space-y-1.5 md:col-span-4">
            <Label className="text-xs uppercase">Choices (comma separated)</Label>
            <Input
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Option A, Option B"
            />
          </div>
        )}
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className="flex min-h-[84px] flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f.field_key} · {f.field_type}
                  {f.is_core ? " · core field" : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs uppercase">
                <Switch
                  disabled={!canEdit}
                  checked={f.visible}
                  onCheckedChange={(v) => update(f.id, { visible: v })}
                />{" "}
                Visible
              </label>
              <label className="flex items-center gap-2 text-xs uppercase">
                <Switch
                  disabled={!canEdit}
                  checked={f.required}
                  onCheckedChange={(v) => update(f.id, { required: v })}
                />{" "}
                Required
              </label>
              {!f.is_core && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => remove(f.id)}
                  title="Delete field"
                >
                  <Trash2 className="size-4 text-red-300" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
