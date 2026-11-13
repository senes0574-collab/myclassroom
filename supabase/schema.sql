-- =====================================================================
--  MYCLASSROOM — schéma de base de données (Supabase / PostgreSQL)
--  À exécuter dans Supabase Studio > SQL Editor, en une seule fois.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('teacher', 'student', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_kind as enum ('session', 'deadline');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Profils (un par utilisateur Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'student',
  username    text,
  full_name   text not null default '',
  created_at  timestamptz not null default now()
);

create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- ---------------------------------------------------------------------
-- 3. Classes
-- ---------------------------------------------------------------------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  level       text default '',
  subject     text default '',
  school_year text default '',
  description text default '',
  color       text not null default '#2C5F8D',
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists classes_owner_idx on public.classes (owner_id);

create table if not exists public.enrollments (
  class_id   uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index if not exists enrollments_student_idx on public.enrollments (student_id);

-- ---------------------------------------------------------------------
-- 4. Contenus pédagogiques
-- ---------------------------------------------------------------------
create table if not exists public.contents (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  title          text not null,
  description    text default '',
  chapter        text default '',
  kind           text not null default 'file' check (kind in ('file', 'link')),
  storage_path   text,
  file_name      text,
  mime_type      text,
  size_bytes     bigint,
  link_url       text,
  status         public.content_status not null default 'draft',
  allow_download boolean not null default true,
  published_at   timestamptz,
  deleted_at     timestamptz,
  created_by     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists contents_class_idx on public.contents (class_id);

-- ---------------------------------------------------------------------
-- 5. Discussion
-- ---------------------------------------------------------------------
create table if not exists public.threads (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes(id) on delete cascade,
  title           text not null,
  is_announcement boolean not null default false,
  is_locked       boolean not null default false,
  created_by      uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index if not exists threads_class_idx on public.threads (class_id);

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);

create index if not exists posts_thread_idx on public.posts (thread_id);

-- ---------------------------------------------------------------------
-- 6. Planning
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  title       text not null,
  description text default '',
  kind        public.event_kind not null default 'session',
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text default '',
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists events_class_idx on public.events (class_id, starts_at);

-- ---------------------------------------------------------------------
-- 7. Fonctions d'aide (SECURITY DEFINER : évitent la récursion des RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_class_owner(cls uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes c where c.id = cls and c.owner_id = auth.uid());
$$;

create or replace function public.is_class_member(cls uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes c where c.id = cls and c.owner_id = auth.uid())
      or exists (select 1 from public.enrollments e where e.class_id = cls and e.student_id = auth.uid());
$$;

create or replace function public.shares_class(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.classes c
           join public.enrollments e on e.class_id = c.id
           where c.owner_id = auth.uid() and e.student_id = other)
      or exists (
           select 1 from public.classes c
           join public.enrollments e on e.class_id = c.id
           where c.owner_id = other and e.student_id = auth.uid())
      or exists (
           select 1 from public.enrollments e1
           join public.enrollments e2 on e1.class_id = e2.class_id
           where e1.student_id = auth.uid() and e2.student_id = other);
$$;

-- ---------------------------------------------------------------------
-- 8. Activer la RLS
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.classes     enable row level security;
alter table public.enrollments enable row level security;
alter table public.contents    enable row level security;
alter table public.threads     enable row level security;
alter table public.posts       enable row level security;
alter table public.events      enable row level security;

-- Profils -------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_class(id));

create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());

-- Classes -------------------------------------------------------------
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select
  using (owner_id = auth.uid() or public.is_class_member(id));

drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert
  with check (owner_id = auth.uid());

drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete
  using (owner_id = auth.uid());

-- Inscriptions --------------------------------------------------------
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select
  using (student_id = auth.uid() or public.is_class_owner(class_id));

drop policy if exists enrollments_insert on public.enrollments;
create policy enrollments_insert on public.enrollments for insert
  with check (public.is_class_owner(class_id));

drop policy if exists enrollments_delete on public.enrollments;
create policy enrollments_delete on public.enrollments for delete
  using (public.is_class_owner(class_id));

-- Contenus ------------------------------------------------------------
-- L'élève ne voit que les contenus publiés ; l'enseignant propriétaire voit tout.
drop policy if exists contents_select on public.contents;
create policy contents_select on public.contents for select
  using (
    deleted_at is null and (
      public.is_class_owner(class_id)
      or (status = 'published' and (published_at is null or published_at <= now())
          and public.is_class_member(class_id))
    )
  );

drop policy if exists contents_insert on public.contents;
create policy contents_insert on public.contents for insert
  with check (public.is_class_owner(class_id) and created_by = auth.uid());

drop policy if exists contents_update on public.contents;
create policy contents_update on public.contents for update
  using (public.is_class_owner(class_id)) with check (public.is_class_owner(class_id));

drop policy if exists contents_delete on public.contents;
create policy contents_delete on public.contents for delete
  using (public.is_class_owner(class_id));

-- Discussion ----------------------------------------------------------
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads for select
  using (public.is_class_member(class_id));

drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads for insert
  with check (public.is_class_member(class_id) and created_by = auth.uid());

drop policy if exists threads_update on public.threads;
create policy threads_update on public.threads for update
  using (public.is_class_owner(class_id)) with check (public.is_class_owner(class_id));

drop policy if exists threads_delete on public.threads;
create policy threads_delete on public.threads for delete
  using (public.is_class_owner(class_id) or created_by = auth.uid());

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select
  using (exists (select 1 from public.threads t where t.id = thread_id and public.is_class_member(t.class_id)));

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and public.is_class_member(t.class_id)
        and (t.is_locked = false or public.is_class_owner(t.class_id))
    )
  );

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete
  using (author_id = auth.uid()
         or exists (select 1 from public.threads t where t.id = thread_id and public.is_class_owner(t.class_id)));

-- Planning ------------------------------------------------------------
drop policy if exists events_select on public.events;
create policy events_select on public.events for select
  using (public.is_class_member(class_id));

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert
  with check (public.is_class_owner(class_id) and created_by = auth.uid());

drop policy if exists events_update on public.events;
create policy events_update on public.events for update
  using (public.is_class_owner(class_id)) with check (public.is_class_owner(class_id));

drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete
  using (public.is_class_owner(class_id));

-- ---------------------------------------------------------------------
-- 9. Création automatique du profil à l'inscription
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role  public.user_role;
  v_user  text;
  v_name  text;
begin
  v_role := case when (new.raw_user_meta_data->>'role') = 'teacher'
                 then 'teacher'::public.user_role else 'student'::public.user_role end;
  v_user := nullif(new.raw_user_meta_data->>'username', '');
  if v_user is null then
    v_user := new.email;
  end if;
  v_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, role, username, full_name)
  values (new.id, v_role, v_user, v_name)
  on conflict (id) do update set role = excluded.role;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 10. Stockage des fichiers (bucket privé « contents »)
--     Chemin : {class_id}/{content_id}/{nom_du_fichier}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('contents', 'contents', false, 52428800)
on conflict (id) do nothing;

drop policy if exists contents_files_read on storage.objects;
create policy contents_files_read on storage.objects for select
  using (bucket_id = 'contents'
         and public.is_class_member(((storage.foldername(name))[1])::uuid));

drop policy if exists contents_files_write on storage.objects;
create policy contents_files_write on storage.objects for insert
  with check (bucket_id = 'contents'
              and public.is_class_owner(((storage.foldername(name))[1])::uuid));

drop policy if exists contents_files_delete on storage.objects;
create policy contents_files_delete on storage.objects for delete
  using (bucket_id = 'contents'
         and public.is_class_owner(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- 11. Divers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists contents_touch on public.contents;
create trigger contents_touch before update on public.contents
  for each row execute function public.touch_updated_at();

-- Recharge le cache des politiques
notify pgrst, 'reload schema';
