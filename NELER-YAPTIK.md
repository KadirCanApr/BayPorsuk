# Bay Porsuk — Çalışma Defteri

Bu dosya projede ne yaptığımızın kaydı. Yeni bir şey ekledikçe
buraya da yazılır. Amaç: aylar sonra açıp "burada ne olmuştu,
neden böyle yapmıştık" sorusuna cevap bulabilmek.

---

## Hızlı Referans

| Ne | Nerede |
|---|---|
| Site | https://kadircanapr.github.io/BayPorsuk/ |
| GitHub deposu | https://github.com/KadirCanApr/BayPorsuk |
| Supabase paneli | https://supabase.com/dashboard/project/afpnlvphotqbqguuhkom |
| SQL Editor | .../sql/new |
| Kullanıcı listesi | .../editor → `profiles` tablosu |
| Kurulum kılavuzu | `supabase/KURULUM.md` |
| Sistem tanısı | `supabase/tani.html` |

**Admin hesabı:** `kcanapr`

**Değişiklikleri GitHub'a gönderme:**
```bash
git add . ; git commit -m "ne yaptiysan yaz" ; git push
```

---

## Şu Anki Durum

### ✅ Çalışanlar (ortak veritabanı — herkes birbirini görüyor)

- **Giriş / kayıt** — Supabase Auth, şifreler sunucuda bcrypt ile
- **Profiller** — ad, yaş, sınav alanı, avatar, banner, açıklama
- **Roller** — üye / admin, kimse kendini admin yapamıyor
- **Rozetler** — 100 rozet, K.C.A ders ustalığı başarımları
- **Çalışma verisi** — dersler, denemeler, süreler, hedefler
- **Günlük** — ayrı tabloda, yalnızca sahibi görüyor
- **İstatistikler, netler, ilerleme, sayaç**

### ⚠️ Henüz localStorage'da (kişiler arasında paylaşılmıyor)

- Baykuş Social (gönderiler)
- Arkadaşlık
- Mesajlaşma
- Duyurular

Bunlar **2. aşamada** taşınacak. Şu an herkes kendi tarayıcısındakini
görüyor; veritabanı tabloları hazır ama kod henüz bağlanmadı.

### 🌐 Herkese açık olanlar (bilinçli karar)

`supabase/acik-liderlik.sql` çalıştırıldıysa giriş ekranındaki dört
panel ziyaretçiye de görünür. Bunun için şunlar internete açıktır:

- Üye adı, kullanıcı adı, yaş, sınav alanı, avatar, banner, açıklama
- Çalışma kayıtları: denemeler, süreler, dersler, hedefler, rozetler

**Gizli kalanlar:** günlük (`user_journal`), mesajlar, arkadaşa özel
gönderiler, e-posta adresleri, şifreler.

Geri almak istersen o dosyanın sonundaki blok var.

**Neden gerekti:** RLS'ten sonra paneller boş kalıyordu ama "Henüz
kayıtlı üye yok" yazıyordu — üye vardı, ziyaretçi göremiyordu. İki
seçenek vardı: listeleri üye alanına taşımak ya da herkese açmak.
İkincisi seçildi.

### 🔓 Açık kalan güvenlik konusu

E-posta doğrulaması kapalı (ücretsiz katmanda mail göndericisi
çalışmıyordu). Bu yüzden **site adresini bilen herkes kayıt olabiliyor.**

Çözüm hazır: `supabase/davet-kodu.sql` çalıştırılırsa kayıt bir davet
koduna bağlanır ve kod veritabanında doğrulanır. Henüz uygulanmadı.

---

## Yapılanlar

### 1. Rozetler modülü

`rozetler.html` · `rozetler.css` · `rozetler.js`

**100 rozet**, 8 grup: Çalışma (16), Kararlılık (10), Denemeler (13),
Müfredat (12), Hedefler (11), Günlük (11), Özel (12), K.C.A (15).

**Temel tasarım kararı:** modül veri üretmiyor. İlerleme her açılışta
diğer modüllerin verisinden yeniden hesaplanıyor. Sayaç saklansaydı
kullanıcı bir kaydı silince sayaç yanlış kalırdı.

Saklanan tek şey rozetin **ilk kazanıldığı an** (`user.data.rozetler`).
Bu olmadan kazanma tarihi gösterilemez ve "yeni rozet" bildirimi her
açılışta tekrar ederdi.

**Kural:** kazanılan rozet geri alınmaz. Kullanıcı eski verisini silse
bile madalya sönmüyor.

#### K.C.A Başarımları

Dört metal seviyenin üstünde duran imza seviyesi. Bir **ders dalının
bütün konuları** bitince veriliyor — Kimya'nın hem TYT hem AYT konuları
biterse "Kimyager" açılıyor, sadece TYT yetmiyor.

14 dal + hepsini isteyen "K.C.A Ustası". Hedef müfredattan okunuyor,
kart "53 / 112 konu · %47" gibi gerçek ilerleme gösteriyor.

#### Yakalanan hatalar

- **Sıfır hedefli rozet kendini açıyordu.** Müfredat kataloğu yüklü
  olmayan sayfalarda hedef 0 oluyordu ve `0 >= 0` doğru olduğu için
  15 rozet birden açılacaktı. "Hedef 0 ise asla açma" kuralı eklendi.
- **`data.dersler` dizi olarak başlıyor.** `dersler.js` açılışta nesneye
  çeviriyor ama rozetler bu alanı bağımsız okuyor; kullanıcı Dersler
  sayfasını hiç açmadıysa müfredat rozetleri sessizce 0 kalıyordu.

---

### 2. Baykuş Social

`sosyal.html` · `sosyal.css` · `sosyal.js`

Yol haritasındaki **"Dosya Paylaşımı"** yerine yapıldı.

**Neden dosya paylaşımı iptal edildi:** sunucusuz mimaride dosyalar
base64 olarak saklanacaktı (%33 şişme). Tek bir PDF 2-5 MB; iki dosya
yüklenince kota biter ve **kullanıcı hesapları da yazılamaz hâle gelir.**
Yani sadece kendi modülünü değil tüm uygulamayı riske atıyordu.

Sosyal akış ise çoğunlukla metin: 280 karakterlik gönderi ~0,5 KB,
yani 2.000 gönderi ≈ 1 MB.

**Ölçülen fotoğraf maliyetleri** (gerçekçi içerikle):

| Boyut | data-URL |
|---|---|
| 1200×900 q0.82 | 185 KB |
| **800×600 q0.75** (seçilen) | **60 KB** |
| 600×450 q0.7 | 31 KB |

Tarayıcı kotası ölçüldü: en az 12 MB.

**Özellikler:** gönderi (metin + tek görsel), beğeni, yorum, düzenleme,
silme, rozet paylaşma, Tümü/Arkadaşlarım süzgeci.

**Görünürlük:** yazar her gönderide "Herkes" ya da "Arkadaşlarım"
seçiyor. Bu okuyucunun süzgecinden farklı bir şey — biri *kimin
görmeye hakkı var*, diğeri *okuyucu neyi görmek istiyor*.

---

### 3. Giriş ekranı sadeleştirmesi

- "Oturumu Hatırla" animasyonlu kartı → klasik onay kutusu
  (`login.css`'ten 120 satır ölü kod silindi)
- 3 hatalı girişten sonra CAPTCHA eklendi
  *(Supabase geçişinde kaldırıldı — kaba kuvvet koruması artık sunucuda)*

---

### 4. Bildirimler

Ayrı sayfa değil, üye panelinde **sol sütun**. Giriş ekranındaki liste
yığınının yerini alıyor.

Bu katman da türetilmiş — beş kaynaktan okuyor:

| Kaynak | Bildirim |
|---|---|
| Arkadaşlık | "X sana istek gönderdi" |
| Mesajlar | "X sana N okunmamış mesaj gönderdi" |
| Duyurular | "Yeni duyuru: …" |
| Gönderiler | "X gönderini beğendi / yorum yaptı" |
| Rozetler | "Y rozetini kazandın" |

**Silme:** kaynağı yok etmiyor (arkadaşlık isteği yerinde kalıyor),
sadece listeden gizliyor. Tek tek (×) ve toplu (Temizle) iki yol var.

---

### 5. GitHub yayını öncesi denetim

Yayına almadan önce tam tarama yapıldı:

- 17 sayfa, 138 yerel kaynak → hepsi çözülüyor
- **Büyük/küçük harf uyumu** — GitHub Linux'ta duyarlı, Windows değil.
  Birebir karşılaştırıldı, temiz.
- Mutlak yol yok → alt dizinde de çalışır
- 19 JS dosyası sözdizimi → hatasız
- 16 sayfa gerçekten çalıştırıldı → çalışma zamanı hatası yok

**Ortaya çıkan temel sorun:** localStorage yüzünden her ziyaretçi kendi
tarayıcısında yapayalnızdı. Site açılıyordu ama çok kullanıcılı hiçbir
şey işlemiyordu. Bu, Supabase'e geçiş kararını doğurdu.

---

### 6. Supabase geçişi — 1. Aşama

#### Veritabanı

`supabase/schema.sql` — 9 tablo, **31 RLS politikası**, 8 işlev,
3 tetikleyici.

| Tablo | İçerik |
|---|---|
| `profiles` | Görünen kullanıcı bilgileri |
| `user_data` | Çalışma verisi (herkese açık okuma) |
| `user_journal` | Günlük (**yalnızca sahibi**) |
| `announcements`, `friendships`, `messages` | 2. aşama |
| `posts`, `post_likes`, `post_comments` | 2. aşama |

**Gizlilik kararı:** `user.data` ikiye bölündü. Liderlik tabloları
başkalarının verisini okumak zorunda, ama aynı blokta Günlüğüm de vardı
(ruh hâli, serbest metin). Hepsi herkese açılsaydı biri API'den
başkasının günlüğünü okuyabilirdi.

**Güvenlik:** eski `GATE_HASH` admin kapı kodu ve kendi hash
fonksiyonumuz (`YKS.Crypto`) tamamen silindi. Rol artık veritabanında
ve `profiles_guard_role` tetikleyicisi kimsenin kendini admin yapmasını
engelliyor.

Anonim istemciyle saldırı denemesi yapıldı: profil/günlük/mesaj okuma
0 satır döndü, gönderi/duyuru/profil yazma `42501 RLS ihlali` ile
engellendi.

#### Kod tarafı

Ölçüm: veri katmanına **258 çağrı**, 18 dosyada. **66 yazma**,
**192 okuma**.

**Çözüm — önbellek + hazır kapısı:** sayfa açılışında oturum ve
profiller bir kez çekiliyor, okuma metotları oradan senkron okumaya
devam ediyor. Böylece 192 çağrıya hiç dokunulmadı. Sayfalar
`DOMContentLoaded` yerine `YKS.hazir()` kullanıyor.

`Users.update()` bir Promise döndürüyor ama üstüne iyimser bir
`.ok = true` de koyuyor — eski senkron çağıranlar çalışmaya devam
ediyor, yeni çağıranlar `.then()` ile gerçek sonucu alıyor.

#### Yakalanan hatalar

- **Parçacık animasyonu hiç çalışmıyormuş.** `canvas.clientWidth = ...`
  — o özellik salt okunur, `"use strict"` altında hata atıyor. Yıllardır
  sessizce kayboluyordu, hazır kapısının try/catch'i ortaya çıkardı.
- **Tanı sayfası 3 yanlış sonuç verdi.** Supabase istemcisinin üç
  çağrısı da bu iş için yanıltıcı:
  - `select(..., {head:true})` → olmayan tabloyu "var" gösteriyor
  - `storage.list()` → olmayan kovada da boş dizi dönüyor
  - `storage.getBucket()` → RLS yüzünden **var olan** kovaya "yok" diyor
- **İlk admini atamak imkânsızdı.** `profiles_guard_role` rolü
  `auth.uid()` ile denetliyor; SQL Editor'de oturum olmadığı için
  `auth.uid()` boş dönüyor ve tetikleyici panelden yapılan değişikliği
  de geri alıyordu. `supabase/ilk-admin.sql` bunu düzeltti.
- **`schema.sql` tekrar çalıştırılamıyordu.** 12. bölümdeki
  `alter publication ... add table` zaten ekli tabloda hata verip tüm
  betiği geri alıyordu. Kontrollü döngüye çevrildi.

#### E-posta doğrulaması

Önce açıktı, sonra **kapatıldı**: Supabase'in ücretsiz katmandaki mail
göndericisi saatte birkaç mail yolluyor ve çoğu spam'e düşüyor, pratikte
çalışmıyor. Kod iki durumu da destekliyor — ileride SMTP bağlanırsa
panelden tek anahtarla geri açılır.

---

## Sırada Ne Var

### 2. Aşama — Sosyal veri (bir sonraki iş)

`announcements`, `friendships`, `messages`, `posts` tablolarına bağlanma
+ gerçek zamanlı yayın. Bitince Baykuş Social, arkadaşlık, mesajlaşma
ve duyurular da kişiler arasında paylaşılır.

### 3. Aşama — Görseller

Avatar, banner ve gönderi fotoğrafları base64 yerine Supabase
Storage'a. `medya` kovası hazır.

### Ayrıca

- Davet kodunu aç (`supabase/davet-kodu.sql`)
- `README.md`'nin dosya yapısı listesi eski — yeni modülleri saymıyor

---

## Bilinmesi Gerekenler

- **Supabase ücretsiz projeler 7 gün hareketsizlikte duraklatılır.**
  Panelden tek tıkla döner, veri kaybolmaz.
- `sb.js` içindeki anahtar **gizli değil**, öyle tasarlanmış. Güvenliği
  RLS sağlıyor. Gizli olan `service_role` anahtarı hiçbir yerde yok.
- Eski localStorage hesapları taşınamaz — şifreler kendi hash
  fonksiyonumuzla üretilmişti, Supabase Auth'a aktarılamıyor.
- Ücretsiz katman sınırları: 500 MB veritabanı, 1 GB depolama,
  50.000 aylık aktif kullanıcı.
