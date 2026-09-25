ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissions JSONB;

COMMENT ON COLUMN public.profiles.permissions IS
  'Per-user page visibility and action overrides layered over the selected role preset.';