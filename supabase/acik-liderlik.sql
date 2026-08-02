-- ============================================================
-- Bay Porsuk — Giriş ekranı listelerini herkese açma
-- ------------------------------------------------------------
-- NEDEN
-- Giriş ekranındaki dört panel (Kayıtlı Üyeler, En Çok Net,
-- En Aktif, En Uzun Ders) üye verisi okuyor. schema.sql'de bu
-- tablolar yalnızca giriş yapmışlara açıktı, dolayısıyla ziyaretçi
-- boş liste görüyordu ve paneller işe yaramaz hâle gelmişti.
--
-- Bu dosya profiles ve user_data tablolarına anonim OKUMA izni
-- verir. Yazma izni verilmez — kimse giriş yapmadan bir şey
-- değiştiremez.
--
-- ⚠ NE HERKESE AÇIK OLUYOR
--   • Üye adı, kullanıcı adı, yaş, sınav alanı, avatar, banner
--   • "Hakkında" açıklaması
--   • Çalışma kayıtları: denemeler, süreler, dersler, hedefler, rozetler
--
-- ✅ GİZLİ KALANLAR (değişmiyor)
--   • Günlük (user_journal) — yalnızca sahibi
--   • Mesajlar — yalnızca tarafları
--   • Arkadaşa özel gönderiler — yalnızca arkadaşlar
--   • E-posta adresleri ve şifreler — auth.users'ta, hiç açılmıyor
--
-- GERİ ALMAK İSTERSEN en alttaki bölümü çalıştır.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Profiller: anonim okuma
-- ------------------------------------------------------------
-- E-posta bu tabloda yok; auth.users'ta duruyor ve açılmıyor.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to anon, authenticated
  using (true);


-- ------------------------------------------------------------
-- 2) Çalışma verisi: anonim okuma
-- ------------------------------------------------------------
-- Liderlik tabloları buradan besleniyor. Günlük bu tabloda DEĞİL
-- (user_journal ayrı ve kapalı) — bölünmenin sebebi tam olarak buydu.
drop policy if exists user_data_select on public.user_data;
create policy user_data_select on public.user_data
  for select to anon, authenticated
  using (true);


-- ------------------------------------------------------------
-- 3) Doğrulama
-- ------------------------------------------------------------
-- Aşağıdaki listede profiles ve user_data'nın "anon" rolüne SELECT
-- izni görünmeli; user_journal, messages, posts GÖRÜNMEMELİ.
select tablename, policyname, roles, cmd
  from pg_policies
 where schemaname = 'public'
   and 'anon' = any(roles)
 order by tablename;


-- ============================================================
-- GERİ ALMA — listeleri tekrar giriş şartına bağlamak istersen
-- ------------------------------------------------------------
-- Aşağıyı ayrı bir sorguda çalıştır:
--
--   drop policy if exists profiles_select on public.profiles;
--   create policy profiles_select on public.profiles
--     for select to authenticated using (true);
--
--   drop policy if exists user_data_select on public.user_data;
--   create policy user_data_select on public.user_data
--     for select to authenticated using (true);
-- ============================================================
