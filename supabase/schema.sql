create extension if not exists "pgcrypto";

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  artist text not null,
  album text,
  cover_url text,
  stream_url text not null,
  source_type text not null check (source_type in ('direct', 'youtube')),
  genre text,
  mood text,
  duration_seconds integer,
  uploaded_by uuid references auth.users(id) on delete set null
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  is_public boolean not null default true,
  owner_id uuid not null references auth.users(id) on delete cascade
);

create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (playlist_id, song_id)
);

alter table public.playlist_songs add column if not exists position integer not null default 0;

alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

drop policy if exists "songs_select_all" on public.songs;
create policy "songs_select_all" on public.songs
for select using (true);

drop policy if exists "songs_insert_auth" on public.songs;
create policy "songs_insert_auth" on public.songs
for insert to authenticated
with check (auth.uid() = uploaded_by);

drop policy if exists "playlists_select_public_or_owner" on public.playlists;
create policy "playlists_select_public_or_owner" on public.playlists
for select
using (is_public or auth.uid() = owner_id);

drop policy if exists "playlists_insert_owner_only" on public.playlists;
create policy "playlists_insert_owner_only" on public.playlists
for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "playlists_update_owner_only" on public.playlists;
create policy "playlists_update_owner_only" on public.playlists
for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "playlists_delete_owner_only" on public.playlists;
create policy "playlists_delete_owner_only" on public.playlists
for delete to authenticated
using (auth.uid() = owner_id);

drop policy if exists "playlist_songs_select_public_or_owner" on public.playlist_songs;
create policy "playlist_songs_select_public_or_owner" on public.playlist_songs
for select
using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and (p.is_public or p.owner_id = auth.uid())
  )
);

drop policy if exists "playlist_songs_insert_owner_only" on public.playlist_songs;
create policy "playlist_songs_insert_owner_only" on public.playlist_songs
for insert to authenticated
with check (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.owner_id = auth.uid()
  )
);

drop policy if exists "playlist_songs_delete_owner_only" on public.playlist_songs;
create policy "playlist_songs_delete_owner_only" on public.playlist_songs
for delete to authenticated
using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.owner_id = auth.uid()
  )
);

drop policy if exists "playlist_songs_update_owner_only" on public.playlist_songs;
create policy "playlist_songs_update_owner_only" on public.playlist_songs
for update to authenticated
using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.owner_id = auth.uid()
  )
);

