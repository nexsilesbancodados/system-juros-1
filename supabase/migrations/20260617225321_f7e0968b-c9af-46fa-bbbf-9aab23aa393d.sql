
-- 1) Drop legacy duplicates that used the owner metadata field
DROP POLICY IF EXISTS "Owners can list own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete own uploads" ON storage.objects;

-- 2) Restrictive profile UPDATE policy: prevents non-admins from writing
--    sensitive columns even if grants ever change. Combines with the
--    trigger trg_protect_profile_admin_columns and the column-level REVOKE.
DROP POLICY IF EXISTS "No self privilege escalation on profiles" ON public.profiles;
CREATE POLICY "No self privilege escalation on profiles"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    is_admin                IS NOT DISTINCT FROM (SELECT p.is_admin                FROM public.profiles p WHERE p.id = profiles.id)
    AND is_blocked          IS NOT DISTINCT FROM (SELECT p.is_blocked          FROM public.profiles p WHERE p.id = profiles.id)
    AND is_chat_blocked     IS NOT DISTINCT FROM (SELECT p.is_chat_blocked     FROM public.profiles p WHERE p.id = profiles.id)
    AND trial_ends_at       IS NOT DISTINCT FROM (SELECT p.trial_ends_at       FROM public.profiles p WHERE p.id = profiles.id)
    AND subscription_expires_at IS NOT DISTINCT FROM (SELECT p.subscription_expires_at FROM public.profiles p WHERE p.id = profiles.id)
    AND subscription_type   IS NOT DISTINCT FROM (SELECT p.subscription_type   FROM public.profiles p WHERE p.id = profiles.id)
  )
);
