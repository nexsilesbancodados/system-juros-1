
-- Permite uploads anônimos APENAS dentro de subpastas .../comprovantes/...
-- Usado por cobradores externos autenticados via token customizado (não Supabase Auth).
DROP POLICY IF EXISTS "uploads_anon_insert_comprovantes" ON storage.objects;
CREATE POLICY "uploads_anon_insert_comprovantes"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[2] = 'comprovantes'
);

DROP POLICY IF EXISTS "uploads_anon_update_comprovantes" ON storage.objects;
CREATE POLICY "uploads_anon_update_comprovantes"
ON storage.objects FOR UPDATE
TO anon
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[2] = 'comprovantes'
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[2] = 'comprovantes'
);
