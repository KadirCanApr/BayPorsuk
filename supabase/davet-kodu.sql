-- ============================================================
-- Bay Porsuk — Davet kodu ile kayıt
-- ------------------------------------------------------------
-- NE İŞE YARAR
-- E-posta doğrulaması kapatıldığında site adresini bilen herkes
-- hesap açabilir hâle geliyor. Bu dosya kaydı bir davet koduna
-- bağlar: kodu bilmeyen kaydolamaz.
--
-- NEDEN GÜVENLİ
-- Kod istemcide DEĞİL, veritabanındaki handle_new_user
-- tetikleyicisinde doğrulanır. Kaynağı okuyan biri kontrolü
-- atlayamaz; kodsuz gelen kayıt isteği veritabanı seviyesinde
-- hata verir ve auth kaydı da geri alınır.
--
-- KULLANIM
-- 1) SQL Editor'e bu dosyanın tamamını yapıştır → Run
-- 2) Aşağıdaki son bölümden kendi kodunu ekle
-- 3) Kodu arkadaşlarına ilet
-- ============================================================

-- ------------------------------------------------------------
-- 1) Davet kodları tablosu
-- ------------------------------------------------------------
create table if not exists public.invite_codes (
  code        citext primary key,
  label       text,                       -- "sinif grubu", "kaan" gibi not
  max_uses    int,                        -- null = sınırsız
  used_count  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),

  constraint invite_codes_code_len check (char_length(code) between 4 and 40)
);

alter table public.invite_codes enable row level security;

-- Kodları yalnızca admin görebilir/yönetebilir.
-- Kayıt sırasındaki doğrulama SECURITY DEFINER tetikleyici içinde
-- olduğu için bu politikaya takılmaz.
drop policy if exists invite_codes_admin on public.invite_codes;
create policy invite_codes_admin on public.invite_codes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ------------------------------------------------------------
-- 2) Kayıt tetikleyicisini davet kodu kontrolüyle değiştir
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_code     citext;
  v_row      public.invite_codes%rowtype;
begin
  -- ---------- Davet kodu ----------
  v_code := nullif(btrim(coalesce(new.raw_user_meta_data->>'invite_code', '')), '')::citext;

  if v_code is null then
    raise exception 'Kayıt için davet kodu gerekli.'
      using errcode = 'check_violation';
  end if;

  select * into v_row from public.invite_codes where code = v_code;

  if not found or not v_row.active then
    raise exception 'Davet kodu geçersiz.'
      using errcode = 'check_violation';
  end if;

  if v_row.max_uses is not null and v_row.used_count >= v_row.max_uses then
    raise exception 'Bu davet kodu kullanım sınırına ulaştı.'
      using errcode = 'check_violation';
  end if;

  update public.invite_codes
     set used_count = used_count + 1
   where code = v_code;

  -- ---------- Profil ----------
  v_username := lower(coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  ));

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


-- ------------------------------------------------------------
-- 3) KENDİ KODUNU EKLE
-- ------------------------------------------------------------
-- Aşağıdaki satırı kendi kodunla değiştirip çalıştır.
-- max_uses null bırakılırsa sınırsız kullanılır.

insert into public.invite_codes (code, label, max_uses)
values ('PORSUK2026', 'ilk arkadaş grubu', 20)
on conflict (code) do nothing;

-- Kodu sonradan kapatmak için:
--   update public.invite_codes set active = false where code = 'PORSUK2026';
--
-- Kullanım durumunu görmek için (admin oturumuyla):
--   select code, used_count, max_uses, active from public.invite_codes;
