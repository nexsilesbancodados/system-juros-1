-- Schedule auto-late-fees: every day at 06:00 UTC (03:00 BRT)
SELECT cron.schedule(
  'auto-late-fees-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-late-fees',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule auto-notifications: every day at 06:15 UTC (03:15 BRT)
SELECT cron.schedule(
  'auto-notifications-daily',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule auto-collection: every day at 12:00 UTC (09:00 BRT)
SELECT cron.schedule(
  'auto-collection-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-collection',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);