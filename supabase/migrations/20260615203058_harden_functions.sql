-- Migration: harden_functions (20260615203058)
-- Address security-advisor warnings: pin search_path and stop trigger-only
-- functions from being callable as PostgREST RPC.

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

revoke execute on function public.bump_conversation()  from anon, authenticated, public;
revoke execute on function public.handle_new_user()    from anon, authenticated, public;
revoke execute on function public.touch_updated_at()   from anon, authenticated, public;
