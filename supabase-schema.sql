-- Run this in Supabase SQL Editor.
-- Safe to run again.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text default 'אחר',
  deadline timestamptz,
  priority text default 'בינונית',
  complexity text default 'בינונית',
  status text default 'פתוחה',
  estimate_minutes integer default 30,
  notes text default '',
  google_event_id text,
  reminder_sent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks add column if not exists google_event_id text;
alter table public.tasks add column if not exists reminder_sent boolean default false;
alter table public.tasks add column if not exists estimate_minutes integer default 30;
alter table public.tasks add column if not exists notes text default '';

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks for select
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks for insert
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks for delete
using (auth.uid() = user_id);


-- Subtasks / project splitting
alter table public.tasks
add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_task_id_idx
on public.tasks(parent_task_id);
