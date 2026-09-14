-- Found via Supabase's own security linter (get_advisors): reserve_numbers,
-- confirm_payment, expire_stale_reservations and prevent_self_privilege_escalation
-- were callable by the unauthenticated `anon` role. Supabase projects grant
-- EXECUTE on new public-schema functions to anon/authenticated by default
-- (separate from, and broader than, the PUBLIC pseudo-role) -- nothing here
-- had ever revoked that default, the `grant ... to authenticated` statements
-- elsewhere only ever *added* a grant, never removed the implicit ones.
--
-- Not exploitable today: every one of these functions checks the caller's
-- role internally (is_seller_or_admin()/is_admin()/current_user_role()) and
-- rejects an unauthenticated caller (auth.uid() is null for anon). Still,
-- "reachable but rejected" is worse defense-in-depth than "not reachable at
-- all" -- revoke the unnecessary exposure.
--
-- prevent_self_privilege_escalation() is a trigger function (see
-- 0016_prevent_self_role_escalation.sql) -- it references the implicit
-- OLD/NEW trigger records and was never meant to be called directly via
-- RPC at all; Postgres invokes trigger functions regardless of EXECUTE
-- grants, so it needs none. expire_stale_reservations() is only ever
-- invoked internally (a `perform` call inside reserve_numbers(), same
-- owner, no grant needed) or via the service-role client in
-- /api/cron/expire-reservations (service_role bypasses grants) -- no app
-- role needs direct RPC access to either.
revoke execute on function reserve_numbers(uuid, integer[], text, text, text, uuid, payment_method) from public, anon;
revoke execute on function confirm_payment(uuid, integer, payment_method, text) from public, anon;
revoke execute on function expire_stale_reservations() from public, anon, authenticated;
revoke execute on function prevent_self_privilege_escalation() from public, anon, authenticated;

grant execute on function reserve_numbers(uuid, integer[], text, text, text, uuid, payment_method) to authenticated;
grant execute on function confirm_payment(uuid, integer, payment_method, text) to authenticated;
