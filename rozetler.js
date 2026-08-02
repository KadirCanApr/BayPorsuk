/* ============================================================
   Bay Porsuk — rozetler.js
   ------------------------------------------------------------
   Rozetler modülü.

   Bu modül veri ÜRETMEZ. istatistik.js gibi, diğer modüllerin
   kullanıcı kaydına yazdığı her şeyi okur ve başarıya çevirir:

     user.data.sureler   → çalışma oturumları  (sayac.js)
     user.data.denemeler → deneme sonuçları    (exams.js)
     user.data.dersler   → müfredat ilerlemesi (dersler.js)
     user.data.hedefler  → hedefler            (hedefler.js)
     user.data.gunluk    → günlük kayıtları    (gunluk.js)

   İLERLEME HER AÇILIŞTA YENİDEN HESAPLANIR; sayaç saklanmaz.
   Böylece kullanıcı bir denemeyi ya da oturumu silerse ilerleme
   kendiliğinden düzelir — kayıtlı sayaç gibi yanlış kalmaz.

   Kalıcı tutulan tek şey rozetin İLK KAZANILDIĞI AN:

     user.data.rozetler = { "sure-100saat": 1753900000000, ... }

   Bu olmadan kazanma tarihi gösterilemez ve "yeni rozet kazandın"
   bildirimi her açılışta baştan tekrar ederdi.

   Kazanılan rozet geri alınmaz: kullanıcı eski verisini silse bile
   damga kayıtta kalır. İlerleme çubuğu canlı veriyi gösterir ama
   madalya sönmez — emekle alınan şey veri temizliğiyle kaybolmasın.

   Sayfa dışından da kullanılır: index.html üye panelindeki
   "son kazanılan rozetler" şeridi YKS.Rozetler.refresh() çağırır.
   Bu yüzden dosya, sayfa kabuğu yoksa yalnızca motoru kurar.

   Bölümler:
     0) Sabitler        5) Rozet kataloğu
     1) Durum           6) Değerlendirme ve kayıt
     2) Yardımcılar     7) Sayfa çizimi
     3) Veri okuma      8) Olay bağları
     4) İstatistik      9) Başlangıç
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     0) SABİTLER
     ========================================================== */

  /* Madalya seviyeleri — kart kenarı ve madalya rengi buradan.
     "kca" dört metal seviyenin üstünde duran imza seviyesidir:
     yalnızca bir dersin bütün konuları bitince verilir. */
  var TIERS = {
    bronze:  { label: "Bronz",  color: "#c9803f", order: 1 },
    silver:  { label: "Gümüş",  color: "#b6c0d4", order: 2 },
    gold:    { label: "Altın",  color: "#ffc046", order: 3 },
    diamond: { label: "Elmas",  color: "#22d3ee", order: 4 },
    kca:     { label: "K.C.A",  color: "#a259ff", order: 5 }
  };

  var GROUPS = [
    { key: "sure",     label: "Çalışma",  icon: "fa-stopwatch" },
    { key: "seri",     label: "Kararlılık", icon: "fa-fire" },
    { key: "deneme",   label: "Denemeler", icon: "fa-clipboard-list" },
    { key: "mufredat", label: "Müfredat", icon: "fa-book-open" },
    { key: "hedef",    label: "Hedefler", icon: "fa-bullseye" },
    { key: "gunluk",   label: "Günlük",   icon: "fa-feather-pointed" },
    { key: "ozel",     label: "Özel",     icon: "fa-star" },
    { key: "kca",      label: "K.C.A Başarımları", icon: "fa-chess-king" }
  ];

  /* Rozet sayısına/gruplara bakan meta rozetlerde "her gruptan en az
     bir rozet" ölçütü K.C.A dalını dışarıda bırakır; o grup bir dersi
     baştan sona bitirmeyi istiyor, dengeli gelişim ölçüsü olamaz. */
  var BASE_GROUPS = ["sure", "seri", "deneme", "mufredat", "hedef", "gunluk", "ozel"];

  /**
   * K.C.A Başarımları — ders dalları.
   *
   * Bir dal, müfredattaki bir ya da birden çok ders kaydını kapsar:
   * Kimya hem TYT hem AYT'de geçer, Tarih ayrıca AYT'de Tarih-1 ve
   * Tarih-2 olarak ikiye ayrılır. Rozet ancak dalın BÜTÜN konuları
   * bitince açılır — "Kimyager" TYT Kimya ile alınmaz, hepsi ister.
   */
  var DISCIPLINES = [
    { id: "matematik",   title: "Matematikçi",  ders: "Matematik",  icon: "fa-square-root-variable",
      subjects: ["matematik"] },
    { id: "turkce",      title: "Dil Ustası",   ders: "Türkçe",     icon: "fa-language",
      subjects: ["turkce"] },
    { id: "edebiyat",    title: "Edebiyatçı",   ders: "Türk Dili ve Edebiyatı", icon: "fa-feather",
      subjects: ["edebiyat"] },
    { id: "fizik",       title: "Fizikçi",      ders: "Fizik",      icon: "fa-atom",
      subjects: ["fizik"] },
    { id: "kimya",       title: "Kimyager",     ders: "Kimya",      icon: "fa-flask",
      subjects: ["kimya"] },
    { id: "biyoloji",    title: "Biyolog",      ders: "Biyoloji",   icon: "fa-dna",
      subjects: ["biyoloji"] },
    { id: "tarih",       title: "Tarihçi",      ders: "Tarih",      icon: "fa-landmark",
      subjects: ["tarih", "tarih1", "tarih2"] },
    { id: "cografya",    title: "Coğrafyacı",   ders: "Coğrafya",   icon: "fa-earth-europe",
      subjects: ["cografya", "cografya1", "cografya2"] },
    { id: "felsefe",     title: "Filozof",      ders: "Felsefe",    icon: "fa-brain",
      subjects: ["felsefe"] },
    { id: "psikoloji",   title: "Psikolog",     ders: "Psikoloji",  icon: "fa-user-doctor",
      subjects: ["psikoloji"] },
    { id: "sosyoloji",   title: "Sosyolog",     ders: "Sosyoloji",  icon: "fa-people-group",
      subjects: ["sosyoloji"] },
    { id: "mantik",      title: "Mantıkçı",     ders: "Mantık",     icon: "fa-diagram-project",
      subjects: ["mantik"] },
    { id: "din",         title: "İlahiyatçı",   ders: "Din Kültürü ve Ahlak Bilgisi", icon: "fa-mosque",
      subjects: ["din"] },
    { id: "vatandaslik", title: "Hukukçu",      ders: "Vatandaşlık", icon: "fa-scale-balanced",
      subjects: ["vatandaslik"] }
  ];

  /* gunluk.js ile aynı anahtarlar — "her ruh hâli" rozeti için */
  var MOOD_KEYS = ["harika", "iyi", "normal", "yorgun", "kotu"];

  /* Seri taramasında sonsuz döngüye karşı üst sınır */
  var STREAK_LIMIT = 2000;

  /* ==========================================================
     1) DURUM
     ========================================================== */
  var currentUser = null;
  var isAdmin = false;

  var groupFilter = "all";
  var stateFilter = "all";   /* all | earned | locked */
  var lastResult = null;

  /* ==========================================================
     2) YARDIMCILAR
     ========================================================== */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function num(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  /** Zaman damgasını "YYYY-MM-DD" gün anahtarına çevirir */
  function dsOf(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function todayDs() { return dsOf(Date.now()); }

  /** Gün anahtarına gün ekler/çıkarır */
  function addDays(ds, delta) {
    var p = String(ds).split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + delta);
    return dsOf(d.getTime());
  }

  /**
   * Bugünden geriye kesintisiz gün sayısı.
   * Bugün kayıt yoksa dünden sayılır; gün bitmeden seri bozulmasın.
   */
  function streakOf(daySet) {
    var cursor = todayDs();
    if (!daySet[cursor]) cursor = addDays(cursor, -1);

    var count = 0, guard = 0;
    while (daySet[cursor] && guard++ < STREAK_LIMIT) {
      count++;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  /** Kayıtların tamamındaki en uzun kesintisiz seri */
  function bestStreakOf(daySet) {
    var days = Object.keys(daySet).sort();
    var best = 0, run = 0, prev = null;

    days.forEach(function (ds) {
      run = (prev && addDays(prev, 1) === ds) ? run + 1 : 1;
      if (run > best) best = run;
      prev = ds;
    });
    return best;
  }

  function countKeys(obj) { return Object.keys(obj).length; }

  /** 12.5 → "12,5" — Türkçe ondalık ayracı */
  function fmtNum(value, digits) {
    var n = num(value);
    var fixed = n.toFixed(digits || 0);
    return fixed.replace(".", ",");
  }

  /** Rozet ilerlemesinde kullanılan kısa sayı biçimi */
  function fmtProgress(value) {
    var n = num(value);
    return Number.isInteger(n) ? String(n) : fmtNum(n, 1);
  }

  function fullDate(ts) {
    return new Date(ts).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "long", year: "numeric"
    });
  }

  function wordCount(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  /* Müfredat kataloğu konular.js ile gelir. Yüklenmediği sayfalarda
     (örn. index.html) müfredat rozetleri hesaplanamaz; kilitli
     görünürler ama daha önce kazanıldıysa damga korunur. */
  function curriculum() { return YKS.Curriculum || null; }

  /* ==========================================================
     3) VERİ OKUMA
     ========================================================== */

  /** Kullanıcı kaydındaki ham listeleri güvenli biçimde toplar */
  function readRaw(user) {
    var d = (user && user.data && typeof user.data === "object") ? user.data : {};

    return {
      sureler: (Array.isArray(d.sureler) ? d.sureler : [])
        .filter(function (s) { return s && s.endedAt && num(s.seconds) > 0; }),

      denemeler: (Array.isArray(d.denemeler) ? d.denemeler : [])
        .filter(function (e) { return e && e.type && e.date; }),

      dersler: normalizeTopics(d.dersler),

      hedefler: (Array.isArray(d.hedefler) ? d.hedefler : [])
        .filter(function (g) { return g && g.date; }),

      gunluk: (Array.isArray(d.gunluk) ? d.gunluk : [])
        .filter(function (g) { return g && g.date; })
    };
  }

  /**
   * Müfredat kayıtlarını anahtar→kayıt nesnesine çevirir.
   *
   * script.js alanı dizi olarak açıyor (data.dersler: []) ve eski şemada
   * kayıtlar [{ key, status, ... }] biçimindeydi. dersler.js açılışta bunu
   * nesneye çeviriyor ama rozetler bu alanı bağımsız okuyor: kullanıcı
   * Dersler sayfasını hiç açmadıysa dizi hâlâ duruyor olabilir. Aynı
   * dönüşümü burada da yapmazsak müfredat rozetleri sessizce 0 kalırdı.
   */
  function normalizeTopics(store) {
    if (Array.isArray(store)) {
      var converted = {};
      store.forEach(function (row) {
        if (row && row.key) converted[row.key] = row;
      });
      return converted;
    }
    return (store && typeof store === "object") ? store : {};
  }

  /**
   * Kayıtlı kilit açılma damgalarını okur.
   * Alan script.js'te dizi olarak açılıyor (data.rozetler: []);
   * eski hesaplarda dizi bulunabilir, nesneye çevrilir.
   */
  function readUnlocks(user) {
    var raw = user && user.data ? user.data.rozetler : null;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    var clean = {};
    Object.keys(raw).forEach(function (id) {
      var ts = num(raw[id]);
      if (ts > 0) clean[id] = ts;
    });
    return clean;
  }

  /** Bir çalışma oturumunun başladığı an */
  function sessionStart(s) {
    return num(s.endedAt) - num(s.seconds) * 1000;
  }

  /* ==========================================================
     4) İSTATİSTİK — rozet ölçütlerinin okuduğu tek nesne
     ========================================================== */
  function statsOf(user) {
    var raw = readRaw(user);
    var st = {};

    /* ---- Çalışma oturumları ------------------------------- */
    var totalSeconds = 0;
    var longestSeconds = 0;
    var byDay = {};
    var subjects = {};
    var nightCount = 0;
    var morningCount = 0;

    raw.sureler.forEach(function (s) {
      var seconds = num(s.seconds);
      var start = sessionStart(s);
      var ds = dsOf(start);

      totalSeconds += seconds;
      if (seconds > longestSeconds) longestSeconds = seconds;
      if (ds) byDay[ds] = (byDay[ds] || 0) + seconds;
      if (s.subjectName) subjects[s.subjectName] = true;

      var hour = new Date(start).getHours();
      if (hour >= 0 && hour < 5) nightCount++;
      else if (hour >= 5 && hour < 8) morningCount++;
    });

    var bestDaySeconds = 0;
    Object.keys(byDay).forEach(function (ds) {
      if (byDay[ds] > bestDaySeconds) bestDaySeconds = byDay[ds];
    });

    st.sessionCount = raw.sureler.length;
    st.totalHours = totalSeconds / 3600;
    st.longestSessionHours = longestSeconds / 3600;
    st.bestDayHours = bestDaySeconds / 3600;
    st.studyDayCount = countKeys(byDay);
    st.studyStreak = streakOf(byDay);
    st.bestStudyStreak = bestStreakOf(byDay);
    st.distinctSubjects = countKeys(subjects);
    st.nightSessions = nightCount;
    st.morningSessions = morningCount;

    /* ---- Denemeler ---------------------------------------- */
    /* Net hesabı exams.js/istatistik.js ile aynı dili konuşsun
       diye ortak katalogdan geçiriliyor: eski şemada Fen/Sosyal
       tek satırken YKS.Subjects bunları alt derslere dağıtır. */
    var examTypes = {};
    var bestNet = 0;
    var recordBreaks = 0;
    var runningBest = null;

    var examsByDate = raw.denemeler.slice().sort(function (a, b) {
      return num(a.date) - num(b.date);
    });

    examsByDate.forEach(function (exam) {
      examTypes[exam.type] = true;

      var net = 0;
      try {
        YKS.Subjects.normalizeExamSubjects(exam).forEach(function (r) {
          net += num(r.net);
        });
      } catch (e) {
        net = 0;   /* bozuk kayıt hesabı durdurmasın */
      }

      if (net > bestNet) bestNet = net;
      if (runningBest !== null && net > runningBest) recordBreaks++;
      if (runningBest === null || net > runningBest) runningBest = net;
    });

    st.examCount = raw.denemeler.length;
    st.examTypeCount = countKeys(examTypes);
    st.bestNet = bestNet;
    st.examRecordBreaks = recordBreaks;

    /* ---- Müfredat ----------------------------------------- */
    var topicsDone = 0;
    var topicsTouched = 0;

    Object.keys(raw.dersler).forEach(function (key) {
      var rec = raw.dersler[key];
      if (!rec || !rec.status || rec.status === "none") return;
      topicsTouched++;
      if (rec.status === "done") topicsDone++;
    });

    st.topicsDone = topicsDone;
    st.topicsTouched = topicsTouched;
    st.completedSubjects = completedSubjectCount(raw.dersler);

    /* K.C.A dalları: her ders dalında kaç konu bitti / toplam kaç konu var */
    st.dallar = disciplineProgress(raw.dersler);
    st.completedDisciplines = 0;
    Object.keys(st.dallar).forEach(function (id) {
      var d = st.dallar[id];
      if (d.total > 0 && d.done >= d.total) st.completedDisciplines++;
    });

    /* ---- Hedefler ----------------------------------------- */
    /* Bir hedef tekrarlıysa her tamamlanan gün ayrı sayılır;
       doneDates hedefler.js'te gün anahtarı listesi olarak durur. */
    var goalDoneDays = {};
    var goalDoneTotal = 0;

    raw.hedefler.forEach(function (g) {
      var dates = Array.isArray(g.doneDates) ? g.doneDates : [];
      if (!dates.length && g.completed) dates = [g.date];

      dates.forEach(function (ds) {
        if (!ds) return;
        goalDoneTotal++;
        goalDoneDays[ds] = true;
      });
    });

    st.goalCount = raw.hedefler.length;
    st.goalDoneCount = goalDoneTotal;
    st.goalStreak = streakOf(goalDoneDays);
    st.bestGoalStreak = bestStreakOf(goalDoneDays);

    /* ---- Günlük ------------------------------------------- */
    var diaryDays = {};
    var diaryWords = 0;
    var moods = {};

    raw.gunluk.forEach(function (g) {
      var ds = dsOf(g.date);
      if (ds) diaryDays[ds] = true;
      diaryWords += wordCount(g.body);
      if (g.mood && MOOD_KEYS.indexOf(g.mood) !== -1) moods[g.mood] = true;
    });

    st.diaryCount = raw.gunluk.length;
    st.diaryStreak = streakOf(diaryDays);
    st.bestDiaryStreak = bestStreakOf(diaryDays);
    st.diaryWords = diaryWords;
    st.moodsUsed = countKeys(moods);

    /* ---- Meta --------------------------------------------- */
    var modules = 0;
    if (raw.sureler.length) modules++;
    if (raw.denemeler.length) modules++;
    if (countKeys(raw.dersler)) modules++;
    if (raw.hedefler.length) modules++;
    if (raw.gunluk.length) modules++;
    st.modulesUsed = modules;

    var created = num(user && user.createdAt);
    st.accountDays = created ? Math.floor((Date.now() - created) / 86400000) : 0;

    /* Rozet sayısına bakan rozetler için; ikinci turda doldurulur
       (bkz. 6. bölümdeki iki turlu değerlendirme). */
    st.earnedCount = 0;

    return st;
  }

  /**
   * Tüm konuları "done" olan ders sayısı.
   * Müfredat kataloğu yoksa hesaplanamaz — 0 döner.
   */
  function completedSubjectCount(dersler) {
    var C = curriculum();
    if (!C || typeof C.flatTopics !== "function" || !C.byType) return 0;

    var perSubject = {};

    try {
      /* Tür listesi katalogdan okunur; ileride tür eklenirse
         burada değişiklik gerekmesin. */
      Object.keys(C.byType).forEach(function (type) {
        var topics = C.flatTopics(type) || [];
        topics.forEach(function (t) {
          var id = type + "." + t.subjectId;
          if (!perSubject[id]) perSubject[id] = { total: 0, done: 0 };
          perSubject[id].total++;

          var rec = dersler[t.key];
          if (rec && rec.status === "done") perSubject[id].done++;
        });
      });
    } catch (e) {
      return 0;   /* katalog beklenenden farklıysa rozet sessizce kilitli kalır */
    }

    var count = 0;
    Object.keys(perSubject).forEach(function (id) {
      var s = perSubject[id];
      if (s.total > 0 && s.done === s.total) count++;
    });
    return count;
  }

  /**
   * Her ders dalında bitmiş / toplam konu sayısı.
   *
   * Dönen değer { kimya: { done: 12, total: 40 }, ... } biçimindedir.
   * Müfredat kataloğu yoksa hepsi { done: 0, total: 0 } kalır; total 0
   * olan rozet asla açılmaz (bkz. evaluateOne içindeki goal kontrolü),
   * yani katalogsuz sayfada yanlışlıkla rozet verilmez.
   */
  function disciplineProgress(dersler) {
    var out = {};
    DISCIPLINES.forEach(function (d) { out[d.id] = { done: 0, total: 0 }; });

    var C = curriculum();
    if (!C || typeof C.flatTopics !== "function" || !C.byType) return out;

    /* Ders kimliğinden dala geri harita — tarih1/tarih2 → tarih */
    var ofSubject = {};
    DISCIPLINES.forEach(function (d) {
      d.subjects.forEach(function (s) { ofSubject[s] = d.id; });
    });

    try {
      Object.keys(C.byType).forEach(function (type) {
        (C.flatTopics(type) || []).forEach(function (t) {
          var dal = ofSubject[t.subjectId];
          if (!dal) return;

          out[dal].total++;
          var rec = dersler[t.key];
          if (rec && rec.status === "done") out[dal].done++;
        });
      });
    } catch (e) {
      /* Katalog beklenmedik biçimdeyse dallar kilitli kalsın */
    }

    return out;
  }

  /* ==========================================================
     5) ROZET KATALOĞU
     ----------------------------------------------------------
     Rozet eklemek tek satır: aşağıya bir kayıt yaz, yeter.
     Çizim ve ilerleme kodu hiç değişmez.

       id     benzersiz anahtar — kayıtta damga bu adla durur,
              SONRADAN DEĞİŞTİRME (kazanılmış rozet kopar)
       goal   hedef değer, value() bunu geçince kilit açılır
       value  stats nesnesinden ilerlemeyi okuyan işlev
       unit   ilerleme metninde sayının ardına eklenir
       meta   rozet sayısına bakan rozetler (ikinci turda ölçülür)
     ========================================================== */
  var CATALOG = [
    /* ---- Çalışma ------------------------------------------ */
    { id: "sure-ilk", group: "sure", tier: "bronze", icon: "fa-play",
      title: "İlk Adım", desc: "İlk çalışma oturumunu tamamla.",
      goal: 1, unit: " oturum", value: function (st) { return st.sessionCount; } },

    { id: "sure-10saat", group: "sure", tier: "bronze", icon: "fa-hourglass-start",
      title: "On Saat", desc: "Toplam 10 saat çalışma süresi biriktir.",
      goal: 10, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-25saat", group: "sure", tier: "bronze", icon: "fa-clock",
      title: "Yirmi Beş Saat", desc: "Toplam 25 saat çalışma süresi biriktir.",
      goal: 25, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-50saat", group: "sure", tier: "silver", icon: "fa-hourglass-half",
      title: "Elli Saat", desc: "Toplam 50 saat çalışma süresi biriktir.",
      goal: 50, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-100saat", group: "sure", tier: "gold", icon: "fa-stopwatch",
      title: "Yüz Saat Kulübü", desc: "Toplam 100 saat çalışma süresi biriktir.",
      goal: 100, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-250saat", group: "sure", tier: "gold", icon: "fa-gauge-high",
      title: "İki Yüz Elli Saat", desc: "Toplam 250 saat çalışma süresi biriktir.",
      goal: 250, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-500saat", group: "sure", tier: "diamond", icon: "fa-infinity",
      title: "Beş Yüz Saat", desc: "Toplam 500 saat çalışma süresi biriktir.",
      goal: 500, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-750saat", group: "sure", tier: "diamond", icon: "fa-bolt",
      title: "Yedi Yüz Elli Saat", desc: "Toplam 750 saat çalışma süresi biriktir.",
      goal: 750, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-1000saat", group: "sure", tier: "diamond", icon: "fa-mountain-sun",
      title: "Bin Saat", desc: "Toplam 1.000 saat çalışma süresi biriktir.",
      goal: 1000, unit: " sa", value: function (st) { return st.totalHours; } },

    { id: "sure-oturum100", group: "sure", tier: "silver", icon: "fa-list-ol",
      title: "Yüz Oturum", desc: "100 ayrı çalışma oturumu tamamla.",
      goal: 100, unit: " oturum", value: function (st) { return st.sessionCount; } },

    { id: "sure-maraton", group: "sure", tier: "gold", icon: "fa-person-running",
      title: "Maraton", desc: "Tek bir günde 8 saat çalış.",
      goal: 8, unit: " sa", value: function (st) { return st.bestDayHours; } },

    { id: "sure-gun12", group: "sure", tier: "diamond", icon: "fa-dumbbell",
      title: "Çelik İrade", desc: "Tek bir günde 12 saat çalış.",
      goal: 12, unit: " sa", value: function (st) { return st.bestDayHours; } },

    { id: "sure-odak", group: "sure", tier: "silver", icon: "fa-bullseye",
      title: "Derin Odak", desc: "Tek oturumda 3 saat aralıksız çalış.",
      goal: 3, unit: " sa", value: function (st) { return st.longestSessionHours; } },

    { id: "sure-gece", group: "sure", tier: "silver", icon: "fa-moon",
      title: "Gece Kuşu", desc: "Gece 00.00–05.00 arasında 10 oturum yap.",
      goal: 10, unit: " oturum", value: function (st) { return st.nightSessions; } },

    { id: "sure-sabah", group: "sure", tier: "silver", icon: "fa-sun",
      title: "Sabah Kuşu", desc: "Sabah 05.00–08.00 arasında 10 oturum yap.",
      goal: 10, unit: " oturum", value: function (st) { return st.morningSessions; } },

    { id: "sure-cokyonlu", group: "sure", tier: "bronze", icon: "fa-shapes",
      title: "Çok Yönlü", desc: "5 farklı derste çalışma kaydı oluştur.",
      goal: 5, unit: " ders", value: function (st) { return st.distinctSubjects; } },

    /* ---- Kararlılık --------------------------------------- */
    { id: "seri-3", group: "seri", tier: "bronze", icon: "fa-fire-flame-simple",
      title: "Isınma", desc: "3 gün üst üste çalış.",
      goal: 3, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-7", group: "seri", tier: "silver", icon: "fa-fire",
      title: "Bir Hafta", desc: "7 gün üst üste çalış.",
      goal: 7, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-14", group: "seri", tier: "silver", icon: "fa-calendar-week",
      title: "İki Hafta", desc: "14 gün üst üste çalış.",
      goal: 14, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-30", group: "seri", tier: "gold", icon: "fa-fire-flame-curved",
      title: "Bir Ay Kesintisiz", desc: "30 gün üst üste çalış.",
      goal: 30, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-60", group: "seri", tier: "gold", icon: "fa-sun-plant-wilt",
      title: "İki Ay Kesintisiz", desc: "60 gün üst üste çalış.",
      goal: 60, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-100", group: "seri", tier: "diamond", icon: "fa-meteor",
      title: "Yüz Gün", desc: "100 gün üst üste çalış.",
      goal: 100, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-180", group: "seri", tier: "diamond", icon: "fa-hourglass-end",
      title: "Altı Ay", desc: "180 gün üst üste çalış.",
      goal: 180, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-365", group: "seri", tier: "diamond", icon: "fa-calendar-days",
      title: "Tam Bir Yıl", desc: "365 gün üst üste çalış.",
      goal: 365, unit: " gün", value: function (st) { return st.bestStudyStreak; } },

    { id: "seri-gun50", group: "seri", tier: "silver", icon: "fa-calendar-check",
      title: "Elli Gün", desc: "Toplam 50 farklı günde çalışma kaydı oluştur.",
      goal: 50, unit: " gün", value: function (st) { return st.studyDayCount; } },

    { id: "seri-gun150", group: "seri", tier: "gold", icon: "fa-calendar-plus",
      title: "Yüz Elli Gün", desc: "Toplam 150 farklı günde çalışma kaydı oluştur.",
      goal: 150, unit: " gün", value: function (st) { return st.studyDayCount; } },

    /* ---- Denemeler ---------------------------------------- */
    { id: "deneme-ilk", group: "deneme", tier: "bronze", icon: "fa-file-pen",
      title: "İlk Deneme", desc: "İlk deneme sonucunu kaydet.",
      goal: 1, unit: " deneme", value: function (st) { return st.examCount; } },

    { id: "deneme-10", group: "deneme", tier: "bronze", icon: "fa-clipboard-list",
      title: "On Deneme", desc: "10 deneme sonucu kaydet.",
      goal: 10, unit: " deneme", value: function (st) { return st.examCount; } },

    { id: "deneme-25", group: "deneme", tier: "silver", icon: "fa-file-lines",
      title: "Yirmi Beş Deneme", desc: "25 deneme sonucu kaydet.",
      goal: 25, unit: " deneme", value: function (st) { return st.examCount; } },

    { id: "deneme-50", group: "deneme", tier: "gold", icon: "fa-clipboard-check",
      title: "Elli Deneme", desc: "50 deneme sonucu kaydet.",
      goal: 50, unit: " deneme", value: function (st) { return st.examCount; } },

    { id: "deneme-100", group: "deneme", tier: "diamond", icon: "fa-award",
      title: "Yüz Deneme", desc: "100 deneme sonucu kaydet.",
      goal: 100, unit: " deneme", value: function (st) { return st.examCount; } },

    { id: "deneme-200", group: "deneme", tier: "diamond", icon: "fa-boxes-stacked",
      title: "İki Yüz Deneme", desc: "200 deneme sonucu kaydet.",
      goal: 200, unit: " deneme", value: function (st) { return st.examCount; } },

    { id: "deneme-turler", group: "deneme", tier: "silver", icon: "fa-layer-group",
      title: "İki Alanda", desc: "En az 2 farklı sınav türünde deneme çöz.",
      goal: 2, unit: " tür", value: function (st) { return st.examTypeCount; } },

    { id: "deneme-tur3", group: "deneme", tier: "gold", icon: "fa-object-group",
      title: "Her Alanda", desc: "TYT, AYT ve KPSS — üç türde de deneme çöz.",
      goal: 3, unit: " tür", value: function (st) { return st.examTypeCount; } },

    { id: "deneme-rekor", group: "deneme", tier: "silver", icon: "fa-arrow-trend-up",
      title: "Rekor Kıran", desc: "5 kez kendi net rekorunu geç.",
      goal: 5, unit: " kez", value: function (st) { return st.examRecordBreaks; } },

    { id: "deneme-rekor15", group: "deneme", tier: "gold", icon: "fa-chart-line",
      title: "Sürekli Gelişim", desc: "15 kez kendi net rekorunu geç.",
      goal: 15, unit: " kez", value: function (st) { return st.examRecordBreaks; } },

    { id: "deneme-net80", group: "deneme", tier: "gold", icon: "fa-trophy",
      title: "Seksen Net", desc: "Bir denemede 80 net barajını aş.",
      goal: 80, unit: " net", value: function (st) { return st.bestNet; } },

    { id: "deneme-net100", group: "deneme", tier: "diamond", icon: "fa-ranking-star",
      title: "Yüz Net", desc: "Bir denemede 100 net barajını aş.",
      goal: 100, unit: " net", value: function (st) { return st.bestNet; } },

    { id: "deneme-net110", group: "deneme", tier: "diamond", icon: "fa-star-of-life",
      title: "Zirve", desc: "Bir denemede 110 net barajını aş.",
      goal: 110, unit: " net", value: function (st) { return st.bestNet; } },

    /* ---- Müfredat ----------------------------------------- */
    { id: "konu-ilk", group: "mufredat", tier: "bronze", icon: "fa-check",
      title: "İlk Konu", desc: "İlk konuyu bitti olarak işaretle.",
      goal: 1, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-10", group: "mufredat", tier: "bronze", icon: "fa-check-double",
      title: "On Konu", desc: "10 konuyu bitir.",
      goal: 10, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-50", group: "mufredat", tier: "bronze", icon: "fa-list-check",
      title: "Elli Konu", desc: "50 konuyu bitir.",
      goal: 50, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-100", group: "mufredat", tier: "silver", icon: "fa-clipboard-list",
      title: "Yüz Konu", desc: "100 konuyu bitir.",
      goal: 100, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-250", group: "mufredat", tier: "gold", icon: "fa-book-open",
      title: "İki Yüz Elli Konu", desc: "250 konuyu bitir.",
      goal: 250, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-500", group: "mufredat", tier: "diamond", icon: "fa-graduation-cap",
      title: "Müfredat Avcısı", desc: "500 konuyu bitir.",
      goal: 500, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-750", group: "mufredat", tier: "diamond", icon: "fa-book-journal-whills",
      title: "Yedi Yüz Elli Konu", desc: "750 konuyu bitir.",
      goal: 750, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-1000", group: "mufredat", tier: "diamond", icon: "fa-book-atlas",
      title: "Bin Konu", desc: "1.000 konuyu bitir.",
      goal: 1000, unit: " konu", value: function (st) { return st.topicsDone; } },

    { id: "konu-baslangic", group: "mufredat", tier: "bronze", icon: "fa-hand-pointer",
      title: "Sayfa Açıldı", desc: "100 konuya başla — hepsini bitirmen gerekmiyor.",
      goal: 100, unit: " konu", value: function (st) { return st.topicsTouched; } },

    { id: "konu-ders", group: "mufredat", tier: "gold", icon: "fa-square-check",
      title: "Ders Tamam", desc: "Bir dersin bütün konularını bitir.",
      goal: 1, unit: " ders", value: function (st) { return st.completedSubjects; } },

    { id: "konu-ders3", group: "mufredat", tier: "gold", icon: "fa-list-ul",
      title: "Üç Ders Tamam", desc: "Üç dersin bütün konularını bitir.",
      goal: 3, unit: " ders", value: function (st) { return st.completedSubjects; } },

    { id: "konu-ders6", group: "mufredat", tier: "diamond", icon: "fa-grip",
      title: "Altı Ders Tamam", desc: "Altı dersin bütün konularını bitir.",
      goal: 6, unit: " ders", value: function (st) { return st.completedSubjects; } },

    /* ---- Hedefler ----------------------------------------- */
    { id: "hedef-ilk", group: "hedef", tier: "bronze", icon: "fa-flag",
      title: "İlk Hedef", desc: "İlk hedefini oluştur.",
      goal: 1, unit: " hedef", value: function (st) { return st.goalCount; } },

    { id: "hedef-olustur25", group: "hedef", tier: "bronze", icon: "fa-pen-ruler",
      title: "Planlayıcı", desc: "25 hedef oluştur — tamamlaman gerekmiyor.",
      goal: 25, unit: " hedef", value: function (st) { return st.goalCount; } },

    { id: "hedef-10", group: "hedef", tier: "bronze", icon: "fa-circle-check",
      title: "On Tamam", desc: "10 hedef tamamla.",
      goal: 10, unit: " tamam", value: function (st) { return st.goalDoneCount; } },

    { id: "hedef-25", group: "hedef", tier: "silver", icon: "fa-flag-checkered",
      title: "Yirmi Beş Tamam", desc: "25 hedef tamamla.",
      goal: 25, unit: " tamam", value: function (st) { return st.goalDoneCount; } },

    { id: "hedef-50", group: "hedef", tier: "silver", icon: "fa-thumbs-up",
      title: "Elli Tamam", desc: "50 hedef tamamla.",
      goal: 50, unit: " tamam", value: function (st) { return st.goalDoneCount; } },

    { id: "hedef-100", group: "hedef", tier: "gold", icon: "fa-medal",
      title: "Yüz Tamam", desc: "100 hedef tamamla.",
      goal: 100, unit: " tamam", value: function (st) { return st.goalDoneCount; } },

    { id: "hedef-250", group: "hedef", tier: "diamond", icon: "fa-trophy",
      title: "İki Yüz Elli Tamam", desc: "250 hedef tamamla.",
      goal: 250, unit: " tamam", value: function (st) { return st.goalDoneCount; } },

    { id: "hedef-seri7", group: "hedef", tier: "silver", icon: "fa-calendar-day",
      title: "Sözünü Tutan", desc: "7 gün üst üste hedeflerini tamamla.",
      goal: 7, unit: " gün", value: function (st) { return st.bestGoalStreak; } },

    { id: "hedef-seri14", group: "hedef", tier: "silver", icon: "fa-handshake",
      title: "İki Hafta Sözünde", desc: "14 gün üst üste hedeflerini tamamla.",
      goal: 14, unit: " gün", value: function (st) { return st.bestGoalStreak; } },

    { id: "hedef-seri30", group: "hedef", tier: "diamond", icon: "fa-gem",
      title: "Demir İrade", desc: "30 gün üst üste hedeflerini tamamla.",
      goal: 30, unit: " gün", value: function (st) { return st.bestGoalStreak; } },

    { id: "hedef-seri60", group: "hedef", tier: "diamond", icon: "fa-shield-halved",
      title: "Sarsılmaz", desc: "60 gün üst üste hedeflerini tamamla.",
      goal: 60, unit: " gün", value: function (st) { return st.bestGoalStreak; } },

    /* ---- Günlük ------------------------------------------- */
    { id: "gunluk-ilk", group: "gunluk", tier: "bronze", icon: "fa-pen-nib",
      title: "İlk Sayfa", desc: "İlk günlük sayfanı yaz.",
      goal: 1, unit: " sayfa", value: function (st) { return st.diaryCount; } },

    { id: "gunluk-7", group: "gunluk", tier: "bronze", icon: "fa-note-sticky",
      title: "Yedi Sayfa", desc: "7 günlük sayfası yaz.",
      goal: 7, unit: " sayfa", value: function (st) { return st.diaryCount; } },

    { id: "gunluk-30", group: "gunluk", tier: "silver", icon: "fa-book",
      title: "Otuz Sayfa", desc: "30 günlük sayfası yaz.",
      goal: 30, unit: " sayfa", value: function (st) { return st.diaryCount; } },

    { id: "gunluk-100", group: "gunluk", tier: "gold", icon: "fa-book-bookmark",
      title: "Yüz Sayfa", desc: "100 günlük sayfası yaz.",
      goal: 100, unit: " sayfa", value: function (st) { return st.diaryCount; } },

    { id: "gunluk-250", group: "gunluk", tier: "diamond", icon: "fa-scroll",
      title: "İki Yüz Elli Sayfa", desc: "250 günlük sayfası yaz.",
      goal: 250, unit: " sayfa", value: function (st) { return st.diaryCount; } },

    { id: "gunluk-seri7", group: "gunluk", tier: "silver", icon: "fa-feather-pointed",
      title: "Düzenli Yazar", desc: "7 gün üst üste günlük tut.",
      goal: 7, unit: " gün", value: function (st) { return st.bestDiaryStreak; } },

    { id: "gunluk-seri30", group: "gunluk", tier: "gold", icon: "fa-pen-fancy",
      title: "Bir Ay Yazdı", desc: "30 gün üst üste günlük tut.",
      goal: 30, unit: " gün", value: function (st) { return st.bestDiaryStreak; } },

    { id: "gunluk-seri100", group: "gunluk", tier: "diamond", icon: "fa-signature",
      title: "Günlük Ustası", desc: "100 gün üst üste günlük tut.",
      goal: 100, unit: " gün", value: function (st) { return st.bestDiaryStreak; } },

    { id: "gunluk-kelime", group: "gunluk", tier: "gold", icon: "fa-align-left",
      title: "On Bin Kelime", desc: "Günlüklerinde toplam 10.000 kelime yaz.",
      goal: 10000, unit: " kelime", value: function (st) { return st.diaryWords; } },

    { id: "gunluk-kelime50k", group: "gunluk", tier: "diamond", icon: "fa-paragraph",
      title: "Elli Bin Kelime", desc: "Günlüklerinde toplam 50.000 kelime yaz.",
      goal: 50000, unit: " kelime", value: function (st) { return st.diaryWords; } },

    { id: "gunluk-mood", group: "gunluk", tier: "bronze", icon: "fa-face-smile",
      title: "Her Hâlden", desc: "Beş ruh hâlinin hepsini en az bir kez kullan.",
      goal: 5, unit: " hâl", value: function (st) { return st.moodsUsed; } },

    /* ---- Özel --------------------------------------------- */
    { id: "ozel-modul", group: "ozel", tier: "gold", icon: "fa-puzzle-piece",
      title: "Tam Takım", desc: "Beş takip modülünün hepsinde kayıt oluştur.",
      goal: 5, unit: " modül", value: function (st) { return st.modulesUsed; } },

    { id: "ozel-dengeli", group: "ozel", tier: "gold", icon: "fa-scale-unbalanced-flip", meta: true,
      title: "Dengeli Gelişim", desc: "Yedi ana grubun hepsinden en az bir rozet kazan.",
      goal: BASE_GROUPS.length, unit: " grup",
      value: function (st) { return st.baseGroupsCovered; } },

    { id: "ozel-30gun", group: "ozel", tier: "bronze", icon: "fa-hourglass-start",
      title: "Bir Aylık Üye", desc: "Hesabının 30. gününü doldur.",
      goal: 30, unit: " gün", value: function (st) { return st.accountDays; } },

    { id: "ozel-100gun", group: "ozel", tier: "silver", icon: "fa-user-clock",
      title: "Yüz Günlük Üye", desc: "Hesabının 100. gününü doldur.",
      goal: 100, unit: " gün", value: function (st) { return st.accountDays; } },

    { id: "ozel-180gun", group: "ozel", tier: "gold", icon: "fa-calendar-check",
      title: "Altı Aylık Üye", desc: "Hesabının 180. gününü doldur.",
      goal: 180, unit: " gün", value: function (st) { return st.accountDays; } },

    { id: "ozel-365gun", group: "ozel", tier: "diamond", icon: "fa-cake-candles",
      title: "Bir Yıl", desc: "Hesabının 365. gününü doldur.",
      goal: 365, unit: " gün", value: function (st) { return st.accountDays; } },

    { id: "ozel-730gun", group: "ozel", tier: "diamond", icon: "fa-tree",
      title: "İki Yıl", desc: "Hesabının 730. gününü doldur.",
      goal: 730, unit: " gün", value: function (st) { return st.accountDays; } },

    /* Koleksiyon merdiveni — bunlar st.earnedCount'a bakar, o da yalnızca
       META OLMAYAN rozetleri sayar (94 tane). Meta rozetler kendilerini
       saysaydı sıralamaya bağlı, çözülemez bir döngü çıkardı. */
    { id: "ozel-avci", group: "ozel", tier: "gold", icon: "fa-star", meta: true,
      title: "Rozet Avcısı", desc: "20 rozet topla.",
      goal: 20, unit: " rozet", value: function (st) { return st.earnedCount; } },

    { id: "ozel-koleksiyoner", group: "ozel", tier: "diamond", icon: "fa-crown", meta: true,
      title: "Koleksiyoner", desc: "35 rozet topla.",
      goal: 35, unit: " rozet", value: function (st) { return st.earnedCount; } },

    { id: "ozel-avci50", group: "ozel", tier: "diamond", icon: "fa-gifts", meta: true,
      title: "Yarı Yol", desc: "50 rozet topla.",
      goal: 50, unit: " rozet", value: function (st) { return st.earnedCount; } },

    { id: "ozel-avci75", group: "ozel", tier: "diamond", icon: "fa-sack-dollar", meta: true,
      title: "Usta Toplayıcı", desc: "75 rozet topla.",
      goal: 75, unit: " rozet", value: function (st) { return st.earnedCount; } },

    { id: "ozel-avci90", group: "ozel", tier: "diamond", icon: "fa-trophy", meta: true,
      title: "Tamamlayıcı", desc: "90 rozet topla — koleksiyonun neredeyse tam.",
      goal: 90, unit: " rozet", value: function (st) { return st.earnedCount; } }
  ];

  /* ==========================================================
     5b) K.C.A BAŞARIMLARI — katalogdan üretilir
     ----------------------------------------------------------
     Her ders dalı için bir rozet, üstüne hepsini isteyen bir taç
     rozet. Yeni dal eklemek DISCIPLINES'a bir satır yazmaktır;
     rozet, süzgeç sekmesi ve sayaçlar kendiliğinden gelir.

     Hedef müfredattan okunur (goalOf): kart "137 / 214 konu" gibi
     gerçek ilerleme gösterir, kuru bir "0 / 1" değil.
     ========================================================== */
  DISCIPLINES.forEach(function (d) {
    CATALOG.push({
      id: "kca-" + d.id,
      group: "kca",
      tier: "kca",
      icon: d.icon,
      title: d.title,
      desc: d.ders + " dersinin bütün konularını bitir — geçtiği her sınav türünde.",
      goal: 1,
      unit: " konu",
      value: function (st) { return st.dallar[d.id] ? st.dallar[d.id].done : 0; },
      goalOf: function (st) { return st.dallar[d.id] ? st.dallar[d.id].total : 0; }
    });
  });

  CATALOG.push({
    id: "kca-usta",
    group: "kca",
    tier: "kca",
    icon: "fa-chess-king",
    title: "K.C.A Ustası",
    desc: "Bütün ders dallarını eksiksiz bitir. Bu listenin en tepesi.",
    goal: DISCIPLINES.length,
    unit: " dal",
    value: function (st) { return st.completedDisciplines; }
  });

  /* ==========================================================
     6) DEĞERLENDİRME VE KAYIT
     ========================================================== */

  /** Tek bir rozetin o anki durumunu üretir */
  function evaluateOne(def, st, unlocks) {
    var value = 0;
    var goal = num(def.goal);

    try {
      value = num(def.value(st));
      /* K.C.A rozetlerinde hedef müfredattan gelir: "40 konunun 40'ı"
         gibi gerçek bir ilerleme çıksın diye sabit değil, hesaplanır. */
      if (typeof def.goalOf === "function") goal = num(def.goalOf(st));
    } catch (e) {
      value = 0;   /* eksik veri rozet çizimini durdurmasın */
    }

    /* Hedef 0 ise ölçüt hesaplanamamış demektir (örn. müfredat kataloğu
       yüklenmemiş). value >= 0 her zaman doğru olacağı için burada
       erken çıkılmazsa rozet yanlışlıkla açılırdı. */
    var meets = goal > 0 && value >= goal;
    var stamped = unlocks[def.id] || 0;

    /* Bir kez kazanılan rozet geri alınmaz: damga varsa kazanılmıştır.
       Kullanıcı eski kaydını silse bile madalya sönmesin. */
    var earned = meets || stamped > 0;

    return {
      def: def,
      value: value,
      goal: goal,
      ratio: goal > 0 ? Math.min(1, value / goal) : 0,
      earned: earned,
      meets: meets,
      earnedAt: stamped,
      isNew: meets && !stamped
    };
  }

  /**
   * Bütün kataloğu değerlendirir.
   *
   * İki tur: önce sıradan rozetler ölçülür, kazanılan sayısı
   * bulunur, sonra bu sayıya bakan meta rozetler ölçülür.
   * Tek turda "rozet sayısı" kendini sayamazdı.
   */
  function evaluate(user) {
    var st = statsOf(user);
    var unlocks = readUnlocks(user);

    var list = [];
    var earnedCount = 0;
    var seenGroups = {};

    CATALOG.forEach(function (def) {
      if (def.meta) return;
      var row = evaluateOne(def, st, unlocks);
      if (row.earned) {
        earnedCount++;
        seenGroups[def.group] = true;
      }
      list.push(row);
    });

    st.earnedCount = earnedCount;
    st.baseGroupsCovered = BASE_GROUPS.filter(function (g) {
      return seenGroups[g];
    }).length;

    CATALOG.forEach(function (def) {
      if (!def.meta) return;
      var row = evaluateOne(def, st, unlocks);
      if (row.earned) earnedCount++;
      list.push(row);
    });

    /* Katalog sırasını koru — grup ve tier düzeni orada tanımlı */
    var order = {};
    CATALOG.forEach(function (def, i) { order[def.id] = i; });
    list.sort(function (a, b) { return order[a.def.id] - order[b.def.id]; });

    return {
      stats: st,
      list: list,
      total: list.length,
      earned: earnedCount,
      fresh: list.filter(function (r) { return r.isNew; })
    };
  }

  /**
   * Yeni kazanılan rozetlerin damgasını kullanıcı kaydına yazar.
   * Yeni rozet yoksa hiç yazmaz — boşuna depolama yazımı olmasın.
   */
  function persist(user, fresh) {
    if (!user || !fresh || !fresh.length) return false;

    if (!user.data || typeof user.data !== "object") user.data = {};

    var unlocks = readUnlocks(user);
    var now = Date.now();
    fresh.forEach(function (row) {
      unlocks[row.def.id] = now;
      row.earnedAt = now;
    });

    user.data.rozetler = unlocks;

    var result = YKS.Users.update(user.id, { data: user.data });
    if (!result.ok) {
      YKS.Toast.show(result.error || "Rozetler kaydedilemedi.", "error");
      return false;
    }
    return true;
  }

  /** Değerlendir + yeni kazanılanları kaydet */
  function refresh(user) {
    var result = evaluate(user);
    if (result.fresh.length) persist(user, result.fresh);
    return result;
  }

  /**
   * "En son kazanılan" sıralaması.
   *
   * İlk açılışta bütün rozetler aynı anda damgalanır; tarihe göre
   * sıralamak o durumda katalog sırasını verirdi. Eşitlikte seviyesi
   * yüksek olan öne alınır ki kullanıcı en değerli rozetini görsün.
   */
  function byRecency(a, b) {
    var diff = num(b.earnedAt) - num(a.earnedAt);
    if (diff !== 0) return diff;

    var ta = (TIERS[a.def.tier] || TIERS.bronze).order;
    var tb = (TIERS[b.def.tier] || TIERS.bronze).order;
    return tb - ta;
  }

  /** index.html şeridi için: en son kazanılan rozetler */
  function recent(user, limit) {
    var result = refresh(user);

    var earned = result.list.filter(function (r) { return r.earned; });
    earned.sort(byRecency);

    return {
      earned: result.earned,
      total: result.total,
      list: earned.slice(0, limit || 3)
    };
  }

  /* Motoru dışarı aç — login.js üye panelinde kullanıyor */
  YKS.Rozetler = {
    TIERS: TIERS,
    GROUPS: GROUPS,
    CATALOG: CATALOG,
    statsOf: statsOf,
    evaluate: evaluate,
    refresh: refresh,
    recent: recent
  };

  /* ==========================================================
     7) SAYFA ÇİZİMİ
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    isAdmin = YKS.Auth.isAdmin();
    currentUser = YKS.Auth.currentUser();

    /* Yönetim koduyla açılan kurucu oturumunun kişisel kaydı yok;
       rozetler kullanıcı verisinden türetildiği için hesap şart. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
    return true;
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".rozet-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-exams">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim kodu ile açılmış kurucu oturumundasın. Rozetler kullanıcı hesabına bağlı verilerden üretilir; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  function renderStats(result) {
    var box = document.getElementById("rozet-stats");
    if (!box) return;

    var pct = result.total ? Math.round((result.earned / result.total) * 100) : 0;

    /* Seviyeye göre kazanılan sayısı — sıralama TIERS.order'dan gelir,
       yeni seviye eklenirse burada değişiklik gerekmez */
    var tierOrder = Object.keys(TIERS).sort(function (a, b) {
      return TIERS[a].order - TIERS[b].order;
    });

    var byTier = {};
    tierOrder.forEach(function (t) { byTier[t] = 0; });
    result.list.forEach(function (r) {
      if (r.earned && byTier[r.def.tier] !== undefined) byTier[r.def.tier]++;
    });

    var earnedRows = result.list.filter(function (r) { return r.earned && r.earnedAt; });
    earnedRows.sort(byRecency);
    var son = earnedRows[0];

    /* Kilitliler içinde tamamlanmaya en yakın olan — bir sonraki hedef */
    var locked = result.list.filter(function (r) { return !r.earned; });
    locked.sort(function (a, b) { return b.ratio - a.ratio; });
    var next = locked[0];

    function card(cls, icon, label, value, note) {
      return '<div class="rozet-stat ' + cls + '">' +
        '<div class="label"><i class="fa-solid ' + icon + '"></i>' + label + "</div>" +
        '<div class="value">' + value + "</div>" +
        '<div class="note">' + note + "</div>" +
      "</div>";
    }

    box.innerHTML =
      card("", "fa-award", "Kazanılan rozet",
        result.earned + '<small> / ' + result.total + "</small>",
        "Koleksiyonun %" + pct + " dolu") +

      card("tier", "fa-gem", "Seviyeler",
        tierOrder.map(function (t) {
          return '<span class="tier-dot ' + t + '" title="' + TIERS[t].label + '">' +
            byTier[t] + "</span>";
        }).join(""),
        tierOrder.map(function (t) { return TIERS[t].label; }).join(" · ")) +

      card("", "fa-clock-rotate-left", "Son kazanılan",
        son ? U.escape(son.def.title) : "—",
        son ? fullDate(son.earnedAt) : "Henüz rozet kazanmadın") +

      card("next", "fa-bullseye", "Sıradaki",
        next ? U.escape(next.def.title) : "Hepsi tamam",
        next
          ? "%" + Math.round(next.ratio * 100) + " tamamlandı"
          : "Bütün rozetleri topladın");
  }

  function renderFilters(result) {
    var box = document.getElementById("rozet-groups");
    if (!box) return;

    var counts = { all: { earned: 0, total: 0 } };
    GROUPS.forEach(function (g) { counts[g.key] = { earned: 0, total: 0 }; });

    result.list.forEach(function (r) {
      var g = r.def.group;
      counts.all.total++;
      if (r.earned) counts.all.earned++;
      if (!counts[g]) return;
      counts[g].total++;
      if (r.earned) counts[g].earned++;
    });

    function tab(key, icon, label) {
      var c = counts[key];
      return '<button type="button" class="rozet-tab' +
        (groupFilter === key ? " active" : "") + '" data-group="' + key + '">' +
        '<i class="fa-solid ' + icon + '"></i>' + label +
        '<span class="tab-count">' + c.earned + "/" + c.total + "</span>" +
      "</button>";
    }

    box.innerHTML = tab("all", "fa-layer-group", "Tümü") +
      GROUPS.map(function (g) { return tab(g.key, g.icon, g.label); }).join("");

    U.qsa("[data-group]", box).forEach(function (btn) {
      btn.addEventListener("click", function () {
        groupFilter = btn.getAttribute("data-group");
        render();
      });
    });
  }

  function cardHTML(row) {
    var def = row.def;
    var tier = TIERS[def.tier] || TIERS.bronze;
    var pct = Math.round(row.ratio * 100);

    /* Kazanılmış rozette ilerleme yerine kazanma tarihi durur */
    var foot = row.earned
      ? '<div class="rozet-foot earned">' +
          '<i class="fa-solid fa-circle-check"></i>' +
          (row.earnedAt ? fullDate(row.earnedAt) + " tarihinde kazanıldı" : "Kazanıldı") +
        "</div>"
      : '<div class="rozet-foot">' +
          '<div class="rozet-bar"><span style="width:' + pct + '%"></span></div>' +
          '<div class="rozet-progress">' +
            "<span>" + fmtProgress(row.value) + " / " + fmtProgress(row.goal) +
              U.escape(def.unit || "") + "</span>" +
            "<span>%" + pct + "</span>" +
          "</div>" +
        "</div>";

    return '<article class="rozet-card tier-' + def.tier +
        (row.earned ? " earned" : " locked") + '">' +
      '<div class="rozet-medal">' +
        '<i class="fa-solid ' + def.icon + '"></i>' +
        (row.earned ? "" : '<span class="rozet-lock"><i class="fa-solid fa-lock"></i></span>') +
      "</div>" +
      '<div class="rozet-body">' +
        '<div class="rozet-head">' +
          "<h3>" + U.escape(def.title) + "</h3>" +
          '<span class="rozet-tier">' + tier.label + "</span>" +
        "</div>" +
        "<p>" + U.escape(def.desc) + "</p>" +
        foot +
      "</div>" +
    "</article>";
  }

  function visibleRows(result) {
    return result.list.filter(function (r) {
      if (groupFilter !== "all" && r.def.group !== groupFilter) return false;
      if (stateFilter === "earned" && !r.earned) return false;
      if (stateFilter === "locked" && r.earned) return false;
      return true;
    });
  }

  function renderGrid(result) {
    var box = document.getElementById("rozet-grid");
    if (!box) return;

    var rows = visibleRows(result);

    var label = document.getElementById("rozet-count");
    if (label) {
      label.textContent = rows.length === result.total
        ? result.total + " rozet"
        : rows.length + " / " + result.total + " rozet";
    }

    if (!rows.length) {
      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-filter-circle-xmark"></i>' +
          "<h3>Bu süzgeçte rozet yok</h3>" +
          "<p>Grup ya da durum süzgecini değiştirip tekrar dene.</p>" +
        "</div>";
      return;
    }

    box.innerHTML = rows.map(cardHTML).join("");
  }

  /** Yeni kazanılan rozetleri bildirir — en fazla 3 tost */
  function announce(fresh) {
    if (!fresh.length) return;

    fresh.slice(0, 3).forEach(function (row) {
      YKS.Toast.show("Yeni rozet: " + row.def.title + " — " + row.def.desc, "ok");
    });

    if (fresh.length > 3) {
      YKS.Toast.show("Ve " + (fresh.length - 3) + " rozet daha kazandın.", "ok");
    }
  }

  function render() {
    if (!lastResult) return;
    renderStats(lastResult);
    renderFilters(lastResult);
    renderGrid(lastResult);
  }

  /* ==========================================================
     8) OLAY BAĞLARI
     ========================================================== */
  function bindShell() {
    var back = document.getElementById("back-btn");
    if (back) {
      back.addEventListener("click", function () {
        window.location.href = isAdmin ? "admin.html" : "index.html";
      });
    }

    var state = document.getElementById("rozet-state");
    if (state) {
      state.addEventListener("change", function () {
        stateFilter = state.value;
        renderGrid(lastResult);
      });
    }
  }

  /* ==========================================================
     9) BAŞLANGIÇ
     ========================================================== */
  YKS.hazir(function () {
    /* Bu dosya index.html'de de yükleniyor (üye paneli şeridi için).
       Sayfa kabuğu yoksa yalnızca motor kurulur, çizim yapılmaz. */
    if (!document.getElementById("rozet-grid")) return;

    if (!loadUser()) return;

    bindShell();

    lastResult = evaluate(currentUser);
    if (lastResult.fresh.length) {
      persist(currentUser, lastResult.fresh);
      announce(lastResult.fresh);
    }

    render();
  });

})(window, document);
