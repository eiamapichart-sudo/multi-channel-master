create schema if not exists app_private;
revoke all on schema app_private from anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function app_private.is_brand_member(_brand_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.brand_members where brand_id = _brand_id and user_id = _user_id)
$$;

create or replace function app_private.is_brand_manager(_brand_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brand_members
    where brand_id = _brand_id and user_id = _user_id and role in ('owner','approver')
  )
$$;

revoke all on function app_private.has_role(uuid, public.app_role) from public;
revoke all on function app_private.is_brand_member(uuid, uuid) from public;
revoke all on function app_private.is_brand_manager(uuid, uuid) from public;
grant execute on function app_private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function app_private.is_brand_member(uuid, uuid) to authenticated, service_role;
grant execute on function app_private.is_brand_manager(uuid, uuid) to authenticated, service_role;

drop policy if exists brand_members_delete on public.brand_members;
drop policy if exists brand_members_insert on public.brand_members;
drop policy if exists brand_members_select on public.brand_members;
drop policy if exists brand_members_update on public.brand_members;
drop policy if exists brands_select_member on public.brands;
drop policy if exists brands_update_manager on public.brands;
drop policy if exists channels_member_all on public.channel_accounts;
drop policy if exists post_targets_member_all on public.post_targets;
drop policy if exists posts_member_all on public.posts;

create policy brand_members_select on public.brand_members for select to authenticated
  using (user_id = auth.uid() or app_private.is_brand_member(brand_id, auth.uid()));
create policy brand_members_insert on public.brand_members for insert to authenticated
  with check (user_id = auth.uid() or app_private.is_brand_manager(brand_id, auth.uid()));
create policy brand_members_update on public.brand_members for update to authenticated
  using (app_private.is_brand_manager(brand_id, auth.uid()))
  with check (app_private.is_brand_manager(brand_id, auth.uid()));
create policy brand_members_delete on public.brand_members for delete to authenticated
  using (app_private.is_brand_manager(brand_id, auth.uid()));

create policy brands_select_member on public.brands for select to authenticated
  using (app_private.is_brand_member(id, auth.uid()));
create policy brands_update_manager on public.brands for update to authenticated
  using (app_private.is_brand_manager(id, auth.uid()))
  with check (app_private.is_brand_manager(id, auth.uid()));

create policy channels_member_all on public.channel_accounts for all to authenticated
  using (app_private.is_brand_member(brand_id, auth.uid()))
  with check (app_private.is_brand_member(brand_id, auth.uid()));

create policy posts_member_all on public.posts for all to authenticated
  using (app_private.is_brand_member(brand_id, auth.uid()))
  with check (app_private.is_brand_member(brand_id, auth.uid()));

create policy post_targets_member_all on public.post_targets for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_targets.post_id and app_private.is_brand_member(p.brand_id, auth.uid())))
  with check (exists (select 1 from public.posts p where p.id = post_targets.post_id and app_private.is_brand_member(p.brand_id, auth.uid())));

drop function if exists public.has_role(uuid, public.app_role);
drop function if exists public.is_brand_member(uuid, uuid);
drop function if exists public.is_brand_manager(uuid, uuid);