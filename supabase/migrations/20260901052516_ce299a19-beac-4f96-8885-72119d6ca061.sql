create or replace function app_private.shares_brand(_other_user uuid, _me uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brand_members a
    join public.brand_members b on b.brand_id = a.brand_id
    where a.user_id = _me and b.user_id = _other_user
  );
$$;

revoke all on function app_private.shares_brand(uuid, uuid) from public;
grant execute on function app_private.shares_brand(uuid, uuid) to authenticated;

drop policy if exists profiles_select_teammates on public.profiles;
create policy profiles_select_teammates on public.profiles
for select to authenticated
using (id = auth.uid() or app_private.shares_brand(id, auth.uid()));