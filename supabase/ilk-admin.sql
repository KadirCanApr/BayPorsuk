-- ============================================================
-- Bay Porsuk — İlk admini atama
-- ------------------------------------------------------------
-- SORUN
-- schema.sql'deki profiles_guard_role tetikleyicisi rol değişimini
-- "admin değilsen yapamazsın" diye engelliyor ve bunu auth.uid()
-- ile kontrol ediyor. Ama SQL Editor'de veya Table Editor'de oturum
-- açmış bir kullanıcı yoktur; auth.uid() NULL döner, is_admin()
-- false çıkar ve tetikleyici SENİN değişikliğini de geri alır.
--
-- Sonuç: ilk admini elle atamak mümkün olmuyordu.
--
-- ÇÖZÜM
-- Tetikleyiciye tek bir koşul ekleniyor: auth.uid() NULL ise
-- (yani istek bir tarayıcı oturumundan değil, doğrudan panelden /
-- SQL editöründen geliyorsa) değişime izin ver.
--
-- BU NEDEN GÜVENLİ?
-- Anonim tarayıcı isteklerinde de auth.uid() NULL'dur — ama onlar
-- zaten profiles tablosunun RLS politikasına takılır:
--     profiles_update_self → using (id = auth.uid() or is_admin())
-- anon için id = NULL asla doğru olmaz, is_admin() de false döner,
-- dolayısıyla UPDATE hiç satır bulamaz ve tetikleyici çalışmaz.
-- auth.uid() = NULL durumuna ancak RLS'i atlayan bir bağlantı
-- ulaşabilir; ona ulaşmak da proje sahibi olmayı gerektirir.
--
-- Yani "kullanıcı kendini admin yapamaz" kuralı aynen duruyor.
--
-- KULLANIM
-- 1) ÖNCE siteden normal şekilde kayıt ol
-- 2) Aşağıdaki 1. bölümü çalıştır (tetikleyici düzeltmesi)
-- 3) 2. bölümdeki kullanıcı adını kendi adınla değiştirip çalıştır
-- ============================================================


-- ------------------------------------------------------------
-- 1) Tetikleyici düzeltmesi
-- ------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Rol değişiyorsa VE istek bir kullanıcı oturumundan geliyorsa
  -- (auth.uid() dolu) VE o kullanıcı admin değilse → geri al.
  --
  -- auth.uid() boşsa istek panelden/SQL editöründen geliyordur;
  -- oraya erişim zaten proje sahipliği demek, izin veriyoruz.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 2) KENDİNİ ADMİN YAP
-- ------------------------------------------------------------
-- 'kullaniciadin' yerine siteye kaydolurken yazdığın kullanıcı adını
-- yaz. Emin değilsen önce şunu çalıştırıp listeye bak:
--
--     select username, full_name, role from public.profiles;

update public.profiles
   set role = 'admin'
 where username = 'kullaniciadin';


-- ------------------------------------------------------------
-- 3) Doğrula — role sütunu 'admin' görünmeli
-- ------------------------------------------------------------
select username, full_name, role
  from public.profiles
 order by created_at;
