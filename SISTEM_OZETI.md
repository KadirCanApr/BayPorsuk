# Aksiyom - YKS & KPSS Sınav Destek Asistanı - Tüm Özellikler

## 🎯 Sisteme Eklenen Tüm Özellikler

### 1️⃣ Üye Kayıt Sistemi
**Dosya:** `register.html`, `register.js`

✅ Kullanıcılar kendi hesaplarını oluşturabilir
✅ E-posta zorunlu (sadece Gmail, Hotmail, Yandex)
✅ Şifre doğrulama sistemi
✅ Başvuru sistemi (admin onayı gerekli)
✅ Başarı ekranı ile kullanıcı bilgilendirme

**Kullanım:** Aksiyom Ana Sayfa → "Üye ol" → Formu doldur → "Başvuru Yolla"

---

### 2️⃣ Admin Başvuru Yönetimi
**Dosya:** `admin.html`, `admin.js`, `admin.css`

✅ Üyelik Başvuruları sayfası
✅ Bekleyen başvuru sayısı badge'i
✅ Başvuruları onaylama (hesap otomatik oluşur)
✅ Başvuruları reddetme (gerekçe ile)
✅ Filtreleme (Bekleyenler/Onaylananlar/Reddedilenler)
✅ Başvuru kartlarında detaylı bilgi görüntüleme

**Kullanım:** Admin Panel → "Üyelik Başvuruları" → Onayla/Reddet

---

### 3️⃣ Profil Yönetimi
**Dosya:** `profile.html`, `profile.js`, `admin.css` (profil stilleri)

✅ Kullanıcılar kendi profillerini düzenleyebilir
✅ Ad Soyad, Yaş, Sınav Alanı değiştirebilir
✅ "Hakkında" açıklaması ekleyebilir/güncelleyebilir
✅ Profil fotoğrafı (avatar) yükleyebilir
✅ Banner (kapak fotoğrafı) yükleyebilir
✅ Şifre değiştirebilir (opsiyonel)
✅ Canlı önizleme (değişiklikler anında görünür)
✅ Hem üyeler hem adminler kullanabilir

**Kullanım:** 
- Üye: Giriş → "Profil Ayarları"
- Admin: Admin Panel → "Profil Ayarları"

---

### 4️⃣ Akıllı Giriş Sistemi
**Dosya:** `login.js`

✅ Başvurusu bekleyen kullanıcıya bilgi mesajı
✅ Reddedilen kullanıcıya red gerekçesi gösterme
✅ Normal kullanıcı direkt giriş yapabilir

**Kullanım:** Otomatik çalışır

---

## 📂 Tüm Dosyalar

### 🆕 Yeni Eklenen Dosyalar (6 adet)
1. ✨ `register.html` - Üye kayıt formu sayfası
2. ✨ `register.js` - Kayıt formu mantığı
3. ✨ `profile.html` - Profil ayarları sayfası
4. ✨ `profile.js` - Profil düzenleme mantığı
5. 📖 `UYELIK_SISTEMI.md` - Üyelik sistemi kılavuzu
6. 📖 `PROFIL_AYARLARI.md` - Profil ayarları kılavuzu
7. 📖 `SISTEM_OZETI.md` - Bu dosya

### ✏️ Güncellenen Dosyalar (7 adet)
1. 🔧 `index.html` - "Üye ol" linki + "Profil Ayarları" butonu
2. 🔧 `admin.html` - "Üyelik Başvuruları" menüsü + "Profil Ayarları" butonu
3. 🔧 `admin.js` - Başvuru yönetim fonksiyonları
4. 🔧 `admin.css` - Başvuru kartları + profil sayfası stilleri
5. 🔧 `login.js` - Başvuru durumu kontrolü
6. 🔧 `login.css` - Başarı mesajı stili
7. 🔧 `README.md` - Dokümantasyon güncellendi

### 📦 Mevcut Dosyalar (Dokunulmadı)
- `style.css` - Ana tasarım sistemi
- `script.js` - Çekirdek sistem (Users, Applications, Auth, Crypto, Media)
- `ts.txt` - ?

---

## 🎨 Kullanıcı Deneyimi Akışı

### Yeni Kullanıcı Kaydı
```
1. Ana Sayfa (index.html)
   ↓ "Üye ol" linki
2. Kayıt Formu (register.html)
   ↓ Bilgileri doldur + "Başvuru Yolla"
3. Başarı Ekranı
   ↓ "Admin onayını bekle" mesajı
4. Admin Paneli (admin.html)
   ↓ Başvuruyu onayla
5. Kullanıcı Giriş Yapabilir!
```

### Profil Düzenleme
```
1. Giriş Yap
   ↓
2. "Profil Ayarları" butonu
   ↓
3. Profil Sayfası (profile.html)
   ↓ Bilgileri düzenle + Görsel yükle
4. "Değişiklikleri Kaydet"
   ↓
5. Profil Güncellendi! ✅
```

### Admin Başvuru Yönetimi
```
1. Admin Panel
   ↓
2. "Üyelik Başvuruları" (badge'de sayı var)
   ↓
3. Başvuruları Görüntüle
   ↓
4. Onayla / Reddet
   ↓
5. Kullanıcı bilgilendirilir
```

---

## 🔐 Güvenlik Özellikleri

### E-posta Kontrolü
✅ Sadece Gmail, Hotmail, Yandex kabul edilir
✅ Format doğrulaması
✅ Tekrar kayıt engelleme

### Şifre Güvenliği
✅ Şifreler hash'lenerek saklanır
✅ Düz metin asla görünmez
✅ Başvuru anında hash'lenir
✅ Şifre değiştirme opsiyonel

### Kullanıcı Adı
✅ Benzersiz olmalı
✅ Değiştirilemez (güvenlik)
✅ Küçük harf, rakam, nokta, tire, alt çizgi

### Oturum Kontrolü
✅ Profil sayfası oturum gerektirir
✅ Admin sayfası admin rolü gerektirir
✅ Otomatik yönlendirme

---

## 💾 Veri Saklama

### LocalStorage Anahtarları
```
yks.users.v1         → Kullanıcı hesapları
yks.applications.v1  → Üyelik başvuruları
yks.session.v1       → Oturum bilgisi (12 saat)
yks.settings.v1      → Ayarlar (ileride)
```

### Başvuru Veri Yapısı
```javascript
{
  id: "a_xxx",
  username: "kullanici.adi",
  email: "ornek@gmail.com",
  passwordHash: "xxx",
  fullName: "Ad Soyad",
  age: 18,
  examField: "sayisal",
  description: "...",
  avatar: null,
  banner: null,
  status: "pending", // pending | approved | rejected
  note: "",
  createdAt: 1234567890,
  decidedAt: null,
  decidedBy: null,
  userId: null
}
```

---

## 🎨 Tasarım Sistemi

### Renkler
- **Brand**: #5b6cff (Mavi)
- **Brand 2**: #a259ff (Mor)
- **Success**: #2fd4a7 (Yeşil)
- **Warning**: #ffc046 (Sarı)
- **Danger**: #ff5c7a (Kırmızı)

### Efektler
- **Cam Efekti**: Glassmorphism
- **Animasyonlar**: Rise, fade, shake
- **Hover Efektleri**: Yumuşak geçişler
- **Responsive**: Mobil uyumlu

### Bileşenler
- **Kartlar**: glass, rise animasyonlu
- **Butonlar**: Primary, Ghost, Danger
- **Formlar**: Input, Select, Textarea, Upload
- **Badge'ler**: Rol, alan, durum göstergeleri
- **Toast**: Bildirim balonları

---

## 📱 Responsive Tasarım

✅ **Mobil**: Tam uyumlu (320px+)
✅ **Tablet**: Optimizasyonlu (768px+)
✅ **Desktop**: Tam deneyim (1024px+)

### Mobilde Özellikler
- Hamburger menü (admin panel)
- Tek sütun layout
- Dokunmatik optimizasyonlu butonlar
- Responsive grid sistemi

---

## 🚀 Nasıl Kullanılır?

### 1. İlk Kurulum
```bash
# Dosyaları bir web sunucusuna yükle
# Ya da GitHub Pages kullan
```

### 2. İlk Admin Hesabı
```
1. index.html'i aç
2. "Kod için admin şifresini gizle"
3. Admin kodu: (script.js'te tanımlı)
4. İlk hesabı oluştur
```

### 3. Üye Kaydı
```
1. "Üye ol" linkine tıkla
2. Formu doldur
3. Başvuruyu yolla
4. Admin onayını bekle
```

### 4. Profil Düzenleme
```
1. Giriş yap
2. "Profil Ayarları"
3. Bilgileri düzenle
4. Kaydet
```

---

## 🎉 Tüm Özellikler Tamamlandı!

### ✅ Üyelik Sistemi
- Kayıt formu
- E-posta doğrulama
- Başvuru sistemi
- Admin onay/red mekanizması

### ✅ Profil Yönetimi
- Kişisel bilgiler düzenleme
- Avatar/Banner yükleme
- Şifre değiştirme
- Canlı önizleme

### ✅ Admin Panel
- Başvuru yönetimi
- Kullanıcı listesi
- Hesap oluşturma
- Veri yönetimi

### ✅ Güvenlik
- Hash'li şifreler
- E-posta kontrolü
- Oturum yönetimi
- Yetki kontrolü

---

## 📚 Kılavuzlar

1. **README.md** - Genel sistem dokümantasyonu
2. **UYELIK_SISTEMI.md** - Üyelik kayıt sistemi detayları
3. **PROFIL_AYARLARI.md** - Profil düzenleme kılavuzu
4. **SISTEM_OZETI.md** - Bu dosya (hızlı bakış)

---

## 🎯 Sonraki Adımlar (Öneriler)

### Gelecek Özellikler
- [ ] E-posta doğrulama (gerçek mail gönderimi)
- [ ] E-posta adresi değiştirme
- [ ] Profil görünürlük ayarları
- [ ] Sosyal medya bağlantıları
- [ ] Tema tercihleri (açık/koyu mod)
- [ ] Bildirim ayarları
- [ ] İki faktörlü kimlik doğrulama
- [ ] Hesap silme özelliği
- [ ] Profil ziyaretçi sayacı

### Modül Sistemi
- [x] Ders takip sistemi (`dersler.html`)
- [x] Deneme sonuçları (`exams.html`)
- [x] Net takibi (`netler.html`)
- [x] Çalışma kayıtları (`sayac.html`)
- [x] Hedef sistemi (`hedefler.html`)
- [x] Rozet sistemi (`rozetler.html`)
- [x] Arkadaş sistemi (`arkadaslar.html`)
- [x] Mesajlaşma (`mesajlar.html`)
- [x] Baykuş Social (`sosyal.html`)
- [x] Bildirimler (üye panelinde sol sütun)
- [~] Dosya paylaşımı — **iptal edildi**, yerine Baykuş Social yapıldı.
      Sunucusuz mimaride dosyalar base64 olarak saklanacağı için birkaç
      PDF localStorage kotasını doldurup kullanıcı kayıtlarını da
      yazılamaz hâle getiriyordu.

---

## 🎊 Sistem Tamamen Hazır!

Artık tam teşekküllü bir kullanıcı yönetim sisteminiz var:

✅ Kayıt sistemi
✅ Admin onay mekanizması  
✅ Profil düzenleme
✅ Güvenlik katmanları
✅ Modern tasarım
✅ Responsive yapı

**Aksiyom - YKS & KPSS Sınav Destek Asistanı başarıyla kuruldu! 🚀**

*Kadir Can Aparı tarafından geliştirilmiştir.*
