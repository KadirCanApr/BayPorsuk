# Profil Ayarları - Kullanım Kılavuzu

## 🎯 Özellikler

Kullanıcılar artık kendi profillerini tamamen özelleştirebilir:

### ✅ Düzenlenebilir Bilgiler
- **Ad Soyad**: İstediği zaman değiştirebilir
- **Yaş**: Güncellenebilir
- **Sınav Alanı**: Sayısal, Eşit Ağırlık, Sözel arasında değiştirebilir
- **Hakkında**: Profil açıklaması (hedef, çalışma düzeni vs.)
- **Profil Fotoğrafı**: Avatar yükleyebilir veya değiştirebilir
- **Banner**: Kapak fotoğrafı ekleyebilir veya değiştirebilir
- **Şifre**: Güvenli şekilde şifresini değiştirebilir

### ✅ Canlı Önizleme
- Yapılan değişiklikler anında önizleme alanında görülür
- Kaydetmeden önce nasıl görüneceğini görebilir
- Değişiklikler beğenilmezse iptal edilebilir

### ✅ Güvenlik
- Kullanıcı adı değiştirilemez (güvenlik)
- Şifre değişikliği opsiyonel (boş bırakılırsa değişmez)
- Şifre tekrar kontrolü
- Oturum kontrollü (giriş yapmış kullanıcı gerekli)

## 📁 Eklenen Dosyalar

### Yeni Dosyalar
1. **profile.html** - Profil ayarları sayfası
2. **profile.js** - Profil düzenleme mantığı
3. **PROFIL_AYARLARI.md** - Bu kılavuz

### Güncellenen Dosyalar
1. **admin.html** - Kenar çubuğuna "Profil Ayarları" butonu eklendi
2. **index.html** - Üye ekranına "Profil Ayarları" butonu eklendi
3. **admin.css** - Profil sayfası için stiller eklendi

## 🚀 Kullanım

### Profil Ayarlarına Erişim

**Yöntem 1: Üye Ekranından**
1. Giriş yap
2. "Profil Ayarları" butonuna tıkla

**Yöntem 2: Admin Panelinden**
1. Admin paneline gir
2. Sol kenar çubuğunun altında "Profil Ayarları" butonuna tıkla

### Profil Düzenleme

1. **Kişisel Bilgiler Kartı**:
   - Ad Soyad: Görünen adını değiştir
   - Yaş: Güncel yaşını gir
   - Sınav Alanı: Alanını seç
   - Kullanıcı Adı: ❌ Değiştirilemez (güvenlik)
   - Hakkında: Kısa bir açıklama yaz

2. **Profil Görselleri Kartı**:
   - **Profil Fotoğrafı**: Tıkla veya sürükle-bırak ile yükle (320×320'ye küçültülür)
   - **Banner**: Kapak fotoğrafı yükle (1200×400'e küçültülür)
   - **Kaldır**: X butonuna tıklayarak görseli kaldır

3. **Şifre Değiştir Kartı**:
   - Yeni şifre gir (en az 4 karakter)
   - Şifreyi tekrar gir
   - ℹ️ Boş bırakırsan şifre değişmez

4. **Kaydet**:
   - "Değişiklikleri Kaydet" butonuna tıkla
   - Başarılı mesajını gör
   - Değişiklikler anında uygulanır

### Canlı Önizleme

Sayfanın üst kısmında profilin nasıl görüneceğini görebilirsin:
- Banner fotoğrafı
- Avatar
- Ad Soyad
- Kullanıcı adı (@username)
- Rozetler (Admin/Üye, Sınav Alanı, Yaş)
- Hakkında açıklaması

Bir şey değiştirdiğinde önizleme otomatik güncellenir.

## 🎨 Görsel Yükleme

### Desteklenen Formatlar
- JPEG / JPG
- PNG
- WebP
- GIF (animasyonsuz)

### Boyut Limitleri
- Maksimum dosya boyutu: 6 MB
- Avatar: 320×320 piksele küçültülür
- Banner: 1200×400 piksele küçültülür
- Kalite: %85 (avatar), %82 (banner)

### İpuçları
✅ Net ve kaliteli görseller kullan
✅ Banner için yatay (manzara) formatı tercih et
✅ Avatar için kare veya yuvarlak görseller uygun
✅ Görsel yükleme sonrası önizlemede kontrol et
❌ Çok büyük dosyalar LocalStorage'ı doldurabilir

## 🔒 Güvenlik ve Gizlilik

### Değiştirilemez Bilgiler
- **Kullanıcı Adı**: Sistem genelinde benzersiz, değiştirilemez
- **E-posta**: Şu an profil sayfasından değiştirilemez
- **Rol**: Admin/Üye rolü sadece admin panelinden değiştirilebilir
- **Kayıt Tarihi**: Değiştirilemez

### Şifre Güvenliği
- Eski şifre gösterilmez
- Yeni şifre hash'lenerek saklanır
- Şifre değiştirmek opsiyonel
- Şifre doğrulama kontrolü var

### Veri Saklama
- Tüm değişiklikler LocalStorage'da `yks.users.v1` altında saklanır
- Görseller veri-URL olarak (base64) saklanır
- Değişiklikler anında uygulanır
- Yedekleme önerilir (Admin Panel → Veri Yönetimi)

## 💡 İpuçları ve Püf Noktaları

### Profil Fotoğrafı
- Yüzünün net göründüğü bir fotoğraf seç
- Arka plan sade olsun
- Merkeze odaklı çekim tercih et
- 320×320 kare formatı için uygun kırpılmış görsel kullan

### Banner
- Geniş açı, panoramik görseller iyi görünür
- Üst ve alt kısımlarda önemli detay olmasın (kesilir)
- Banner olmadan da kullanabilirsin (gradient gösterilir)

### Hakkında Bölümü
- Hedef bölümünü yaz
- Kaçıncı yılda olduğunu belirt
- Çalışma hedeflerini paylaş
- Kısa ve öz tut (2-3 cümle ideal)

### Şifre Değiştirme
- Güçlü şifre kullan (4+ karakter, sayı + harf karışımı önerilir)
- Şifreni düzenli aralıklarla değiştir
- Kolay tahmin edilebilir şifreler kullanma
- Şifre değiştirmek istemiyorsan alanı boş bırak

## 🎯 Sık Kullanım Senaryoları

### Senaryo 1: İlk Defa Profil Düzenleme
1. Giriş yap → Profil Ayarları
2. "Hakkında" kısmını doldur
3. Profil fotoğrafı yükle
4. Banner ekle (opsiyonel)
5. Kaydet

### Senaryo 2: Sadece Fotoğraf Değiştirme
1. Profil Ayarları → Profil Fotoğrafı
2. Yeni fotoğraf yükle
3. Önizlemede kontrol et
4. Kaydet

### Senaryo 3: Şifre Değiştirme
1. Profil Ayarları → Şifre Değiştir
2. Yeni şifre gir (2 kez)
3. Kaydet
4. Yeni şifre ile giriş yapabilirsin

### Senaryo 4: Yaş/Alan Güncelleme
1. Profil Ayarları → Kişisel Bilgiler
2. Yaş veya Sınav Alanını güncelle
3. Önizlemede kontrol et
4. Kaydet

## 🐛 Sorun Giderme

**Profil Ayarları butonunu göremiyorum:**
- Giriş yapmış olduğundan emin ol
- Sayfayı yenile (F5)
- Başka tarayıcıda dene

**Görsel yüklenmiyor:**
- Dosya boyutu 6 MB'dan küçük olmalı
- Desteklenen format kullan (JPG, PNG)
- LocalStorage dolu olabilir (yedek al, eski verileri temizle)
- Tarayıcı konsoluna bak

**Değişiklikler kaydedilmiyor:**
- Tüm zorunlu alanları doldur
- Şifre tekrarı uyuşuyor mu kontrol et
- Yaş 10-99 arası olmalı
- LocalStorage kotası dolmuş olabilir

**Önizleme güncellemiyor:**
- Birkaç saniye bekle (300ms gecikme var)
- Sayfayı yenile
- Tarayıcı konsolunda hata var mı kontrol et

**Şifre değişmiyor:**
- Şifre alanlarını doldur (boşsa değişmez)
- Şifre tekrarı aynı olmalı
- En az 4 karakter olmalı

## ℹ️ Önemli Notlar

1. **Kullanıcı Adı**: Kayıttan sonra değiştirilemez. Değiştirmek için yöneticiye başvur.

2. **E-posta**: Şu an profil sayfasından değiştirilemiyor. İleride eklenebilir.

3. **Rol Değişikliği**: Admin/Üye rolü sadece yönetici tarafından değiştirilebilir.

4. **Görseller**: LocalStorage'da saklandığı için çok fazla büyük görsel sistemde yer kaplar. Makul boyutlar kullan.

5. **Yedekleme**: Profil değişikliklerinden sonra Admin Panel'den yedek almanı öneririz.

6. **Geri Alma**: Değişiklikler kaydedildikten sonra geri alınamaz. Dikkatli ol!

## 🎉 Başarılı Kurulum!

Artık kullanıcılar profillerini tamamen özelleştirebilir. Avatar, banner, hakkında bilgisi ve şifre değiştirme özgürlüğü sunuyorsun. Canlı önizleme sayesinde kullanıcılar değişiklikleri kaydetmeden görebilir.

### Sonraki Adımlar
- ✅ E-posta değiştirme özelliği eklenebilir
- ✅ Profil görünürlük ayarları (herkese açık/gizli)
- ✅ Sosyal medya bağlantıları
- ✅ Tema tercihleri (açık/koyu mod)
- ✅ Bildirim ayarları
