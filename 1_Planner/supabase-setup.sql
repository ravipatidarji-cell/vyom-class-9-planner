create table if not exists public.planner_records (
  collection text not null check (collection in ('days', 'chapters', 'tests', 'settings', 'mistakes')),
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, record_id)
);

create table if not exists public.planner_family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member',
  added_at timestamptz not null default now()
);

alter table public.planner_family_members add column if not exists display_name text;
alter table public.planner_family_members add column if not exists role text not null default 'member';

alter table public.planner_family_members
  drop constraint if exists planner_family_members_role_check;
alter table public.planner_family_members
  add constraint planner_family_members_role_check check (role in ('admin', 'member'));

create table if not exists public.planner_family_private (
  user_id uuid primary key references public.planner_family_members(user_id) on delete cascade,
  phone text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_comments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.planner_family_members(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists planner_comments_created_at_idx
  on public.planner_comments(created_at desc);

alter table public.planner_family_members enable row level security;
alter table public.planner_family_private enable row level security;
alter table public.planner_comments enable row level security;
alter table public.planner_records enable row level security;

create or replace function public.is_planner_family_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.planner_family_members
    where user_id = auth.uid()
  );
$$;

create or replace function public.is_planner_family_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.planner_family_members
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_planner_family_member() from public;
revoke all on function public.is_planner_family_admin() from public;
grant execute on function public.is_planner_family_member() to authenticated;
grant execute on function public.is_planner_family_admin() to authenticated;

drop policy if exists "family members can see own membership" on public.planner_family_members;
drop policy if exists "family can see approved member names" on public.planner_family_members;
create policy "family can see approved member names"
  on public.planner_family_members for select
  to authenticated
  using (public.is_planner_family_member());

drop policy if exists "parent admins can read private family phones" on public.planner_family_private;
create policy "parent admins can read private family phones"
  on public.planner_family_private for select
  to authenticated
  using (public.is_planner_family_admin());

drop policy if exists "family can read comments" on public.planner_comments;
create policy "family can read comments"
  on public.planner_comments for select
  to authenticated
  using (public.is_planner_family_member());

drop policy if exists "members can post own comments" on public.planner_comments;
create policy "members can post own comments"
  on public.planner_comments for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_planner_family_member());

drop policy if exists "family members can read planner progress" on public.planner_records;
create policy "family members can read planner progress"
  on public.planner_records for select
  to authenticated
  using (public.is_planner_family_member());

drop policy if exists "family members can write planner progress" on public.planner_records;
create policy "family members can write planner progress"
  on public.planner_records for insert
  to authenticated
  with check (public.is_planner_family_member());

drop policy if exists "family members can update planner progress" on public.planner_records;
create policy "family members can update planner progress"
  on public.planner_records for update
  to authenticated
  using (public.is_planner_family_member())
  with check (public.is_planner_family_member());

grant select, insert, update on public.planner_records to authenticated;
grant select on public.planner_family_members to authenticated;
grant select on public.planner_family_private to authenticated;
grant select, insert on public.planner_comments to authenticated;
grant usage, select on sequence public.planner_comments_id_seq to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.planner_records;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.planner_comments;
exception
  when duplicate_object then null;
end $$;

update public.planner_family_members m
set display_name = coalesce(nullif(m.display_name, ''), 'Parent / Admin'),
    role = 'admin'
from auth.users u
where u.id = m.user_id
  and lower(u.email) = lower('ravipatidarji@gmail.com');
