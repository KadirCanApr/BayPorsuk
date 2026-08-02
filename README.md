# Bay Porsuk - YKS & KPSS Sınav Destek Asistanı

Sunucusuz (HTML + CSS + JavaScript) çalışan giriş sistemi ve yönetim paneli.
GitHub Pages üzerinde doğrudan yayınlanabilir.

## Özellikler

### Üye Kayıt Sistemi
- Kullanıcılar `register.html` üzerinden başvuru yapabilir
- E-posta zorunlu ve yalnızca Gmail, Hotmail, Yandex kabul edilir
- Şifre doğrulama sistemi
- Başvurular "bekliyor" durumunda admin panelinde görünür

### Admin Panel
- **Üyelik Başvuruları** bölümünden:
  - Bekleyen başvuruları görüntüleme
  - Başvuruları onaylama (hesap otomatik oluşur)
  - Başvuruları reddetme (gerekçe ile)
  - Onaylanan/reddedilen başvuru kayıtlarını silme
- Bekleyen başvuru sayısı kenar çubuğunda badge ile gösterilir
- **Hesap Oluştur** ile doğrudan hesap açma (e-posta opsiyonel)
- **Kullanıcılar** listesinde tüm kayıtlı hesaplar
- **Veri Yönetimi** ile yedekleme/geri yükleme

### Giriş Sistemi
- Kullanıcı adı + şifre ile giriş
- Başvurusu bekleyen kişi giriş yapmaya çalışırsa bilgilendirilir
- Başvurusu reddedilen kişiye red gerekçesi gösterilir
- Gizli admin kapısı (kod ile panel erişimi)

### Profil Yönetimi
- **Profil Ayarları Sayfası** (`profile.html`):
  - Kişisel bilgileri düzenleme (Ad Soyad, Yaş, Sınav Alanı)
  - Avatar (profil fotoğrafı) yükleme ve değiştirme
  - Banner (kapak fotoğrafı) yükleme ve değiştirme
  - "Hakkında" açıklaması güncelleme
  - Şifre değiştirme (opsiyonel)
  - Canlı önizleme (değişiklikler anında görünür)
- Hem üyeler hem adminler kendi profillerini düzenleyebilir
- Kullanıcı adı değiştirilemez (güvenlik)

## Dosya yapısı

```
index.html      Giriş ekranı + gizli yönetici kapısı + üye alanı
register.html   Üye kayıt formu (başvuru sistemi)
profile.html    Profil ayarları sayfası
admin.html      Yönetim paneli (yetki kontrolü sayfa çizilmeden yapılır)
style.css       Ortak tasarım sistemi (renkler, cam efekti, butonlar, bildirimler)
login.css       Giriş ve kayıt ekranlarına özel stiller
admin.css       Yönetim paneli ve profil sayfası stilleri
script.js       Çekirdek: Store, Users, Applications, Auth, Crypto, Media, Toast, Particles
login.js        Giriş ekranı mantığı
register.js     Kayıt formu mantığı
profile.js      Profil düzenleme mantığı
admin.js        Yönetim paneli mantığı
assets/
  images/       Görseller
  icons/        Özel ikonlar
```

## Yayınlama

1. Dosyaları bir GitHub deposunun köküne yükle.
2. Depo ayarları → **Pages** → Branch: `main`, Folder: `/ (root)` → Save.
3. Bir iki dakika içinde `https://kullaniciadi.github.io/depo-adi/` adresinden açılır.

Harici bağımlılıklar (Poppins, Bootstrap 5, Font Awesome 6) CDN üzerinden gelir;
ayrıca kurulum gerekmez.

## İlk kullanım

### Yöntem 1: Kayıt Olma (Önerilen)

1. Giriş ekranındaki **"Üye ol"** linkine tıkla.
2. E-posta adresin Gmail, Hotmail veya Yandex olmalı.
3. Kullanıcı adı, şifre ve diğer bilgileri doldur.
4. **Başvuru Yolla** butonuna tıkla.
5. Admin onayını bekle.

### Yöntem 2: Admin Kapısı ile Doğrudan Hesap Oluşturma

1. Giriş ekranının altındaki **"Kod için admin şifresini gizle"** yazısına tıkla.
2. Yönetim kodunu gir → panel açılır.
3. **Hesap oluştur** bölümünden ilk kullanıcıyı ekle.

Rolü **Admin** olan bir kullanıcı, normal giriş yaptığında da doğrudan panele gider.

## Yönetim kodunu değiştirme

Kod kaynak dosyalarda düz metin olarak bulunmaz; yalnızca hash'i saklanır.
Yeni bir kod belirlemek için tarayıcı konsolunda:

```js
YKS.Crypto.makeGateHash("YeniKodun")
```

Çıkan 16 haneli değeri `script.js` içindeki `GATE_HASH` sabitine yaz.

## Veri saklama

Tüm kayıtlar tarayıcının **LocalStorage** alanında tutulur:

| Anahtar | İçerik |
|---|---|
| `yks.users.v1` | Kullanıcı kayıtları |
| `yks.applications.v1` | Üyelik başvuruları |
| `yks.session.v1` | Açık oturum (12 saat geçerli) |
| `yks.settings.v1` | Ayarlar (ileride kullanılacak) |

Veriler yalnızca o tarayıcıda durur; başka cihazda görünmez.
Tarayıcı verisi temizlenirse hesaplar silinir. Panelde **Veri yönetimi** bölümünden
JSON yedek al ve gerektiğinde geri yükle.

Yüklenen görseller canvas ile küçültülüp (avatar 320×320, banner 1200×400) JPEG
veri-URL olarak saklanır. LocalStorage yaklaşık 5 MB sınırlıdır; çok sayıda büyük
görsel yüklenirse kota dolabilir.

## Güvenlik sınırı

Bu sürüm sunucusuz çalışır. İstemci tarafındaki hiçbir kontrol gerçek güvenlik
sağlamaz:

- Kaynak kodu inceleyen biri JavaScript'i durdurup yönlendirmeyi atlayabilir.
- Yönetim kodu hash'lenmiş olsa da kaba kuvvetle denenebilir.
- LocalStorage'daki oturum kaydı elle düzenlenebilir.

Uygulamada bunlara karşı alınan önlemler *caydırıcıdır*, kesin değildir:
kod düz metin tutulmaz, şifreler hash'lenir, oturum rolü kullanıcı kaydından
tekrar doğrulanır, oturumun süresi dolar, kapıda hatalı denemeden sonra kilit gelir.

Gerçek gizlilik gerektiğinde Firebase Authentication, Supabase Auth ya da kendi
sunucun devreye girmelidir. Kod bunu kolaylaştıracak şekilde ayrıldı: kimlik
doğrulama tamamen `YKS.Auth`, veri erişimi tamamen `YKS.Users` içinde. Backend'e
geçerken yalnızca bu iki katman değiştirilir, arayüz aynı kalır.

## Yeni modül ekleme

Gelecek özellikler için kayıt defteri hazır. Yeni bir dosya ekleyip şunu yazman
yeterli — mevcut dosyalara dokunmadan çalışır:

```js
YKS.Modules.register("denemeler", {
  title: "Deneme Sonuçları",
  icon: "fa-clipboard-list",
  mount: function (container, ctx) {
    // ctx.user → o an giriş yapmış kullanıcı
    // Veriler user.data.denemeler içinde tutulur
    container.innerHTML = "...";
  }
});
```

Her kullanıcı kaydında modüller için ayrılmış alanlar hazır bekliyor:
`dersler`, `denemeler`, `netler`, `calisma`, `sureler`, `hedefler`, `rozetler`,
`arkadaslar`, `mesajlar`, `bildirimler`, `dosyalar`.

Arayüzdeki "yakında" kartları `script.js` içindeki `YKS.Roadmap` listesinden
üretilir. Bir modül gerçekten yazıldığında ilgili satırı listeden çıkar.
Liste şu an boş — planlanan her modül yazıldı; boşken "Yakında" bölümü
hem üye panelinde hem yönetim panelinde kendiliğinden gizlenir.

## Bildirimler

Ayrı bir sayfası yok: üye panelinde **sol sütun** olarak durur
(`index.html` içindeki `#notif-stack`). Giriş ekranındaki liste yığınının
yerini alır — çıkış yapılınca eski panel geri gelir.

Bu katman da veri üretmez, `YKS.Notifications` mevcut verilerden türetir:

| Kaynak | Bildirim |
|---|---|
| `YKS.Friends.incoming` | "X sana arkadaşlık isteği gönderdi" |
| `YKS.Messages` | "X sana N okunmamış mesaj gönderdi" (kişi başına tek satır) |
| `YKS.Announcements` | "Yeni duyuru: …" |
| `YKS.Posts` | "X gönderini beğendi" / "X gönderine yorum yaptı" |
| `YKS.Rozetler` | "Y rozetini kazandın" |

Okunmuşluk tek bir damgada tutulur: `user.data.bildirimSonGorulme`.
Bu damgadan yeni olan her şey okunmamış sayılır; "Okundu işaretle"
damgayı şimdiye çeker.

### Silme

Bildirimler türetilmiş olduğu için silmek **kaynağı yok etmek değildir**:
arkadaşlık isteği, mesaj ya da yorum yerinde kalır, yalnızca bildirim
listesinden gizlenir. İki mekanizma var:

| Alan | İşlev |
|---|---|
| `user.data.bildirimTemizleme` | "Temizle" damgası — bundan eski her bildirim gizlenir |
| `user.data.bildirimGizlenen` | Satırdaki × ile tek tek silinenlerin kimlikleri |

Damga tek sayı olduğu için büyümez; kimlik listesi 300 kayıtla sınırlı
ve "Temizle" çalıştığında boşaltılır (damga zaten hepsini kapsar).
Temizlikten sonra gelen yeni olaylar normal biçimde görünmeye devam eder.

Beğeniler için gönderide ayrı bir `likeLog: [{ u, at }]` alanı tutulur.
`likes` dizisi yalnızca "şu an kim beğeniyor" bilgisidir ve zaman
taşımaz; biçimini değiştirmek mevcut okuma yollarını bozacağı için
zaman damgası ayrı alana yazıldı.

## Rozetler

`rozetler.html` — kullanıcının kazandığı başarı rozetleri, gruplara ayrılmış
kartlar hâlinde. Kilitli rozetler de görünür; altlarında ilerleme çubuğu durur.
Toplam **100 rozet** var:

| Grup | Adet | Neye bakar |
|---|---|---|
| Çalışma | 16 | Toplam süre, oturum sayısı, tek gün/tek oturum rekorları, gece-sabah alışkanlığı |
| Kararlılık | 10 | Kesintisiz çalışma serisi ve toplam çalışma günü |
| Denemeler | 13 | Deneme sayısı, sınav türü çeşitliliği, net rekorları |
| Müfredat | 12 | Bitirilen konu sayısı ve tamamlanan ders sayısı |
| Hedefler | 11 | Oluşturulan/tamamlanan hedef ve hedef serisi |
| Günlük | 11 | Sayfa sayısı, yazma serisi, kelime sayısı, ruh hâli çeşitliliği |
| Özel | 12 | Hesap yaşı, modül kullanımı, rozet koleksiyonu |
| **K.C.A Başarımları** | **15** | Ders ustalığı — aşağıya bak |

### K.C.A Başarımları

Dört metal seviyenin (Bronz · Gümüş · Altın · Elmas) üstünde duran imza
seviyesi. Bir **ders dalının bütün konuları** bitince verilir ve kart mora
döner. Örnek: Kimya'nın hem TYT hem AYT konularının tamamı bitince
**Kimyager** açılır — yalnız TYT'yi bitirmek yetmez.

14 dal var: Matematikçi, Dil Ustası, Edebiyatçı, Fizikçi, **Kimyager**,
Biyolog, Tarihçi, Coğrafyacı, Filozof, Psikolog, Sosyolog, Mantıkçı,
İlahiyatçı, Hukukçu. On beşincisi **K.C.A Ustası**: on dört dalın hepsi.

Bir dal birden çok müfredat dersini kapsayabilir — Tarih dalı TYT Tarih,
AYT Tarih-1, AYT Tarih-2 ve KPSS Tarih'in tamamını ister. Dal tanımları
`rozetler.js` içindeki `DISCIPLINES` listesindedir; oraya satır eklemek
hem rozeti hem süzgeç sekmesini kendiliğinden getirir.

Bu rozetlerin hedefi müfredattan okunur, sabit değil: kart "53 / 112 konu"
gibi gerçek ilerleme gösterir. Müfredat kataloğu (`konular.js`) yüklü
olmayan sayfalarda hedef 0 kalır ve rozet **asla açılmaz** — yanlışlıkla
"0 ≥ 0" ile kilit açılmasın diye motorda ayrıca korunuyor.

Bu modül **veri üretmez**. `istatistik.html` gibi türetilmiş bir modüldür:
ilerlemeyi her açılışta diğer modüllerin verisinden yeniden hesaplar
(`sureler`, `denemeler`, `dersler`, `hedefler`, `gunluk`). Böylece kullanıcı bir
kaydını silerse ilerleme kendiliğinden düzelir — saklanan sayaç gibi yanlış kalmaz.

`user.data.rozetler` alanında yalnızca **kilit açılma anı** tutulur:

```js
user.data.rozetler = { "sure-100saat": 1753900000000, ... }
```

Damga olmadan kazanma tarihi gösterilemez ve "yeni rozet" bildirimi her açılışta
tekrar ederdi. Bir kez kazanılan rozet geri alınmaz: damga kayıtta kaldığı için
kullanıcı eski verisini silse bile madalya sönmez.

Yeni rozet eklemek `rozetler.js` içindeki `CATALOG` listesine bir satır yazmaktır;
çizim kodu değişmez:

```js
{
  id: "sure-100saat", group: "sure", tier: "gold", icon: "fa-stopwatch",
  title: "Yüz Saat Kulübü", desc: "Toplam 100 saat çalışma süresi biriktir.",
  goal: 100, unit: " sa", value: function (st) { return st.totalHours; }
}
```

`value` işlevi `statsOf()` nesnesinden ilerlemeyi okur; `goal` değerine ulaşınca
kilit açılır. Hedef sabit olmayacaksa `goalOf: function (st) { ... }` yaz —
K.C.A rozetleri hedefi böyle müfredattan alıyor. **`id` alanını sonradan
değiştirme** — kazanılmış rozetin damgası o ada bağlı, değişirse rozet kopar.

`meta: true` işaretli rozetler "kaç rozet topladın" gibi rozetlerin kendisine
bakar; bunlar ikinci turda ölçülür ve `st.earnedCount` yalnızca meta olmayan
94 rozeti sayar. Meta rozetler kendilerini de sayabilseydi çözülemez bir
döngü çıkardı, koleksiyon merdiveninin tavanı bu yüzden 90.

Motor `YKS.Rozetler` olarak dışarı açılır; `index.html` üye panelindeki
"son rozetlerin" şeridi bunu kullanır. Sayfa kabuğu olmayan yerlerde
`rozetler.js` yalnızca motoru kurar, çizim yapmaz.

## Tarayıcı desteği

Chrome, Edge, Firefox, Safari güncel sürümleri. `backdrop-filter` desteklemeyen
eski tarayıcılarda cam efekti düz renge düşer, işlevsellik etkilenmez.
Hareket azaltma tercihi açık olan cihazlarda parçacık animasyonu çalışmaz.
