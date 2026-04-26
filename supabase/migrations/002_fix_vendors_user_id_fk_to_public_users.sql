-- 002_fix_vendors_user_id_fk_to_public_users.sql
-- Align vendors.user_id with marketplace public.users.id
-- so email verification in marketplace can directly activate vendors.

begin;

-- Drop old FK first (it points to the old user source and blocks remapping).
alter table if exists public.vendors
  drop constraint if exists vendors_user_id_fkey;

-- First remap existing vendor rows to marketplace users by matching email.
update public.vendors v
set user_id = u.id
from public.users u
where v.email is not null
  and lower(v.email) = lower(u.email)
  and v.user_id <> u.id;

alter table if exists public.vendors
  add constraint vendors_user_id_fkey
  foreign key (user_id)
  references public.users(id)
  on delete cascade;

commit;
