-- Migration: Schedule the daily-report Edge Function using pg_cron + pg_net
-- Runs every day at 23:00 UTC (01:00 Madrid time in summer / 00:00 in winter)
-- Adjust the hour as needed for your timezone preference.

-- Step 1: Enable required extensions (may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Remove old schedule if it exists (idempotent re-run safety)
SELECT cron.unschedule('daily-financial-report')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-financial-report'
);

-- Step 3: Schedule the Edge Function call at 23:00 UTC every day
-- The function URL is: https://<project-ref>.supabase.co/functions/v1/daily-report
-- Authorization uses the anon key — the function uses service_role internally via env vars.
SELECT cron.schedule(
  'daily-financial-report',   -- job name (unique)
  '0 21 * * *',               -- cron expression: 21:00 UTC = 23:00 Madrid time (CEST)
  $$
  SELECT
    net.http_post(
      url     := 'https://dfjxmnsozvmfhojnuikx.supabase.co/functions/v1/daily-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY'
      ),
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify the schedule was created:
-- SELECT * FROM cron.job WHERE jobname = 'daily-financial-report';
