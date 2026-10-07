-- Fix: Freedom RLS policies must not query workspace_members directly.
--
-- 20260910120000 wrote its policies as an inline
--   exists (select 1 from public.workspace_members wm where ...)
-- which matches the pattern used by the standard_inclusions_* tables. On this
-- database that pattern is broken, because workspace_members has a self-
-- referential policy of its own:
--
--   CREATE POLICY "members_read_workspace_members" ON workspace_members
--     USING (workspace_id IN (SELECT workspace_id FROM workspace_members ...))
--
-- Evaluating a Freedom policy therefore evaluates workspace_members' policy,
-- which evaluates itself, and Postgres aborts with
--   42P17: infinite recursion detected in policy for relation "workspace_members"
--
-- The practical effect was that RLS blocked everything with an ERROR rather than
-- by returning no rows. That is safe (nothing leaked) but wrong: a legitimate
-- member holding a user JWT could not read their own Freedom rows either, so RLS
-- was not actually providing the second line of defence it is there to provide.
--
-- The repository already solved this once, for the builder/estimate tables:
-- public.is_workspace_member(uuid) is a SECURITY DEFINER function, so the
-- membership lookup inside it runs with RLS bypassed and the recursion never
-- starts. These policies now use it. This is the established pattern here, not a
-- new mechanism, and it does not widen access: the predicate is the same
-- membership-with-status-'active' test, evaluated the same way.
--
-- The recursive workspace_members policy itself is NOT touched. It is
-- pre-existing, shared by other modules, and fixing it belongs to whoever owns
-- that table rather than to a Freedom storage migration.

-- Recreate the helper defensively: if an earlier migration that defines it has
-- not been applied on this database, the policies below would fail to compile.
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'freedom_positions',
    'freedom_position_events',
    'freedom_trade_imports',
    'freedom_broker_snapshots'
  ]
  loop
    execute format('drop policy if exists %I_member_select on public.%I', t, t);
    execute format($f$
      create policy %I_member_select on public.%I
        for select
        using (public.is_workspace_member(%I.workspace_id))
    $f$, t, t, t);

    execute format('drop policy if exists %I_member_insert on public.%I', t, t);
    execute format($f$
      create policy %I_member_insert on public.%I
        for insert
        with check (public.is_workspace_member(%I.workspace_id))
    $f$, t, t, t);

    -- USING gates which rows may be updated; WITH CHECK stops an update from
    -- moving a row into a workspace the caller is not a member of.
    execute format('drop policy if exists %I_member_update on public.%I', t, t);
    execute format($f$
      create policy %I_member_update on public.%I
        for update
        using (public.is_workspace_member(%I.workspace_id))
        with check (public.is_workspace_member(%I.workspace_id))
    $f$, t, t, t, t);

    execute format('drop policy if exists %I_member_delete on public.%I', t, t);
    execute format($f$
      create policy %I_member_delete on public.%I
        for delete
        using (public.is_workspace_member(%I.workspace_id))
    $f$, t, t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
