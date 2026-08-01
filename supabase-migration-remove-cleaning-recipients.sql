-- Renhold notifications are now unified with the standard per-user
-- notification_prefs system (type 'cleaning_daily_summary'), replacing the
-- separate admin-curated recipient list and the app_settings on/off toggle.
drop table if exists public.cleaning_notification_recipients;
drop table if exists public.app_settings;
