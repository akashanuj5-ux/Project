ALTER TABLE public.deviations
  ADD COLUMN IF NOT EXISTS eco_attachment_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('deviation-attachments', 'deviation-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "authenticated upload deviation attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deviation-attachments');

CREATE POLICY "authenticated read deviation attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deviation-attachments');