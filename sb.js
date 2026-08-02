/* ============================================================
   Bay Porsuk — sb.js
   ------------------------------------------------------------
   Supabase bağlantısı. Bu dosya yalnızca istemciyi kurar;
   veri okuma/yazma mantığı script.js içindeki katmanlarda.

   YÜKLEME SIRASI (her sayfada):
     1) supabase-js UMD  (CDN)
     2) sb.js            (bu dosya)
     3) script.js        (çekirdek)

   ANAHTARLAR NEDEN AÇIKTA?
   Aşağıdaki URL ve "publishable" anahtar gizli değildir; bunlar
   "hangi projeye bağlanıyorum" bilgisidir ve tarayıcıya gömülmek
   üzere tasarlanmıştır. Güvenliği bunları saklamak değil,
   veritabanındaki RLS politikaları sağlar: anahtarla bağlanan
   biri bile yalnızca görme hakkı olan satırları çekebilir.

   ASLA buraya konmayacak olan: service_role anahtarı ve
   veritabanı şifresi. Onlar RLS'i tamamen atlar.
   ============================================================ */

(function (window) {
  "use strict";

  var YKS = (window.YKS = window.YKS || {});

  /* ==========================================================
     1) PROJE BİLGİLERİ
     ========================================================== */
  YKS.SupabaseConfig = {
    url: "https://afpnlvphotqbqguuhkom.supabase.co",
    key: "sb_publishable_TlQ7coaghSTvL_6JRvwamw_fEj0v0S9",

    /* Görsellerin yükleneceği depolama kovası (schema.sql açıyor) */
    bucket: "medya"
  };

  /* ==========================================================
     2) İSTEMCİ
     ========================================================== */
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error(
      "[YKS] supabase-js yüklenmedi. sb.js'ten ÖNCE şu satır olmalı:\n" +
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"><\/script>'
    );
    YKS.SB = null;
    return;
  }

  YKS.SB = window.supabase.createClient(
    YKS.SupabaseConfig.url,
    YKS.SupabaseConfig.key,
    {
      auth: {
        /* Oturum localStorage'da saklanır — ama bu bizim eski
           veri deposu değil, yalnızca Supabase'in oturum jetonu.
           Kullanıcı verisi artık veritabanında. */
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true   /* e-posta doğrulama dönüşü için */
      }
    }
  );

  /* ==========================================================
     3) ORTAK YARDIMCILAR
     ========================================================== */

  /**
   * Supabase hatasını kullanıcıya gösterilecek Türkçe metne çevirir.
   * Ham İngilizce mesajlar arayüzde kötü duruyor.
   */
  YKS.sbHata = function (error) {
    if (!error) return "Bilinmeyen hata.";
    var m = String(error.message || "");

    if (/Invalid login credentials/i.test(m)) return "Kullanıcı adı veya şifre hatalı.";
    if (/Email not confirmed/i.test(m)) return "E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.";
    if (/User already registered/i.test(m)) return "Bu e-posta zaten kayıtlı.";
    if (/Password should be at least/i.test(m)) return "Şifre en az 6 karakter olmalı.";
    if (/rate limit|too many requests/i.test(m)) return "Çok fazla deneme yapıldı. Biraz bekle.";
    if (/duplicate key.*username/i.test(m)) return "Bu kullanıcı adı zaten alınmış.";
    if (/violates row-level security/i.test(m)) return "Bu işlem için yetkin yok.";

    /* Davet kodu doğrulaması handle_new_user tetikleyicisinde yapılıyor.
       Tetikleyici hata fırlattığında Supabase Auth bunu ham metniyle
       değil "Database error saving new user" diye döndürüyor — kullanıcı
       neyin yanlış olduğunu anlayamaz. Bu yüzden yönlendirici bir
       karşılık veriyoruz. */
    if (/Database error saving new user/i.test(m)) {
      return "Kayıt tamamlanamadı. Davet kodunu kontrol et — " +
             "kod yanlış, süresi dolmuş ya da kullanım sınırına ulaşmış olabilir.";
    }
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sunucuya ulaşılamadı. İnternetini kontrol et.";
    if (error.code === "PGRST205") return "Veritabanı şeması kurulmamış (supabase/schema.sql çalıştırılmalı).";

    return m || "İşlem tamamlanamadı.";
  };

  /**
   * Bağlantı ayakta mı — tanı sayfası ve açılış kontrolü için.
   *
   * Bilerek head:true KULLANILMIYOR: HEAD isteğinde gövde dönmediği
   * için supabase-js hata nesnesini dolduramıyor ve olmayan tablo
   * başarılıymış gibi görünüyor. Gerçek bir select yapıp hem error
   * hem status kontrol ediliyor.
   */
  YKS.sbSaglik = function () {
    if (!YKS.SB) return Promise.resolve({ ok: false, error: "İstemci kurulmadı." });

    return YKS.SB.from("profiles").select("id").limit(1)
      .then(function (r) {
        if (r.error) return { ok: false, error: YKS.sbHata(r.error), kod: r.error.code };
        if (r.status === 404) {
          return { ok: false, error: "Veritabanı şeması kurulmamış.", kod: "PGRST205" };
        }
        return { ok: true };
      })
      .catch(function (e) { return { ok: false, error: String(e.message) }; });
  };

})(window);
