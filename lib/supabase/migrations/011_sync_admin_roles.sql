-- ============================================================================
-- SYNC AUTH METADATA FROM public.admins ONLY
-- public.admins.role stays the source of truth.
-- This migration intentionally does NOT create admin rows from auth metadata.
-- It only normalizes legacy ADMIN metadata for comparison, mirrors DB roles
-- back into auth metadata, and reports rollout discrepancies via NOTICEs.
-- ============================================================================

do $$
declare
  metadata_only_admin_count integer;
  metadata_role_mismatch_count integer;
  admin_without_auth_count integer;
  metadata_only_admin_record record;
  metadata_role_mismatch_record record;
  admin_without_auth_record record;
begin
  select count(*)
  into metadata_only_admin_count
  from auth.users u
  where coalesce(u.raw_user_meta_data->>'role', '') in ('SUPER_ADMIN', 'MANAGER', 'STAFF', 'ADMIN')
    and not exists (
      select 1
      from public.admins a
      where a.id = u.id
    );

  select count(*)
  into metadata_role_mismatch_count
  from auth.users u
  join public.admins a on a.id = u.id
  where coalesce(
    case u.raw_user_meta_data->>'role'
      when 'ADMIN' then 'MANAGER'
      else u.raw_user_meta_data->>'role'
    end,
    ''
  ) is distinct from a.role::text;

  select count(*)
  into admin_without_auth_count
  from public.admins a
  where not exists (
    select 1
    from auth.users u
    where u.id = a.id
  );

  raise notice 'RBAC rollout audit: metadata-only admin candidates=%', metadata_only_admin_count;
  raise notice 'RBAC rollout audit: metadata/db role mismatches=%', metadata_role_mismatch_count;
  raise notice 'RBAC rollout audit: admins without auth users=%', admin_without_auth_count;

  for metadata_only_admin_record in
    select u.id, coalesce(u.email, '') as email, coalesce(u.raw_user_meta_data->>'role', '') as metadata_role
    from auth.users u
    where coalesce(u.raw_user_meta_data->>'role', '') in ('SUPER_ADMIN', 'MANAGER', 'STAFF', 'ADMIN')
      and not exists (
        select 1
        from public.admins a
        where a.id = u.id
      )
  loop
    raise notice 'RBAC rollout detail: metadata-only admin candidate id=%, email=%, metadata_role=%',
      metadata_only_admin_record.id,
      metadata_only_admin_record.email,
      metadata_only_admin_record.metadata_role;
  end loop;

  for metadata_role_mismatch_record in
    select
      u.id,
      coalesce(u.email, '') as email,
      case u.raw_user_meta_data->>'role'
        when 'ADMIN' then 'MANAGER'
        else coalesce(u.raw_user_meta_data->>'role', '')
      end as metadata_role,
      a.role::text as admin_role
    from auth.users u
    join public.admins a on a.id = u.id
    where coalesce(
      case u.raw_user_meta_data->>'role'
        when 'ADMIN' then 'MANAGER'
        else u.raw_user_meta_data->>'role'
      end,
      ''
    ) is distinct from a.role::text
  loop
    raise notice 'RBAC rollout detail: role mismatch id=%, email=%, metadata_role=%, admin_role=%',
      metadata_role_mismatch_record.id,
      metadata_role_mismatch_record.email,
      metadata_role_mismatch_record.metadata_role,
      metadata_role_mismatch_record.admin_role;
  end loop;

  for admin_without_auth_record in
    select a.id, coalesce(a.email, '') as email, a.role::text as admin_role
    from public.admins a
    where not exists (
      select 1
      from auth.users u
      where u.id = a.id
    )
  loop
    raise notice 'RBAC rollout detail: admin without auth user id=%, email=%, admin_role=%',
      admin_without_auth_record.id,
      admin_without_auth_record.email,
      admin_without_auth_record.admin_role;
  end loop;
end $$;

update auth.users as u
set raw_user_meta_data = jsonb_set(
  coalesce(u.raw_user_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(a.role::text),
  true
)
from public.admins as a
where a.id = u.id
  and coalesce(
    case u.raw_user_meta_data->>'role'
      when 'ADMIN' then 'MANAGER'
      else u.raw_user_meta_data->>'role'
    end,
    ''
  ) is distinct from a.role::text;
