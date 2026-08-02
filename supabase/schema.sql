-- ============================================================
-- Bay Porsuk — Supabase şeması
-- ------------------------------------------------------------
-- Supabase panelinde: SQL Editor → New query → bu dosyanın
-- tamamını yapıştır → Run.
--
-- Baştan sona bir kerede çalışır ve tekrar çalıştırılabilir
-- (drop ... if exists / create ... if not exists kullanıldı).
--
-- GÜVENLİK İLKESİ
-- Bu dosyanın en önemli kısmı tabloların kendisi değil, en
-- alttaki RLS (Row Level Security) politikalarıdır. localStorage
-- sürümünde "arkadaşa özel gönderi" tarayıcıdaki JavaScript ile
-- süzülüyordu; konsolu açan biri hepsini görebilirdi. Burada
-- süzme veritabanında yapılır — sunucu o satırı hiç göndermez.
--
-- Aynı şekilde kimse kendini admin yapamaz: rol sütununu
-- değiştirmeye çalışan güncelleme bir tetikleyiciyle geri alınır.
-- ============================================================

-- ------------------------------------------------------------
-- 0) UZANTILAR
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";        -- harf duyarsız kullanıcı adı


-- ============================================================
-- 1) PROFILLER
-- ------------------------------------------------------------
-- auth.users Supabase'in kendi tablosu; şifreler orada bcrypt
-- ile durur ve istemciye ASLA gelmez. Buradaki profiles tablosu
-- yalnızca görünen bilgileri tutar.
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     citext not null unique,
  full_name    text   not null,
  age          int,
  exam_field   text   not null default 'sayisal',
  description  text   not null default '',
  avatar_url   text,
  banner_url   text,
  role         text   not null default 'uye',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_role_check
    check (role in ('uye', 'admin')),
  constraint profiles_username_check
    check (username ~ '^[a-z0-9._-]{3,}$'),
  constraint profiles_exam_field_check
    check (exam_field in ('sayisal', 'esit-agirlik', 'sozel')),
  constraint profiles_age_check
    check (age is null or (age between 10 and 99))
);


-- ============================================================
-- 2) KULLANICI VERİSİ
-- ------------------------------------------------------------
-- Modüllerin yazdığı user.data bloğu tek bir jsonb sütununda.
-- Böylece dersler.js, exams.js, sayac.js, hedefler.js, rozetler.js
-- ve istatistik.js kodları olduğu gibi çalışmaya devam eder.
--
-- GİZLİLİK KARARI — neden ikiye bölündü:
-- Giriş ekranındaki liderlik tabloları (En Çok Net, En Aktif,
-- En Uzun Ders) BAŞKA kullanıcıların verisini okumak zorunda.
-- Ama aynı blokta Günlüğüm de vardı: ruh hâli ve serbest metin.
-- Hepsini herkese açsaydık biri API'den başkasının günlüğünü
-- okuyabilirdi. Bu yüzden günlük ayrı tabloda ve YALNIZCA
-- sahibine açık.
-- ============================================================

-- Herkese açık kısım: dersler, denemeler, sureler, hedefler,
-- rozetler, bildirim damgaları
create table if not exists public.user_data (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Yalnızca sahibine açık kısım: günlük kayıtları
create table if not exists public.user_journal (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  entries     jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);


-- ============================================================
-- 3) DUYURULAR
-- ============================================================
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.profiles(id) on delete set null,
  title       text not null,
  body        text not null,
  level       text not null default 'info',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,

  constraint announcements_level_check
    check (level in ('info', 'warn', 'danger', 'ok')),
  constraint announcements_title_len check (char_length(title) between 3 and 120),
  constraint announcements_body_len  check (char_length(body) between 1 and 4000)
);

create index if not exists announcements_created_idx
  on public.announcements (created_at desc);


-- ============================================================
-- 4) ARKADAŞLIK
-- ------------------------------------------------------------
-- Tek satır iki kişiyi bağlar. Aynı çiftin iki kez kaydolmasını
-- least/greatest üzerine kurulu tekil indeks engeller — yön
-- fark etmeksizin tek kayıt kalır.
-- ============================================================
create table if not exists public.friendships (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.profiles(id) on delete cascade,
  to_id       uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,

  constraint friendships_status_check check (status in ('pending', 'accepted')),
  constraint friendships_not_self     check (from_id <> to_id)
);

create unique index if not exists friendships_pair_idx
  on public.friendships (least(from_id, to_id), greatest(from_id, to_id));


-- ============================================================
-- 5) MESAJLAR
-- ============================================================
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.profiles(id) on delete cascade,
  to_id       uuid not null references public.profiles(id) on delete cascade,
  text        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),

  constraint messages_text_len  check (char_length(text) between 1 and 2000),
  constraint messages_not_self  check (from_id <> to_id)
);

create index if not exists messages_pair_idx
  on public.messages (least(from_id, to_id), greatest(from_id, to_id), created_at);
create index if not exists messages_unread_idx
  on public.messages (to_id) where read_at is null;


-- ============================================================
-- 6) BAYKUŞ SOCIAL
-- ------------------------------------------------------------
-- Beğeniler artık ayrı tabloda ve created_at taşıyor; böylece
-- localStorage sürümünde "beğeni ne zaman yapıldı" sorusunu
-- çözmek için eklenen likeLog alanına gerek kalmıyor.
-- ============================================================
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  text        text not null default '',
  image_url   text,
  visibility  text not null default 'public',
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,

  constraint posts_visibility_check check (visibility in ('public', 'friends')),
  constraint posts_text_len         check (char_length(text) <= 500),
  -- Metin de görsel de boşsa gönderi anlamsız
  constraint posts_not_empty        check (char_length(btrim(text)) > 0 or image_url is not null)
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx  on public.posts (author_id);

create table if not exists public.post_likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now(),

  constraint post_comments_text_len check (char_length(text) between 1 and 300)
);

create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at);


-- ============================================================
-- 7) YARDIMCI İŞLEVLER
-- ------------------------------------------------------------
-- Hepsi SECURITY DEFINER: RLS politikalarının içinden çağrıldıkları
-- için kendileri RLS'e takılmamalı. Aksi hâlde "profili okumak için
-- profili okumak" gibi sonsuz özyineleme oluşur.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (least(from_id, to_id) = least(a, b))
      and (greatest(from_id, to_id) = greatest(a, b))
  );
$$;

-- Bir gönderiyi görme hakkı — posts, post_likes ve post_comments
-- politikaları hep buradan sorar ki kural tek yerde dursun.
create or replace function public.can_see_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and (
        p.visibility = 'public'
        or p.author_id = auth.uid()
        or public.are_friends(auth.uid(), p.author_id)
        or public.is_admin()
      )
  );
$$;


-- ============================================================
-- 8) TETİKLEYİCİLER
-- ============================================================

-- 8a) Yeni kullanıcı kaydolunca profil + veri satırları açılsın.
-- Kayıt formundaki ek alanlar auth metadata olarak gelir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := lower(coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  ));

  -- Kullanıcı adı doluysa sonuna sayı ekleyerek tekilleştir
  while exists (select 1 from public.profiles where username = v_username::citext) loop
    v_username := v_username || floor(random() * 10)::text;
  end loop;

  insert into public.profiles (id, username, full_name, age, exam_field, description)
  values (
    new.id,
    v_username,
    coalesce(new.raw_user_meta_data->>'full_name', 'İsimsiz'),
    nullif(new.raw_user_meta_data->>'age', '')::int,
    coalesce(new.raw_user_meta_data->>'exam_field', 'sayisal'),
    coalesce(new.raw_user_meta_data->>'description', '')
  );

  insert into public.user_data (user_id) values (new.id);
  insert into public.user_journal (user_id) values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 8b) ROL YÜKSELTMEYE KARŞI KORUMA
-- Bu, dosyanın en kritik kuralı. Kullanıcı kendi profilini
-- güncelleyebilir; ama role sütununa dokunursa değer sessizce
-- eski hâline döner. Yalnızca mevcut bir admin rol değiştirebilir.
-- Böylece "kendini admin yapma" yolu tamamen kapanır.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();


-- 8c) Arkadaşlık kabul edilince damga
create or replace function public.touch_friendship()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    new.decided_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_touch on public.friendships;
create trigger friendships_touch
  before update on public.friendships
  for each row execute function public.touch_friendship();


-- ============================================================
-- 9) LİDERLİK TABLOLARI
-- ------------------------------------------------------------
-- Giriş ekranındaki listeler için. user_data zaten tüm giriş
-- yapmış kullanıcılara açık olduğu için bu işlevler ekstra bir
-- yetki vermiyor; sadece jsonb toplamayı sunucuda yapıp
-- istemciye hazır sonuç veriyorlar.
-- ============================================================

-- Toplam çalışma süresi (saniye) — "En Uzun Ders Süresi"
create or replace function public.leaderboard_study(limit_n int default 10)
returns table (user_id uuid, username citext, full_name text,
               avatar_url text, total_seconds numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.avatar_url,
         coalesce(sum((s->>'seconds')::numeric), 0) as total_seconds
  from public.profiles p
  join public.user_data d on d.user_id = p.id
  left join lateral jsonb_array_elements(
    case when jsonb_typeof(d.data->'sureler') = 'array'
         then d.data->'sureler' else '[]'::jsonb end
  ) s on true
  group by p.id, p.username, p.full_name, p.avatar_url
  having coalesce(sum((s->>'seconds')::numeric), 0) > 0
  order by total_seconds desc
  limit limit_n;
$$;

-- Deneme sayısı — "En Aktif Kullanıcılar"
create or replace function public.leaderboard_active(limit_n int default 10)
returns table (user_id uuid, username citext, full_name text,
               avatar_url text, exam_count int)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.avatar_url,
         coalesce(jsonb_array_length(
           case when jsonb_typeof(d.data->'denemeler') = 'array'
                then d.data->'denemeler' else '[]'::jsonb end), 0) as exam_count
  from public.profiles p
  join public.user_data d on d.user_id = p.id
  order by exam_count desc
  limit limit_n;
$$;


-- ============================================================
-- 10) ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Buradan sonrası asıl güvenlik katmanı. Her tabloda RLS açık;
-- politika yazılmayan hiçbir işlem yapılamaz (varsayılan: reddet).
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.user_data     enable row level security;
alter table public.user_journal  enable row level security;
alter table public.announcements enable row level security;
alter table public.friendships   enable row level security;
alter table public.messages      enable row level security;
alter table public.posts         enable row level security;
alter table public.post_likes    enable row level security;
alter table public.post_comments enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);                      -- herkes birbirini görebilsin

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
  -- role sütunu ayrıca 8b tetikleyicisiyle korunuyor

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ---------- user_data (herkese açık okuma) ----------
drop policy if exists user_data_select on public.user_data;
create policy user_data_select on public.user_data
  for select to authenticated
  using (true);

drop policy if exists user_data_write_self on public.user_data;
create policy user_data_write_self on public.user_data
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_data_insert_self on public.user_data;
create policy user_data_insert_self on public.user_data
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------- user_journal (YALNIZCA sahibi) ----------
drop policy if exists journal_all_self on public.user_journal;
create policy journal_all_self on public.user_journal
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- announcements ----------
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (true);

drop policy if exists announcements_write_admin on public.announcements;
create policy announcements_write_admin on public.announcements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- friendships ----------
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or public.is_admin());

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (from_id = auth.uid() and status = 'pending');

-- Yalnızca isteği ALAN kişi kabul edebilir
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update to authenticated
  using (to_id = auth.uid())
  with check (to_id = auth.uid());

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or public.is_admin());

-- ---------- messages ----------
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or public.is_admin());

-- Yalnızca arkadaşına mesaj atabilirsin
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (from_id = auth.uid() and public.are_friends(auth.uid(), to_id));

-- "Okundu" işaretini yalnızca alıcı koyar
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (to_id = auth.uid())
  with check (to_id = auth.uid());

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete to authenticated
  using (from_id = auth.uid() or public.is_admin());

-- ---------- posts ----------
-- Görünürlüğün gerçekten uygulandığı yer burası
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated
  using (
    visibility = 'public'
    or author_id = auth.uid()
    or public.are_friends(auth.uid(), author_id)
    or public.is_admin()
  );

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ---------- post_likes ----------
drop policy if exists post_likes_select on public.post_likes;
create policy post_likes_select on public.post_likes
  for select to authenticated
  using (public.can_see_post(post_id));

drop policy if exists post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_post(post_id));

drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------- post_comments ----------
drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments
  for select to authenticated
  using (public.can_see_post(post_id));

drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_post(post_id));

-- Yorumu: yazarı, gönderinin sahibi ve admin silebilir
drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.posts p
               where p.id = post_id and p.author_id = auth.uid())
  );


-- ============================================================
-- 11) DEPOLAMA (Storage)
-- ------------------------------------------------------------
-- Avatar, banner ve gönderi görselleri. Görseller artık base64
-- olarak veritabanında değil, dosya olarak burada durur —
-- localStorage'ın 5 MB sınırı tamamen ortadan kalkar.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('medya', 'medya', true)
on conflict (id) do nothing;

drop policy if exists medya_select on storage.objects;
create policy medya_select on storage.objects
  for select to public
  using (bucket_id = 'medya');

-- Herkes yalnızca kendi klasörüne yazabilir: medya/<user_id>/...
drop policy if exists medya_insert on storage.objects;
create policy medya_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medya'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists medya_update on storage.objects;
create policy medya_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'medya'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists medya_delete on storage.objects;
create policy medya_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medya'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );


-- ============================================================
-- 12) GERÇEK ZAMANLI YAYIN
-- ------------------------------------------------------------
-- Mesaj, gönderi ve bildirimlerin anında görünmesi için.
-- RLS yayında da geçerlidir: kimse görme hakkı olmayan bir
-- satırın değişikliğini almaz.
-- ============================================================
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.announcements;
