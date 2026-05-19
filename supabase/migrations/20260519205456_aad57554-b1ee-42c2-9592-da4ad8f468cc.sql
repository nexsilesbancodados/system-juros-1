
-- 1. Profiles: drop overly broad SELECT, expose safe directory via a view
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, name, avatar_url, is_admin, is_chat_blocked
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2. Settings: remove broad public SELECT, provide function for signup checkout URL
DROP POLICY IF EXISTS "Public can view checkout URL" ON public.settings;

CREATE OR REPLACE FUNCTION public.get_signup_checkout_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hubla_checkout_url
  FROM public.settings
  WHERE hubla_checkout_url IS NOT NULL AND hubla_checkout_url <> ''
  ORDER BY created_at ASC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_signup_checkout_url() TO anon, authenticated;

-- 3. Chat message reactions: only visible to channel members / DM participants
DROP POLICY IF EXISTS "View reactions on visible messages" ON public.chat_message_reactions;

CREATE POLICY "View reactions on visible messages"
ON public.chat_message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_message_reactions.message_id
      AND (
        (m.channel_id IS NOT NULL AND public.is_channel_member(m.channel_id, auth.uid()))
        OR (m.dm_thread_id IS NOT NULL AND public.is_dm_participant(m.dm_thread_id, auth.uid()))
      )
  )
);

-- 4. Subscriptions: explicit admin-only write policies (prevent self-service tampering)
CREATE POLICY "Admins can insert subscriptions"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update subscriptions"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete subscriptions"
ON public.subscriptions
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 5. Uploads bucket: lock writes/updates/deletes to the owning user
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

CREATE POLICY "Authenticated users can upload to uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Owners can update own uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND owner = auth.uid())
WITH CHECK (bucket_id = 'uploads' AND owner = auth.uid());

CREATE POLICY "Owners can delete own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND owner = auth.uid());

-- 6. Fix function search_path warning on handle_new_user_trial
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.trial_ends_at = now() + interval '3 days';
  RETURN NEW;
END;
$$;
