DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.tables
           WHERE table_schema='public' AND table_type='BASE TABLE'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.table_name);
  END LOOP;
END $$;

-- Anon reads limited to tables used by public/portal flows
GRANT SELECT ON public.settings TO anon;
GRANT SELECT ON public.profiles TO anon;