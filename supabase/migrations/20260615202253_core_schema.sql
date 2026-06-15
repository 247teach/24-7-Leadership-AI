-- Migration: core_schema (20260615202253)
-- =====================================================================
-- 24/7 Leadership AI — Core schema
-- Agent Hub: profiles, agents, conversations, messages, attachments,
-- and the governance (knowledge review) queue.
-- =====================================================================

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default 'Team Member',
  role         text not null default '24/7 Education team',
  initials     text not null default '',
  clearances   text[] not null default '{}',
  is_reviewer  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is 'Team member profile, 1:1 with auth.users. clearances gate agent access.';

create table public.agents (
  id                 text primary key,
  name               text not null,
  icon               text not null,
  description        text not null,
  function_label     text,
  clearance_label    text not null,
  required_clearance text not null default 'all',
  greeting           text,
  is_flagship        boolean not null default false,
  status             text not null default 'active'
                       check (status in ('active','coming_soon','restricted')),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now()
);
comment on table public.agents is 'Catalog of AI agents. required_clearance gates access against profiles.clearances.';

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  agent_id   text not null references public.agents (id),
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_agent_idx
  on public.conversations (user_id, agent_id, updated_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user','agent')),
  content         text not null default '',
  flagged         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx
  on public.messages (conversation_id, created_at);

create table public.attachments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id      uuid references public.messages (id) on delete set null,
  file_name       text not null,
  file_size       bigint not null default 0,
  storage_path    text not null,
  scope           text not null default 'conversation'
                    check (scope in ('conversation','knowledge_base')),
  created_at      timestamptz not null default now()
);
create index attachments_user_idx on public.attachments (user_id, created_at desc);

create table public.review_items (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('document','correction')),
  title         text not null,
  submitted_by  uuid references public.profiles (id) on delete set null,
  submitted_name text,
  source        text,
  snippet       text,
  target        text,
  agent_id      text references public.agents (id),
  attachment_id uuid references public.attachments (id) on delete set null,
  message_id    uuid references public.messages (id) on delete set null,
  status        text not null default 'pending'
                  check (status in ('pending','approved','declined')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles (id) on delete set null
);
create index review_items_status_idx on public.review_items (status, created_at desc);

-- Helpers ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_bump_conversation after insert on public.messages
  for each row execute function public.bump_conversation();

-- Auto-create a profile on signup. NOTE: new members default to a broad
-- clearance set + reviewer access so the hub is explorable out of the box.
-- Tighten these defaults for a real rollout.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_initials text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1));
  v_initials := upper(left(split_part(v_name, ' ', 1), 1) ||
    coalesce(left(nullif(split_part(v_name, ' ', 2), ''), 1), ''));
  insert into public.profiles (id, full_name, role, initials, clearances, is_reviewer)
  values (new.id, v_name,
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), '24/7 Education team'),
    v_initials, array['leadership','build','academic'], true)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.user_can_access_agent(p_agent_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agents a
      join public.profiles p on p.id = auth.uid()
     where a.id = p_agent_id and a.status = 'active'
       and (a.required_clearance = 'all' or a.required_clearance = any (p.clearances)));
$$;
