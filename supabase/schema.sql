-- Reading state, per account.
--
-- One table, because the reading list is the only thing worth carrying between
-- devices: course progress is derived from it (see src/view/walk.ts), and panel
-- width is a property of the screen you are sitting at, not of you.
--
-- Apply once, in the Supabase SQL editor. Safe to re-run.

create table if not exists public.reading (
  user_id  uuid        not null references auth.users on delete cascade,
  node_id  text        not null check (node_id ~ '^[a-z0-9]+$'),
  read_at  timestamptz not null default now(),
  primary key (user_id, node_id)
);

-- Every query filters by user, and the row-level policies below make that the
-- only possible query, so the index carries the whole access pattern.
create index if not exists reading_user_idx on public.reading (user_id);

alter table public.reading enable row level security;

-- The anon key ships in the browser, so these policies ARE the security model.
-- `auth.uid() = user_id` on all four verbs means a signed-in reader can see and
-- change their own rows and nothing else; an anonymous request matches nothing.
drop policy if exists reading_select on public.reading;
create policy reading_select on public.reading
  for select using (auth.uid() = user_id);

drop policy if exists reading_insert on public.reading;
create policy reading_insert on public.reading
  for insert with check (auth.uid() = user_id);

drop policy if exists reading_update on public.reading;
create policy reading_update on public.reading
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reading_delete on public.reading;
create policy reading_delete on public.reading
  for delete using (auth.uid() = user_id);

-- A reader must be able to take their data out and to destroy it. Deleting the
-- auth user cascades to these rows; this is the "just the reading list" case.
create or replace function public.clear_my_reading()
returns void language sql security invoker as $$
  delete from public.reading where user_id = auth.uid();
$$;
