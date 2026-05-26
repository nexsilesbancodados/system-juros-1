
-- 1) Remove sensitive tables from realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='settings') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.settings';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='subscriptions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='collector_tokens') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.collector_tokens';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='client_tokens') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.client_tokens';
  END IF;
END $$;

-- 2) automation_logs: allow service role inserts (edge functions)
DROP POLICY IF EXISTS "Service role can insert automation logs" ON public.automation_logs;
CREATE POLICY "Service role can insert automation logs"
ON public.automation_logs FOR INSERT TO service_role WITH CHECK (true);

-- 3) system_automations: allow admin manage
DROP POLICY IF EXISTS "Admins can insert system automations" ON public.system_automations;
CREATE POLICY "Admins can insert system automations"
ON public.system_automations FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update system automations" ON public.system_automations;
CREATE POLICY "Admins can update system automations"
ON public.system_automations FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete system automations" ON public.system_automations;
CREATE POLICY "Admins can delete system automations"
ON public.system_automations FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 4) backups bucket: insert policy scoped to user folder
DROP POLICY IF EXISTS "Users can upload own backups" ON storage.objects;
CREATE POLICY "Users can upload own backups"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);
