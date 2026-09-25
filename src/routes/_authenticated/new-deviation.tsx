import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFormFields, logAudit } from "@/lib/data";
import { CHANGE_TYPES, type FormField, type MasterRow } from "@/lib/types";
import type { LookupKind, LookupMode } from "@/lib/master";
import { MasterCombobox } from "@/components/master-combobox";
import { PageHeader } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/new-deviation")({
  component: NewDeviation,
});

const empty: Record<string, string> = {
  supervisor_name: "",
  item_name: "",
  last_seq_no: "",
  last_operation_name: "",
  next_dept_code: "",
  next_dept_desc: "",
  next_seq_no: "",
  next_op_code: "",
  proposed_operation: "",
  movement_date: "",
  change_type: "Permanent",
  remarks: "",
};

const lookupColumnForKey = (fieldKey: string): LookupKind | null => {
  switch (fieldKey) {
    case "item_name":
      return "item";
    case "last_operation_name":
      return "op_desc";
    case "next_dept_code":
      return "dept_code";
    case "next_dept_desc":
      return "dept_desc";
    case "next_op_code":
      return "op_code";
    case "proposed_operation":
      return "op_desc";
    default:
      return null;
  }
};

function NewDeviation() {
  const { data: fields = [] } = useFormFields();
  const { session, userName, userEmail, activeRole, canView, can } = useAuth();
  const canSubmit = can("newDeviation", "canSubmit");
  const [form, setForm] = useState<Record<string, string>>({ ...empty });
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cfg = (key: string) => fields.find((f) => f.field_key === key);
  const visible = (key: string) => cfg(key)?.visible !== false;
  const req = (key: string) => cfg(key)?.required ?? false;
  const labelFor = (key: string, fallback: string) => cfg(key)?.label ?? fallback;
  const customFields = fields.filter((f) => !f.is_core && f.visible);
  const changeOptions = cfg("change_type")?.options?.length
    ? cfg("change_type")!.options
    : [...CHANGE_TYPES];

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const applyValue = (key: string, value: string) => {
    if (key in empty) set(key, value);
    else setCustom((p) => ({ ...p, [key]: value }));
  };

  const autofill = (field: FormField | undefined, row: Partial<MasterRow>) => {
    if (!field?.autofill_target || !field.autofill_source) return;
    const value = row[field.autofill_source];
    if (value) applyValue(field.autofill_target, String(value));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    try {
      const payload = {
        requester_id: session.user.id,
        requester_name: userName,
        requester_email: userEmail,
        supervisor_name: form.supervisor_name,
        item_name: form.item_name,
        last_seq_no: form.last_seq_no ? Number(form.last_seq_no) : null,
        last_operation_name: form.last_operation_name || null,
        next_dept_code: form.next_dept_code || null,
        next_dept_desc: form.next_dept_desc || null,
        next_seq_no: form.next_seq_no ? Number(form.next_seq_no) : null,
        next_op_code: form.next_op_code || null,
        proposed_operation: form.proposed_operation,
        movement_date: form.movement_date || null,
        change_type: form.change_type,
        remarks: form.remarks || null,
        custom_fields: custom,
      };
      const { data, error } = await supabase
        .from("deviations")
        .insert(payload)
        .select("id, ticket_no")
        .single();
      if (error) throw error;
      await logAudit({
        deviation_id: (data as { id: string }).id,
        action: "SUBMITTED",
        actor_id: session.user.id,
        actor_name: userName,
        actor_email: userEmail,
        actor_role: activeRole ?? "REQUESTER",
        remarks: "Deviation logged",
      });
      await queryClient.invalidateQueries({ queryKey: ["deviations"] });
      toast.success(`Deviation ${(data as { ticket_no: string }).ticket_no} submitted`);
      navigate({ to: "/my-requests" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit deviation");
    } finally {
      setBusy(false);
    }
  }

  if (!canView("newDeviation")) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You do not have access to this page.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Deviation Form"
        subtitle="Once submitted you can track progress, but the form becomes read-only for you."
      />

      <form onSubmit={submit} className="space-y-6 rounded-lg border border-border bg-card p-6">
        {visible("supervisor_name") && (
          <Field
            label={labelFor("supervisor_name", "Supervisor Name (Prod. Transit Control)")}
            required={req("supervisor_name")}
          >
            <TextControl
              fieldKey="supervisor_name"
              placeholder="e.g. S. Kulkarni"
              form={form}
              setValue={set}
              cfg={cfg}
              req={req}
              autofill={autofill}
            />
          </Field>
        )}

        {visible("item_name") && (
          <Field label={labelFor("item_name", "Item Name")} required={req("item_name")}>
            <TextControl
              fieldKey="item_name"
              placeholder="Type to search item codes from master data"
              form={form}
              setValue={set}
              cfg={cfg}
              req={req}
              autofill={autofill}
            />
          </Field>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {visible("last_seq_no") && (
            <Field label={labelFor("last_seq_no", "Last Seq No.")} required={req("last_seq_no")}>
              <Input
                type="number"
                inputMode="numeric"
                value={form.last_seq_no}
                required={req("last_seq_no")}
                onChange={(e) => set("last_seq_no", e.target.value.replace(/[^0-9]/g, ""))}
              />
            </Field>
          )}
          {visible("last_operation_name") && (
            <Field
              label={labelFor("last_operation_name", "Last Operation Name")}
              required={req("last_operation_name")}
            >
              <TextControl
                fieldKey="last_operation_name"
                placeholder="Operation description"
                form={form}
                setValue={set}
                cfg={cfg}
                req={req}
                autofill={autofill}
              />
            </Field>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {visible("next_dept_code") && (
            <Field
              label={labelFor("next_dept_code", "Next Department Code")}
              required={req("next_dept_code")}
            >
              <TextControl
                fieldKey="next_dept_code"
                placeholder="e.g. DP06"
                form={form}
                setValue={set}
                cfg={cfg}
                req={req}
                autofill={autofill}
              />
            </Field>
          )}
          {visible("next_dept_desc") && (
            <Field
              label={labelFor("next_dept_desc", "Next Department Description")}
              required={req("next_dept_desc")}
            >
              <TextControl
                fieldKey="next_dept_desc"
                placeholder="e.g. Metal Assembly Shop"
                form={form}
                setValue={set}
                cfg={cfg}
                req={req}
                autofill={autofill}
              />
            </Field>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {visible("next_seq_no") && (
            <Field label={labelFor("next_seq_no", "Next Seq No")} required={req("next_seq_no")}>
              <Input
                type="number"
                inputMode="numeric"
                value={form.next_seq_no}
                required={req("next_seq_no")}
                onChange={(e) => set("next_seq_no", e.target.value.replace(/[^0-9]/g, ""))}
              />
            </Field>
          )}
          {visible("next_op_code") && (
            <Field
              label={labelFor("next_op_code", "Next Operation Code")}
              required={req("next_op_code")}
            >
              <TextControl
                fieldKey="next_op_code"
                placeholder="e.g. O024"
                form={form}
                setValue={set}
                cfg={cfg}
                req={req}
                autofill={autofill}
              />
            </Field>
          )}
        </div>

        {visible("proposed_operation") && (
          <Field
            label={labelFor("proposed_operation", "Proposed Operation (Need to Change in Routing)")}
            required={req("proposed_operation")}
          >
            <TextControl
              fieldKey="proposed_operation"
              placeholder="Pick a master operation or type free text"
              form={form}
              setValue={set}
              cfg={cfg}
              req={req}
              autofill={autofill}
            />
          </Field>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {visible("movement_date") && (
            <Field
              label={labelFor("movement_date", "Movement Date")}
              required={req("movement_date")}
            >
              <Input
                type="date"
                value={form.movement_date}
                required={req("movement_date")}
                onChange={(e) => set("movement_date", e.target.value)}
              />
            </Field>
          )}
          {visible("change_type") && (
            <Field label={labelFor("change_type", "Change Type")} required={req("change_type")}>
              <Select value={form.change_type} onValueChange={(v) => set("change_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {changeOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        {visible("remarks") && (
          <Field label={labelFor("remarks", "Remarks")} required={req("remarks")}>
            <Textarea
              rows={3}
              value={form.remarks}
              required={req("remarks")}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Machine clearance, transit or tooling notes"
            />
          </Field>
        )}

        {customFields.map((f) => (
          <CustomField
            key={f.id}
            field={f}
            value={custom[f.field_key] ?? ""}
            onChange={(v) => setCustom((p) => ({ ...p, [f.field_key]: v }))}
            onPickRow={(row) => autofill(f, row)}
          />
        ))}

        <Button type="submit" size="lg" disabled={busy || !canSubmit} className="w-full md:w-auto">
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          Submit Routing Deviation
        </Button>
      </form>
    </div>
  );
}

function TextControl({
  fieldKey,
  placeholder,
  form,
  setValue,
  cfg,
  req,
  autofill,
}: {
  fieldKey: string;
  placeholder?: string;
  form: Record<string, string>;
  setValue: (key: string, value: string) => void;
  cfg: (key: string) => FormField | undefined;
  req: (key: string) => boolean;
  autofill: (field: FormField | undefined, row: Partial<MasterRow>) => void;
}) {
  const f = cfg(fieldKey);
  const lookupKey =
    f?.lookup_enabled && f.lookup_column
      ? (f.lookup_column as LookupKind)
      : lookupColumnForKey(fieldKey);

  if (lookupKey) {
    return (
      <MasterCombobox
        kind={lookupKey}
        value={form[fieldKey] ?? ""}
        onChange={(v) => setValue(fieldKey, v)}
        onPickRow={(row) => autofill(f, row)}
        mode={(f?.lookup_mode as LookupMode) ?? "prefix"}
        minChars={f?.lookup_min_chars ?? 0}
        required={req(fieldKey)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <Input
      value={form[fieldKey] ?? ""}
      required={req(fieldKey)}
      placeholder={placeholder}
      onChange={(e) => setValue(fieldKey, e.target.value)}
    />
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold tracking-wide uppercase">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function CustomField({
  field,
  value,
  onChange,
  onPickRow,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  onPickRow?: (row: Partial<MasterRow>) => void;
}) {
  const lookupColumn = field.lookup_enabled
    ? ((field.lookup_column ??
        (field.field_type === "item_lookup"
          ? "item"
          : field.field_type === "op_code_lookup"
            ? "op_code"
            : field.field_type === "op_desc_lookup"
              ? "op_desc"
              : field.field_type === "dept_code_lookup"
                ? "dept_code"
                : field.field_type === "dept_desc_lookup"
                  ? "dept_desc"
                  : null)) as LookupKind | null)
    : field.field_type === "item_lookup"
      ? ("item" as LookupKind)
      : field.field_type === "op_code_lookup"
        ? ("op_code" as LookupKind)
        : field.field_type === "op_desc_lookup"
          ? ("op_desc" as LookupKind)
          : field.field_type === "dept_code_lookup"
            ? ("dept_code" as LookupKind)
            : field.field_type === "dept_desc_lookup"
              ? ("dept_desc" as LookupKind)
              : null;

  return (
    <Field label={field.label} required={field.required}>
      {lookupColumn ? (
        <MasterCombobox
          kind={lookupColumn}
          value={value}
          onChange={onChange}
          onPickRow={onPickRow}
          mode={(field.lookup_mode as LookupMode) ?? "prefix"}
          minChars={field.lookup_min_chars ?? 0}
          required={field.required}
        />
      ) : field.field_type === "textarea" ? (
        <Textarea
          rows={3}
          value={value}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.field_type === "select" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={
            field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"
          }
          value={value}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
