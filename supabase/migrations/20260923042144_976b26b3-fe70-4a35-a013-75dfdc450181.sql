CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS lookup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lookup_column text,
  ADD COLUMN IF NOT EXISTS lookup_mode text NOT NULL DEFAULT 'prefix',
  ADD COLUMN IF NOT EXISTS lookup_min_chars integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autofill_target text,
  ADD COLUMN IF NOT EXISTS autofill_source text;

UPDATE public.form_fields SET lookup_enabled = true, lookup_column = 'item' WHERE field_key = 'item_name';
UPDATE public.form_fields SET lookup_enabled = true, lookup_column = 'op_desc' WHERE field_key IN ('last_operation_name','proposed_operation');
UPDATE public.form_fields SET lookup_enabled = true, lookup_column = 'dept_code', autofill_target = 'next_dept_desc', autofill_source = 'dept_desc' WHERE field_key = 'next_dept_code';
UPDATE public.form_fields SET lookup_enabled = true, lookup_column = 'dept_desc', autofill_target = 'next_dept_code', autofill_source = 'dept_code' WHERE field_key = 'next_dept_desc';
UPDATE public.form_fields SET lookup_enabled = true, lookup_column = 'op_code', autofill_target = 'proposed_operation', autofill_source = 'op_desc' WHERE field_key = 'next_op_code';