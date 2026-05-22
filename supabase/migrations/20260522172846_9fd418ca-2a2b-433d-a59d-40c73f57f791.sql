-- Enable realtime on all key tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clients','contracts','contract_installments','installments','transactions',
    'profits','expenses','notifications','collectors','collector_assignments',
    'collector_tokens','client_tokens','pledges','goals','todos','notes',
    'vehicles','rentals','stock_items','message_templates','subscriptions','profiles','settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;