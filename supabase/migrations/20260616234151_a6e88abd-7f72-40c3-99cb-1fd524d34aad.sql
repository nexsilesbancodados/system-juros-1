SET LOCAL lock_timeout = '3s';
DROP POLICY IF EXISTS "Members & admins view memberships" ON public.chat_channel_members;