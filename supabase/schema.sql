-- E-Surat Deputi Infrastructure — schema for free Supabase test project
-- Run once in Supabase Dashboard > SQL Editor.
-- Use dummy data only. Review policies before any production use.

create extension if not exists pgcrypto;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into public.units (code, name, sort_order) values
 ('SEKRETARIAT', 'Sekretariat Deputi', 1),
 ('KONEKTIVITAS', 'Asisten Deputi Infrastruktur Konektivitas', 2),
 ('SDA', 'Asisten Deputi Sumber Daya Air', 3),
 ('SANITASI', 'Asisten Deputi Infrastruktur Permukiman & Sanitasi', 4),
 ('TATARUANG', 'Asisten Deputi Tata Ruang & Pembangunan Kewilayahan', 5),
 ('IKN', 'Asisten Deputi Akselerasi Infrastruktur IKN', 6)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  unit_id uuid references public.units(id) on delete set null,
  role text not null default 'pegawai' check (role in ('super_admin','admin','pimpinan','asdep','pegawai')),
  status text not null default 'pending' check (status in ('pending','active','rejected','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_profile_unit_id()
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$ select unit_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = auth.uid() and status = 'active') $$;

create or replace function public.is_admin_user()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('admin','super_admin')) $$;

create or replace function public.is_super_admin_user()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'super_admin') $$;

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  direction text not null check (direction in ('masuk','keluar')),
  letter_number text not null,
  letter_date date not null,
  sender text not null,
  recipient text not null,
  confidentiality text not null default 'Penting' check (confidentiality in ('Biasa','Penting','Rahasia','Sangat Rahasia')),
  classification text not null default 'Lainnya',
  subject text not null,
  initial_note text,
  status text not null default 'diterima' check (status in ('diterima','disposisi','proses','verifikasi','selesai')),
  origin_unit_id uuid not null references public.units(id),
  target_unit_id uuid not null references public.units(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.letter_access (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (letter_id, user_id)
);

create or replace function public.can_access_letter(p_letter_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.letters l
    where l.id = p_letter_id
      and public.is_active_user()
      and (
        public.is_admin_user()
        or (public.current_profile_role() = 'pimpinan' and l.confidentiality not in ('Rahasia','Sangat Rahasia'))
        or l.created_by = auth.uid()
        or exists (select 1 from public.letter_access la where la.letter_id = l.id and la.user_id = auth.uid())
        or (
          l.confidentiality not in ('Rahasia','Sangat Rahasia')
          and (l.origin_unit_id = public.current_profile_unit_id() or l.target_unit_id = public.current_profile_unit_id())
        )
      )
  )
$$;

create table if not exists public.letter_history (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  status text not null,
  title text not null,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.dispositions (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  to_unit_id uuid not null references public.units(id),
  instruction text not null,
  due_date date,
  status text not null default 'dikirim' check (status in ('dikirim','diterima','diproses','selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  unit_id uuid not null references public.units(id),
  assigned_to uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  letter_id uuid references public.letters(id) on delete set null,
  due_date date,
  priority text not null default 'Normal' check (priority in ('Normal','Tinggi','Urgent')),
  status text not null default 'belum_mulai' check (status in ('belum_mulai','proses','selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- A new self-registration always becomes a pending PEGawai. Role never comes from browser metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare requested_unit uuid;
begin
  begin requested_unit := nullif(new.raw_user_meta_data->>'unit_id','')::uuid;
  exception when others then requested_unit := null;
  end;
  if requested_unit is not null and not exists (select 1 from public.units where id = requested_unit) then
    requested_unit := null;
  end if;
  insert into public.profiles (id, email, full_name, unit_id, role, status)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), requested_unit, 'pegawai', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_esurat on auth.users;
create trigger on_auth_user_created_esurat after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists letters_set_updated_at on public.letters;
create trigger letters_set_updated_at before update on public.letters for each row execute procedure public.set_updated_at();
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();
drop trigger if exists dispositions_set_updated_at on public.dispositions;
create trigger dispositions_set_updated_at before update on public.dispositions for each row execute procedure public.set_updated_at();

create or replace function public.log_letter_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.letter_history(letter_id,status,title,note,actor_id)
    values(new.id,new.status,'Surat diregistrasi',coalesce(new.initial_note,'Dicatat ke dalam register.'),auth.uid());
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'create','letter',new.id,jsonb_build_object('tracking_code',new.tracking_code));
  elsif new.status is distinct from old.status then
    insert into public.letter_history(letter_id,status,title,note,actor_id)
    values(new.id,new.status,'Status surat diperbarui','Status diubah menjadi '||new.status,auth.uid());
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'update_status','letter',new.id,jsonb_build_object('from',old.status,'to',new.status));
    insert into public.notifications(user_id,title,body,link)
    select distinct p.id,'Status surat diperbarui',new.tracking_code||' sekarang berstatus '||new.status,'tracking'
    from public.profiles p
    where p.status='active' and p.id <> auth.uid()
      and (
        p.id = new.created_by
        or p.role in ('admin','super_admin')
        or exists (select 1 from public.letter_access la where la.letter_id = new.id and la.user_id = p.id)
        or (new.confidentiality not in ('Rahasia','Sangat Rahasia') and (p.role = 'pimpinan' or p.unit_id in (new.origin_unit_id,new.target_unit_id)))
      );
  end if;
  return new;
end;
$$;
drop trigger if exists letters_log_changes on public.letters;
create trigger letters_log_changes after insert or update of status on public.letters
for each row execute procedure public.log_letter_change();

create or replace function public.notify_disposition_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare code text;
begin
  select tracking_code into code from public.letters where id=new.letter_id;
  -- A unit-level disposition explicitly grants access to active members of the destination unit
  -- when the letter is classified Rahasia/Sangat Rahasia.
  insert into public.letter_access(letter_id,user_id,granted_by)
  select new.letter_id,p.id,new.from_user_id
  from public.profiles p join public.letters l on l.id=new.letter_id
  where l.confidentiality in ('Rahasia','Sangat Rahasia')
    and p.unit_id=new.to_unit_id and p.status='active' and p.id<>new.from_user_id
  on conflict (letter_id,user_id) do nothing;
  insert into public.notifications(user_id,title,body,link)
  select p.id,'Disposisi surat baru','Ada disposisi untuk '||coalesce(code,'surat')||': '||new.instruction,'dispositions'
  from public.profiles p where p.unit_id=new.to_unit_id and p.status='active' and p.id<>new.from_user_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'create','disposition',new.id,jsonb_build_object('letter_id',new.letter_id,'to_unit_id',new.to_unit_id));
  return new;
end;
$$;
drop trigger if exists dispositions_notify on public.dispositions;
create trigger dispositions_notify after insert on public.dispositions
for each row execute procedure public.notify_disposition_created();

create or replace function public.notify_task_assignee()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.notifications(user_id,title,body,link)
  values(new.assigned_to,'Tugas baru ditugaskan',new.title,'tasks');
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'create','task',new.id,jsonb_build_object('assigned_to',new.assigned_to,'unit_id',new.unit_id));
  return new;
end;
$$;
drop trigger if exists tasks_notify_assignee on public.tasks;
create trigger tasks_notify_assignee after insert on public.tasks
for each row execute procedure public.notify_task_assignee();

-- RLS is mandatory: the browser contains only a publishable key, never a service-role key.
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.letters enable row level security;
alter table public.letter_access enable row level security;
alter table public.letter_history enable row level security;
alter table public.dispositions enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

 drop policy if exists units_read_all on public.units;
create policy units_read_all on public.units for select to anon, authenticated using (true);

drop policy if exists profiles_read_scope on public.profiles;
create policy profiles_read_scope on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin_user() or (public.is_active_user() and unit_id = public.current_profile_unit_id()));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user() and (role in ('pegawai','asdep','pimpinan') or public.is_super_admin_user()));

-- Admin and leadership can read across units; other active accounts are restricted to their unit.
-- Secret / top-secret letters additionally require an explicit letter_access grant (or creator/admin).
drop policy if exists letters_read_scope on public.letters;
create policy letters_read_scope on public.letters for select to authenticated using (public.can_access_letter(id));
drop policy if exists letters_insert_scope on public.letters;
create policy letters_insert_scope on public.letters for insert to authenticated
with check (public.is_active_user() and created_by = auth.uid() and (public.is_admin_user() or origin_unit_id = public.current_profile_unit_id()));
drop policy if exists letters_update_scope on public.letters;
create policy letters_update_scope on public.letters for update to authenticated
using (public.can_access_letter(id)) with check (public.can_access_letter(id));
drop policy if exists letters_delete_admin on public.letters;
create policy letters_delete_admin on public.letters for delete to authenticated using (public.is_admin_user());

drop policy if exists letter_access_read on public.letter_access;
create policy letter_access_read on public.letter_access for select to authenticated using (user_id = auth.uid() or public.is_admin_user());
drop policy if exists letter_access_admin_insert on public.letter_access;
create policy letter_access_admin_insert on public.letter_access for insert to authenticated with check (public.is_admin_user() and granted_by = auth.uid());
drop policy if exists letter_access_admin_update on public.letter_access;
create policy letter_access_admin_update on public.letter_access for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user() and granted_by = auth.uid());
drop policy if exists letter_access_admin_delete on public.letter_access;
create policy letter_access_admin_delete on public.letter_access for delete to authenticated using (public.is_admin_user());

drop policy if exists history_read_scope on public.letter_history;
create policy history_read_scope on public.letter_history for select to authenticated using (public.can_access_letter(letter_id));
-- No client INSERT policy on letter_history: history rows are written only by database triggers.

drop policy if exists dispositions_read_scope on public.dispositions;
create policy dispositions_read_scope on public.dispositions for select to authenticated using (public.can_access_letter(letter_id));
drop policy if exists dispositions_insert_scope on public.dispositions;
create policy dispositions_insert_scope on public.dispositions for insert to authenticated
with check (public.is_active_user() and from_user_id = auth.uid() and public.can_access_letter(letter_id));
drop policy if exists dispositions_update_scope on public.dispositions;
create policy dispositions_update_scope on public.dispositions for update to authenticated
using (public.is_admin_user() or from_user_id = auth.uid() or to_unit_id = public.current_profile_unit_id())
with check (public.is_admin_user() or from_user_id = auth.uid() or to_unit_id = public.current_profile_unit_id());

drop policy if exists tasks_read_scope on public.tasks;
create policy tasks_read_scope on public.tasks for select to authenticated
using (public.is_admin_user() or public.current_profile_role() = 'pimpinan' or created_by = auth.uid() or assigned_to = auth.uid() or (public.is_active_user() and unit_id = public.current_profile_unit_id()));
drop policy if exists tasks_insert_scope on public.tasks;
create policy tasks_insert_scope on public.tasks for insert to authenticated
with check (public.is_active_user() and created_by = auth.uid() and (public.is_admin_user() or unit_id = public.current_profile_unit_id())
  and (public.is_admin_user() or exists (select 1 from public.profiles p where p.id = assigned_to and p.status='active' and p.unit_id = public.current_profile_unit_id()))
  and (letter_id is null or public.can_access_letter(letter_id)));
drop policy if exists tasks_update_scope on public.tasks;
create policy tasks_update_scope on public.tasks for update to authenticated
using (public.is_admin_user() or created_by = auth.uid() or assigned_to = auth.uid())
with check (public.is_admin_user() or created_by = auth.uid() or assigned_to = auth.uid());
drop policy if exists tasks_delete_admin on public.tasks;
create policy tasks_delete_admin on public.tasks for delete to authenticated using (public.is_admin_user());

drop policy if exists documents_read_scope on public.documents;
create policy documents_read_scope on public.documents for select to authenticated using (public.can_access_letter(letter_id));
drop policy if exists documents_insert_scope on public.documents;
create policy documents_insert_scope on public.documents for insert to authenticated
with check (uploaded_by = auth.uid() and public.can_access_letter(letter_id));
drop policy if exists documents_delete_scope on public.documents;
create policy documents_delete_scope on public.documents for delete to authenticated
using (public.is_admin_user() or uploaded_by = auth.uid());

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists audit_read_scope on public.audit_logs;
create policy audit_read_scope on public.audit_logs for select to authenticated using (public.is_admin_user() or actor_id = auth.uid());

-- Private Storage bucket for archive attachments. Object path format: <letter_uuid>/<timestamp>-<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('surat-arsip','surat-arsip',false,10485760,array['application/pdf','image/png','image/jpeg','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=false, file_size_limit=10485760;

drop policy if exists archive_objects_read on storage.objects;
create policy archive_objects_read on storage.objects for select to authenticated
using (bucket_id='surat-arsip' and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_letter(split_part(name,'/',1)::uuid));
drop policy if exists archive_objects_insert on storage.objects;
create policy archive_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='surat-arsip' and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_letter(split_part(name,'/',1)::uuid));
drop policy if exists archive_objects_delete on storage.objects;
create policy archive_objects_delete on storage.objects for delete to authenticated
using (bucket_id='surat-arsip' and (public.is_admin_user() or owner_id = auth.uid()));

-- Required table privileges (RLS policies still decide which rows are accessible).
grant select on public.units to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.letters to authenticated;
grant select, insert, update, delete on public.letter_access to authenticated;
grant select on public.letter_history to authenticated;
grant select, insert on public.dispositions to authenticated;
revoke update on public.dispositions from authenticated;
grant update (status) on public.dispositions to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, delete on public.documents to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;

-- After registering your own first account, promote it manually in SQL Editor:
-- update public.profiles set role='super_admin', status='active',
--   unit_id=(select id from public.units where code='SEKRETARIAT')
-- where email='EMAIL-ADMIN-KAMU';
-- Never expose the Supabase service_role/secret key in frontend code.

-- Restrict browser-side updates to the fields exposed by this test UI.
revoke update on public.letters from authenticated;
grant update (status) on public.letters to authenticated;
revoke update on public.tasks from authenticated;
grant update (status) on public.tasks to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
