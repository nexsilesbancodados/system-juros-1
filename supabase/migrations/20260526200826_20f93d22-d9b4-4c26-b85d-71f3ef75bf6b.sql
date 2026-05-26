
SELECT cron.unschedule('whatsapp-followup-every-30min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='whatsapp-followup-every-30min');

SELECT cron.schedule(
  'whatsapp-followup-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://bnupitnrxyferelwroas.supabase.co/functions/v1/whatsapp-followup',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
