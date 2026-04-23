-- Add read watermarks to DM threads for cross-device read receipts
ALTER TABLE public.chat_dm_threads
  ADD COLUMN IF NOT EXISTS last_read_a timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_read_b timestamptz NOT NULL DEFAULT now();

-- Allow participants to update their own read watermark
DROP POLICY IF EXISTS "Participants update own read watermark" ON public.chat_dm_threads;
CREATE POLICY "Participants update own read watermark"
ON public.chat_dm_threads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b)
WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- Allow editing own messages: add edited_at timestamp on UPDATE handled by client.
-- (chat_messages already has edited_at column and UPDATE policy for author/admin.)