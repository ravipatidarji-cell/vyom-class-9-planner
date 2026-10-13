create table if not exists public.planner_records (
  collection text not null check (collection in ('days', 'chapters', 'tests', 'settings', 'mistakes')),
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, record_id)
);

create table if not exists public.planner_family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.planner_family_members enable row level security;
alter table public.planner_records enable row level security;

drop policy if exists "family members can see own membership" on public.planner_family_members;
create policy "family members can see own membership"
  on public.planner_family_members for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "family members can read planner progress" on public.planner_records;
create policy "family members can read planner progress"
  on public.planner_records for select
  to authenticated
  using (exists (
    select 1 from public.planner_family_members
    where user_id = auth.uid()
  ));

drop policy if exists "family members can write planner progress" on public.planner_records;
create policy "family members can write planner progress"
  on public.planner_records for insert
  to authenticated
  with check (exists (
    select 1 from public.planner_family_members
    where user_id = auth.uid()
  ));

drop policy if exists "family members can update planner progress" on public.planner_records;
create policy "family members can update planner progress"
  on public.planner_records for update
  to authenticated
  using (exists (
    select 1 from public.planner_family_members
    where user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.planner_family_members
    where user_id = auth.uid()
  ));

grant select, insert, update on public.planner_records to authenticated;
grant select on public.planner_family_members to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.planner_records;
exception
  when duplicate_object then null;
end $$;
