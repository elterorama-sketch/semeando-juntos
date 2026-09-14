-- CRITICAL security finding: "profiles_update_own_basic_or_admin" allows
-- any user to update their OWN row (id = auth.uid()), with no column-level
-- restriction. RLS policies can't see column-level, only row-level, so a
-- non-admin could PATCH their own profiles row directly via the Supabase
-- client/REST API and set role = 'admin' (or active = true, or
-- congregation_id to anything) -- nothing in the UI exposes this, but
-- nothing in the database stopped it either. Confirmed and reverted live
-- in production during this audit.
--
-- Fix: a BEFORE UPDATE trigger, which (unlike RLS) can see OLD vs NEW and
-- clamp specific columns. Only an admin caller may actually change role,
-- active, or congregation_id; any other update request silently keeps
-- those three at their previous values regardless of what was sent,
-- while still letting a user's own update through for columns like
-- full_name/phone. Runs for every profiles UPDATE, including ones made
-- from the admin UI (which authenticate as the admin's own session, so
-- is_admin() there still evaluates true and nothing is clamped).
create or replace function prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    new.role := old.role;
    new.active := old.active;
    new.congregation_id := old.congregation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_privilege_escalation on profiles;
create trigger trg_prevent_self_privilege_escalation
  before update on profiles
  for each row
  execute function prevent_self_privilege_escalation();
