/* ============================================================
   YKS Takip Sistemi — script.js  (ÇEKİRDEK)
   ------------------------------------------------------------
   Bu dosya tüm sayfalarda ilk yüklenir ve ortak altyapıyı kurar:
     YKS.Config    → ayarlar ve sabitler
     YKS.Utils     → küçük yardımcı fonksiyonlar
     YKS.Validate  → ortak doğrulama kuralları (e-posta vb.)
     YKS.Cache     → sunucudan çekilen verinin bellek kopyası
     YKS.Store     → LocalStorage sarmalayıcı
     YKS.Users     → kullanıcı CRUD işlemleri
     YKS.Auth      → Supabase kimlik doğrulama (kayıt, giriş, rol)
     YKS.Friends   → arkadaşlık istekleri ve arkadaş listesi
     YKS.Messages  → birebir mesajlaşma (+ yönetici sorgusu)
     YKS.Auth      → oturum yönetimi ve yetki kontrolü
     YKS.Media     → görsel yükleme + boyut küçültme
     YKS.Toast     → bildirim balonları
     YKS.Particles → arka plan parçacık animasyonu
     YKS.Modules   → gelecekte eklenecek modüllerin kayıt defteri

   Tasarım kararı: her şey tek bir global "YKS" ad alanı altında
   toplandı. Böylece dosyalar birbirini ezmeden büyüyebilir ve
   ileride ES Modüllerine geçmek kolay olur.
   ============================================================ */

(function (window, document) {
  "use strict";

  /* Global ad alanı — varsa tekrar oluşturma */
  var YKS = (window.YKS = window.YKS || {});

  /* ==========================================================
     1) CONFIG — Uygulama sabitleri
     ========================================================== */
  YKS.Config = {
    appName: "YKS Takip Sistemi",
    version: "1.0.0",

    /* LocalStorage anahtarları.
       Kullanıcılar, oturum ve başvurular artık Supabase'de —
       bu anahtarlar yalnızca henüz taşınmamış modüller için duruyor
       (2. aşamada duyurular/arkadaşlık/mesaj/gönderi de gidecek).
       Oturumu Supabase kendi anahtarında tutar, buradaki değil. */
    keys: {
      announcements: "yks.announcements.v1",
      friendships: "yks.friendships.v1",
      messages: "yks.messages.v1",
      posts: "yks.posts.v1",
      settings: "yks.settings.v1"
    },

    /* Mesajlaşma sınırları */
    message: {
      textMax: 2000,
      /* Bir sohbette tek seferde çizilecek en fazla balon */
      pageSize: 60
    },

    /* Baykuş Social sınırları.
       maxPosts bir kota emniyet supabıdır: gönderiler görsel taşıdığı
       için liste sınırsız büyürse depolama dolar ve kullanıcı kayıtları
       da yazılamaz hale gelir. Sınıra gelince en eski GÖRSELSİZ değil,
       en eski gönderi düşer (bkz. YKS.Posts._trim). */
    post: {
      textMax: 500,
      commentMax: 300,
      maxPosts: 300,
      pageSize: 20
    },

    /* Oturum süresi: 12 saat (ms) */
    sessionTTL: 12 * 60 * 60 * 1000,

    /* Görsel yükleme sınırları */
    media: {
      avatar: { w: 320, h: 320, quality: 0.85 },
      banner: { w: 1200, h: 400, quality: 0.82 },
      /* Gönderi görseli bilerek küçük: veri-URL olarak saklandığı için
         800x600/q0.75 tipik bir fotoğrafta ~60 KB tutar. Daha büyüğü
         birkaç gönderide localStorage kotasını yakardı. */
      post: { w: 800, h: 600, quality: 0.75 },
      maxInputBytes: 6 * 1024 * 1024 /* 6 MB'den büyük dosya reddedilir */
    },

    /* Seçenek listeleri — formlar buradan beslenir */
    roles: [
      { value: "uye", label: "Üye" },
      { value: "admin", label: "Admin" }
    ],
    fields: [
      { value: "sayisal", label: "Sayısal" },
      { value: "esit-agirlik", label: "Eşit Ağırlık" },
      { value: "sozel", label: "Sözel" }
    ],

    /* Kabul edilen e-posta sağlayıcıları.
       Başvuru formu ve hesap kaydı yalnızca bu alan adlarını geçirir;
       listede olmayan bir adresle kayıt yapılamaz.
       Yeni bir sağlayıcı açmak için tek yapılacak buraya satır eklemek. */
    allowedEmailDomains: [
      "gmail.com",
      "hotmail.com",
      "hotmail.com.tr",
      "yandex.com",
      "yandex.com.tr",
      "yandex.ru"
    ],

    /* Başvuru durumları */
    applicationStatuses: [
      { value: "pending", label: "Bekliyor" },
      { value: "approved", label: "Onaylandı" },
      { value: "rejected", label: "Reddedildi" }
    ],

    /* Duyuru türleri — renk ve ikon buradan gelir */
    announcementLevels: [
      { value: "info",    label: "Bilgi",  icon: "fa-circle-info" },
      { value: "success", label: "Müjde",  icon: "fa-circle-check" },
      { value: "warn",    label: "Uyarı",  icon: "fa-triangle-exclamation" },
      { value: "danger",  label: "Önemli", icon: "fa-bullhorn" }
    ],

    /* Duyuru alan sınırları */
    announcement: {
      titleMin: 3,
      titleMax: 120,
      bodyMin: 3,
      bodyMax: 4000
    }
  };

  /* ==========================================================
     1b) SUBJECTS — Sınav türleri ve ders kataloğu
     ----------------------------------------------------------
     Tek kaynak: deneme girişi, başarı takibi ve çalışma sayacı
     aynı listeyi kullanır. Böylece ders kimlikleri (id) her yerde
     aynı kalır ve raporlar tutarlı çıkar.
       max   → o dersteki soru sayısı (deneme modülü kullanır)
       icon  → Font Awesome ikonu (takip ve sayaç kullanır)
       group → sınavdaki üst başlık (Fen Bilimleri, Sosyal Bilimler…)

     Dersler tek tek tutulur; "Fen Bilimleri" gibi başlıklar
     yalnızca gruplama içindir. Böylece hem giriş hem takip
     Fizik / Kimya / Biyoloji düzeyinde yapılabiliyor.
     ========================================================== */
  YKS.Subjects = {
    /* Kayıtlı deneme kaydının ders şeması sürümü.
       1 → Fen ve Sosyal tek satırdı
       2 → alt derslere ayrıldı
       Sürümü olmayan kayıtlar okunurken 1 sayılır ve dağıtılır. */
    schemaVersion: 2,

    types: [
      { value: "tyt",  label: "TYT",  full: "Temel Yeterlilik Testi",       icon: "fa-book" },
      { value: "ayt",  label: "AYT",  full: "Alan Yeterlilik Testi",        icon: "fa-graduation-cap" },
      { value: "kpss", label: "KPSS", full: "Kamu Personeli Seçme Sınavı",  icon: "fa-briefcase" }
    ],

    /* Sınavdaki üst başlıklar */
    groupNames: {
      turkce:       "Türkçe",
      matematik:    "Matematik",
      fen:          "Fen Bilimleri",
      sosyal:       "Sosyal Bilimler",
      edebiyatSos1: "Edebiyat ve Sosyal Bilimler-1",
      sos2:         "Sosyal Bilimler-2",
      felsefeGrubu: "Felsefe Grubu",
      genelYetenek: "Genel Yetenek",
      genelKultur:  "Genel Kültür"
    },

    byType: {
      /* TYT — 120 soru */
      tyt: [
        { id: "turkce",      name: "Türkçe",       icon: "fa-book",       max: 40, group: "turkce" },
        { id: "matematik",   name: "Matematik",    icon: "fa-calculator", max: 40, group: "matematik" },

        /* Fen Bilimleri (20) */
        { id: "fizik",       name: "Fizik",        icon: "fa-atom",       max: 7,  group: "fen" },
        { id: "kimya",       name: "Kimya",        icon: "fa-vial",       max: 7,  group: "fen" },
        { id: "biyoloji",    name: "Biyoloji",     icon: "fa-dna",        max: 6,  group: "fen" },

        /* Sosyal Bilimler (20) */
        { id: "tarih",       name: "Tarih",        icon: "fa-landmark",   max: 5,  group: "sosyal" },
        { id: "cografya",    name: "Coğrafya",     icon: "fa-map",        max: 5,  group: "sosyal" },
        { id: "felsefe",     name: "Felsefe",      icon: "fa-brain",      max: 5,  group: "sosyal" },
        { id: "din",         name: "Din Kültürü",  icon: "fa-mosque",     max: 5,  group: "sosyal" }
      ],

      /* AYT — 160 soru */
      ayt: [
        { id: "matematik",   name: "Matematik",    icon: "fa-calculator", max: 40, group: "matematik" },

        /* Fen Bilimleri (40) */
        { id: "fizik",       name: "Fizik",        icon: "fa-atom",       max: 14, group: "fen" },
        { id: "kimya",       name: "Kimya",        icon: "fa-vial",       max: 13, group: "fen" },
        { id: "biyoloji",    name: "Biyoloji",     icon: "fa-dna",        max: 13, group: "fen" },

        /* Edebiyat – Sosyal Bilimler-1 (40) */
        { id: "edebiyat",    name: "Edebiyat",     icon: "fa-book-open",  max: 24, group: "edebiyatSos1" },
        { id: "tarih1",      name: "Tarih-1",      icon: "fa-landmark",   max: 10, group: "edebiyatSos1" },
        { id: "cografya1",   name: "Coğrafya-1",   icon: "fa-map",        max: 6,  group: "edebiyatSos1" },

        /* Sosyal Bilimler-2 (40) — Felsefe Grubu ayrı başlık */
        { id: "tarih2",      name: "Tarih-2",      icon: "fa-landmark",   max: 11, group: "sos2" },
        { id: "cografya2",   name: "Coğrafya-2",   icon: "fa-map",        max: 11, group: "sos2" },
        { id: "din",         name: "Din Kültürü",  icon: "fa-mosque",     max: 6,  group: "sos2" },

        /* Felsefe Grubu (12) — alt dağılım yıldan yıla değişebiliyor,
           toplam 12'yi bozmadan buradan düzeltilebilir */
        { id: "felsefe",     name: "Felsefe",      icon: "fa-brain",      max: 3,  group: "felsefeGrubu" },
        { id: "psikoloji",   name: "Psikoloji",    icon: "fa-user-doctor",max: 3,  group: "felsefeGrubu" },
        { id: "sosyoloji",   name: "Sosyoloji",    icon: "fa-people-group", max: 3, group: "felsefeGrubu" },
        { id: "mantik",      name: "Mantık",       icon: "fa-diagram-project", max: 3, group: "felsefeGrubu" }
      ],

      /* KPSS — 100 soru */
      kpss: [
        { id: "turkce",      name: "Türkçe",       icon: "fa-book",       max: 30, group: "genelYetenek" },
        { id: "matematik",   name: "Matematik",    icon: "fa-calculator", max: 30, group: "genelYetenek" },
        { id: "tarih",       name: "Tarih",        icon: "fa-landmark",   max: 15, group: "genelKultur" },
        { id: "cografya",    name: "Coğrafya",     icon: "fa-map",        max: 15, group: "genelKultur" },
        { id: "vatandaslik", name: "Vatandaşlık",  icon: "fa-flag",       max: 10, group: "genelKultur" }
      ]
    },

    /**
     * Şema 1 döneminde tek satır tutulan başlıklar ve karşılık
     * gelen alt dersler. Eski kayıtlar okunurken kullanılır.
     */
    legacy: {
      tyt: {
        fen:    ["fizik", "kimya", "biyoloji"],
        sosyal: ["tarih", "cografya", "felsefe", "din"]
      },
      ayt: {
        felsefe: ["felsefe", "psikoloji", "sosyoloji", "mantik"]
      },
      kpss: {}
    },

    /** Bir sınav türünün ders listesi */
    list: function (type) { return this.byType[type] || []; },

    /** Tür + ders kimliğinden ders kaydı */
    find: function (type, id) {
      var list = this.list(type);
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    },

    /** Sınav türünün kısa adı: "tyt" → "TYT" */
    typeLabel: function (type) {
      for (var i = 0; i < this.types.length; i++) {
        if (this.types[i].value === type) return this.types[i].label;
      }
      return "";
    },

    /** Sınav türündeki toplam soru sayısı */
    totalQuestions: function (type) {
      return this.list(type).reduce(function (sum, s) { return sum + s.max; }, 0);
    },

    /**
     * Dersleri üst başlıklara göre gruplar.
     * @returns {Array<{id:string, name:string, max:number, subjects:Array}>}
     */
    groupsOf: function (type) {
      var out = [], index = {}, self = this;

      this.list(type).forEach(function (subject) {
        var gid = subject.group || subject.id;
        if (!index[gid]) {
          index[gid] = {
            id: gid,
            name: self.groupNames[gid] || subject.name,
            max: 0,
            subjects: []
          };
          out.push(index[gid]);
        }
        index[gid].subjects.push(subject);
        index[gid].max += subject.max;
      });

      return out;
    },

    /**
     * Bir miktarı ağırlıklara göre tam sayı olarak paylaştırır.
     * Kalanlar en büyük ondalık artığa gider; toplam korunur.
     */
    _distribute: function (amount, weights) {
      var zeros = weights.map(function () { return 0; });
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      if (total <= 0 || amount <= 0) return zeros;

      var raw = weights.map(function (w) { return (amount * w) / total; });
      var out = raw.map(function (r) { return Math.floor(r); });
      var used = out.reduce(function (a, b) { return a + b; }, 0);

      var order = raw.map(function (r, i) { return { i: i, frac: r - Math.floor(r) }; })
        .sort(function (a, b) { return b.frac - a.frac; });

      for (var k = 0; k < amount - used; k++) out[order[k].i]++;
      return out;
    },

    /**
     * Bir deneme kaydının derslerini güncel kataloğa göre okur.
     *
     * Şema 1 kayıtlarında "Fen Bilimleri" gibi toplu satırlar
     * alt derslere soru sayısına orantılı dağıtılır. Doğru ve
     * yanlış toplamları korunduğu için toplam net değişmez;
     * yalnızca dersler arası dağılım bir tahmindir.
     *
     * @returns {Array} katalog sırasında, eksiksiz ders listesi
     */
    normalizeExamSubjects: function (exam) {
      var self = this;
      var type = exam && exam.type;
      var stored = (exam && Array.isArray(exam.subjects)) ? exam.subjects : [];
      var isLegacy = !exam || !(exam.v >= this.schemaVersion);
      var legacyMap = (isLegacy && this.legacy[type]) || {};
      var values = {};

      function put(id, correct, wrong) {
        values[id] = {
          correct: Math.max(0, parseInt(correct, 10) || 0),
          wrong: Math.max(0, parseInt(wrong, 10) || 0)
        };
      }

      stored.forEach(function (row) {
        if (!row || !row.id) return;

        var parts = legacyMap[row.id];
        if (!parts) { put(row.id, row.correct, row.wrong); return; }

        var defs = [];
        parts.forEach(function (pid) {
          var def = self.find(type, pid);
          if (def) defs.push(def);
        });
        if (!defs.length) { put(row.id, row.correct, row.wrong); return; }

        var weights = defs.map(function (d) { return d.max; });
        var corrects = self._distribute(Math.max(0, parseInt(row.correct, 10) || 0), weights);
        var wrongs = self._distribute(Math.max(0, parseInt(row.wrong, 10) || 0), weights);

        defs.forEach(function (d, i) { put(d.id, corrects[i], wrongs[i]); });
      });

      return this.list(type).map(function (def) {
        var v = values[def.id] || { correct: 0, wrong: 0 };
        var correct = Math.min(v.correct, def.max);
        var wrong = Math.min(v.wrong, def.max - correct);

        return {
          id: def.id,
          name: def.name,
          icon: def.icon,
          group: def.group,
          max: def.max,
          correct: correct,
          wrong: wrong,
          blank: def.max - correct - wrong,
          net: correct - wrong / 4
        };
      });
    }
  };

  /* ==========================================================
     2) UTILS — Küçük yardımcılar
     ========================================================== */
  YKS.Utils = {
    /** Tek eleman seçer */
    qs: function (sel, root) { return (root || document).querySelector(sel); },

    /** Çoklu eleman seçer, gerçek diziye çevirir */
    qsa: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },

    /** Çakışmayan basit kimlik üretir ("u" kullanıcı, "a" başvuru) */
    uid: function (prefix) {
      return (prefix || "u") + "_" + Date.now().toString(36) + "_" +
        Math.random().toString(36).slice(2, 8);
    },

    /** HTML enjeksiyonunu engellemek için metni kaçırır */
    escape: function (str) {
      return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },

    /** Tarihi Türkçe okunur biçime çevirir */
    formatDate: function (ts) {
      try {
        return new Date(ts).toLocaleDateString("tr-TR", {
          day: "2-digit", month: "long", year: "numeric"
        });
      } catch (e) { return "-"; }
    },

    /** Değer listesinden etiket bulur (ör. "sayisal" → "Sayısal") */
    labelOf: function (list, value) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].value === value) return list[i].label;
      }
      return value || "-";
    },

    /** Sık tetiklenen olayları yavaşlatır (arama kutusu vb.) */
    debounce: function (fn, wait) {
      var t;
      return function () {
        var ctx = this, args = arguments;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
      };
    },

    /** Kullanıcı adını normalleştirir: küçük harf, boşluksuz */
    normalizeUsername: function (name) {
      return String(name || "").trim().toLowerCase().replace(/\s+/g, "");
    },

    /** E-postayı normalleştirir: küçük harf, boşluksuz */
    normalizeEmail: function (mail) {
      return String(mail || "").trim().toLowerCase().replace(/\s+/g, "");
    },

    /** Ad Soyad → baş harfler (avatar yoksa kullanılır) */
    initials: function (fullName, username) {
      var src = (fullName || username || "?").trim();
      var parts = src.split(/\s+/).slice(0, 2);
      return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join("");
    },

    /** Avatar yoksa baş harflerden SVG veri-URL'i üretir */
    fallbackAvatar: function (fullName, username) {
      var txt = YKS.Utils.initials(fullName, username);
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#5b6cff"/><stop offset="1" stop-color="#a259ff"/>' +
        "</linearGradient></defs>" +
        '<rect width="160" height="160" fill="url(#g)"/>' +
        '<text x="50%" y="50%" dy="0.35em" text-anchor="middle" ' +
        'font-family="Poppins,sans-serif" font-size="62" font-weight="600" fill="#fff">' +
        txt + "</text></svg>";
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
  };

  /* ==========================================================
     3) VALIDATE — Ortak doğrulama kuralları
     ----------------------------------------------------------
     Hem başvuru formu hem yönetici formu aynı kuralları kullanır;
     böylece iki yerde farklı davranan doğrulama olmaz.
     ========================================================== */
  YKS.Validate = {
    /** İzin verilen alan adlarını okunur bir dizeye çevirir */
    emailDomainList: function (sep) {
      return YKS.Config.allowedEmailDomains.join(sep || ", ");
    },

    /**
     * E-posta kontrolü: biçim + sağlayıcı listesi.
     * @returns {{ok:boolean, email?:string, error?:string}}
     */
    email: function (raw) {
      var email = YKS.Utils.normalizeEmail(raw);

      if (!email) {
        return { ok: false, error: "E-posta adresi zorunlu." };
      }
      /* Basit ama işe yarar biçim kontrolü: tek @, iki yanı dolu,
         ard arda nokta yok, alan adında en az bir nokta var. */
      if (!/^[a-z0-9]([a-z0-9._%+-]*[a-z0-9])?@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(email) ||
          email.indexOf("..") !== -1) {
        return { ok: false, error: "Geçerli bir e-posta adresi gir." };
      }

      var domain = email.split("@")[1];
      if (YKS.Config.allowedEmailDomains.indexOf(domain) === -1) {
        return {
          ok: false,
          error: "Yalnızca şu e-posta adresleri kabul ediliyor: " + this.emailDomainList()
        };
      }
      return { ok: true, email: email };
    }
  };

  /* ==========================================================
     4) CACHE — Sunucudan çekilen verinin bellek kopyası
     ----------------------------------------------------------
     Supabase asenkron, localStorage senkrondu. Bütün okuma
     çağrılarını (192 adet) async yapmamak için şu yol seçildi:
     sayfa açılışında gereken veri BİR KEZ çekilir, buraya konur,
     okuma metotları buradan senkron okumaya devam eder.
     Yazmalar sunucuya gider ve dönüşte burayı tazeler.

     YKS.hazir(cb) bu yükleme bitince çalışır; sayfalar
     DOMContentLoaded yerine onu kullanır.
     ========================================================== */
  YKS.Cache = {
    profiller: [],          /* profiles tablosunun tamamı */
    oturum: null,           /* Supabase oturumu */
    benimId: null,

    /**
     * Giriş yapmış kullanıcının kişisel modül verisini çeker.
     *
     * İki tablo:
     *   user_data    → dersler, denemeler, sureler, hedefler, rozetler…
     *                  (herkese açık okuma; liderlik tabloları buna bakar)
     *   user_journal → gunluk (YALNIZCA sahibine açık)
     *
     * Günlük ayrı tutuluyor çünkü ruh hâli ve serbest metin içeriyor;
     * liderlik tablosu uğruna herkese açılmamalı.
     */
    verimiYukle: function () {
      if (!YKS.SB || !YKS.Cache.benimId) return Promise.resolve(false);
      var id = YKS.Cache.benimId;

      return Promise.all([
        YKS.SB.from("user_data").select("data").eq("user_id", id).maybeSingle(),
        YKS.SB.from("user_journal").select("entries").eq("user_id", id).maybeSingle()
      ]).then(function (r) {
        var profil = YKS.Users.byId(id);
        if (!profil) return false;

        var d = (r[0].data && r[0].data.data) || {};
        if (typeof d !== "object" || Array.isArray(d)) d = {};

        var g = (r[1].data && r[1].data.entries) || [];
        d.gunluk = Array.isArray(g) ? g : [];

        profil.data = d;
        return true;
      });
    },

    /** Profilleri sunucudan tazeler */
    profilleriYukle: function () {
      if (!YKS.SB) return Promise.resolve(false);

      return YKS.SB.from("profiles")
        .select("id, username, full_name, age, exam_field, description, avatar_url, banner_url, role, created_at, updated_at")
        .order("created_at", { ascending: true })
        .then(function (r) {
          if (r.error) {
            console.error("[YKS] Profiller yüklenemedi:", r.error.message);
            return false;
          }
          YKS.Cache.profiller = (r.data || []).map(YKS.Cache.profilCevir);
          return true;
        });
    },

    /**
     * Veritabanı satırını uygulamanın beklediği biçime çevirir.
     * Sütun adları snake_case, kod ise camelCase bekliyor; çeviriyi
     * tek yerde yapıp 192 okuma çağrısına dokunmuyoruz.
     */
    profilCevir: function (row) {
      return {
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        age: row.age,
        examField: row.exam_field,
        description: row.description || "",
        avatar: row.avatar_url,
        banner: row.banner_url,
        role: row.role,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,

        /* Kişisel modül verisi ayrı tabloda; 3. aşamada bağlanacak.
           Şimdilik boş dursun ki rozet/istatistik kodu çökmesin. */
        data: {}
      };
    }
  };

  /* ==========================================================
     4b) HAZIR KAPISI
     ----------------------------------------------------------
     Sayfalar şöyle kullanır:
         YKS.hazir(function () { ... });
     DOM yüklendiğinde VE oturum + profiller geldiğinde çalışır.
     ========================================================== */
  (function () {
    var bekleyenler = [];
    var hazirMi = false;

    function domSozu() {
      return new Promise(function (resolve) {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", resolve);
        } else { resolve(); }
      });
    }

    function baslat() {
      if (!YKS.SB) {
        console.error("[YKS] Supabase istemcisi yok — sb.js yüklendi mi?");
        return domSozu();
      }

      return YKS.SB.auth.getSession()
        .then(function (s) {
          YKS.Cache.oturum = (s.data && s.data.session) || null;
          YKS.Cache.benimId = YKS.Cache.oturum ? YKS.Cache.oturum.user.id : null;

          /* Oturum yoksa profilleri çekmenin anlamı yok:
             RLS zaten boş döndürür. */
          if (!YKS.Cache.oturum) return true;
          return YKS.Cache.profilleriYukle().then(function () {
            return YKS.Cache.verimiYukle();
          });
        })
        .then(domSozu)
        .catch(function (e) {
          console.error("[YKS] Açılış hatası:", e);
          return domSozu();
        });
    }

    var acilis = baslat().then(function () {
      hazirMi = true;
      bekleyenler.forEach(function (cb) {
        try { cb(); } catch (e) { console.error("[YKS] hazir geri çağrısı:", e); }
      });
      bekleyenler = [];
    });

    YKS.hazir = function (cb) {
      if (typeof cb !== "function") return acilis;
      if (hazirMi) { cb(); return acilis; }
      bekleyenler.push(cb);
      return acilis;
    };

    /* Oturum başka sekmede değişirse (giriş/çıkış) önbelleği tazele */
    if (YKS.SB) {
      YKS.SB.auth.onAuthStateChange(function (olay, oturum) {
        YKS.Cache.oturum = oturum || null;
        YKS.Cache.benimId = oturum ? oturum.user.id : null;
        if (olay === "SIGNED_OUT") YKS.Cache.profiller = [];
      });
    }
  })();


  /* ==========================================================
     5) STORE — LocalStorage sarmalayıcı
     ========================================================== */
  YKS.Store = {
    /** JSON okur; bozuk veri varsa varsayılana döner */
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        console.warn("[YKS] Okunamayan kayıt:", key, e);
        return fallback;
      }
    },

    /** JSON yazar; kota dolarsa false döner */
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error("[YKS] Kayıt yazılamadı:", key, e);
        YKS.Toast.show("Depolama alanı dolu. Görselleri küçültüp tekrar deneyin.", "error");
        return false;
      }
    },

    remove: function (key) { localStorage.removeItem(key); },

    /** Sadece bu uygulamaya ait anahtarları temizler */
    clearApp: function () {
      var k = YKS.Config.keys;
      Object.keys(k).forEach(function (name) { localStorage.removeItem(k[name]); });
    }
  };

  /* ==========================================================
     6) USERS — Profiller
     ----------------------------------------------------------
     Kaynak artık localStorage değil, Supabase'deki profiles
     tablosu. Şifre burada TUTULMAZ: kimlik doğrulama tamamen
     auth.users tarafında, şifreler sunucuda bcrypt ile.

     OKUMALAR SENKRON: hepsi YKS.Cache.profiller'den okur, böylece
     çağıran kodun değişmesi gerekmez.
     YAZMALAR ASENKRON: Promise döner, çağıran await/then kullanır.
     ========================================================== */
  YKS.Users = {
    /* ---------- Okumalar (senkron, önbellekten) ---------- */

    all: function () {
      return YKS.Cache.profiller.slice();
    },

    byId: function (id) {
      if (!id) return null;
      var l = YKS.Cache.profiller;
      for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
      return null;
    },

    byUsername: function (username) {
      var key = YKS.Utils.normalizeUsername(username);
      var l = YKS.Cache.profiller;
      for (var i = 0; i < l.length; i++) {
        if (YKS.Utils.normalizeUsername(l[i].username) === key) return l[i];
      }
      return null;
    },

    /** Kullanıcı adı boşta mı — kayıt formu için */
    usernameAlinmis: function (username) {
      return !!this.byUsername(username);
    },

    stats: function () {
      var l = YKS.Cache.profiller;
      function alan(v) {
        return l.filter(function (u) { return u.examField === v; }).length;
      }
      return {
        total: l.length,
        admins: l.filter(function (u) { return u.role === "admin"; }).length,
        members: l.filter(function (u) { return u.role !== "admin"; }).length,
        sayisal: alan("sayisal"),
        esit: alan("esit-agirlik"),
        sozel: alan("sozel")
      };
    },

    /* ---------- Yazmalar (asenkron, sunucuya) ---------- */

    /**
     * Profili günceller.
     * role alanı bilerek dışarıda: veritabanındaki
     * profiles_guard_role tetikleyicisi zaten geri alıyor, ama
     * buradan da göndermeyerek niyeti açık tutuyoruz.
     * Rol değişimi için setRole() var (yalnızca admin çalıştırabilir).
     */
    update: function (id, patch) {
      if (!YKS.SB) return YKS.Users._sonuc(Promise.resolve({ ok: false, error: "Bağlantı yok." }), false);

      var isler = [];

      /* --- Profil alanları --- */
      var satir = {};
      if (patch.fullName !== undefined)    satir.full_name = String(patch.fullName).trim();
      if (patch.age !== undefined)         satir.age = parseInt(patch.age, 10) || null;
      if (patch.examField !== undefined)   satir.exam_field = patch.examField;
      if (patch.description !== undefined) satir.description = String(patch.description || "").trim();
      if (patch.avatar !== undefined)      satir.avatar_url = patch.avatar;
      if (patch.banner !== undefined)      satir.banner_url = patch.banner;

      if (Object.keys(satir).length) {
        isler.push(
          YKS.SB.from("profiles").update(satir).eq("id", id).select().single()
            .then(function (r) {
              if (r.error) throw new Error(YKS.sbHata(r.error));
              YKS.Users._onbellegeYaz(r.data);
            })
        );
      }

      /* --- Kişisel modül verisi --- */
      if (patch.data !== undefined) {
        var veri = patch.data || {};
        var gunluk = Array.isArray(veri.gunluk) ? veri.gunluk : [];

        /* Günlük ayrı tabloya; kalanı user_data'ya */
        var kalan = {};
        Object.keys(veri).forEach(function (k) {
          if (k !== "gunluk") kalan[k] = veri[k];
        });

        isler.push(
          YKS.SB.from("user_data").upsert({ user_id: id, data: kalan, updated_at: new Date().toISOString() })
            .then(function (r) { if (r.error) throw new Error(YKS.sbHata(r.error)); })
        );
        isler.push(
          YKS.SB.from("user_journal").upsert({ user_id: id, entries: gunluk, updated_at: new Date().toISOString() })
            .then(function (r) { if (r.error) throw new Error(YKS.sbHata(r.error)); })
        );

        /* Önbelleği hemen güncelle — arayüz beklemesin */
        var profil = YKS.Users.byId(id);
        if (profil) profil.data = veri;
      }

      var sozu = Promise.all(isler)
        .then(function () { return { ok: true, user: YKS.Users.byId(id) }; })
        .catch(function (e) {
          YKS.Toast.show(e.message || "Kaydedilemedi.", "error");
          return { ok: false, error: e.message };
        });

      return YKS.Users._sonuc(sozu, true);
    },

    /**
     * GEÇİŞ KÖPRÜSÜ.
     *
     * 11 modül şu kalıbı kullanıyor:
     *     var r = YKS.Users.update(id, { data: ... });
     *     if (!r.ok) { hata göster }
     * localStorage senkrondu, Supabase değil. Hepsini birden async
     * yapmak yerine dönen Promise'e iyimser bir .ok ekliyoruz:
     *   • Eski senkron çağıranlar r.ok görür (iyimser: true)
     *   • Yeni çağıranlar .then() ile GERÇEK sonucu alır
     * Yazma gerçekten başarısız olursa yukarıdaki catch kullanıcıya
     * hata balonu gösterir — sessiz veri kaybı olmaz.
     */
    _sonuc: function (sozu, iyimser) {
      sozu.ok = !!iyimser;
      return sozu;
    },

    /** Rol değiştirir — RLS ve tetikleyici yalnızca admine izin verir */
    setRole: function (id, role) {
      if (!YKS.SB) return Promise.resolve({ ok: false, error: "Bağlantı yok." });

      return YKS.SB.from("profiles")
        .update({ role: role === "admin" ? "admin" : "uye" })
        .eq("id", id).select().single()
        .then(function (r) {
          if (r.error) return { ok: false, error: YKS.sbHata(r.error) };

          /* Tetikleyici sessizce geri almış olabilir — dönen değeri
             kontrol et ki arayüz yalan söylemesin. */
          if (r.data.role !== role) {
            return { ok: false, error: "Rol değiştirilemedi: yetkin yok." };
          }
          YKS.Users._onbellegeYaz(r.data);
          return { ok: true };
        });
    },

    /** Hesabı siler — RLS yalnızca admine izin verir */
    remove: function (id) {
      if (!YKS.SB) return Promise.resolve({ ok: false, error: "Bağlantı yok." });

      return YKS.SB.from("profiles").delete().eq("id", id)
        .then(function (r) {
          if (r.error) return { ok: false, error: YKS.sbHata(r.error) };
          YKS.Cache.profiller = YKS.Cache.profiller.filter(function (u) {
            return u.id !== id;
          });
          return { ok: true };
        });
    },

    /** Profilleri sunucudan yeniden çeker */
    tazele: function () { return YKS.Cache.profilleriYukle(); },

    /* ---------- İç yardımcı ---------- */
    _onbellegeYaz: function (row) {
      var profil = YKS.Cache.profilCevir(row);
      var l = YKS.Cache.profiller;
      for (var i = 0; i < l.length; i++) {
        if (l[i].id === profil.id) {
          /* data alanı ayrı tablodan geliyor; ezme */
          profil.data = l[i].data || {};
          l[i] = profil;
          return;
        }
      }
      l.push(profil);
    }
  };


  /* ==========================================================
     7b) ANNOUNCEMENTS — Duyurular
     ----------------------------------------------------------
     Duyurular tek bir ortak listede tutulur, kullanıcı kaydına
     değil. Yöneticiler yazar, herkes okur.

     Sabitlenen duyurular listenin başında kalır, geri kalanlar
     yeniden eskiye sıralanır.
     ========================================================== */
  YKS.Announcements = {
    /** Tümü — sabitlenenler önce, sonra yeniden eskiye */
    all: function () {
      var list = YKS.Store.get(YKS.Config.keys.announcements, []);
      if (!Array.isArray(list)) return [];

      return list.slice().sort(function (a, b) {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },

    saveAll: function (list) {
      return YKS.Store.set(YKS.Config.keys.announcements, list);
    },

    byId: function (id) {
      return this.all().filter(function (a) { return a.id === id; })[0] || null;
    },

    count: function () { return this.all().length; },

    /** Belirtilen andan sonra yayımlanan duyuru sayısı */
    unreadCount: function (since) {
      if (!since) return this.count();
      return this.all().filter(function (a) {
        return (a.createdAt || 0) > since;
      }).length;
    },

    /** Geçerli tür mü; değilse "info" */
    _level: function (value) {
      var levels = YKS.Config.announcementLevels;
      for (var i = 0; i < levels.length; i++) {
        if (levels[i].value === value) return value;
      }
      return "info";
    },

    /** Tür etiketi ve ikonu */
    levelInfo: function (value) {
      var levels = YKS.Config.announcementLevels;
      for (var i = 0; i < levels.length; i++) {
        if (levels[i].value === value) return levels[i];
      }
      return levels[0];
    },

    /**
     * Girdiyi doğrular.
     * @returns {{ok:boolean, error?:string, value?:object}}
     */
    _validate: function (input) {
      var limits = YKS.Config.announcement;
      var title = String(input.title || "").trim();
      var body = String(input.body || "").trim();

      if (title.length < limits.titleMin) {
        return { ok: false, error: "Başlık en az " + limits.titleMin + " karakter olmalı." };
      }
      if (title.length > limits.titleMax) {
        return { ok: false, error: "Başlık en fazla " + limits.titleMax + " karakter olabilir." };
      }
      if (body.length < limits.bodyMin) {
        return { ok: false, error: "Duyuru metni boş bırakılamaz." };
      }
      if (body.length > limits.bodyMax) {
        return { ok: false, error: "Duyuru metni en fazla " + limits.bodyMax + " karakter olabilir." };
      }

      return {
        ok: true,
        value: {
          title: title,
          body: body,
          level: this._level(input.level),
          pinned: !!input.pinned
        }
      };
    },

    /** Depodaki ham liste (sıralanmamış) */
    _raw: function () {
      var list = YKS.Store.get(YKS.Config.keys.announcements, []);
      return Array.isArray(list) ? list : [];
    },

    /**
     * Yeni duyuru yayımlar.
     * Arayüz zaten yalnızca yöneticiye gösteriyor; yetki burada
     * bir kez daha doğrulanıyor ki tek kapıdan geçsin.
     */
    create: function (input) {
      if (!YKS.Auth.isAdmin()) {
        return { ok: false, error: "Duyuru yayımlamak için yönetici olman gerekiyor." };
      }

      var check = this._validate(input);
      if (!check.ok) return check;

      var session = YKS.Auth.session();
      var author = YKS.Auth.currentUser();

      var announcement = {
        id: YKS.Utils.uid("d"),
        title: check.value.title,
        body: check.value.body,
        level: check.value.level,
        pinned: check.value.pinned,

        /* Kurucu oturumunun kullanıcı kaydı yok */
        authorId: author ? author.id : null,
        authorName: author ? author.fullName : "Kurucu",
        authorUsername: session ? session.username : "kurucu",

        createdAt: Date.now(),
        updatedAt: null
      };

      var list = this._raw();
      list.push(announcement);

      if (!this.saveAll(list)) {
        return { ok: false, error: "Duyuru kaydedilemedi. Depolama alanı dolu olabilir." };
      }
      return { ok: true, announcement: announcement };
    },

    /** Var olan duyuruyu günceller */
    update: function (id, input) {
      if (!YKS.Auth.isAdmin()) {
        return { ok: false, error: "Duyuruyu düzenlemek için yönetici olman gerekiyor." };
      }

      var check = this._validate(input);
      if (!check.ok) return check;

      var found = false;
      var list = this._raw().map(function (a) {
        if (a.id !== id) return a;
        found = true;
        return Object.assign({}, a, check.value, { updatedAt: Date.now() });
      });

      if (!found) return { ok: false, error: "Duyuru bulunamadı." };
      return this.saveAll(list)
        ? { ok: true }
        : { ok: false, error: "Duyuru güncellenemedi." };
    },

    /** Sabitleme durumunu ters çevirir */
    togglePin: function (id) {
      if (!YKS.Auth.isAdmin()) {
        return { ok: false, error: "Bu işlem için yönetici olman gerekiyor." };
      }

      var found = false, pinned = false;
      var list = this._raw().map(function (a) {
        if (a.id !== id) return a;
        found = true;
        pinned = !a.pinned;
        return Object.assign({}, a, { pinned: pinned });
      });

      if (!found) return { ok: false, error: "Duyuru bulunamadı." };
      return this.saveAll(list)
        ? { ok: true, pinned: pinned }
        : { ok: false, error: "Duyuru güncellenemedi." };
    },

    remove: function (id) {
      if (!YKS.Auth.isAdmin()) {
        return { ok: false, error: "Duyuruyu silmek için yönetici olman gerekiyor." };
      }

      var list = this._raw().filter(function (a) { return a.id !== id; });
      return this.saveAll(list)
        ? { ok: true }
        : { ok: false, error: "Duyuru silinemedi." };
    }
  };

  /* ==========================================================
     8) FRIENDS — Arkadaşlık istekleri ve arkadaş listesi
     ----------------------------------------------------------
     Tek bir ortak listede tutulur. Bir kayıt iki kişiyi bağlar:

       { id, fromId, toId, status, createdAt, decidedAt }

     status "pending"  → istek gönderildi, cevap bekliyor
     status "accepted" → arkadaşlar

     Reddedilen istek listeden düşer; böylece aynı kişiye
     ileride yeniden istek gönderilebilir.
     ========================================================== */
  YKS.Friends = {
    /** Depodaki ham liste */
    _raw: function () {
      var list = YKS.Store.get(YKS.Config.keys.friendships, []);
      return Array.isArray(list) ? list : [];
    },

    saveAll: function (list) {
      return YKS.Store.set(YKS.Config.keys.friendships, list);
    },

    all: function () { return this._raw(); },

    byId: function (id) {
      return this._raw().filter(function (f) { return f.id === id; })[0] || null;
    },

    /** İki kişi arasındaki kayıt (yönü fark etmeksizin) */
    between: function (a, b) {
      return this._raw().filter(function (f) {
        return (f.fromId === a && f.toId === b) || (f.fromId === b && f.toId === a);
      })[0] || null;
    },

    /**
     * İki kişinin ilişkisi — arayüz buna göre düğme seçer.
     * @returns {"self"|"none"|"friends"|"outgoing"|"incoming"}
     */
    statusBetween: function (viewerId, otherId) {
      if (viewerId === otherId) return "self";

      var rec = this.between(viewerId, otherId);
      if (!rec) return "none";
      if (rec.status === "accepted") return "friends";
      return rec.fromId === viewerId ? "outgoing" : "incoming";
    },

    areFriends: function (a, b) {
      var rec = this.between(a, b);
      return !!(rec && rec.status === "accepted");
    },

    /**
     * Arkadaşlık isteği gönderir.
     * Karşı taraf zaten istek göndermişse istek beklemeye
     * alınmaz, doğrudan arkadaşlığa çevrilir.
     */
    request: function (fromId, toId) {
      if (!fromId || !toId) return { ok: false, error: "Kullanıcı bulunamadı." };
      if (fromId === toId) return { ok: false, error: "Kendine istek gönderemezsin." };

      if (!YKS.Users.byId(fromId) || !YKS.Users.byId(toId)) {
        return { ok: false, error: "Kullanıcı bulunamadı." };
      }

      var existing = this.between(fromId, toId);
      if (existing && existing.status === "accepted") {
        return { ok: false, error: "Zaten arkadaşsınız." };
      }

      if (existing && existing.status === "pending") {
        /* Karşılıklı istek → anında arkadaş */
        if (existing.toId === fromId) {
          return this.accept(existing.id, fromId);
        }
        return { ok: false, error: "Bu kişiye zaten istek gönderdin." };
      }

      var record = {
        id: YKS.Utils.uid("f"),
        fromId: fromId,
        toId: toId,
        status: "pending",
        createdAt: Date.now(),
        decidedAt: null
      };

      var list = this._raw();
      list.push(record);

      if (!this.saveAll(list)) {
        return { ok: false, error: "İstek kaydedilemedi. Depolama alanı dolu olabilir." };
      }
      return { ok: true, friendship: record };
    },

    /** İsteği kabul eder — yalnızca isteğin gönderildiği kişi yapabilir */
    accept: function (id, byUserId) {
      var found = null;
      var list = this._raw().map(function (f) {
        if (f.id !== id) return f;
        found = f;
        return Object.assign({}, f, { status: "accepted", decidedAt: Date.now() });
      });

      if (!found) return { ok: false, error: "İstek bulunamadı." };
      if (found.toId !== byUserId) return { ok: false, error: "Bu isteği yanıtlayamazsın." };

      return this.saveAll(list)
        ? { ok: true, friendship: this.byId(id) }
        : { ok: false, error: "İstek güncellenemedi." };
    },

    /** İsteği reddeder veya gönderilen isteği geri çeker */
    reject: function (id, byUserId) {
      var found = this.byId(id);
      if (!found) return { ok: false, error: "İstek bulunamadı." };
      if (found.status !== "pending") return { ok: false, error: "Bu istek zaten yanıtlanmış." };
      if (found.toId !== byUserId && found.fromId !== byUserId) {
        return { ok: false, error: "Bu isteği yanıtlayamazsın." };
      }

      var list = this._raw().filter(function (f) { return f.id !== id; });
      return this.saveAll(list) ? { ok: true } : { ok: false, error: "İstek silinemedi." };
    },

    /** Arkadaşlıktan çıkarır; sohbet geçmişi korunur */
    unfriend: function (a, b) {
      var rec = this.between(a, b);
      if (!rec || rec.status !== "accepted") {
        return { ok: false, error: "Bu kişi arkadaş listende değil." };
      }

      var list = this._raw().filter(function (f) { return f.id !== rec.id; });
      return this.saveAll(list) ? { ok: true } : { ok: false, error: "İşlem tamamlanamadı." };
    },

    /** Kabul edilmiş arkadaşların kullanıcı kayıtları */
    friendsOf: function (userId) {
      var out = [];
      this._raw().forEach(function (f) {
        if (f.status !== "accepted") return;
        var otherId = f.fromId === userId ? f.toId : (f.toId === userId ? f.fromId : null);
        if (!otherId) return;
        var user = YKS.Users.byId(otherId);
        if (user) out.push(user);
      });
      return out.sort(function (a, b) { return a.fullName.localeCompare(b.fullName, "tr"); });
    },

    /** Bana gelen bekleyen istekler */
    incoming: function (userId) {
      return this._raw()
        .filter(function (f) { return f.status === "pending" && f.toId === userId; })
        .sort(function (a, b) { return b.createdAt - a.createdAt; });
    },

    /** Benim gönderdiğim, cevap bekleyen istekler */
    outgoing: function (userId) {
      return this._raw()
        .filter(function (f) { return f.status === "pending" && f.fromId === userId; })
        .sort(function (a, b) { return b.createdAt - a.createdAt; });
    },

    counts: function (userId) {
      return {
        friends: this.friendsOf(userId).length,
        incoming: this.incoming(userId).length,
        outgoing: this.outgoing(userId).length
      };
    },

    /** Hesap silindiğinde ilgili bağları temizler */
    purgeUser: function (userId) {
      var list = this._raw().filter(function (f) {
        return f.fromId !== userId && f.toId !== userId;
      });
      return this.saveAll(list);
    }
  };

  /* ==========================================================
     9) MESSAGES — Birebir mesajlaşma
     ----------------------------------------------------------
     Mesajlar tek düz listede durur; her kayıt iki kişiyi
     bağlayan bir "thread" anahtarı taşır:

       { id, thread, fromId, toId, text, createdAt, readAt }

     Yalnızca arkadaş olanlar birbirine yazabilir. Yöneticiler
     historyOf() ile bir kişinin tüm yazışmalarını sorgular.
     ========================================================== */
  YKS.Messages = {
    _raw: function () {
      var list = YKS.Store.get(YKS.Config.keys.messages, []);
      return Array.isArray(list) ? list : [];
    },

    saveAll: function (list) {
      return YKS.Store.set(YKS.Config.keys.messages, list);
    },

    /** Tüm mesajlar — YKS.Friends.all() ile aynı desen */
    all: function () { return this._raw(); },

    /** İki kişi için sabit sohbet anahtarı (sıra fark etmez) */
    threadKey: function (a, b) {
      return [a, b].sort().join("|");
    },

    byId: function (id) {
      return this._raw().filter(function (m) { return m.id === id; })[0] || null;
    },

    /**
     * Mesaj gönderir.
     * Arkadaşlık kontrolü burada yapılır; arayüz zaten yalnızca
     * arkadaşlara yazdırıyor, kural tek kapıdan geçsin diye
     * veri katmanında bir kez daha doğrulanıyor.
     */
    send: function (fromId, toId, text) {
      var body = String(text == null ? "" : text).trim();

      if (!fromId || !toId) return { ok: false, error: "Alıcı bulunamadı." };
      if (fromId === toId) return { ok: false, error: "Kendine mesaj gönderemezsin." };
      if (!body) return { ok: false, error: "Boş mesaj gönderilemez." };

      if (body.length > YKS.Config.message.textMax) {
        return { ok: false, error: "Mesaj en fazla " + YKS.Config.message.textMax + " karakter olabilir." };
      }

      if (!YKS.Users.byId(toId)) return { ok: false, error: "Alıcı bulunamadı." };

      if (!YKS.Friends.areFriends(fromId, toId)) {
        return { ok: false, error: "Yalnızca arkadaş listendeki kişilere mesaj gönderebilirsin." };
      }

      var message = {
        id: YKS.Utils.uid("m"),
        thread: this.threadKey(fromId, toId),
        fromId: fromId,
        toId: toId,
        text: body,
        createdAt: Date.now(),
        readAt: null
      };

      var list = this._raw();
      list.push(message);

      if (!this.saveAll(list)) {
        return { ok: false, error: "Mesaj gönderilemedi. Depolama alanı dolu olabilir." };
      }
      return { ok: true, message: message };
    },

    /** İki kişi arasındaki tüm mesajlar — eskiden yeniye */
    thread: function (a, b) {
      var key = this.threadKey(a, b);
      return this._raw()
        .filter(function (m) { return m.thread === key; })
        .sort(function (x, y) { return x.createdAt - y.createdAt; });
    },

    /**
     * Kullanıcının sohbet listesi.
     * Her satır: karşı taraf, son mesaj ve okunmamış sayısı.
     */
    conversations: function (userId) {
      var index = {};

      this._raw().forEach(function (m) {
        if (m.fromId !== userId && m.toId !== userId) return;

        var peerId = m.fromId === userId ? m.toId : m.fromId;
        if (!index[peerId]) {
          index[peerId] = { peerId: peerId, last: null, unread: 0, total: 0 };
        }

        var row = index[peerId];
        row.total++;

        /* Eşit zaman damgasında sonradan eklenen kazanır; sohbet
           listesindeki önizleme ile balonların sırası uyuşsun */
        if (!row.last || m.createdAt >= row.last.createdAt) row.last = m;
        if (m.toId === userId && !m.readAt) row.unread++;
      });

      return Object.keys(index).map(function (peerId) {
        var row = index[peerId];
        row.peer = YKS.Users.byId(peerId);
        return row;
      }).filter(function (row) {
        return !!row.peer;
      }).sort(function (a, b) {
        return b.last.createdAt - a.last.createdAt;
      });
    },

    /** Karşı taraftan gelen okunmamışları okundu yapar */
    markRead: function (userId, peerId) {
      var key = this.threadKey(userId, peerId);
      var changed = 0;

      var list = this._raw().map(function (m) {
        if (m.thread !== key || m.toId !== userId || m.readAt) return m;
        changed++;
        return Object.assign({}, m, { readAt: Date.now() });
      });

      if (!changed) return { ok: true, changed: 0 };
      return this.saveAll(list)
        ? { ok: true, changed: changed }
        : { ok: false, error: "Okundu bilgisi yazılamadı." };
    },

    /** Kullanıcının toplam okunmamış mesaj sayısı */
    unreadTotal: function (userId) {
      return this._raw().filter(function (m) {
        return m.toId === userId && !m.readAt;
      }).length;
    },

    /** Kendi mesajını siler; yönetici her mesajı silebilir */
    remove: function (id, byUserId) {
      var message = this.byId(id);
      if (!message) return { ok: false, error: "Mesaj bulunamadı." };

      if (message.fromId !== byUserId && !YKS.Auth.isAdmin()) {
        return { ok: false, error: "Yalnızca kendi mesajını silebilirsin." };
      }

      var list = this._raw().filter(function (m) { return m.id !== id; });
      return this.saveAll(list) ? { ok: true } : { ok: false, error: "Mesaj silinemedi." };
    },

    /* ---------- Yönetici sorgusu ---------- */

    /**
     * Bir kişinin bütün yazışmaları — karşı tarafa göre gruplanır.
     * Denetim amaçlı olduğu için yalnızca yöneticiye açıktır.
     * @returns {{ok:boolean, error?:string, user?:object, threads?:Array, stats?:object}}
     */
    historyOf: function (userId) {
      if (!YKS.Auth.isAdmin()) {
        return { ok: false, error: "Mesaj geçmişini yalnızca yöneticiler sorgulayabilir." };
      }

      var user = YKS.Users.byId(userId);
      if (!user) return { ok: false, error: "Kullanıcı bulunamadı." };

      var index = {};
      var sent = 0, received = 0, first = null, last = null;

      this._raw().forEach(function (m) {
        if (m.fromId !== userId && m.toId !== userId) return;

        if (m.fromId === userId) sent++; else received++;
        if (first === null || m.createdAt < first) first = m.createdAt;
        if (last === null || m.createdAt > last) last = m.createdAt;

        var peerId = m.fromId === userId ? m.toId : m.fromId;
        if (!index[peerId]) index[peerId] = { peerId: peerId, messages: [] };
        index[peerId].messages.push(m);
      });

      var threads = Object.keys(index).map(function (peerId) {
        var row = index[peerId];
        row.messages.sort(function (a, b) { return a.createdAt - b.createdAt; });
        row.peer = YKS.Users.byId(peerId);
        row.peerName = row.peer ? row.peer.fullName : "Silinmiş hesap";
        row.peerUsername = row.peer ? row.peer.username : "silinmis";
        row.count = row.messages.length;
        row.lastAt = row.messages[row.messages.length - 1].createdAt;
        return row;
      }).sort(function (a, b) { return b.lastAt - a.lastAt; });

      return {
        ok: true,
        user: user,
        threads: threads,
        stats: {
          total: sent + received,
          sent: sent,
          received: received,
          threads: threads.length,
          firstAt: first,
          lastAt: last
        }
      };
    },

    /** Tüm mesajlarda metin arar — yalnızca yönetici */
    search: function (query) {
      if (!YKS.Auth.isAdmin()) {
        return { ok: false, error: "Bu sorgu için yönetici olman gerekiyor." };
      }

      var q = String(query || "").trim().toLocaleLowerCase("tr");
      if (!q) return { ok: true, matches: [] };

      var matches = this._raw().filter(function (m) {
        return String(m.text || "").toLocaleLowerCase("tr").indexOf(q) !== -1;
      }).sort(function (a, b) { return b.createdAt - a.createdAt; });

      return { ok: true, matches: matches };
    },

    /** Panel özeti için genel sayılar */
    stats: function () {
      var list = this._raw();
      var threads = {};
      list.forEach(function (m) { threads[m.thread] = true; });

      return {
        total: list.length,
        threads: Object.keys(threads).length,
        unread: list.filter(function (m) { return !m.readAt; }).length
      };
    },

    /** Hesap silindiğinde o kişinin yazışmalarını temizler */
    purgeUser: function (userId) {
      var list = this._raw().filter(function (m) {
        return m.fromId !== userId && m.toId !== userId;
      });
      return this.saveAll(list);
    }
  };

  /* ==========================================================
     9b) POSTS — Baykuş Social gönderileri
     ----------------------------------------------------------
     Gönderiler kullanıcı kaydında değil, tek bir ortak listede
     tutulur; akış kullanıcılar arası olduğu için YKS.Messages ile
     aynı yaklaşım.

       { id, authorId, text, image, visibility, createdAt, editedAt,
         likes: [userId], comments: [{ id, authorId, text, createdAt }] }

     visibility "public"  → herkes görür
     visibility "friends" → yalnızca yazarın arkadaşları (ve yazar)

     Yazar adı kopyalanmaz, authorId üzerinden YKS.Users'tan okunur:
     kullanıcı adını ya da avatarını değiştirince eski gönderiler de
     güncel görünsün.

     GÖRÜNÜRLÜK İKİ AYRI KAVRAM:
       visibility → yazarın kararı, kimin görmeye HAKKI var
       scope      → okuyucunun süzgeci, neyi görmek İSTİYOR
     feed() önce hakkı, sonra tercihi uygular; ikisi karışmasın.

     UYARI — depolama: gönderi görselleri veri-URL olarak burada
     duruyor ve bu liste users kaydıyla aynı kotayı paylaşıyor.
     Kota dolarsa YKS.Store.set false döner; create/comment bunu
     kullanıcıya hata olarak yansıtır, sessizce yutmaz.
     ========================================================== */
  YKS.Posts = {
    /** Depodaki ham liste */
    _raw: function () {
      var list = YKS.Store.get(YKS.Config.keys.posts, []);
      return Array.isArray(list) ? list : [];
    },

    saveAll: function (list) {
      return YKS.Store.set(YKS.Config.keys.posts, list);
    },

    /** Tümü — yeniden eskiye */
    all: function () {
      return this._raw().slice().sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },

    byId: function (id) {
      return this._raw().filter(function (p) { return p.id === id; })[0] || null;
    },

    count: function () { return this._raw().length; },

    /** Bir kişinin gönderileri — profil ve istatistik için */
    byAuthor: function (userId) {
      return this.all().filter(function (p) { return p.authorId === userId; });
    },

    /** Geçerli görünürlük değeri; tanınmayan her şey "public" sayılır */
    _visibility: function (value) {
      return value === "friends" ? "friends" : "public";
    },

    /**
     * Bir gönderiyi görme hakkı var mı?
     * Kendi gönderin her zaman görünür; "friends" olanlar yalnızca
     * yazarın arkadaş listesindekilere açılır.
     */
    canSee: function (post, viewerId, friendIds) {
      if (!post) return false;
      if (post.authorId === viewerId) return true;
      if (this._visibility(post.visibility) === "public") return true;
      return !!(friendIds && friendIds[post.authorId]);
    },

    /** Kullanıcının arkadaş kimliklerini arama tablosu olarak verir */
    _friendMap: function (userId) {
      var map = {};
      YKS.Friends.friendsOf(userId).forEach(function (u) { map[u.id] = true; });
      return map;
    },

    /**
     * Akış.
     * Önce görme hakkı süzülür (yazarın visibility kararı), sonra
     * okuyucunun tercihi: scope "friends" ise yalnızca arkadaşlar
     * ve kendisi, "all" ise görmeye hakkı olan her şey.
     */
    feed: function (userId, scope) {
      var self = this;
      var friendIds = this._friendMap(userId);

      var list = this.all().filter(function (p) {
        return self.canSee(p, userId, friendIds);
      });

      if (scope !== "friends") return list;

      return list.filter(function (p) {
        return p.authorId === userId || friendIds[p.authorId];
      });
    },

    /**
     * Liste tavanı aşıldıysa en eski gönderileri düşürür.
     * Kotayı korumak için; kullanıcıya haber vermeden veri silmemek
     * adına yalnızca create sırasında ve tavan aşıldığında çalışır.
     */
    _trim: function (list) {
      var max = YKS.Config.post.maxPosts;
      if (list.length <= max) return list;

      var sirali = list.slice().sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      return sirali.slice(0, max);
    },

    /** Gönderi metni doğrulaması */
    _validateText: function (raw, max, bosOlabilir) {
      var text = String(raw || "").trim();

      if (!text && !bosOlabilir) {
        return { ok: false, error: "Bir şeyler yazmadan paylaşamazsın." };
      }
      if (text.length > max) {
        return { ok: false, error: "En fazla " + max + " karakter yazabilirsin." };
      }
      return { ok: true, text: text };
    },

    /**
     * Yeni gönderi paylaşır.
     * @param {string} userId
     * @param {{text:string, image?:string}} input
     */
    create: function (userId, input) {
      var author = YKS.Users.byId(userId);
      if (!author) {
        return { ok: false, error: "Paylaşım yapmak için kendi hesabınla giriş yapmalısın." };
      }

      var image = input.image || null;
      var check = this._validateText(input.text, YKS.Config.post.textMax, !!image);
      if (!check.ok) return check;

      var post = {
        id: YKS.Utils.uid("gnd"),
        authorId: userId,
        text: check.text,
        image: image,
        visibility: this._visibility(input.visibility),
        createdAt: Date.now(),
        editedAt: null,
        likes: [],
        comments: []
      };

      var list = this._trim(this._raw().concat([post]));

      if (!this.saveAll(list)) {
        return {
          ok: false,
          error: "Gönderi kaydedilemedi. Depolama dolmuş olabilir — görseli küçült ya da eski gönderileri sil."
        };
      }
      return { ok: true, post: post };
    },

    /** Kendi gönderinin metnini ve görünürlüğünü düzenler */
    update: function (postId, userId, text, visibility) {
      var post = this.byId(postId);
      if (!post) return { ok: false, error: "Gönderi bulunamadı." };
      if (post.authorId !== userId) {
        return { ok: false, error: "Yalnızca kendi gönderini düzenleyebilirsin." };
      }

      var check = this._validateText(text, YKS.Config.post.textMax, !!post.image);
      if (!check.ok) return check;

      /* Görünürlük verilmediyse eskisi korunur */
      var gorunurluk = visibility === undefined
        ? this._visibility(post.visibility)
        : this._visibility(visibility);

      var list = this._raw().map(function (p) {
        if (p.id !== postId) return p;
        return Object.assign({}, p, {
          text: check.text,
          visibility: gorunurluk,
          editedAt: Date.now()
        });
      });

      return this.saveAll(list)
        ? { ok: true }
        : { ok: false, error: "Gönderi güncellenemedi." };
    },

    /**
     * Beğeniyi ekler ya da kaldırır.
     *
     * likes yalnızca "şu an kimler beğeniyor" listesidir, zaman tutmaz.
     * Bildirimlerin "ne zaman beğendi" diyebilmesi için ayrı bir
     * likeLog tutuluyor: [{ u: userId, at: ts }]. Ayrı alan seçildi
     * çünkü likes.indexOf(...) her yerde kullanılıyor; onun biçimini
     * değiştirmek mevcut kayıtları ve okuma yollarını bozardı.
     */
    toggleLike: function (postId, userId) {
      var bulundu = false, begenildi = false;

      var list = this._raw().map(function (p) {
        if (p.id !== postId) return p;
        bulundu = true;

        var likes = Array.isArray(p.likes) ? p.likes.slice() : [];
        var log = Array.isArray(p.likeLog) ? p.likeLog.slice() : [];

        var i = likes.indexOf(userId);
        if (i === -1) {
          likes.push(userId);
          begenildi = true;
          /* Aynı kişinin eski kaydı varsa tazelenir; beğen-vazgeç-beğen
             döngüsünde log şişmesin */
          log = log.filter(function (r) { return r && r.u !== userId; });
          log.push({ u: userId, at: Date.now() });
        } else {
          likes.splice(i, 1);
          log = log.filter(function (r) { return r && r.u !== userId; });
        }

        return Object.assign({}, p, { likes: likes, likeLog: log });
      });

      if (!bulundu) return { ok: false, error: "Gönderi bulunamadı." };
      return this.saveAll(list)
        ? { ok: true, liked: begenildi }
        : { ok: false, error: "Beğeni kaydedilemedi." };
    },

    /** Gönderiye yorum ekler */
    comment: function (postId, userId, text) {
      var author = YKS.Users.byId(userId);
      if (!author) return { ok: false, error: "Yorum için kendi hesabınla giriş yapmalısın." };

      var check = this._validateText(text, YKS.Config.post.commentMax, false);
      if (!check.ok) return check;

      var bulundu = false;
      var yorum = {
        id: YKS.Utils.uid("yrm"),
        authorId: userId,
        text: check.text,
        createdAt: Date.now()
      };

      var list = this._raw().map(function (p) {
        if (p.id !== postId) return p;
        bulundu = true;
        var comments = Array.isArray(p.comments) ? p.comments.slice() : [];
        comments.push(yorum);
        return Object.assign({}, p, { comments: comments });
      });

      if (!bulundu) return { ok: false, error: "Gönderi bulunamadı." };
      return this.saveAll(list)
        ? { ok: true, comment: yorum }
        : { ok: false, error: "Yorum kaydedilemedi." };
    },

    /**
     * Yorumu siler.
     * Yorumun sahibi, gönderinin sahibi ve yöneticiler silebilir —
     * kendi gönderindeki istenmeyen yorumu temizleyebilmelisin.
     */
    removeComment: function (postId, commentId, userId) {
      var post = this.byId(postId);
      if (!post) return { ok: false, error: "Gönderi bulunamadı." };

      var yorum = (post.comments || []).filter(function (c) { return c.id === commentId; })[0];
      if (!yorum) return { ok: false, error: "Yorum bulunamadı." };

      var yetkili = yorum.authorId === userId ||
                    post.authorId === userId ||
                    YKS.Auth.isAdmin();
      if (!yetkili) return { ok: false, error: "Bu yorumu silemezsin." };

      var list = this._raw().map(function (p) {
        if (p.id !== postId) return p;
        return Object.assign({}, p, {
          comments: (p.comments || []).filter(function (c) { return c.id !== commentId; })
        });
      });

      return this.saveAll(list)
        ? { ok: true }
        : { ok: false, error: "Yorum silinemedi." };
    },

    /** Gönderiyi siler — sahibi ya da yönetici */
    remove: function (postId, userId) {
      var post = this.byId(postId);
      if (!post) return { ok: false, error: "Gönderi bulunamadı." };

      if (post.authorId !== userId && !YKS.Auth.isAdmin()) {
        return { ok: false, error: "Yalnızca kendi gönderini silebilirsin." };
      }

      var list = this._raw().filter(function (p) { return p.id !== postId; });
      return this.saveAll(list)
        ? { ok: true }
        : { ok: false, error: "Gönderi silinemedi." };
    },

    /** Yönetim paneli özeti — görünürlüğe bakmadan her şeyi sayar */
    stats: function () {
      return this._summarize(this._raw());
    },

    /**
     * Bir kullanıcının gördüğü akışın özeti.
     * Arkadaşa özel gönderileri sayıma katmıyoruz; okuyamadığı bir
     * gönderinin sayaçta görünmesi görünürlük ayarını sızdırırdı.
     */
    statsFor: function (userId) {
      return this._summarize(this.feed(userId, "all"));
    },

    _summarize: function (list) {
      var begeni = 0, yorum = 0, gorselli = 0;

      list.forEach(function (p) {
        begeni += (p.likes || []).length;
        yorum += (p.comments || []).length;
        if (p.image) gorselli++;
      });

      return {
        total: list.length,
        likes: begeni,
        comments: yorum,
        withImage: gorselli
      };
    },

    /**
     * Hesap silindiğinde o kişinin gönderilerini ve her yerdeki
     * yorum/beğenilerini temizler.
     */
    purgeUser: function (userId) {
      var list = this._raw()
        .filter(function (p) { return p.authorId !== userId; })
        .map(function (p) {
          return Object.assign({}, p, {
            likes: (p.likes || []).filter(function (id) { return id !== userId; }),
            likeLog: (p.likeLog || []).filter(function (r) { return r && r.u !== userId; }),
            comments: (p.comments || []).filter(function (c) { return c.authorId !== userId; })
          });
        });

      return this.saveAll(list);
    }
  };

  /* ==========================================================
     9c) NOTIFICATIONS — Bildirimler
     ----------------------------------------------------------
     Bu katman VERİ ÜRETMEZ. rozetler.js ve istatistik.js gibi
     türetilmiş bir katmandır: bildirimleri, olay anında bir yere
     yazmak yerine mevcut verilerden okur.

       YKS.Friends       → gelen arkadaşlık istekleri
       YKS.Messages      → okunmamış mesajlar
       YKS.Announcements → yeni duyurular
       YKS.Posts         → gönderilerine gelen beğeni ve yorumlar
       YKS.Rozetler      → yeni kazanılan rozetler

     Neden türetilmiş: aksi hâlde her modüle "bildirim yaz" çağrısı
     eklemek gerekirdi; biri unutulduğunda ya da bir kayıt silindiğinde
     bildirim listesi gerçekle uyuşmaz hâle gelirdi. Böyle her açılışta
     kendiliğinden doğru.

     Okundu bilgisi tek bir damgada tutulur:
       user.data.bildirimSonGorulme = <zaman damgası>
     Bu damgadan yeni olan her şey okunmamış sayılır. (duyurular.js
     zaten aynı yöntemi duyuruSonGorulme ile kullanıyor.)
     ========================================================== */
  YKS.Notifications = {
    /** Kullanıcının bildirim damgası */
    lastSeen: function (user) {
      if (!user || !user.data) return 0;
      var n = Number(user.data.bildirimSonGorulme);
      return isNaN(n) ? 0 : n;
    },

    /** Damgayı şimdiye çeker — hepsi okundu sayılır */
    markSeen: function (user) {
      if (!user) return false;
      if (!user.data || typeof user.data !== "object") user.data = {};
      user.data.bildirimSonGorulme = Date.now();
      var r = YKS.Users.update(user.id, { data: user.data });
      return !!r.ok;
    },

    /* ---------- Silme ----------
       Bildirimler türetilmiş olduğu için "silmek" kaynağı yok etmek
       DEĞİLDİR: arkadaşlık isteğini ya da yorumu silmeyiz, yalnızca
       bildirim listesinden gizleriz. İstek arkadaslar.html'de durmaya
       devam eder.

       İki ayrı mekanizma var:
         bildirimTemizleme → bu andan ESKİ her şey gizlenir (tek damga,
                             büyümez; "Temizle" butonu bunu kullanır)
         bildirimGizlenen  → tek tek silinenlerin kimlikleri
     */

    /** "Temizle" damgası — bundan eski bildirimler gösterilmez */
    clearedAt: function (user) {
      if (!user || !user.data) return 0;
      var n = Number(user.data.bildirimTemizleme);
      return isNaN(n) ? 0 : n;
    },

    /** Tek tek gizlenmiş bildirim kimlikleri */
    hiddenIds: function (user) {
      var raw = user && user.data ? user.data.bildirimGizlenen : null;
      return Array.isArray(raw) ? raw : [];
    },

    /** Tek bir bildirimi listeden gizler */
    dismiss: function (user, id) {
      if (!user || !id) return false;
      if (!user.data || typeof user.data !== "object") user.data = {};

      var list = this.hiddenIds(user).slice();
      if (list.indexOf(id) === -1) list.push(id);

      /* Sınırsız büyümesin — en yenileri yeter, eskiler zaten
         çoğunlukla temizleme damgasının altında kalır. */
      if (list.length > 300) list = list.slice(list.length - 300);

      user.data.bildirimGizlenen = list;
      var r = YKS.Users.update(user.id, { data: user.data });
      return !!r.ok;
    },

    /**
     * Görünen bütün bildirimleri siler.
     * Damgayı şimdiye çeker ve tek tek gizlenenler listesini boşaltır:
     * damga zaten hepsini kapsadığı için o liste gereksizleşir.
     */
    clearAll: function (user) {
      if (!user) return false;
      if (!user.data || typeof user.data !== "object") user.data = {};

      user.data.bildirimTemizleme = Date.now();
      user.data.bildirimGizlenen = [];
      /* Silinen bildirim okunmamış da sayılmasın */
      user.data.bildirimSonGorulme = Date.now();

      var r = YKS.Users.update(user.id, { data: user.data });
      return !!r.ok;
    },

    /** Bir kişinin görünen adı — silinmiş hesaba karşı dayanıklı */
    _adOf: function (userId) {
      var u = YKS.Users.byId(userId);
      return u ? u.fullName : "Silinmiş kullanıcı";
    },

    /**
     * Bildirimleri üretir — yeniden eskiye sıralı.
     * @returns {Array<{id,type,icon,tone,title,text,at,href,unread}>}
     */
    list: function (user, limit) {
      if (!user) return [];

      var self = this;
      var since = this.lastSeen(user);
      var out = [];

      /* --- Arkadaşlık istekleri --- */
      YKS.Friends.incoming(user.id).forEach(function (f) {
        out.push({
          id: "f-" + f.id,
          type: "friend",
          icon: "fa-user-plus",
          tone: "brand",
          title: self._adOf(f.fromId),
          text: "sana arkadaşlık isteği gönderdi.",
          at: f.createdAt,
          href: "arkadaslar.html"
        });
      });

      /* --- Okunmamış mesajlar: kişi başına tek satır --- */
      var sonMesaj = {};
      YKS.Messages.all().forEach(function (m) {
        if (m.toId !== user.id || m.readAt) return;
        var v = sonMesaj[m.fromId];
        if (!v || m.createdAt > v.at) {
          sonMesaj[m.fromId] = { at: m.createdAt, text: m.text, sayi: (v ? v.sayi : 0) + 1 };
        } else {
          v.sayi++;
        }
      });

      Object.keys(sonMesaj).forEach(function (fromId) {
        var v = sonMesaj[fromId];
        out.push({
          id: "m-" + fromId + "-" + v.at,
          type: "message",
          icon: "fa-comment-dots",
          tone: "brand",
          title: self._adOf(fromId),
          text: v.sayi > 1
            ? v.sayi + " okunmamış mesaj gönderdi."
            : "sana mesaj gönderdi.",
          at: v.at,
          href: "mesajlar.html"
        });
      });

      /* --- Duyurular ---
         Burada "since" ile SÜZMÜYORUZ: süzseydik duyuru okundu
         işaretlenince listeden tamamen kaybolur, diğer bildirimler
         ise kalırdı. Okunmuşluk aşağıda ortak biçimde damgalanıyor;
         hacmi de listenin genel sınırı dengeliyor. */
      YKS.Announcements.all().forEach(function (a) {
        if (!a.createdAt) return;
        out.push({
          id: "d-" + a.id,
          type: "announcement",
          icon: "fa-bullhorn",
          tone: "warn",
          title: "Yeni duyuru",
          text: a.title,
          at: a.createdAt,
          href: "duyurular.html"
        });
      });

      /* --- Kendi gönderilerine gelen beğeni ve yorumlar --- */
      YKS.Posts.byAuthor(user.id).forEach(function (p) {
        (p.likeLog || []).forEach(function (r) {
          if (!r || r.u === user.id || !r.at) return;
          out.push({
            id: "l-" + p.id + "-" + r.u,
            type: "like",
            icon: "fa-heart",
            tone: "danger",
            title: self._adOf(r.u),
            text: "gönderini beğendi.",
            at: r.at,
            href: "sosyal.html"
          });
        });

        (p.comments || []).forEach(function (c) {
          if (!c || c.authorId === user.id) return;
          out.push({
            id: "c-" + c.id,
            type: "comment",
            icon: "fa-comment",
            tone: "brand",
            title: self._adOf(c.authorId),
            text: "gönderine yorum yaptı: " + c.text,
            at: c.createdAt,
            href: "sosyal.html"
          });
        });
      });

      /* --- Yeni kazanılan rozetler --- */
      /* Rozet motoru yalnızca rozetler.js yüklüyse var; yoksa bu
         bölüm sessizce atlanır, diğer bildirimler çalışmaya devam eder. */
      if (YKS.Rozetler) {
        try {
          YKS.Rozetler.evaluate(user).list.forEach(function (r) {
            if (!r.earned || !r.earnedAt) return;
            out.push({
              id: "r-" + r.def.id,
              type: "badge",
              icon: r.def.icon,
              tone: "ok",
              title: r.def.title,
              text: "rozetini kazandın.",
              at: r.earnedAt,
              href: "rozetler.html"
            });
          });
        } catch (e) { /* rozet hesabı bildirimleri düşürmesin */ }
      }

      /* Silinenleri ele: temizleme damgasından eski olanlar ve
         tek tek gizlenmiş kimlikler listeye girmez. */
      var temizlendi = this.clearedAt(user);
      var gizli = {};
      this.hiddenIds(user).forEach(function (id) { gizli[id] = true; });

      out = out.filter(function (n) {
        if (gizli[n.id]) return false;
        return Number(n.at || 0) > temizlendi;
      });

      out.forEach(function (n) { n.unread = Number(n.at || 0) > since; });
      out.sort(function (a, b) { return Number(b.at || 0) - Number(a.at || 0); });

      return limit ? out.slice(0, limit) : out;
    },

    /** Okunmamış bildirim sayısı */
    unreadCount: function (user) {
      return this.list(user).filter(function (n) { return n.unread; }).length;
    }
  };

  /* ==========================================================
     10) AUTH — Supabase kimlik doğrulama
     ----------------------------------------------------------
     Şifreler artık istemciye HİÇ gelmez; auth.users tarafında
     bcrypt ile saklanır. Eski "gizli admin kapısı" tamamen
     kaldırıldı: rol veritabanındaki profiles.role sütununda ve
     profiles_guard_role tetikleyicisi kimsenin kendini admin
     yapmasını engelliyor.

     session() ve isAdmin() bilerek SENKRON kaldı — 38 currentUser,
     19 session, 18 isAdmin çağrısını async yapmamak için değerler
     YKS.Cache'ten okunuyor (bkz. 4. bölüm).
     ========================================================== */
  YKS.Auth = {

    /* ---------- Senkron okumalar (önbellekten) ---------- */

    /** Açık oturum — yoksa null */
    session: function () {
      var o = YKS.Cache.oturum;
      if (!o) return null;

      /* Eski koddaki alanlar korunuyor ki çağıran yerler değişmesin */
      var u = YKS.Users.byId(o.user.id);
      return {
        type: "user",
        userId: o.user.id,
        username: u ? u.username : (o.user.email || "").split("@")[0],
        role: u ? u.role : "uye",
        email: o.user.email
      };
    },

    isLoggedIn: function () { return !!YKS.Cache.oturum; },

    /** Giriş yapmış kullanıcının profili */
    currentUser: function () {
      return YKS.Cache.benimId ? YKS.Users.byId(YKS.Cache.benimId) : null;
    },

    /**
     * Yetki kontrolü. Rol her zaman profiles tablosundan okunur —
     * tarayıcıdaki hiçbir değer buna karar veremez. Zaten sunucuda
     * RLS de aynı kontrolü yapıyor; bu yalnızca arayüzü doğru
     * çizmek için.
     */
    isAdmin: function () {
      var u = this.currentUser();
      return !!(u && u.role === "admin");
    },

    /* ---------- Asenkron işlemler ---------- */

    /**
     * Yeni hesap açar. Ek alanlar auth metadata olarak gider;
     * veritabanındaki handle_new_user tetikleyicisi profiles ve
     * user_data satırlarını bunlardan üretir.
     */
    signUp: function (input) {
      if (!YKS.SB) return Promise.resolve({ ok: false, error: "Bağlantı yok." });

      var mail = YKS.Validate.email(input.email);
      if (!mail.ok) return Promise.resolve({ ok: false, error: mail.error });

      var username = YKS.Utils.normalizeUsername(input.username);
      if (username.length < 3) {
        return Promise.resolve({ ok: false, error: "Kullanıcı adı en az 3 karakter olmalı." });
      }
      if (!/^[a-z0-9._-]+$/.test(username)) {
        return Promise.resolve({ ok: false, error: "Kullanıcı adı yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir." });
      }
      if (!input.password || input.password.length < 6) {
        return Promise.resolve({ ok: false, error: "Şifre en az 6 karakter olmalı." });
      }
      if (!input.fullName || input.fullName.trim().length < 2) {
        return Promise.resolve({ ok: false, error: "Ad Soyad alanı boş bırakılamaz." });
      }

      var age = parseInt(input.age, 10);
      if (isNaN(age) || age < 10 || age > 99) {
        return Promise.resolve({ ok: false, error: "Yaş 10 ile 99 arasında olmalı." });
      }

      return YKS.SB.auth.signUp({
        email: mail.email,
        password: input.password,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, "index.html"),
          data: {
            username: username,
            full_name: input.fullName.trim(),
            age: String(age),
            exam_field: input.examField || "sayisal",
            description: (input.description || "").trim(),
            /* Davet kodu sunucudaki tetikleyicide doğrulanır.
               davet-kodu.sql çalıştırılmadıysa bu alan yok sayılır. */
            invite_code: String(input.inviteCode || "").trim()
          }
        }
      }).then(function (r) {
        if (r.error) return { ok: false, error: YKS.sbHata(r.error) };

        /* E-posta doğrulama KAPALIYSA signUp doğrudan oturum döner ve
           kullanıcı zaten giriş yapmış olur. Açıksa session null gelir
           ve önce maildeki bağlantıya tıklaması gerekir.
           Kod iki durumu da destekliyor; hangisinin geçerli olduğunu
           Supabase panelindeki ayar belirler. */
        if (!r.data.session) {
          return { ok: true, dogrulamaGerekli: true, email: mail.email };
        }

        YKS.Cache.oturum = r.data.session;
        YKS.Cache.benimId = r.data.user.id;

        /* Profil satırını tetikleyici açıyor; önbelleği doldur */
        return YKS.Cache.profilleriYukle()
          .then(function () { return YKS.Cache.verimiYukle(); })
          .then(function () {
            return {
              ok: true,
              dogrulamaGerekli: false,
              email: mail.email,
              user: YKS.Auth.currentUser()
            };
          });
      });
    },

    /** E-posta + şifre ile giriş */
    signIn: function (email, password) {
      if (!YKS.SB) return Promise.resolve({ ok: false, error: "Bağlantı yok." });

      return YKS.SB.auth.signInWithPassword({
        email: String(email || "").trim().toLowerCase(),
        password: password
      }).then(function (r) {
        if (r.error) return { ok: false, error: YKS.sbHata(r.error) };

        YKS.Cache.oturum = r.data.session;
        YKS.Cache.benimId = r.data.user.id;

        /* Giriş sonrası profiller görünür hâle gelir (RLS) */
        return YKS.Cache.profilleriYukle().then(function () {
          return { ok: true, user: YKS.Auth.currentUser() };
        });
      });
    },

    /** Doğrulama e-postasını yeniden gönderir */
    resendConfirmation: function (email) {
      if (!YKS.SB) return Promise.resolve({ ok: false, error: "Bağlantı yok." });

      return YKS.SB.auth.resend({
        type: "signup",
        email: String(email || "").trim().toLowerCase()
      }).then(function (r) {
        return r.error ? { ok: false, error: YKS.sbHata(r.error) } : { ok: true };
      });
    },

    /** Şifre sıfırlama bağlantısı yollar */
    resetPassword: function (email) {
      if (!YKS.SB) return Promise.resolve({ ok: false, error: "Bağlantı yok." });

      return YKS.SB.auth.resetPasswordForEmail(
        String(email || "").trim().toLowerCase(),
        { redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, "profile.html") }
      ).then(function (r) {
        return r.error ? { ok: false, error: YKS.sbHata(r.error) } : { ok: true };
      });
    },

    /** Giriş yapmış kullanıcının şifresini değiştirir */
    changePassword: function (yeniSifre) {
      if (!YKS.SB) return Promise.resolve({ ok: false, error: "Bağlantı yok." });
      if (!yeniSifre || yeniSifre.length < 6) {
        return Promise.resolve({ ok: false, error: "Şifre en az 6 karakter olmalı." });
      }

      return YKS.SB.auth.updateUser({ password: yeniSifre }).then(function (r) {
        return r.error ? { ok: false, error: YKS.sbHata(r.error) } : { ok: true };
      });
    },

    logout: function () {
      if (!YKS.SB) return Promise.resolve();

      return YKS.SB.auth.signOut().then(function () {
        YKS.Cache.oturum = null;
        YKS.Cache.benimId = null;
        YKS.Cache.profiller = [];
      });
    },

    /**
     * Korumalı sayfaların başında çağrılır.
     * Bu yalnızca arayüz kolaylığı — asıl koruma sunucudaki RLS.
     */
    requireAdmin: function (redirectTo) {
      if (this.isAdmin()) return true;
      window.location.replace((redirectTo || "index.html") + "?reason=yetki");
      return false;
    }
  };


  /* ==========================================================
     11) MEDIA — Görsel yükleme ve küçültme
     ----------------------------------------------------------
     LocalStorage ~5 MB sınırlıdır. Yüklenen görseller canvas ile
     küçültülüp JPEG olarak veri-URL'e çevrilir.
     ========================================================== */
  YKS.Media = {
    /**
     * Dosyayı okuyup küçültülmüş veri-URL döndürür.
     * @param {File} file
     * @param {object} preset YKS.Config.media.avatar gibi
     * @returns {Promise<string>}
     */
    toDataURL: function (file, preset) {
      return new Promise(function (resolve, reject) {
        if (!file) return reject(new Error("Dosya seçilmedi."));
        if (!/^image\//.test(file.type)) return reject(new Error("Yalnızca görsel dosyası yükleyin."));
        if (file.size > YKS.Config.media.maxInputBytes) {
          return reject(new Error("Görsel 6 MB'den büyük olamaz."));
        }

        var reader = new FileReader();
        reader.onerror = function () { reject(new Error("Dosya okunamadı.")); };
        reader.onload = function () {
          var img = new Image();
          img.onerror = function () { reject(new Error("Görsel açılamadı.")); };
          img.onload = function () {
            /* Oranı koruyarak hedef kutuya sığdır (cover mantığı) */
            var ratio = Math.max(preset.w / img.width, preset.h / img.height);
            ratio = Math.min(ratio, 1); /* küçük görselleri büyütme */
            var cw = Math.round(Math.min(img.width * ratio, preset.w));
            var ch = Math.round(Math.min(img.height * ratio, preset.h));

            var canvas = document.createElement("canvas");
            canvas.width = cw;
            canvas.height = ch;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, cw, ch);
            resolve(canvas.toDataURL("image/jpeg", preset.quality));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  /* ==========================================================
     12) TOAST — Bildirim balonları
     ========================================================== */
  YKS.Toast = {
    _area: null,

    _ensureArea: function () {
      if (this._area && document.body.contains(this._area)) return this._area;
      var area = document.getElementById("toast-area");
      if (!area) {
        area = document.createElement("div");
        area.id = "toast-area";
        document.body.appendChild(area);
      }
      this._area = area;
      return area;
    },

    /**
     * @param {string} message
     * @param {"ok"|"error"|"warn"|"info"} type
     * @param {number} duration ms
     */
    show: function (message, type, duration) {
      type = type || "info";
      var icons = {
        ok: "fa-circle-check",
        error: "fa-circle-exclamation",
        warn: "fa-triangle-exclamation",
        info: "fa-circle-info"
      };

      var el = document.createElement("div");
      el.className = "toast-x toast-" + type;
      el.setAttribute("role", "status");
      el.innerHTML =
        '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i>' +
        "<div>" + YKS.Utils.escape(message) + "</div>";

      this._ensureArea().appendChild(el);

      setTimeout(function () {
        el.classList.add("leaving");
        setTimeout(function () { el.remove(); }, 240);
      }, duration || 3600);
    }
  };

  /* ==========================================================
     13) PARTICLES — Arka plan parçacık animasyonu
     ----------------------------------------------------------
     Harici kütüphane kullanılmadı; hafif ve bağımsız çalışır.
     Sekme arka plana alınınca ve hareket azaltma tercihi
     açıkken durur.
     ========================================================== */
  YKS.Particles = {
    _raf: null,

    init: function (options) {
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return; /* Hareket istemeyen kullanıcılar için çizme */

      var opt = Object.assign({
        count: 58,        /* parçacık sayısı */
        linkDistance: 132, /* birbirine çizgi çekilecek mesafe */
        speed: 0.28,
        color: "125, 145, 255"
      }, options || {});

      var canvas = document.getElementById("particle-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "particle-canvas";
        document.body.appendChild(canvas);
      }
      var ctx = canvas.getContext("2d");
      var dots = [];
      var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

      /* Ekran boyutuna göre yeniden ölçekle.
         NOT: clientWidth/clientHeight salt okunurdur; onlara atama
         "use strict" altında TypeError atar ve parçacıklar hiç
         çizilmezdi. Görünen boyut style ile veriliyor. */
      function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      /* Küçük ekranlarda daha az parçacık üret */
      function seed() {
        var n = window.innerWidth < 720 ? Math.round(opt.count * 0.5) : opt.count;
        dots = [];
        for (var i = 0; i < n; i++) {
          dots.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * opt.speed,
            vy: (Math.random() - 0.5) * opt.speed,
            r: Math.random() * 1.7 + 0.7
          });
        }
      }

      function frame() {
        ctx.clearRect(0, 0, w, h);

        for (var i = 0; i < dots.length; i++) {
          var d = dots[i];
          d.x += d.vx;
          d.y += d.vy;

          /* Kenardan sekme */
          if (d.x < 0 || d.x > w) d.vx *= -1;
          if (d.y < 0 || d.y > h) d.vy *= -1;

          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(" + opt.color + ", 0.55)";
          ctx.fill();

          /* Yakın parçacıklar arasına çizgi */
          for (var j = i + 1; j < dots.length; j++) {
            var o = dots[j];
            var dx = d.x - o.x, dy = d.y - o.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < opt.linkDistance) {
              ctx.beginPath();
              ctx.moveTo(d.x, d.y);
              ctx.lineTo(o.x, o.y);
              ctx.strokeStyle = "rgba(" + opt.color + "," + (0.14 * (1 - dist / opt.linkDistance)).toFixed(3) + ")";
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
        YKS.Particles._raf = requestAnimationFrame(frame);
      }

      function start() {
        if (YKS.Particles._raf) return;
        YKS.Particles._raf = requestAnimationFrame(frame);
      }
      function stop() {
        cancelAnimationFrame(YKS.Particles._raf);
        YKS.Particles._raf = null;
      }

      resize();
      seed();
      start();

      window.addEventListener("resize", YKS.Utils.debounce(function () {
        resize(); seed();
      }, 200));

      /* Sekme görünmüyorsa boşuna çizme */
      document.addEventListener("visibilitychange", function () {
        document.hidden ? stop() : start();
      });
    }
  };

  /* ==========================================================
     14) MODULES — Gelecekteki özelliklerin kayıt defteri
     ----------------------------------------------------------
     Kullanım (ileride yeni bir dosyada):
       YKS.Modules.register("denemeler", {
         title: "Deneme Sonuçları",
         icon: "fa-clipboard-list",
         mount: function (container, ctx) { ... }
       });
     Böylece yeni özellik eklerken mevcut dosyalara dokunmak
     gerekmez; sadece yeni bir js dosyası eklenir.
     ========================================================== */
  YKS.Modules = {
    _registry: {},

    register: function (name, def) {
      if (this._registry[name]) {
        console.warn("[YKS] Modül zaten kayıtlı:", name);
        return;
      }
      this._registry[name] = Object.assign({ name: name, enabled: true }, def);
    },

    get: function (name) { return this._registry[name] || null; },

    list: function () {
      var reg = this._registry;
      return Object.keys(reg).map(function (k) { return reg[k]; });
    },

    /** Bir modülü hedef elemana bağlar */
    mount: function (name, container, ctx) {
      var mod = this.get(name);
      if (!mod || typeof mod.mount !== "function") {
        console.warn("[YKS] Bağlanamayan modül:", name);
        return false;
      }
      mod.mount(container, ctx || {});
      return true;
    }
  };

  /* Yol haritası — arayüzde "yakında" kartlarını besler.
     Modül gerçekten yazıldığında buradan kaldırılıp
     YKS.Modules.register ile kaydedilecek. */
  /* Şu an bekleyen modül yok — planlanan her şey yazıldı.
     Buraya satır eklendiğinde "Yakında" bölümü kendiliğinden
     geri gelir (login.js liste boşsa bölümü gizliyor). */
  YKS.Roadmap = [];

  /* ==========================================================
     15) BOOT — Ortak açılış işlemleri
     ========================================================== */
  YKS.boot = function () {
    YKS.Particles.init();
    console.log("%c" + YKS.Config.appName + " v" + YKS.Config.version,
      "color:#a259ff;font-weight:600");
  };

  /* Açılış artık hazır kapısına bağlı: parçacıklar ve sayfa kodu
     oturum + profiller geldikten sonra çalışır. */
  YKS.hazir(YKS.boot);

})(window, document);
