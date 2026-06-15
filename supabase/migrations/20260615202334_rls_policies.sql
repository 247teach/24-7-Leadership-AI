-- Migration: rls_policies (20260615202334)
-- =====================================================================
-- Row Level Security — the clearance + ownership model.
-- =====================================================================

alter table public.profiles      enable row level security;
alter table public.agents        enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.attachments   enable row level security;
alter table public.review_items  enable row level security;

create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_reviewer from public.profiles p where p.id = auth.uid()), false);
$$;

-- profiles: read all (directory), modify own.
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- agents: full catalog readable by all authenticated members.
create policy "agents readable by authenticated" on public.agents
  for select to authenticated using (true);

-- conversations: own only, and only with agents the member is cleared for.
create policy "conversations select own" on public.conversations
  for select to authenticated using (user_id = auth.uid());
create policy "conversations insert own cleared" on public.conversations
  for insert to authenticated
  with check (user_id = auth.uid() and public.user_can_access_agent(agent_id));
create policy "conversations update own" on public.conversations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "conversations delete own" on public.conversations
  for delete to authenticated using (user_id = auth.uid());

-- messages: access flows through ownership of the parent conversation.
create policy "messages select own" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "messages insert own" on public.messages
  for insert to authenticated with check (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "messages update own" on public.messages
  for update to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- attachments: own only.
create policy "attachments select own" on public.attachments
  for select to authenticated using (user_id = auth.uid());
create policy "attachments insert own" on public.attachments
  for insert to authenticated with check (user_id = auth.uid());
create policy "attachments delete own" on public.attachments
  for delete to authenticated using (user_id = auth.uid());

-- review_items: reviewers (or the submitter) can see; only reviewers resolve.
create policy "review_items select reviewer or owner" on public.review_items
  for select to authenticated using (public.is_reviewer() or submitted_by = auth.uid());
create policy "review_items insert own" on public.review_items
  for insert to authenticated with check (submitted_by = auth.uid() or submitted_by is null);
create policy "review_items update reviewer" on public.review_items
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
