
-- Garante que cada usuário só acessa arquivos dentro da sua própria pasta
-- (convenção: primeiro segmento do path = auth.uid())
-- Aplica-se ao bucket "uploads".

-- Política de SELECT: somente arquivos da própria pasta do usuário
DROP POLICY IF EXISTS "uploads_owner_select" ON storage.objects;
CREATE POLICY "uploads_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de INSERT: só pode criar dentro da própria pasta
DROP POLICY IF EXISTS "uploads_owner_insert" ON storage.objects;
CREATE POLICY "uploads_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de UPDATE: só pode alterar dentro da própria pasta
DROP POLICY IF EXISTS "uploads_owner_update" ON storage.objects;
CREATE POLICY "uploads_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de DELETE: só pode apagar dentro da própria pasta
DROP POLICY IF EXISTS "uploads_owner_delete" ON storage.objects;
CREATE POLICY "uploads_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
