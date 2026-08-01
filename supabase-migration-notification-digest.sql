-- Lets each user choose whether their email notifications go out immediately
-- as events happen, or get batched into one daily digest at a time of their
-- choosing (Europe/Oslo hour, 0-23).
alter table profiles add column if not exists email_digest_mode text not null default 'immediate';
alter table profiles add column if not exists email_digest_hour smallint not null default 8;

-- Tracks whether/when the email portion of a notification was actually sent,
-- so the digest cron can find notifications still waiting to go out by email
-- (the bell/push side is unaffected by this — it's inserted immediately either way).
alter table notifications add column if not exists emailed_at timestamptz;

-- A row can exist purely to queue a daily-digest email for someone who has
-- push/bell turned off for that notification type — show_in_bell keeps it
-- out of their bell popover while still letting the digest cron find it via
-- emailed_at is null.
alter table notifications add column if not exists show_in_bell boolean not null default true;
