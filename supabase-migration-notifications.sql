-- In-app notification bell: a per-recipient feed of "someone did X" events,
-- separate from Gjøremål (which only ever shows the current user's own
-- pending action items and is not configurable).

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on notifications (recipient_id, created_at desc);

alter table notifications enable row level security;

-- Recipients can read and mark their own notifications as read.
-- Inserts only ever happen server-side via the service role (see
-- app/api/notifications/create/route.ts), which bypasses RLS entirely, so
-- there is deliberately no INSERT policy here.
create policy "recipient_select_notifications" on notifications
  for select using (auth.uid() = recipient_id);

create policy "recipient_update_notifications" on notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- Per-user opt-out of specific notification types, e.g. {"contract_signed": false}.
-- Missing key = enabled (default on).
alter table profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
