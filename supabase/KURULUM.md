# Supabase Kurulumu — Bay Porsuk

Bu belge siteyi localStorage'dan gerçek bir veritabanına taşımak için
yapman gerekenleri anlatır. Ücret yok; Supabase ücretsiz katmanı ve
GitHub Pages yeterli.

---

## 1. Supabase projesini aç

1. [supabase.com](https://supabase.com) → **Start your project** → GitHub ile giriş
2. **New project**
   - **Name:** `bay-porsuk`
   - **Database Password:** güçlü bir şifre üret ve **bir yere kaydet**
     (bu şifre veritabanının kök şifresi — siteye konmayacak, sana lazım olacak)
   - **Region:** `Central EU (Frankfurt)` — Türkiye'ye en yakın olan
3. Proje hazırlanması 1–2 dakika sürer.

## 2. Şemayı kur

1. Sol menü → **SQL Editor** → **New query**
2. `schema.sql` dosyasının **tamamını** yapıştır → **Run**
3. "Success. No rows returned" görmelisin.

Dosya tekrar çalıştırılabilir yazıldı; bir şey değişirse yeniden çalıştırabilirsin.

## 2b. Kurulumu doğrula

Tarayıcıda `supabase/tani.html` sayfasını aç. Bağlantıyı, 9 tabloyu,
işlevleri, RLS'in gerçekten uygulandığını ve depolama kovasını
tek tek sınar; eksik varsa hangisi olduğunu söyler.

Her şey yeşil olmadan kod geçişine başlama.

> **Neden bu kadar dolambaçlı kontroller var?**
> Supabase istemcisinin üç çağrısı da bu iş için yanıltıcı:
>
> | Çağrı | Sorun |
> |---|---|
> | `select(..., { head: true })` | HEAD isteğinde gövde dönmediği için olmayan tablo **başarılı** görünür (yanlış yeşil) |
> | `storage.from(x).list()` | Olmayan kovada da boş dizi döner, hata vermez (yanlış yeşil) |
> | `storage.getBucket(x)` | `storage.buckets` tablosunun kendi RLS'i yüzünden **var olan** kovaya bile "Bucket not found" der (yanlış kırmızı) |
>
> Tanı bunun yerine gerçek `select` + `status` kontrolü, ve kova için
> herkese açık nesne uç noktasını kullanır: kova varsa `NoSuchKey`,
> yoksa `NoSuchBucket` döner — tek güvenilir ayrım bu.

## 3. E-posta doğrulamayı KAPAT

Sol menü → **Authentication** → **Sign In / Providers** → **Email**

- **Confirm email:** **KAPAT**

Sebebi: Supabase'in ücretsiz katmandaki yerleşik mail göndericisi saatte
yalnızca birkaç mail yolluyor ve çoğu spam klasörüne düşüyor. Küçük bir
grup için bile pratikte çalışmıyor.

Kapatınca kayıt olan kişi anında giriş yapmış olur; kod iki durumu da
destekliyor, ek değişiklik gerekmez.

Sonra **Authentication → URL Configuration**:

- **Site URL:** `https://KULLANICIADIN.github.io/DEPO-ADI/`
- **Redirect URLs:** aynı adresi ekle, yerelde denemek için
  `http://localhost:8123/**` satırını da ekle

> **İleride mail doğrulama istersen:** **Authentication → Emails →
> SMTP Settings** bölümünden ücretsiz bir SMTP servisi (Brevo, Resend)
> bağlayıp "Confirm email" ayarını geri açman yeterli. Kodda bir şey
> değişmez.

### ⚠ Kayıt artık herkese açık

Doğrulama kapalıyken **site adresini bilen herkes hesap açabilir.**
Daha önce bunu admin onayı ya da mail doğrulaması engelliyordu; şimdi
engelleyen bir şey yok. GitHub Pages adresi herkese açık olduğu için
bu gerçek bir risk.

Çözüm hazır: `davet-kodu.sql` dosyasını çalıştırırsan kayıt olmak için
bir davet kodu şart olur ve kod **veritabanı tarafında** doğrulanır —
istemciden atlatılamaz. Ayrıntı o dosyanın başında.

## 4. Anahtarları al

Sol menü → **Project Settings** → **API**

Bana şu ikisini ver:

| Alan | Örnek | Gizli mi? |
|---|---|---|
| **Project URL** | `https://abcdefgh.supabase.co` | Hayır, siteye gömülecek |
| **anon public** | `eyJhbGciOi...` (uzun) | Hayır, siteye gömülecek |

**`service_role` anahtarını kimseye verme** — ne bana, ne siteye. O anahtar
RLS'i tamamen atlar; sızarsa tüm veritabanı açılır. Veritabanı şifreni de
paylaşma.

### "anon key herkese açıksa güvenlik nerede?"

Bu anahtar bir şifre değil, sadece "hangi projeye bağlanıyorum" bilgisi.
Güvenliği **RLS politikaları** sağlıyor: anahtarla bağlanan biri bile
yalnızca kendi görme hakkı olan satırları çekebilir. Örneğin arkadaşa
özel bir gönderiyi, arkadaş olmayan biri anahtarla doğrudan API'ye
sorsa bile veritabanı o satırı göndermez.

## 5. İlk admin hesabını yap

1. Siteden normal şekilde kayıt ol, mailindeki bağlantıyı onayla
2. Supabase → **Table Editor** → `profiles` tablosu
3. Kendi satırını bul, `role` sütununu `uye` → `admin` yap → kaydet

Bundan sonra admin atamalarını site içinden yapabilirsin.

> Bunu elle yapmak zorundasın çünkü şemadaki `profiles_guard_role`
> tetikleyicisi kimsenin kendini admin yapmasını engelliyor —
> ilk adminin dışarıdan konması gerekiyor. Kurulumdaki bu tek elle
> adım, "kendini admin yapma" açığının tamamen kapalı olmasının bedeli.

---

## Neler değişiyor

### Kalkanlar

| Şu anki hâli | Yerine |
|---|---|
| `GATE_HASH` admin kapı kodu (`script.js`) | **Silinecek.** Rol veritabanında, kod diye bir şey kalmıyor |
| `YKS.Crypto` kendi hash fonksiyonu | Supabase Auth (sunucuda bcrypt) |
| `yks.users.v1` vb. localStorage anahtarları | Postgres tabloları |
| Başvuru + admin onayı akışı | E-posta doğrulama (senin seçimin) |
| Görsellerin base64 saklanması | Supabase Storage |
| `likeLog` alanı | `post_likes.created_at` |

### Aynen kalanlar

17 HTML sayfasının tamamı, tüm CSS, rozet motoru, istatistikler,
dersler, denemeler, sayaç, hedefler, günlük mantığı. Bunlar `user.data`
üzerinde çalışıyor; o blok `user_data.data` jsonb sütununa taşındığı
için kodları değişmiyor.

---

## Geçiş planı

Ölçtüğüm rakamlar: veri katmanına **258 çağrı** var, 18 dosyada.
Bunların **66'sı yazma** (async olmak zorunda), **192'si okuma**.

Okumaları async yapmamak için şöyle kuracağım: sayfa açılışında gereken
veri **bir kez** çekilip bellekte tutulur, okuma metotları o önbellekten
senkron okumaya devam eder. Yazmalar Supabase'e gider ve önbelleği
tazeler. Böylece 192 çağrıya hiç dokunmuyoruz.

Aşamalar — her birinin sonunda site **çalışır durumda** olur:

| # | Aşama | Kapsam |
|---|---|---|
| 1 | Kimlik + profiller | Gerçek kayıt/giriş, e-posta doğrulama, roller. Kapı kodu ve CAPTCHA silinir (artık gereksiz) |
| 2 | Sosyal veri | Gönderiler, arkadaşlık, mesajlar, duyurular + gerçek zamanlı yayın |
| 3 | Kişisel veri | `user.data` → `user_data.data`; günlük ayrı tabloya |
| 4 | Görseller | Avatar, banner, gönderi fotoğrafı → Storage |

### Mevcut verilerin taşınması

localStorage'daki hesaplar **taşınmayacak** — şifreler kendi hash
fonksiyonumuzla üretildiği için Supabase Auth'a aktarılamaz. Herkes
yeniden kayıt olacak. Çalışma verini (denemeler, süreler, konular)
kaybetmek istemiyorsan, geçişten önce yönetim panelindeki
**Veri yönetimi → JSON yedek al** ile dışa aktar; geçişten sonra
içe aktarma için sana küçük bir araç yazarım.

---

## Bilinmesi gerekenler

- **Ücretsiz projeler 7 gün hareketsiz kalırsa duraklatılır.** Panelden
  tek tıkla geri açılır, veri kaybolmaz. Düzenli kullanımda yaşamazsın.
- Ücretsiz katman sınırları: 500 MB veritabanı, 1 GB depolama,
  50.000 aylık aktif kullanıcı. Bir arkadaş grubu için fazlasıyla yeterli.
- Site GitHub Pages'te kalmaya devam eder; sadece veri katmanı değişir.
- Supabase JS kütüphanesi CDN'den gelecek, kurulum/derleme adımı yok —
  proje sunucusuz mimarisini koruyor.
