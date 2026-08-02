# Üyelik Kayıt Sistemi - Kullanım Kılavuzu

## 🎯 Özellikler

Sisteminize tam teşekküllü bir üye kayıt ve başvuru sistemi eklendi:

### ✅ Kullanıcı Tarafı
- **Kayıt Formu**: `register.html` sayfası eklendi
- **E-posta Zorunluluğu**: Sadece Gmail, Hotmail, Yandex kabul edilir
- **Şifre Doğrulama**: Şifre tekrarı ile doğrulama
- **Başvuru Sistemi**: Kayıt doğrudan hesap açmaz, admin onayı gerekir
- **Durum Bildirimi**: Giriş ekranında başvuru durumu gösterilir

### ✅ Admin Tarafı
- **Başvuru Paneli**: Admin menüsünde yeni "Üyelik Başvuruları" bölümü
- **Onay/Red Sistemi**: Başvuruları onaylayabilir veya gerekçe ile reddedebilir
- **Bildirim Badge**: Bekleyen başvuru sayısı menüde gösterilir
- **Otomatik Hesap Açma**: Onaylanan başvurular için hesap otomatik oluşturulur

## 📁 Eklenen/Güncellenen Dosyalar

### Yeni Dosyalar
1. **register.html** - Üye kayıt formu sayfası
2. **register.js** - Kayıt formu mantığı
3. **profile.html** - Profil ayarları sayfası
4. **profile.js** - Profil düzenleme mantığı
5. **UYELIK_SISTEMI.md** - Bu kılavuz
6. **PROFIL_AYARLARI.md** - Profil ayarları kılavuzu

### Güncellenen Dosyalar
1. **index.html** - "Üye ol" linki ve "Profil Ayarları" butonu eklendi
2. **admin.html** - "Üyelik Başvuruları" menü öğesi ve "Profil Ayarları" butonu eklendi
3. **admin.js** - Başvuru yönetimi fonksiyonları eklendi
4. **admin.css** - Başvuru kartları ve profil sayfası için stiller eklendi
5. **login.js** - Başvuru durumu kontrolü eklendi
6. **login.css** - Başarı mesajı stili eklendi
7. **README.md** - Sistem dokümantasyonu güncellendi

## 🚀 Kullanım

### Kullanıcı Kaydı
1. Ana sayfada (index.html) "Üye ol" linkine tıklayın
2. Formu doldurun:
   - Kullanıcı adı (küçük harf, rakam, nokta, tire, alt çizgi)
   - E-posta (Gmail, Hotmail veya Yandex)
   - Ad Soyad
   - Yaş (10-99 arası)
   - Sınav alanı
   - Şifre (en az 4 karakter)
   - Şifre tekrar
   - Açıklama (opsiyonel)
3. "Başvuru Yolla" butonuna tıklayın
4. Başarı mesajını görün
5. Admin onayını bekleyin

### Admin Onaylama
1. Admin paneline giriş yapın
2. Kenar çubuğunda "Üyelik Başvuruları" menüsüne tıklayın
3. Badge'de bekleyen başvuru sayısını görün
4. Başvuru kartında:
   - **Onayla**: Hesap otomatik oluşturulur, kullanıcı giriş yapabilir
   - **Reddet**: Gerekçe girin, kullanıcı giriş ekranında bu gerekçeyi görür
5. Onaylanan/reddedilen başvuru kayıtlarını silebilirsiniz

### Durum Bildirimleri
Kullanıcı giriş yapmaya çalıştığında:
- **Beklemede**: "Başvurun admin onayını bekliyor. Lütfen sabırlı ol."
- **Reddedildi**: "Başvurun reddedildi. Gerekçe: [admin'in yazdığı gerekçe]"
- **Onaylandı**: Normal giriş yapabilir

## 🔒 E-posta Kısıtlaması

Sistem yalnızca şu e-posta sağlayıcılarını kabul eder:
- gmail.com
- hotmail.com
- hotmail.com.tr
- yandex.com
- yandex.com.tr
- yandex.ru

Yeni sağlayıcı eklemek için `script.js` dosyasındaki `allowedEmailDomains` dizisine ekleyin.

## 💾 Veri Saklama

Başvurular `localStorage` içinde `yks.applications.v1` anahtarında saklanır:
```javascript
{
  id: "a_xxx",
  username: "kullanici.adi",
  email: "ornek@gmail.com",
  passwordHash: "xxx", // Şifre hash'li saklanır
  fullName: "Ad Soyad",
  age: 18,
  examField: "sayisal",
  description: "...",
  status: "pending", // pending | approved | rejected
  note: "", // Red gerekçesi
  createdAt: 1234567890,
  decidedAt: null,
  decidedBy: null,
  userId: null // Onaylandığında oluşan hesap ID'si
}
```

## 🎨 Tasarım

Tüm bileşenler mevcut tasarım sisteminizle uyumlu:
- Cam efekti (glass morphism)
- Gradient renkler
- Animasyonlar
- Responsive tasarım
- Dark theme

## 🔐 Güvenlik

- Şifreler asla düz metin olarak saklanmaz
- Başvuru anında hash'lenir
- Onaylandığında hash aynen kullanıcı hesabına taşınır
- E-posta doğrulaması format + sağlayıcı kontrolü ile yapılır
- Tekrar kayıt engellenir (username ve email bazında)

## 📝 Notlar

- Admin panelinde doğrudan hesap oluşturma hala kullanılabilir (e-posta opsiyonel)
- Başvuru sistemi sadece kullanıcılar için, adminler için değil
- Onaylanan başvurular varsayılan olarak "üye" rolüyle oluşturulur
- İsterseniz onaylarken rolü "admin" de yapabilirsiniz (kod değişikliği gerekir)

## 🐛 Sorun Giderme

**Başvuru gönderilmiyor:**
- Tarayıcı konsoluna bakın
- LocalStorage dolu olabilir (görseller çok büyükse)
- E-posta formatı doğru mu kontrol edin

**Admin badge güncellemiyor:**
- Sayfayı yenileyin
- LocalStorage'da `yks.applications.v1` anahtarını kontrol edin

**Onaylanan kullanıcı giriş yapamıyor:**
- Kullanıcılar listesinde hesabın oluştuğunu kontrol edin
- Başvuru sayfasında userId'nin dolu olduğunu kontrol edin

## 🎉 Başarılı Kurulum!

Artık sisteminizde tam teşekküllü bir üye kayıt ve başvuru sistemi var. Kullanıcılar güvenli bir şekilde kayıt olabilir, siz de admin panelinden onaylayabilirsiniz.
