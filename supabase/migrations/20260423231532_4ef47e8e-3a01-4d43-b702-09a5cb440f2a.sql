-- Allow authenticated users to view basic profile info of others (needed for Chat "People" tab)
-- The existing "Users can view own profile" and "Admins can view all profiles" policies remain.
-- This is safe because chat_messages already expose user_name and user_avatar to channel members.

CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);