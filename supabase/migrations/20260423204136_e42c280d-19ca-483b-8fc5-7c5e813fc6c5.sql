-- =====================================================
-- CHAT SYSTEM: channels, members, messages, reactions, DMs
-- =====================================================

-- 1) CHANNELS (global + thematic)
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_announcement BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- 2) CHANNEL MEMBERSHIP (opt-in)
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ccm_user ON public.chat_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ccm_channel ON public.chat_channel_members(channel_id);

-- 3) DM THREADS (1-to-1)
CREATE TABLE IF NOT EXISTS public.chat_dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE(user_a, user_b)
);
ALTER TABLE public.chat_dm_threads ENABLE ROW LEVEL SECURITY;

-- 4) RECONSTRUCT chat_messages (drop & recreate — was unused on frontend)
DROP TABLE IF EXISTS public.chat_messages CASCADE;
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  dm_thread_id UUID REFERENCES public.chat_dm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text', -- text | image | file | system
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  reply_to JSONB, -- { id, user_name, content }
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_by UUID,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ( (channel_id IS NOT NULL)::int + (dm_thread_id IS NOT NULL)::int = 1 )
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cm_channel_created ON public.chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_cm_dm_created ON public.chat_messages(dm_thread_id, created_at DESC);
CREATE INDEX idx_cm_user ON public.chat_messages(user_id);

-- 5) REACTIONS
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cmr_message ON public.chat_message_reactions(message_id);

-- =====================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
-- =====================================================

-- Is the user member of channel?
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  )
$$;

-- Is the user participant of DM thread?
CREATE OR REPLACE FUNCTION public.is_dm_participant(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_dm_threads
    WHERE id = _thread_id AND (user_a = _user_id OR user_b = _user_id)
  )
$$;

-- Get or create DM thread between two users (always sorted)
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(_other_user UUID)
RETURNS UUID
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  ua UUID;
  ub UUID;
  tid UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF me = _other_user THEN RAISE EXCEPTION 'cannot DM yourself'; END IF;
  IF me < _other_user THEN ua := me; ub := _other_user; ELSE ua := _other_user; ub := me; END IF;
  SELECT id INTO tid FROM public.chat_dm_threads WHERE user_a = ua AND user_b = ub;
  IF tid IS NULL THEN
    INSERT INTO public.chat_dm_threads (user_a, user_b) VALUES (ua, ub) RETURNING id INTO tid;
  END IF;
  RETURN tid;
END;
$$;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- chat_channels: everyone can SEE list of channels; only admin creates/edits/deletes
CREATE POLICY "Anyone authenticated can view channels"
  ON public.chat_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage channels"
  ON public.chat_channels FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- chat_channel_members: user manages own membership; admins see/manage all
CREATE POLICY "Users join channels (self)"
  ON public.chat_channel_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave own membership"
  ON public.chat_channel_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "Members & admins view memberships"
  ON public.chat_channel_members FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Users update own membership"
  ON public.chat_channel_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- chat_dm_threads: only participants
CREATE POLICY "Participants view DM threads"
  ON public.chat_dm_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b OR is_admin(auth.uid()));
CREATE POLICY "Anyone create DM (function-mediated)"
  ON public.chat_dm_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- chat_messages: members of channel OR participants of DM
CREATE POLICY "View messages of accessible scope"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    (channel_id IS NOT NULL AND is_channel_member(channel_id, auth.uid()))
    OR (dm_thread_id IS NOT NULL AND is_dm_participant(dm_thread_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "Send messages to accessible scope"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT COALESCE((SELECT is_chat_blocked FROM public.profiles WHERE id = auth.uid()), false)
    AND (
      (channel_id IS NOT NULL AND is_channel_member(channel_id, auth.uid()))
      OR (dm_thread_id IS NOT NULL AND is_dm_participant(dm_thread_id, auth.uid()))
    )
  );
CREATE POLICY "Author or admin edits messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "Author or admin deletes messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- chat_message_reactions: anyone who can see the message can react
CREATE POLICY "View reactions on visible messages"
  ON public.chat_message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id));
CREATE POLICY "Add own reaction"
  ON public.chat_message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Remove own reaction"
  ON public.chat_message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update DM last_message_at
CREATE OR REPLACE FUNCTION public.touch_dm_thread()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.dm_thread_id IS NOT NULL THEN
    UPDATE public.chat_dm_threads SET last_message_at = NEW.created_at WHERE id = NEW.dm_thread_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_touch_dm ON public.chat_messages;
CREATE TRIGGER trg_touch_dm
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_dm_thread();

-- =====================================================
-- SEED: default global channel
-- =====================================================
INSERT INTO public.chat_channels (id, name, description, is_default)
VALUES ('00000000-0000-0000-0000-00000000c001', 'geral', 'Sala global de conversa entre todos os usuários', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- REALTIME
-- =====================================================
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_channel_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channel_members;