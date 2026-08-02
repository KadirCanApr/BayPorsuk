/* ============================================================
   Bay Porsuk — istatistik.js
   ------------------------------------------------------------
   Grafikler ve İstatistikler modülü.

   Bu modül veri ÜRETMEZ; diğer modüllerin kullanıcı kaydına
   yazdığı her şeyi tek ekranda toplar ve yorumlar:

     user.data.denemeler → deneme sonuçları  (exams.js)
     user.data.sureler   → çalışma oturumları (sayac.js)
     user.data.dersler   → müfredat ilerlemesi (dersler.js)
     user.data.hedefler  → hedefler ve tekrarları (hedefler.js)
     user.data.gunluk    → günlük kayıtları (gunluk.js)

   Grafikler harici bir kütüphane olmadan doğrudan SVG olarak
   çizilir; böylece sayfa çevrimdışı da çalışır ve tasarım
   token'ları (style.css) grafiklerde de geçerli kalır.

   Bölümler:
     0) Sabitler        5) Hedef hesapları
     1) Durum           6) Günlük hesapları
     2) Yardımcılar     7) Grafik araç kutusu (SVG)
     3) Veri okuma      8) Bölüm çizimleri
     4) Hesap katmanı   9) CSV / yazdırma / başlatma
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;
  var S = YKS.Subjects;

  /* Müfredat kataloğu konular.js ile gelir; yüklenmemişse
     müfredat bölümü kendini kapatır, diğerleri çalışmaya devam eder. */
  function curriculum() { return YKS.Curriculum || null; }

  /* ==========================================================
     0) SABİTLER
     ========================================================== */

  /* Kategorik seri paleti — koyu zeminde birbirinden ayırt
     edilebilen, marka renkleriyle uyumlu on renk. */
  var PALETTE = [
    "#5b6cff", "#a259ff", "#2fd4a7", "#ffc046", "#ff5c7a",
    "#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#22d3ee",
    "#c084fc", "#4ade80", "#facc15", "#f87171"
  ];

  var COLOR = {
    brand: "#5b6cff",
    brand2: "#a259ff",
    ok: "#2fd4a7",
    warn: "#ffc046",
    danger: "#ff5c7a",
    muted: "#667090"
  };

  /* Ruh hâli — gunluk.js ile aynı anahtarlar, ek olarak puan.
     Puan eğilim grafiğinde kullanılır (1 en düşük, 5 en yüksek). */
  var MOODS = {
    harika: { face: "😄", label: "Harika", score: 5, color: "#2fd4a7" },
    iyi:    { face: "🙂", label: "İyi",    score: 4, color: "#a3e635" },
    normal: { face: "😐", label: "Normal", score: 3, color: "#ffc046" },
    yorgun: { face: "😴", label: "Yorgun", score: 2, color: "#fb923c" },
    kotu:   { face: "😔", label: "Kötü",   score: 1, color: "#ff5c7a" }
  };
  var MOOD_ORDER = ["harika", "iyi", "normal", "yorgun", "kotu"];

  /* Konu durumları — dersler.js ile aynı anahtarlar */
  var TOPIC_STATUS = {
    done:     { label: "Bitti",          color: "#2fd4a7", icon: "fa-circle-check" },
    review:   { label: "Tekrar gerekli", color: "#ffc046", icon: "fa-rotate-right" },
    learning: { label: "Çalışıyorum",    color: "#5b6cff", icon: "fa-spinner" },
    none:     { label: "Başlanmadı",     color: "#3a4260", icon: "fa-circle" }
  };
  var STATUS_ORDER = ["done", "review", "learning", "none"];

  /* Hedef öncelikleri — hedefler.js ile aynı */
  var PRIORITIES = {
    high:   { label: "Yüksek", color: "#ff5c7a" },
    medium: { label: "Orta",   color: "#ffc046" },
    low:    { label: "Düşük",  color: "#38bdf8" }
  };

  /* Sayaç modları */
  var SESSION_KINDS = {
    kronometre:  { label: "Kronometre",   color: "#5b6cff", icon: "fa-stopwatch" },
    zamanlayici: { label: "Zaman tutma",  color: "#a259ff", icon: "fa-hourglass-half" },
    tren:        { label: "Tren modu",    color: "#2fd4a7", icon: "fa-train" }
  };

  var WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  var WEEKDAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  var MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz",
                      "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  var MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                     "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  var DAY_MS = 86400000;

  /* Isı haritasında ve "tüm zamanlar" seçiminde çizilecek en
     fazla gün — daha uzun aralıklar okunmaz hâle geliyor. */
  var HEATMAP_MAX_DAYS = 371;

  /* Günlük çalışma temposu puanlanırken tam puan alınan süre */
  var TEMPO_TARGET_MIN = 240;

  /* ==========================================================
     1) DURUM
     ========================================================== */
  var currentUser = null;
  var rangeMode = "30";        /* 7 | 30 | 90 | 180 | 365 | all */
  var examType = "tyt";        /* tyt | ayt | kpss */
  var section = "genel";       /* genel | calisma | deneme | mufredat | hedef | gunluk */

  /* Ham kayıtlar — readData() doldurur */
  var raw = {
    denemeler: [],
    sureler: [],
    dersler: {},
    hedefler: [],
    gunluk: []
  };

  /* Seçili aralık — refreshRange() hesaplar */
  var span = { start: "", end: "", days: [], count: 0 };

  /* ==========================================================
     2) YARDIMCILAR
     ========================================================== */

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- Tarih ---------- */

  /** Zaman damgası → "YYYY-MM-DD" (yerel saat) */
  function dsOf(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /** "YYYY-MM-DD" → o günün öğle vakti (yaz saati kaymalarına dayanıklı) */
  function tsOf(ds) {
    var p = String(ds || "").split("-");
    if (p.length !== 3) return NaN;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0, 0).getTime();
  }

  function today() { return dsOf(Date.now()); }

  function addDays(ds, n) {
    var t = tsOf(ds);
    if (isNaN(t)) return ds;
    return dsOf(t + n * DAY_MS);
  }

  function dayDiff(a, b) { return Math.round((tsOf(b) - tsOf(a)) / DAY_MS); }

  /** 0 = Pazartesi */
  function weekIndex(ds) { return (new Date(tsOf(ds)).getDay() + 6) % 7; }

  function shortDs(ds) {
    var p = String(ds || "").split("-");
    if (p.length !== 3) return "-";
    return Number(p[2]) + " " + MONTHS_SHORT[Number(p[1]) - 1];
  }

  function longDs(ds) {
    var p = String(ds || "").split("-");
    if (p.length !== 3) return "-";
    return Number(p[2]) + " " + MONTHS_LONG[Number(p[1]) - 1] + " " + p[0];
  }

  function monthKeyOf(ds) { return String(ds || "").slice(0, 7); }

  /* ---------- Sayı biçimleri ---------- */

  /** Binlik ayracı nokta, ondalık ayracı virgül (tr-TR) */
  function fmtInt(v) {
    return String(Math.round(num(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function fmtNum(v, digits) {
    var d = digits == null ? 2 : digits;
    var n = num(v);
    var s = Math.abs(n).toFixed(d);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 ? "-" : "") + parts.join(",");
  }

  function fmtPct(v, digits) { return fmtNum(v, digits == null ? 0 : digits) + "%"; }

  function signed(v, digits) {
    var n = num(v);
    if (Math.abs(n) < 0.005) return "0";
    return (n > 0 ? "+" : "") + fmtNum(n, digits == null ? 2 : digits);
  }

  /** Saniye → "12 sa 30 dk" */
  function fmtDur(seconds) {
    var s = Math.max(0, Math.round(num(seconds)));
    var h = Math.floor(s / 3600);
    var m = Math.round((s % 3600) / 60);
    if (m === 60) { h += 1; m = 0; }
    if (h && m) return h + " sa " + m + " dk";
    if (h) return h + " sa";
    return m + " dk";
  }

  /** Saniye → "12,5 sa" (eksen etiketleri için kısa) */
  function fmtHours(seconds) {
    var h = num(seconds) / 3600;
    if (h >= 10) return fmtNum(h, 0) + " sa";
    if (h >= 1) return fmtNum(h, 1) + " sa";
    return Math.round(num(seconds) / 60) + " dk";
  }

  function fmtMinutes(minutes) { return fmtDur(num(minutes) * 60); }

  /* ---------- Dizi istatistikleri ---------- */

  function sum(list) {
    return list.reduce(function (a, b) { return a + num(b); }, 0);
  }

  function avg(list) {
    if (!list || !list.length) return 0;
    return sum(list) / list.length;
  }

  function maxOf(list) {
    return list.length ? list.reduce(function (a, b) { return Math.max(a, num(b)); }, -Infinity) : 0;
  }

  function minOf(list) {
    return list.length ? list.reduce(function (a, b) { return Math.min(a, num(b)); }, Infinity) : 0;
  }

  function stdev(list) {
    if (!list || list.length < 2) return 0;
    var m = avg(list);
    var v = avg(list.map(function (x) { return (num(x) - m) * (num(x) - m); }));
    return Math.sqrt(v);
  }

  /**
   * En küçük kareler doğrusunun eğimi — "ölçüm başına değişim".
   * Eğilim okunu ve gelişim yorumunu bu belirler.
   */
  function slope(values) {
    var n = values.length;
    if (n < 2) return 0;
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) {
      sx += i; sy += num(values[i]);
      sxy += i * num(values[i]); sxx += i * i;
    }
    var den = n * sxx - sx * sx;
    if (!den) return 0;
    return (n * sxy - sx * sy) / den;
  }

  /** İki dizi arasındaki Pearson korelasyonu (-1 … 1) */
  function correlation(xs, ys) {
    var n = Math.min(xs.length, ys.length);
    if (n < 3) return null;
    var mx = avg(xs.slice(0, n)), my = avg(ys.slice(0, n));
    var num_ = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) {
      var a = num(xs[i]) - mx, b = num(ys[i]) - my;
      num_ += a * b; dx += a * a; dy += b * b;
    }
    if (!dx || !dy) return null;
    return num_ / Math.sqrt(dx * dy);
  }

  /** Son `w` ölçümün kayan ortalaması; ilk değerler null kalır */
  function movingAverage(values, w) {
    return values.map(function (_, i) {
      if (i < w - 1) return null;
      return avg(values.slice(i - w + 1, i + 1));
    });
  }

  /** Eğilim yönü: "up" | "down" | "flat" */
  function trendOf(delta, tolerance) {
    var t = tolerance == null ? 0.01 : tolerance;
    if (delta > t) return "up";
    if (delta < -t) return "down";
    return "flat";
  }

  function trendIcon(dir) {
    if (dir === "up") return "fa-arrow-trend-up";
    if (dir === "down") return "fa-arrow-trend-down";
    return "fa-minus";
  }

  /** Bir günün "dolu" sayıldığı diziden ardışık gün serisi */
  function streakOf(activeSet) {
    var cursor = today();
    /* Bugün henüz boşsa seri dünden geriye sayılır; gün ortasında
       seriyi sıfırlanmış göstermek yanıltıcı olurdu. */
    if (!activeSet[cursor]) cursor = addDays(cursor, -1);

    var n = 0, guard = 0;
    while (activeSet[cursor] && guard++ < 3650) {
      n++;
      cursor = addDays(cursor, -1);
    }
    return n;
  }

  /** Verilen gün kümesindeki en uzun ardışık seri */
  function longestStreak(days, activeSet) {
    var best = 0, run = 0;
    days.forEach(function (ds) {
      if (activeSet[ds]) { run++; if (run > best) best = run; }
      else run = 0;
    });
    return best;
  }

  /* ==========================================================
     3) VERİ OKUMA
     ========================================================== */

  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = YKS.Auth.currentUser();

    /* Yönetim kodu ile açılan kurucu oturumunun kişisel kaydı
       yoktur; istatistik kullanıcı verisinden üretildiği için
       bu oturumda gösterilecek bir şey yok. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
    return true;
  }

  function renderAccountRequired(isGate) {
    var host = document.getElementById("stats-content");
    if (!host) return;

    host.innerHTML =
      '<div class="empty-stats">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim kodu ile açılmış kurucu oturumundasın. İstatistikler kullanıcı hesabına bağlı verilerden üretilir; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  function readData() {
    var d = currentUser.data || {};

    raw.denemeler = (Array.isArray(d.denemeler) ? d.denemeler : [])
      .filter(function (e) { return e && e.type && e.date; });

    raw.sureler = (Array.isArray(d.sureler) ? d.sureler : [])
      .filter(function (s) { return s && s.endedAt && num(s.seconds) > 0; });

    raw.dersler = (d.dersler && typeof d.dersler === "object") ? d.dersler : {};

    raw.hedefler = (Array.isArray(d.hedefler) ? d.hedefler : [])
      .filter(function (g) { return g && g.date; })
      .map(normalizeGoal);

    raw.gunluk = (Array.isArray(d.gunluk) ? d.gunluk : [])
      .filter(function (g) { return g && g.date; });
  }

  /** Hiç veri yoksa modül boş ekran gösterir */
  function hasAnyData() {
    return raw.denemeler.length > 0 || raw.sureler.length > 0 ||
           raw.hedefler.length > 0 || raw.gunluk.length > 0 ||
           Object.keys(raw.dersler).length > 0;
  }

  /** Bir çalışma oturumunun başladığı an */
  function sessionStart(s) {
    return num(s.endedAt) - num(s.seconds) * 1000;
  }

  /** Tüm kayıtlardaki en eski gün — "tüm zamanlar" aralığı için */
  function earliestDs() {
    var candidates = [];

    raw.denemeler.forEach(function (e) { candidates.push(dsOf(e.date)); });
    raw.sureler.forEach(function (s) { candidates.push(dsOf(sessionStart(s))); });
    raw.gunluk.forEach(function (g) { candidates.push(dsOf(g.date)); });
    raw.hedefler.forEach(function (g) { candidates.push(g.date); });
    Object.keys(raw.dersler).forEach(function (k) {
      var rec = raw.dersler[k];
      if (rec && rec.updatedAt) candidates.push(dsOf(rec.updatedAt));
    });

    candidates = candidates.filter(function (ds) { return ds && ds.length === 10; }).sort();
    return candidates.length ? candidates[0] : addDays(today(), -29);
  }

  /** Seçili aralığı gün listesine çevirir */
  function refreshRange() {
    var end = today();
    var start;

    if (rangeMode === "all") {
      start = earliestDs();
      if (dayDiff(start, end) < 6) start = addDays(end, -6);
    } else {
      start = addDays(end, -(parseInt(rangeMode, 10) - 1));
    }

    var days = [];
    var cursor = start;
    var guard = 0;
    while (cursor <= end && guard++ < 4000) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }

    span = { start: start, end: end, days: days, count: days.length };
  }

  function inSpan(ds) { return ds >= span.start && ds <= span.end; }

  /* ==========================================================
     4) HESAP KATMANI — Çalışma ve denemeler
     ========================================================== */

  /** Aralığa düşen çalışma oturumları */
  function sessionsInSpan() {
    return raw.sureler.filter(function (s) { return inSpan(dsOf(sessionStart(s))); });
  }

  /** Gün gün toplam çalışma saniyesi (aralıktaki her gün için bir değer) */
  function studyByDay(sessions) {
    var map = {};
    span.days.forEach(function (ds) { map[ds] = 0; });

    sessions.forEach(function (s) {
      var ds = dsOf(sessionStart(s));
      if (map[ds] !== undefined) map[ds] += num(s.seconds);
    });

    return {
      map: map,
      values: span.days.map(function (ds) { return map[ds]; })
    };
  }

  /** Haftanın günlerine göre toplam ve gün başına ortalama */
  function studyByWeekday(sessions) {
    var total = [0, 0, 0, 0, 0, 0, 0];
    var occurrences = [0, 0, 0, 0, 0, 0, 0];

    span.days.forEach(function (ds) { occurrences[weekIndex(ds)]++; });
    sessions.forEach(function (s) {
      total[weekIndex(dsOf(sessionStart(s)))] += num(s.seconds);
    });

    return WEEKDAYS.map(function (name, i) {
      return {
        name: name,
        short: WEEKDAYS_SHORT[i],
        total: total[i],
        occurrences: occurrences[i],
        average: occurrences[i] ? total[i] / occurrences[i] : 0
      };
    });
  }

  /**
   * Saat dilimlerine göre dağılım.
   * Oturum saat sınırını aşıyorsa süre saatlere bölüştürülür;
   * tek bir saate yığmak "3 saatlik çalışma" gibi kayıtlarda
   * gerçeği bozuyordu.
   */
  function studyByHour(sessions) {
    var buckets = [];
    for (var i = 0; i < 24; i++) buckets.push(0);

    sessions.forEach(function (s) {
      var end = num(s.endedAt);
      var start = sessionStart(s);
      if (!end || end <= start) return;

      var cursor = start, guard = 0;
      while (cursor < end && guard++ < 400) {
        var d = new Date(cursor);
        var hour = d.getHours();
        var next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour + 1, 0, 0, 0).getTime();
        var slice = Math.min(next, end) - cursor;
        buckets[hour] += slice / 1000;
        cursor += slice;
      }
    });

    return buckets;
  }

  /** Derse göre çalışma süresi — çoktan aza */
  function studyBySubject(sessions) {
    var map = {};

    sessions.forEach(function (s) {
      var key = s.subjectName || "Ders seçilmedi";
      if (!map[key]) {
        map[key] = { name: key, seconds: 0, count: 0, examType: s.examType || null };
      }
      map[key].seconds += num(s.seconds);
      map[key].count++;
    });

    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.seconds - a.seconds; });
  }

  /** Sayaç moduna göre dağılım */
  function studyByKind(sessions) {
    var map = {};

    sessions.forEach(function (s) {
      var key = SESSION_KINDS[s.kind] ? s.kind : "kronometre";
      if (!map[key]) map[key] = { key: key, seconds: 0, count: 0 };
      map[key].seconds += num(s.seconds);
      map[key].count++;
    });

    return Object.keys(SESSION_KINDS)
      .filter(function (k) { return map[k]; })
      .map(function (k) { return map[k]; });
  }

  /** Bir sınav türünün denemeleri — eskiden yeniye */
  function examsOfType(type) {
    return raw.denemeler
      .filter(function (e) { return e.type === type; })
      .sort(function (a, b) { return num(a.date) - num(b.date); });
  }

  /**
   * Bir deneme kaydını ortak kataloğa göre çözer.
   * Eski şema (Fen/Sosyal tek satır) YKS.Subjects tarafından
   * alt derslere dağıtıldığı için tüm hesaplar aynı dilde konuşur.
   */
  function examDetail(exam) {
    var rows = S.normalizeExamSubjects(exam);
    var correct = 0, wrong = 0, blank = 0, net = 0, max = 0;

    rows.forEach(function (r) {
      correct += r.correct;
      wrong += r.wrong;
      blank += r.blank;
      net += r.net;
      max += r.max;
    });

    var answered = correct + wrong;

    return {
      id: exam.id,
      name: exam.name || "Adsız deneme",
      ds: dsOf(exam.date),
      date: num(exam.date),
      rows: rows,
      correct: correct,
      wrong: wrong,
      blank: blank,
      answered: answered,
      max: max,
      net: net,
      /* İsabet: işaretlenen sorular içinde doğruların payı */
      accuracy: answered ? (correct / answered) * 100 : 0,
      /* Başarı: sınavın tamamı üzerinden net oranı */
      success: max ? (net / max) * 100 : 0,
      /* Sorulara dokunma oranı — boş bırakma alışkanlığı */
      coverage: max ? (answered / max) * 100 : 0
    };
  }

  /** Ders bazlı deneme analizi */
  function subjectAnalysis(type, details) {
    return S.list(type).map(function (def) {
      var values = details.map(function (d) {
        var row = null;
        for (var i = 0; i < d.rows.length; i++) {
          if (d.rows[i].id === def.id) { row = d.rows[i]; break; }
        }
        return row ? row.net : 0;
      });

      var correct = 0, wrong = 0, blank = 0;
      details.forEach(function (d) {
        d.rows.forEach(function (r) {
          if (r.id !== def.id) return;
          correct += r.correct; wrong += r.wrong; blank += r.blank;
        });
      });

      var first = values.length ? values[0] : 0;
      var last = values.length ? values[values.length - 1] : 0;
      var answered = correct + wrong;

      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        group: def.group,
        max: def.max,
        values: values,
        count: values.length,
        average: avg(values),
        best: values.length ? maxOf(values) : 0,
        worst: values.length ? minOf(values) : 0,
        first: first,
        last: last,
        diff: last - first,
        slope: slope(values),
        stdev: stdev(values),
        ratio: def.max ? (avg(values) / def.max) * 100 : 0,
        correct: correct,
        wrong: wrong,
        blank: blank,
        accuracy: answered ? (correct / answered) * 100 : 0
      };
    });
  }

  /* ==========================================================
     4b) HESAP KATMANI — Müfredat
     ========================================================== */

  function curriculumStats(type) {
    var C = curriculum();
    if (!C) return null;

    var subjects = C.subjectsOf(type);
    if (!subjects.length) return null;

    var totals = { topics: 0, done: 0, review: 0, learning: 0, none: 0, minutes: 0, questions: 0 };

    var rows = subjects.map(function (subject) {
      var row = {
        id: subject.subject,
        name: subject.name,
        icon: subject.icon,
        topics: 0, done: 0, review: 0, learning: 0, none: 0,
        minutes: 0, questions: 0
      };

      subject.groups.forEach(function (group) {
        group.topics.forEach(function (topic) {
          var rec = raw.dersler[C.topicKey(type, subject.subject, topic)] || null;
          var status = (rec && TOPIC_STATUS[rec.status]) ? rec.status : "none";

          row.topics++;
          row[status]++;
          if (rec) {
            row.minutes += num(rec.minutes);
            row.questions += num(rec.questions);
          }
        });
      });

      row.started = row.topics - row.none;
      row.pct = row.topics ? (row.done / row.topics) * 100 : 0;
      row.startedPct = row.topics ? (row.started / row.topics) * 100 : 0;

      totals.topics += row.topics;
      totals.done += row.done;
      totals.review += row.review;
      totals.learning += row.learning;
      totals.none += row.none;
      totals.minutes += row.minutes;
      totals.questions += row.questions;

      return row;
    });

    totals.started = totals.topics - totals.none;
    totals.pct = totals.topics ? (totals.done / totals.topics) * 100 : 0;
    totals.startedPct = totals.topics ? (totals.started / totals.topics) * 100 : 0;

    return { rows: rows, totals: totals };
  }

  /** Aralık içinde müfredat kaydı güncellenen gün sayısı */
  function curriculumTouchDays() {
    var set = {};
    Object.keys(raw.dersler).forEach(function (k) {
      var rec = raw.dersler[k];
      if (!rec || !rec.updatedAt) return;
      var ds = dsOf(rec.updatedAt);
      if (inSpan(ds)) set[ds] = true;
    });
    return set;
  }

  /* ==========================================================
     5) HESAP KATMANI — Hedefler
     ========================================================== */

  /** hedefler.js kaydını istatistik için sadeleştirir */
  function normalizeGoal(g) {
    var metric = null;
    if (g.metric && g.metric.kind) {
      metric = {
        kind: g.metric.kind,
        target: Math.max(1, parseInt(g.metric.target, 10) || 1),
        auto: !!g.metric.auto
      };
    }

    var doneDates = Array.isArray(g.doneDates) ? g.doneDates.slice() : [];
    if (!doneDates.length && g.completed) doneDates.push(g.date);

    return {
      id: g.id,
      title: String(g.title || "Adsız hedef"),
      date: g.date,
      priority: PRIORITIES[g.priority] ? g.priority : "medium",
      examType: g.examType || null,
      subjectId: g.subjectId || null,
      subjectName: g.subjectName || null,
      metric: metric,
      steps: Array.isArray(g.steps) ? g.steps : [],
      repeat: g.repeat || "none",
      repeatUntil: g.repeatUntil || null,
      doneDates: doneDates,
      progressByDate: (g.progressByDate && typeof g.progressByDate === "object") ? g.progressByDate : {},
      stepDoneByDate: (g.stepDoneByDate && typeof g.stepDoneByDate === "object") ? g.stepDoneByDate : {}
    };
  }

  /** Hedef o güne düşüyor mu? (hedefler.js ile aynı kural) */
  function occursOn(goal, ds) {
    if (ds < goal.date) return false;
    if (goal.repeat === "none") return ds === goal.date;
    if (goal.repeatUntil && ds > goal.repeatUntil) return false;
    if (goal.repeat === "daily") return true;
    if (goal.repeat === "weekday") return weekIndex(ds) <= 4;
    if (goal.repeat === "weekly") return weekIndex(ds) === weekIndex(goal.date);
    return false;
  }

  /** Sayaç modülünden o güne düşen dakika (otomatik ölçütler için) */
  function autoMinutes(goal, ds) {
    var total = 0;
    raw.sureler.forEach(function (s) {
      if (dsOf(s.endedAt) !== ds) return;
      if (goal.subjectId && s.subjectId !== goal.subjectId) return;
      if (!goal.subjectId && goal.examType && s.examType !== goal.examType) return;
      total += num(s.seconds);
    });
    return Math.round(total / 60);
  }

  function metricCurrent(goal, ds) {
    if (!goal.metric) return 0;
    if (goal.metric.auto) return autoMinutes(goal, ds);
    return clamp(parseInt(goal.progressByDate[ds], 10) || 0, 0, goal.metric.target);
  }

  function goalDone(goal, ds) {
    if (goal.metric) return metricCurrent(goal, ds) >= goal.metric.target;
    if (goal.steps.length) {
      var map = goal.stepDoneByDate[ds] || {};
      var n = 0;
      goal.steps.forEach(function (s) { if (map[s.id]) n++; });
      return n === goal.steps.length;
    }
    return goal.doneDates.indexOf(ds) !== -1;
  }

  /**
   * Aralıktaki tüm hedef "günleri".
   * Tekrarlı hedefler tek kayıtta durduğu için her gün ayrı ayrı
   * açılır; oran hesabı böylece gerçek yükü yansıtır.
   */
  function goalStats() {
    var perDay = span.days.map(function (ds) {
      return { ds: ds, due: 0, done: 0 };
    });
    var index = {};
    perDay.forEach(function (d, i) { index[d.ds] = i; });

    var byPriority = { high: { due: 0, done: 0 }, medium: { due: 0, done: 0 }, low: { due: 0, done: 0 } };
    var perGoal = [];
    var totalDue = 0, totalDone = 0;

    raw.hedefler.forEach(function (goal) {
      var due = 0, done = 0, lastDs = "";

      span.days.forEach(function (ds) {
        if (!occursOn(goal, ds)) return;
        due++;
        var ok = goalDone(goal, ds);
        if (ok) { done++; lastDs = ds; }

        var slot = perDay[index[ds]];
        slot.due++;
        if (ok) slot.done++;

        byPriority[goal.priority].due++;
        if (ok) byPriority[goal.priority].done++;
      });

      totalDue += due;
      totalDone += done;

      if (due > 0) {
        perGoal.push({
          id: goal.id,
          title: goal.title,
          priority: goal.priority,
          repeat: goal.repeat,
          subjectName: goal.subjectName,
          metric: goal.metric,
          due: due,
          done: done,
          rate: due ? (done / due) * 100 : 0,
          lastDs: lastDs
        });
      }
    });

    /* Seri: üzerine düşen hedeflerin tamamı bitirilen ardışık günler */
    var perfect = {};
    perDay.forEach(function (d) {
      if (d.due > 0 && d.done === d.due) perfect[d.ds] = true;
    });

    perGoal.sort(function (a, b) { return b.rate - a.rate || b.due - a.due; });

    return {
      perDay: perDay,
      perGoal: perGoal,
      byPriority: byPriority,
      totalDue: totalDue,
      totalDone: totalDone,
      rate: totalDue ? (totalDone / totalDue) * 100 : 0,
      activeGoals: perGoal.length,
      allGoals: raw.hedefler.length,
      streak: streakOf(perfect),
      bestStreak: longestStreak(span.days, perfect),
      perfectDays: Object.keys(perfect).length
    };
  }

  /* ==========================================================
     6) HESAP KATMANI — Günlük
     ========================================================== */

  function diaryStats() {
    var entries = raw.gunluk
      .filter(function (g) { return inSpan(dsOf(g.date)); })
      .sort(function (a, b) { return num(a.date) - num(b.date); });

    var moodCounts = {};
    MOOD_ORDER.forEach(function (k) { moodCounts[k] = 0; });

    var subjectCounts = {};
    var words = 0, minutes = 0;
    var byDay = {};

    entries.forEach(function (e) {
      var mood = MOODS[e.mood] ? e.mood : "normal";
      moodCounts[mood]++;
      minutes += num(e.minutes);

      var body = String(e.body || "").trim();
      words += body ? body.split(/\s+/).length : 0;

      (Array.isArray(e.subjects) ? e.subjects : []).forEach(function (s) {
        var key = String(s).trim();
        if (!key) return;
        subjectCounts[key] = (subjectCounts[key] || 0) + 1;
      });

      var ds = dsOf(e.date);
      if (!byDay[ds]) byDay[ds] = { count: 0, score: 0, minutes: 0 };
      byDay[ds].count++;
      byDay[ds].score += MOODS[mood].score;
      byDay[ds].minutes += num(e.minutes);
    });

    var written = {};
    Object.keys(byDay).forEach(function (ds) { written[ds] = true; });

    var moodSeries = span.days.map(function (ds) {
      var d = byDay[ds];
      return d && d.count ? d.score / d.count : null;
    });

    var topSubjects = Object.keys(subjectCounts)
      .map(function (k) { return { name: k, count: subjectCounts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });

    var scores = entries.map(function (e) {
      return MOODS[e.mood] ? MOODS[e.mood].score : 3;
    });

    return {
      entries: entries,
      count: entries.length,
      allCount: raw.gunluk.length,
      moodCounts: moodCounts,
      moodSeries: moodSeries,
      moodAverage: scores.length ? avg(scores) : 0,
      minutes: minutes,
      words: words,
      avgWords: entries.length ? words / entries.length : 0,
      topSubjects: topSubjects,
      byDay: byDay,
      written: written,
      streak: streakOf(written),
      bestStreak: longestStreak(span.days, written)
    };
  }

  /* ==========================================================
     7) GRAFİK ARAÇ KUTUSU (SVG)
     ----------------------------------------------------------
     Her çizer bir HTML dizesi döndürür. Fare balonu için
     elemanlara data-tip / data-tip-sub yazılır; tek bir
     dinleyici (bindTooltip) bunları yakalar.
     ========================================================== */

  function tipAttr(title, sub) {
    var out = ' data-tip="' + U.escape(title) + '"';
    if (sub) out += ' data-tip-sub="' + U.escape(sub) + '"';
    return out;
  }

  /**
   * Eksen için "yuvarlak" alt/üst sınır ve adım üretir.
   * 0–37,4 gibi bir aralığı 0–40 / adım 10'a çevirir.
   */
  function niceScale(min, max, ticks) {
    var t = ticks || 4;
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }

    if (min === max) {
      if (min === 0) { max = 1; }
      else if (min > 0) { min = 0; max = max * 1.25; }
      else { max = 0; min = min * 1.25; }
    }

    /* Değerler tabana yakınsa ekseni sıfırdan başlat: sütun
       grafiklerinde kesik eksen farkları abartıyor. */
    if (min > 0 && min / max < 0.6) min = 0;
    if (max < 0 && max / min < 0.6) max = 0;

    var span_ = max - min || 1;
    var rough = span_ / t;
    var mag = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10));
    var norm = rough / mag;
    var step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;

    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    if (hi === lo) hi = lo + step;

    return { min: lo, max: hi, step: step, ticks: Math.round((hi - lo) / step) };
  }

  function polar(cx, cy, r, deg) {
    var rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function n2(v) { return (Math.round(v * 100) / 100).toString(); }

  /* ---------- Kart sarmalayıcı ---------- */

  /**
   * opts: { icon, title, meta:[], body, foot, legend }
   */
  function chartCard(opts) {
    var meta = (opts.meta || []).map(function (m) { return "<span>" + m + "</span>"; }).join("");

    return '<div class="chart-card">' +
      '<div class="chart-head">' +
        "<h3><i class=\"fa-solid " + (opts.icon || "fa-chart-simple") + "\"></i> " +
          U.escape(opts.title) + "</h3>" +
        (meta ? '<div class="chart-meta">' + meta + "</div>" : "") +
      "</div>" +
      '<div class="chart-body' + (opts.tight ? " tight" : "") + '">' + opts.body + "</div>" +
      (opts.legend ? opts.legend : "") +
      (opts.foot ? '<div class="chart-foot">' + opts.foot + "</div>" : "") +
    "</div>";
  }

  function emptyChart(text, icon) {
    return '<div class="chart-empty">' +
      '<i class="fa-solid ' + (icon || "fa-chart-line") + '"></i>' +
      U.escape(text) +
    "</div>";
  }

  /** items: [{name, color, value}] */
  function legendOf(items) {
    if (!items || !items.length) return "";

    return '<div class="chart-legend">' + items.map(function (it) {
      return '<span class="legend-item">' +
        '<span class="legend-dot" style="background:' + it.color + '"></span>' +
        U.escape(it.name) +
        (it.value != null ? "<strong>" + U.escape(String(it.value)) + "</strong>" : "") +
      "</span>";
    }).join("") + "</div>";
  }

  /* ---------- Çizgi / alan grafiği ---------- */

  /**
   * opts: {
   *   labels:  ["01 Oca", …]      → x ekseni etiketleri
   *   series:  [{ name, color, values:[num|null], area, dashed, dots }]
   *   height, fmt(value), maxLabels, zeroLine, tipTitle(i)
   * }
   */
  function lineChart(opts) {
    var labels = opts.labels || [];
    var series = (opts.series || []).filter(function (s) { return s && s.values; });
    if (!labels.length || !series.length) return emptyChart(opts.emptyText || "Grafik için yeterli veri yok.");

    var fmt = opts.fmt || function (v) { return fmtNum(v, 1); };
    var W = 960;
    var H = opts.height || 300;
    var padL = opts.padL || 58, padR = 24, padT = 18, padB = 44;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    /* Tüm serileri kapsayan ölçek */
    var all = [];
    series.forEach(function (s) {
      s.values.forEach(function (v) { if (v != null && isFinite(v)) all.push(num(v)); });
    });
    if (!all.length) return emptyChart(opts.emptyText || "Grafik için yeterli veri yok.");

    var scale = niceScale(minOf(all), maxOf(all), 4);

    function px(i) {
      if (labels.length === 1) return padL + innerW / 2;
      return padL + (i / (labels.length - 1)) * innerW;
    }
    function py(v) {
      return padT + innerH - ((num(v) - scale.min) / (scale.max - scale.min)) * innerH;
    }

    /* Izgara ve y etiketleri */
    var grid = "";
    for (var g = 0; g <= scale.ticks; g++) {
      var val = scale.min + scale.step * g;
      var y = py(val);
      grid += '<line class="c-grid" x1="' + padL + '" y1="' + n2(y) +
                '" x2="' + (W - padR) + '" y2="' + n2(y) + '" />' +
              '<text class="c-label" x="' + (padL - 10) + '" y="' + n2(y + 4) +
                '" text-anchor="end">' + U.escape(fmt(val)) + "</text>";
    }

    if (opts.zeroLine && scale.min < 0 && scale.max > 0) {
      grid += '<line class="c-zero" x1="' + padL + '" y1="' + n2(py(0)) +
              '" x2="' + (W - padR) + '" y2="' + n2(py(0)) + '" />';
    }

    /* Seriler — null değerler çizgiyi böler */
    var paths = "";
    series.forEach(function (s) {
      var segments = [], current = [];

      s.values.forEach(function (v, i) {
        if (v == null || !isFinite(v)) {
          if (current.length) segments.push(current);
          current = [];
          return;
        }
        current.push({ x: px(i), y: py(v) });
      });
      if (current.length) segments.push(current);

      segments.forEach(function (seg) {
        var d = seg.map(function (p, i) {
          return (i ? "L" : "M") + n2(p.x) + "," + n2(p.y);
        }).join(" ");

        if (s.area && seg.length > 1) {
          var base = n2(padT + innerH);
          paths += '<path class="c-area" fill="' + s.color + '" fill-opacity="0.14" d="' +
            d + " L" + n2(seg[seg.length - 1].x) + "," + base +
            " L" + n2(seg[0].x) + "," + base + ' Z" />';
        }

        if (seg.length === 1) {
          paths += '<circle class="c-dot" cx="' + n2(seg[0].x) + '" cy="' + n2(seg[0].y) +
            '" r="4.5" stroke="' + s.color + '" />';
        } else {
          paths += '<path class="c-line' + (s.dashed ? " dashed" : "") + '" stroke="' +
            s.color + '" d="' + d + '" />';
        }
      });

      /* Nokta sayısı azsa her ölçüm işaretlenir */
      if (s.dots !== false && labels.length <= 40) {
        s.values.forEach(function (v, i) {
          if (v == null || !isFinite(v)) return;
          paths += '<circle class="c-dot" cx="' + n2(px(i)) + '" cy="' + n2(py(v)) +
            '" r="4" stroke="' + s.color + '" />';
        });
      }
    });

    /* X etiketleri — en fazla maxLabels tane */
    var maxLabels = opts.maxLabels || 8;
    var step = Math.max(1, Math.ceil(labels.length / maxLabels));
    var xLabels = labels.map(function (label, i) {
      if (i % step !== 0 && i !== labels.length - 1) return "";
      return '<text class="c-label" x="' + n2(px(i)) + '" y="' + (H - padB + 24) +
        '" text-anchor="middle">' + U.escape(label) + "</text>";
    }).join("");

    /* Fare şeridi: bir sütunun üzerine gelince o günün tüm serileri */
    var bandW = labels.length > 1 ? innerW / (labels.length - 1) : innerW;
    var bands = labels.map(function (label, i) {
      var lines = series.map(function (s) {
        var v = s.values[i];
        return s.name + ": " + (v == null || !isFinite(v) ? "—" : fmt(v));
      }).join("\n");

      var x = px(i) - bandW / 2;
      return '<rect class="c-band" x="' + n2(Math.max(padL, x)) + '" y="' + padT +
        '" width="' + n2(Math.min(bandW, W - padR - Math.max(padL, x))) + '" height="' + innerH + '"' +
        tipAttr(opts.tipTitle ? opts.tipTitle(i) : label, lines) + " />";
    }).join("");

    return '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
             'aria-label="' + U.escape(opts.title || "Çizgi grafiği") + '">' +
      grid + paths + xLabels + bands +
    "</svg>";
  }

  /* ---------- Dikey sütun grafiği ---------- */

  /**
   * opts: {
   *   labels, values, colors|color, height, fmt(value),
   *   showValues, tipSub(i), maxLabels
   * }
   */
  function barChart(opts) {
    var labels = opts.labels || [];
    var values = opts.values || [];
    if (!labels.length) return emptyChart(opts.emptyText || "Gösterilecek veri yok.");

    var fmt = opts.fmt || function (v) { return fmtNum(v, 0); };
    var W = 960;
    var H = opts.height || 260;
    var padL = opts.padL || 58, padR = 20, padT = 22, padB = 42;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    var scale = niceScale(Math.min(0, minOf(values)), maxOf(values), 4);

    var slot = innerW / labels.length;
    var barW = Math.max(4, Math.min(52, slot * (opts.thickness || 0.62)));

    function py(v) {
      return padT + innerH - ((num(v) - scale.min) / (scale.max - scale.min)) * innerH;
    }

    var grid = "";
    for (var g = 0; g <= scale.ticks; g++) {
      var val = scale.min + scale.step * g;
      var y = py(val);
      grid += '<line class="c-grid" x1="' + padL + '" y1="' + n2(y) +
                '" x2="' + (W - padR) + '" y2="' + n2(y) + '" />' +
              '<text class="c-label" x="' + (padL - 10) + '" y="' + n2(y + 4) +
                '" text-anchor="end">' + U.escape(fmt(val)) + "</text>";
    }

    var zeroY = py(0);
    var bars = values.map(function (v, i) {
      var cx = padL + slot * i + slot / 2;
      var y = py(v);
      var top = Math.min(y, zeroY);
      var h = Math.max(1.5, Math.abs(zeroY - y));
      var color = opts.colors ? opts.colors[i] : (opts.color || COLOR.brand);

      var out = '<rect class="c-bar" x="' + n2(cx - barW / 2) + '" y="' + n2(top) +
        '" width="' + n2(barW) + '" height="' + n2(h) + '" rx="' + n2(Math.min(5, barW / 2)) +
        '" fill="' + color + '"' +
        tipAttr(labels[i], (opts.tipSub ? opts.tipSub(i) : fmt(v))) + " />";

      if (opts.showValues && labels.length <= 16) {
        out += '<text class="c-value" x="' + n2(cx) + '" y="' + n2(top - 7) +
          '" text-anchor="middle">' + U.escape(fmt(v)) + "</text>";
      }
      return out;
    }).join("");

    var maxLabels = opts.maxLabels || 14;
    var step = Math.max(1, Math.ceil(labels.length / maxLabels));
    var xLabels = labels.map(function (label, i) {
      if (i % step !== 0 && i !== labels.length - 1) return "";
      return '<text class="c-label" x="' + n2(padL + slot * i + slot / 2) + '" y="' + (H - padB + 22) +
        '" text-anchor="middle">' + U.escape(label) + "</text>";
    }).join("");

    return '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
             'aria-label="' + U.escape(opts.title || "Sütun grafiği") + '">' +
      grid + bars + xLabels +
    "</svg>";
  }

  /* ---------- Yığılmış sütun grafiği ---------- */

  /**
   * opts: { labels, segments:[{name,color,values}], height, fmt, maxLabels }
   */
  function stackedBarChart(opts) {
    var labels = opts.labels || [];
    var segs = opts.segments || [];
    if (!labels.length || !segs.length) return emptyChart(opts.emptyText || "Gösterilecek veri yok.");

    var fmt = opts.fmt || function (v) { return fmtNum(v, 0); };
    var W = 960;
    var H = opts.height || 280;
    var padL = opts.padL || 58, padR = 20, padT = 20, padB = 42;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    var totals = labels.map(function (_, i) {
      return sum(segs.map(function (s) { return num(s.values[i]); }));
    });

    var scale = niceScale(0, maxOf(totals), 4);
    var slot = innerW / labels.length;
    var barW = Math.max(4, Math.min(56, slot * 0.62));

    function py(v) {
      return padT + innerH - (num(v) / (scale.max - scale.min)) * innerH;
    }

    var grid = "";
    for (var g = 0; g <= scale.ticks; g++) {
      var val = scale.min + scale.step * g;
      var y = py(val);
      grid += '<line class="c-grid" x1="' + padL + '" y1="' + n2(y) +
                '" x2="' + (W - padR) + '" y2="' + n2(y) + '" />' +
              '<text class="c-label" x="' + (padL - 10) + '" y="' + n2(y + 4) +
                '" text-anchor="end">' + U.escape(fmt(val)) + "</text>";
    }

    var bars = labels.map(function (label, i) {
      var cx = padL + slot * i + slot / 2;
      var acc = 0;
      var tip = segs.map(function (s) {
        return s.name + ": " + fmt(num(s.values[i]));
      }).join("\n") + "\nToplam: " + fmt(totals[i]);

      return segs.map(function (s) {
        var v = num(s.values[i]);
        if (v <= 0) { return ""; }
        var yTop = py(acc + v);
        var h = py(acc) - yTop;
        acc += v;
        return '<rect class="c-bar" x="' + n2(cx - barW / 2) + '" y="' + n2(yTop) +
          '" width="' + n2(barW) + '" height="' + n2(Math.max(1, h)) +
          '" fill="' + s.color + '"' + tipAttr(label, tip) + " />";
      }).join("");
    }).join("");

    var maxLabels = opts.maxLabels || 12;
    var step = Math.max(1, Math.ceil(labels.length / maxLabels));
    var xLabels = labels.map(function (label, i) {
      if (i % step !== 0 && i !== labels.length - 1) return "";
      return '<text class="c-label" x="' + n2(padL + slot * i + slot / 2) + '" y="' + (H - padB + 22) +
        '" text-anchor="middle">' + U.escape(label) + "</text>";
    }).join("");

    return '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
             'aria-label="' + U.escape(opts.title || "Yığılmış sütun grafiği") + '">' +
      grid + bars + xLabels +
    "</svg>";
  }

  /* ---------- Halka grafiği ---------- */

  /**
   * opts: { items:[{name,color,value}], fmt(value), centerValue, centerLabel }
   */
  function donutChart(opts) {
    var items = (opts.items || []).filter(function (i) { return num(i.value) > 0; });
    if (!items.length) return emptyChart(opts.emptyText || "Gösterilecek veri yok.", "fa-chart-pie");

    var fmt = opts.fmt || function (v) { return fmtNum(v, 0); };
    var total = sum(items.map(function (i) { return i.value; }));

    var size = 260;
    var cx = size / 2, cy = size / 2;
    var rOuter = 104, rInner = 66;

    var angle = 0;
    var slices = items.map(function (it) {
      var share = num(it.value) / total;
      var sweep = share * 360;
      var start = angle;
      var end = angle + sweep;
      angle = end;

      /* Tek dilim tam çemberse yay çizilemez; halka olarak boyanır */
      if (sweep >= 359.99) {
        return '<circle class="c-slice" cx="' + cx + '" cy="' + cy + '" r="' + ((rOuter + rInner) / 2) +
          '" fill="none" stroke="' + it.color + '" stroke-width="' + (rOuter - rInner) + '"' +
          tipAttr(it.name, fmt(it.value) + " · " + fmtPct(share * 100, 1)) + " />";
      }

      var o1 = polar(cx, cy, rOuter, start), o2 = polar(cx, cy, rOuter, end);
      var i1 = polar(cx, cy, rInner, end), i2 = polar(cx, cy, rInner, start);
      var large = sweep > 180 ? 1 : 0;

      var d = "M" + n2(o1.x) + "," + n2(o1.y) +
        " A" + rOuter + "," + rOuter + " 0 " + large + " 1 " + n2(o2.x) + "," + n2(o2.y) +
        " L" + n2(i1.x) + "," + n2(i1.y) +
        " A" + rInner + "," + rInner + " 0 " + large + " 0 " + n2(i2.x) + "," + n2(i2.y) + " Z";

      return '<path class="c-slice" d="' + d + '" fill="' + it.color + '"' +
        tipAttr(it.name, fmt(it.value) + " · " + fmtPct(share * 100, 1)) + " />";
    }).join("");

    var center =
      '<text class="c-donut-total" x="' + cx + '" y="' + (cy + 2) + '">' +
        U.escape(opts.centerValue != null ? String(opts.centerValue) : fmt(total)) + "</text>" +
      '<text class="c-donut-sub" x="' + cx + '" y="' + (cy + 22) + '">' +
        U.escape(opts.centerLabel || "toplam") + "</text>";

    return '<svg class="chart-svg" viewBox="0 0 ' + size + " " + size + '" ' +
             'style="max-width:280px;margin:0 auto" role="img" ' +
             'aria-label="' + U.escape(opts.title || "Halka grafiği") + '">' +
      slices + center +
    "</svg>";
  }

  /* ---------- Radar grafiği ---------- */

  /**
   * opts: { axes:[{name, max}], series:[{name,color,values}], fmt(value) }
   * Değerler eksen üst sınırına göre oranlanır; farklı soru
   * sayısındaki dersler böylece aynı çemberde karşılaştırılabilir.
   */
  function radarChart(opts) {
    var axes = opts.axes || [];
    var series = opts.series || [];
    if (axes.length < 3 || !series.length) {
      return emptyChart(opts.emptyText || "Radar için en az üç ders gerekiyor.", "fa-bullseye");
    }

    var fmt = opts.fmt || function (v) { return fmtNum(v, 2); };
    var W = 560, H = 420;
    var cx = W / 2, cy = H / 2 + 6, r = 138;
    var stepDeg = 360 / axes.length;

    /* Örümcek ağı */
    var rings = "";
    for (var k = 1; k <= 4; k++) {
      var rr = (r * k) / 4;
      var pts = axes.map(function (_, i) {
        var p = polar(cx, cy, rr, i * stepDeg);
        return n2(p.x) + "," + n2(p.y);
      }).join(" ");
      rings += '<polygon class="c-radar-web" points="' + pts + '" />';
    }

    var spokes = axes.map(function (_, i) {
      var p = polar(cx, cy, r, i * stepDeg);
      return '<line class="c-radar-spoke" x1="' + cx + '" y1="' + cy +
        '" x2="' + n2(p.x) + '" y2="' + n2(p.y) + '" />';
    }).join("");

    var shapes = series.map(function (s) {
      var pts = axes.map(function (a, i) {
        var ratio = a.max ? clamp(num(s.values[i]) / a.max, 0, 1) : 0;
        var p = polar(cx, cy, r * ratio, i * stepDeg);
        return n2(p.x) + "," + n2(p.y);
      }).join(" ");

      var dots = axes.map(function (a, i) {
        var ratio = a.max ? clamp(num(s.values[i]) / a.max, 0, 1) : 0;
        var p = polar(cx, cy, r * ratio, i * stepDeg);
        return '<circle class="c-radar-dot" cx="' + n2(p.x) + '" cy="' + n2(p.y) +
          '" r="3.5" fill="' + s.color + '"' +
          tipAttr(a.name, s.name + ": " + fmt(s.values[i]) + " / " + a.max) + " />";
      }).join("");

      return '<polygon class="c-radar-area" points="' + pts + '" fill="' + s.color +
        '" fill-opacity="0.16" stroke="' + s.color + '" />' + dots;
    }).join("");

    /* Eksen adları — çember dışına, açıya göre hizalı */
    var labels = axes.map(function (a, i) {
      var deg = i * stepDeg;
      var p = polar(cx, cy, r + 22, deg);
      var anchor = "middle";
      if (deg > 8 && deg < 172) anchor = "start";
      else if (deg > 188 && deg < 352) anchor = "end";

      return '<text class="c-label strong" x="' + n2(p.x) + '" y="' + n2(p.y + 4) +
        '" text-anchor="' + anchor + '">' + U.escape(a.name) + "</text>";
    }).join("");

    return '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '" ' +
             'style="max-width:600px;margin:0 auto" role="img" ' +
             'aria-label="' + U.escape(opts.title || "Radar grafiği") + '">' +
      rings + spokes + shapes + labels +
    "</svg>";
  }

  /* ---------- Takvim ısı haritası ---------- */

  var HEAT_COLORS = ["rgba(255,255,255,0.045)", "#233069", "#33449e", "#4557d6", "#7f6dff"];

  /**
   * opts: { days:[ds], valueOf(ds)->number, fmt(value), zeroText }
   */
  function calendarHeatmap(opts) {
    var days = opts.days || [];
    if (!days.length) return emptyChart("Gösterilecek gün yok.", "fa-calendar");

    /* Uzun aralıklarda hücreler okunmaz hâle geliyor; son
       HEATMAP_MAX_DAYS güne kırpılır. */
    if (days.length > HEATMAP_MAX_DAYS) days = days.slice(days.length - HEATMAP_MAX_DAYS);

    var fmt = opts.fmt || function (v) { return fmtNum(v, 0); };
    var cell = 13, gap = 4, stepPx = cell + gap;
    var padL = 34, padT = 24;

    var offset = weekIndex(days[0]);
    var weeks = Math.ceil((offset + days.length) / 7);

    var W = padL + weeks * stepPx + 8;
    var H = padT + 7 * stepPx + 6;

    var values = days.map(function (ds) { return num(opts.valueOf(ds)); });
    var top = maxOf(values.filter(function (v) { return v > 0; }));
    if (!isFinite(top) || top <= 0) top = 1;

    function level(v) {
      if (v <= 0) return 0;
      var ratio = v / top;
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.5) return 2;
      if (ratio <= 0.78) return 3;
      return 4;
    }

    var cells = "", monthLabels = "", lastMonth = "";

    days.forEach(function (ds, i) {
      var col = Math.floor((offset + i) / 7);
      var row = (offset + i) % 7;
      var x = padL + col * stepPx;
      var y = padT + row * stepPx;
      var v = values[i];

      cells += '<rect class="c-heat" x="' + x + '" y="' + y + '" width="' + cell +
        '" height="' + cell + '" fill="' + HEAT_COLORS[level(v)] + '"' +
        tipAttr(longDs(ds), v > 0 ? fmt(v) : (opts.zeroText || "Kayıt yok")) + " />";

      /* Ay adı: ayın ilk hücresinin bulunduğu sütuna */
      var mk = monthKeyOf(ds);
      if (mk !== lastMonth && row <= 3) {
        lastMonth = mk;
        monthLabels += '<text class="c-label" x="' + x + '" y="' + (padT - 9) + '">' +
          U.escape(MONTHS_SHORT[Number(ds.slice(5, 7)) - 1]) + "</text>";
      }
    });

    var dayLabels = [0, 2, 4, 6].map(function (row) {
      return '<text class="c-label" x="' + (padL - 8) + '" y="' + (padT + row * stepPx + cell - 2) +
        '" text-anchor="end">' + WEEKDAYS_SHORT[row] + "</text>";
    }).join("");

    return '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
             'aria-label="' + U.escape(opts.title || "Takvim ısı haritası") + '">' +
      monthLabels + dayLabels + cells +
    "</svg>";
  }

  function heatScale() {
    return '<span class="heat-scale">az' +
      HEAT_COLORS.map(function (c) {
        return '<span class="heat-box" style="background:' + c + '"></span>';
      }).join("") + "çok</span>";
  }

  /* ---------- Sıralı yatay liste ---------- */

  /**
   * items: [{ name, icon, value, label, sub, color, pct }]
   * pct verilmezse en büyük değere göre oranlanır.
   */
  function rankList(items, opts) {
    var o = opts || {};
    if (!items || !items.length) return emptyChart(o.emptyText || "Gösterilecek kayıt yok.", "fa-list");

    var list = items.slice(0, o.limit || 12);
    var top = maxOf(list.map(function (i) { return num(i.value); }));
    if (top <= 0) top = 1;

    return '<div class="rank-list">' + list.map(function (it, i) {
      var pct = it.pct != null ? clamp(num(it.pct), 0, 100) : (num(it.value) / top) * 100;
      var color = it.color || PALETTE[i % PALETTE.length];

      return '<div class="rank-row"' + tipAttr(it.name, it.tip || it.label || "") + ">" +
        '<span class="rank-name">' +
          (it.icon ? '<i class="fa-solid ' + it.icon + '"></i>' : "") +
          U.escape(it.name) +
        "</span>" +
        '<span class="rank-track">' +
          '<span class="rank-fill" style="width:' + n2(Math.max(2, pct)) +
            "%;background:" + color + '"></span>' +
        "</span>" +
        '<span class="rank-value">' + U.escape(it.label != null ? String(it.label) : fmtNum(it.value, 0)) +
          (it.sub ? "<small>" + U.escape(it.sub) + "</small>" : "") +
        "</span>" +
      "</div>";
    }).join("") + "</div>";
  }

  /* ---------- Kart içi mini eğilim çizgisi ---------- */

  function sparkline(values, color) {
    var clean = values.filter(function (v) { return v != null && isFinite(v); });
    if (clean.length < 2) return "";

    var W = 200, H = 34;
    var lo = minOf(clean), hi = maxOf(clean);
    if (hi - lo < 0.0001) { hi = lo + 1; lo -= 0.5; }

    var pts = values.map(function (v, i) {
      if (v == null || !isFinite(v)) return null;
      var x = (i / Math.max(1, values.length - 1)) * W;
      var y = H - ((num(v) - lo) / (hi - lo)) * (H - 4) - 2;
      return n2(x) + "," + n2(y);
    }).filter(Boolean);

    var d = "M" + pts.join(" L");

    return '<svg class="kpi-spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" ' +
             'aria-hidden="true" style="--kpi-color:' + color + '">' +
      '<path class="spark-area" fill="' + color + '" d="' + d +
        " L" + W + "," + H + " L0," + H + ' Z" />' +
      '<path class="spark-line" d="' + d + '" />' +
    "</svg>";
  }

  /* ---------- Radyal skor göstergesi ---------- */

  function gauge(value, caption) {
    var v = clamp(num(value), 0, 100);
    var size = 190, cx = size / 2, cy = size / 2, r = 74, width = 13;

    /* 270°'lik yay: sol altta başlar, sağ altta biter */
    var startDeg = -135, sweepDeg = 270;
    var circumference = 2 * Math.PI * r;
    var arcLen = circumference * (sweepDeg / 360);

    function arc(deg) {
      var s = polar(cx, cy, r, startDeg + 180);
      var e = polar(cx, cy, r, startDeg + 180 + deg);
      var large = deg > 180 ? 1 : 0;
      return "M" + n2(s.x) + "," + n2(s.y) + " A" + r + "," + r + " 0 " + large + " 1 " +
        n2(e.x) + "," + n2(e.y);
    }

    var color = v >= 70 ? COLOR.ok : v >= 45 ? COLOR.warn : COLOR.danger;

    return '<svg class="score-gauge" viewBox="0 0 ' + size + " " + size + '" role="img" ' +
             'aria-label="Genel skor ' + Math.round(v) + ' / 100">' +
      '<path class="gauge-track" d="' + arc(sweepDeg) + '" stroke-width="' + width + '" />' +
      '<path class="gauge-fill" d="' + arc(sweepDeg) + '" stroke="' + color +
        '" stroke-width="' + width + '" stroke-dasharray="' + n2(arcLen) +
        '" stroke-dashoffset="' + n2(arcLen * (1 - v / 100)) + '" />' +
      '<text class="gauge-value" x="' + cx + '" y="' + (cy + 6) + '">' + Math.round(v) + "</text>" +
      '<text class="gauge-cap" x="' + cx + '" y="' + (cy + 26) + '">' +
        U.escape(caption || "100 üzerinden") + "</text>" +
    "</svg>";
  }

  /* ---------- Gösterge kartı ---------- */

  /**
   * opts: { label, value, unit, note, tone, icon, color, spark:[] }
   */
  function kpiCard(opts) {
    var color = opts.color || COLOR.brand;
    var tone = opts.tone || "";

    return '<div class="kpi-card" style="--kpi-color:' + color + '"' +
        (opts.tip ? tipAttr(opts.label, opts.tip) : "") + ">" +
      '<i class="kpi-icon fa-solid ' + (opts.icon || "fa-chart-simple") + '"></i>' +
      '<div class="kpi-label">' + U.escape(opts.label) + "</div>" +
      '<div class="kpi-value">' + U.escape(String(opts.value)) +
        (opts.unit ? "<small>" + U.escape(opts.unit) + "</small>" : "") +
      "</div>" +
      (opts.note
        ? '<div class="kpi-note ' + tone + '">' +
            (tone ? '<i class="fa-solid ' + trendIcon(tone) + '"></i>' : "") +
            U.escape(opts.note) +
          "</div>"
        : "") +
      (opts.spark && opts.spark.length ? sparkline(opts.spark, color) : "") +
    "</div>";
  }

  function kpiGrid(cards) {
    return '<div class="kpi-grid">' + cards.join("") + "</div>";
  }

  function sectionHead(icon, title, note) {
    return '<div class="section-head">' +
      "<h2><i class=\"fa-solid " + icon + '"></i>' + U.escape(title) + "</h2>" +
      (note ? "<p>" + U.escape(note) + "</p>" : "") +
    "</div>";
  }

  /** columns: [{key,label,num,fmt}] */
  function dataTable(opts) {
    var cols = opts.columns || [];
    var rows = opts.rows || [];
    if (!rows.length) return emptyChart(opts.emptyText || "Tabloya yazılacak kayıt yok.", "fa-table");

    var head = "<tr>" + cols.map(function (c) {
      return '<th class="' + (c.num ? "num" : "") + '">' + U.escape(c.label) + "</th>";
    }).join("") + "</tr>";

    var body = rows.map(function (r) {
      return "<tr>" + cols.map(function (c) {
        var cell = r[c.key];
        return '<td class="' + (c.num ? "num" : "") + '">' + (cell == null ? "—" : cell) + "</td>";
      }).join("") + "</tr>";
    }).join("");

    var foot = "";
    if (opts.footer) {
      foot = "<tfoot><tr>" + cols.map(function (c) {
        var cell = opts.footer[c.key];
        return '<td class="' + (c.num ? "num" : "") + '">' + (cell == null ? "" : cell) + "</td>";
      }).join("") + "</tr></tfoot>";
    }

    return '<div class="stat-table-wrap"><table class="stat-table">' +
      "<thead>" + head + "</thead><tbody>" + body + "</tbody>" + foot +
    "</table></div>";
  }

  function deltaCell(value, digits) {
    var dir = trendOf(value, 0.005);
    return '<span class="delta ' + dir + '">' + U.escape(signed(value, digits == null ? 2 : digits)) + "</span>";
  }

  /* ==========================================================
     8) BAĞLAM — Bir çizimde bir kez hesaplanır
     ----------------------------------------------------------
     Bölümler arasında geçiş yapılırken aynı toplamlar tekrar
     tekrar hesaplanmasın diye tüm özetler tek yerde toplanır.
     ========================================================== */
  var ctx = null;

  function buildContext() {
    var sessions = sessionsInSpan();
    var byDay = studyByDay(sessions);

    var activeDays = byDay.values.filter(function (v) { return v > 0; }).length;
    var activeSet = {};
    span.days.forEach(function (ds) { if (byDay.map[ds] > 0) activeSet[ds] = true; });

    var totalSeconds = sum(byDay.values);

    /* Denemeler de seçili aralığa göre süzülür; aralık dışında
       kalan kayıt varsa bölüm başında uyarı gösterilir. */
    var allOfType = examsOfType(examType).map(examDetail);
    var details = allOfType.filter(function (d) { return inSpan(d.ds); });
    var analysis = subjectAnalysis(examType, details);

    var counts = {};
    S.types.forEach(function (t) {
      counts[t.value] = raw.denemeler.filter(function (e) { return e.type === t.value; }).length;
    });

    ctx = {
      study: {
        sessions: sessions,
        byDay: byDay,
        weekday: studyByWeekday(sessions),
        hours: studyByHour(sessions),
        subjects: studyBySubject(sessions),
        kinds: studyByKind(sessions),
        total: totalSeconds,
        activeDays: activeDays,
        activeSet: activeSet,
        consistency: span.count ? (activeDays / span.count) * 100 : 0,
        dailyAverage: span.count ? totalSeconds / span.count : 0,
        activeAverage: activeDays ? totalSeconds / activeDays : 0,
        streak: streakOf(activeSet),
        bestStreak: longestStreak(span.days, activeSet),
        best: sessions.length ? sessions.reduce(function (a, b) {
          return num(a.seconds) >= num(b.seconds) ? a : b;
        }) : null,
        allCount: raw.sureler.length
      },
      exams: {
        details: details,
        allOfType: allOfType,
        hidden: allOfType.length - details.length,
        analysis: analysis,
        counts: counts,
        allCount: raw.denemeler.length
      },
      curriculum: curriculumStats(examType),
      goals: goalStats(),
      diary: diaryStats()
    };

    ctx.score = overallScore();
    return ctx;
  }

  /**
   * Genel skor — beş bileşenin ağırlıklı ortalaması.
   * Amaç tek bir "not" vermek değil, hangi alanın geri kaldığını
   * bir bakışta göstermek; kırılım her zaman skorla birlikte durur.
   */
  function overallScore() {
    var consistency = ctx.study.consistency;

    var dailyMinutes = ctx.study.dailyAverage / 60;
    var tempo = clamp((dailyMinutes / TEMPO_TARGET_MIN) * 100, 0, 100);

    var curriculumPct = ctx.curriculum ? ctx.curriculum.totals.pct : 0;

    var details = ctx.exams.details;
    var examScore = 0;
    if (details.length >= 2) {
      var success = details.map(function (d) { return d.success; });
      /* Son üç denemenin seviyesi + genel eğilimin küçük katkısı */
      examScore = clamp(avg(success.slice(-3)) + slope(success) * 10, 0, 100);
    } else if (details.length === 1) {
      examScore = clamp(details[0].success, 0, 100);
    }

    var goalScore = ctx.goals.totalDue ? ctx.goals.rate : 0;

    var parts = [
      { name: "Süreklilik",         value: consistency,   weight: 25, color: COLOR.brand,
        hint: "Aralıktaki günlerin yüzde kaçında çalışma kaydı var." },
      { name: "Çalışma temposu",    value: tempo,         weight: 20, color: COLOR.brand2,
        hint: "Günlük ortalama sürenin " + TEMPO_TARGET_MIN + " dakikalık hedefe oranı." },
      { name: "Müfredat ilerlemesi",value: curriculumPct, weight: 20, color: COLOR.ok,
        hint: "Seçili sınav türünde bitirilen konu oranı." },
      { name: "Deneme başarısı",    value: examScore,     weight: 20, color: COLOR.warn,
        hint: "Son denemelerin net oranı ve gelişim eğilimi." },
      { name: "Hedef tutarlılığı",  value: goalScore,     weight: 15, color: "#38bdf8",
        hint: "Aralıkta üzerine düşen hedeflerin tamamlanma oranı." }
    ];

    var weights = sum(parts.map(function (p) { return p.weight; }));
    var total = sum(parts.map(function (p) { return p.value * p.weight; })) / weights;

    return { total: clamp(total, 0, 100), parts: parts };
  }

  /* ==========================================================
     8b) İÇGÖRÜLER — Sayıların cümleye çevrilmiş hâli
     ========================================================== */
  function insights() {
    var out = [];
    var st = ctx.study, ex = ctx.exams, gl = ctx.goals, dy = ctx.diary;

    /* En verimli gün */
    var byWeekday = st.weekday.slice().sort(function (a, b) { return b.total - a.total; });
    if (byWeekday.length && byWeekday[0].total > 0) {
      var bestDay = byWeekday[0];
      var worstDay = st.weekday.filter(function (d) { return d.occurrences > 0; })
        .sort(function (a, b) { return a.average - b.average; })[0];

      out.push({
        tone: "good", icon: "fa-calendar-day", title: "En verimli günün " + bestDay.name,
        text: bestDay.name + " günleri ortalama " + fmtDur(bestDay.average) + " çalışıyorsun." +
          (worstDay && worstDay.name !== bestDay.name
            ? " En düşük gün ise " + worstDay.name + " (" + fmtDur(worstDay.average) + ")."
            : "")
      });
    }

    /* En yoğun saat dilimi */
    var hourTop = -1, hourVal = 0;
    st.hours.forEach(function (v, h) { if (v > hourVal) { hourVal = v; hourTop = h; } });
    if (hourTop >= 0 && hourVal > 0) {
      out.push({
        tone: "", icon: "fa-clock", title: "En çok " + pad2(hourTop) + ":00 – " + pad2((hourTop + 1) % 24) + ":00 arasında çalışıyorsun",
        text: "Bu saat diliminde toplam " + fmtDur(hourVal) + " kayıt var. Zor konuları bu aralığa almak işine yarayabilir."
      });
    }

    /* Süreklilik */
    if (span.count >= 7) {
      var tone = st.consistency >= 70 ? "good" : st.consistency >= 40 ? "warn" : "bad";
      out.push({
        tone: tone, icon: "fa-fire",
        title: "Süreklilik " + fmtPct(st.consistency, 0),
        text: span.count + " günün " + st.activeDays + " gününde çalıştın. " +
          (st.streak > 0 ? "Şu anki serin " + st.streak + " gün; " : "Şu an aktif bir serin yok; ") +
          "en uzun serin " + st.bestStreak + " gün."
      });
    }

    /* En çok çalışılan ders */
    if (st.subjects.length) {
      var topSubject = st.subjects[0];
      out.push({
        tone: "", icon: "fa-book",
        title: "En çok " + topSubject.name,
        text: "Toplam sürenin " + fmtPct(st.total ? (topSubject.seconds / st.total) * 100 : 0, 0) +
          " kadarı bu derse ayrılmış (" + fmtDur(topSubject.seconds) + ", " + topSubject.count + " oturum)."
      });
    }

    /* Deneme eğilimi */
    if (ex.details.length >= 2) {
      var nets = ex.details.map(function (d) { return d.net; });
      var change = nets[nets.length - 1] - nets[0];
      var dir = trendOf(change, 0.25);

      out.push({
        tone: dir === "up" ? "good" : dir === "down" ? "bad" : "warn",
        icon: trendIcon(dir),
        title: S.typeLabel(examType) + " toplam net " + signed(change, 2),
        text: "İlk denemede " + fmtNum(nets[0], 2) + " net, son denemede " +
          fmtNum(nets[nets.length - 1], 2) + " net. Deneme başına ortalama değişim " +
          signed(slope(nets), 2) + " net."
      });

      /* En çok gelişen ve gerileyen ders */
      var sorted = ex.analysis.slice().sort(function (a, b) { return b.diff - a.diff; });
      var rising = sorted[0], falling = sorted[sorted.length - 1];

      if (rising && rising.diff > 0.05) {
        out.push({
          tone: "good", icon: "fa-arrow-trend-up", title: "En çok gelişen ders: " + rising.name,
          text: "İlk denemeden bu yana " + signed(rising.diff, 2) + " net. Ortalaman " +
            fmtNum(rising.average, 2) + " / " + rising.max + "."
        });
      }
      if (falling && falling.diff < -0.05) {
        out.push({
          tone: "bad", icon: "fa-arrow-trend-down", title: "Geri giden ders: " + falling.name,
          text: "İlk denemeye göre " + signed(falling.diff, 2) + " net. Bu derse ayrılan süre " +
            (function () {
              var match = st.subjects.filter(function (s) { return s.name === falling.name; })[0];
              return match ? fmtDur(match.seconds) : "kayıtlarda görünmüyor";
            })() + "."
        });
      }

      /* İsabet oranı */
      var accuracy = avg(ex.details.map(function (d) { return d.accuracy; }));
      out.push({
        tone: accuracy >= 80 ? "good" : accuracy >= 65 ? "warn" : "bad",
        icon: "fa-crosshairs", title: "İsabet oranı " + fmtPct(accuracy, 1),
        text: "İşaretlediğin her 100 sorunun " + fmtNum(accuracy, 0) + " tanesi doğru. " +
          "Ortalama boş sayın " + fmtNum(avg(ex.details.map(function (d) { return d.blank; })), 0) + "."
      });
    }

    /* Müfredat */
    if (ctx.curriculum && ctx.curriculum.totals.topics) {
      var t = ctx.curriculum.totals;
      var slow = ctx.curriculum.rows.slice().sort(function (a, b) { return a.pct - b.pct; })[0];

      out.push({
        tone: t.pct >= 60 ? "good" : t.pct >= 30 ? "warn" : "bad",
        icon: "fa-book-open",
        title: S.typeLabel(examType) + " müfredatının " + fmtPct(t.pct, 0) + "'i bitti",
        text: t.topics + " konudan " + t.done + " tanesi tamamlandı, " + t.review +
          " tanesi tekrar bekliyor." + (slow ? " En geride kalan ders: " + slow.name + "." : "")
      });
    }

    /* Hedefler */
    if (gl.totalDue) {
      out.push({
        tone: gl.rate >= 75 ? "good" : gl.rate >= 45 ? "warn" : "bad",
        icon: "fa-bullseye", title: "Hedef tamamlama " + fmtPct(gl.rate, 0),
        text: "Aralıkta üzerine " + gl.totalDue + " hedef günü düştü, " + gl.totalDone +
          " tanesini bitirdin. Kusursuz gün sayın " + gl.perfectDays + "."
      });
    }

    /* Ruh hâli ile çalışma ilişkisi */
    if (dy.count >= 4) {
      var xs = [], ys = [];
      span.days.forEach(function (ds, i) {
        var mood = dy.moodSeries[i];
        if (mood == null) return;
        xs.push(mood);
        ys.push(st.byDay.map[ds] / 3600);
      });

      var r = correlation(xs, ys);
      if (r != null && Math.abs(r) >= 0.3) {
        out.push({
          tone: r > 0 ? "good" : "warn", icon: "fa-face-smile",
          title: r > 0 ? "Çok çalıştığın günlerde moralin daha iyi" : "Uzun çalışma günleri seni yoruyor",
          text: "Günlük kayıtlarındaki ruh hâli ile çalışma süresi arasındaki ilişki katsayısı " +
            fmtNum(r, 2) + ". " + (r > 0
              ? "Tempoyu korumak motivasyonunu da taşıyor."
              : "Uzun oturumları bölmek ve mola vermek işe yarayabilir.")
        });
      }
    }

    return out;
  }

  function insightGrid() {
    var list = insights();
    if (!list.length) {
      return '<div class="chart-empty"><i class="fa-solid fa-lightbulb"></i>' +
        "Yorum üretebilmek için biraz daha veri gerekiyor.</div>";
    }

    return '<div class="insight-grid">' + list.map(function (it) {
      return '<div class="insight-card ' + (it.tone || "") + '">' +
        '<span class="insight-icon"><i class="fa-solid ' + it.icon + '"></i></span>' +
        "<div><h4>" + U.escape(it.title) + "</h4><p>" + U.escape(it.text) + "</p></div>" +
      "</div>";
    }).join("") + "</div>";
  }

  /* ==========================================================
     8c) BÖLÜM — Genel Bakış
     ========================================================== */
  function renderGeneral() {
    var st = ctx.study, ex = ctx.exams, gl = ctx.goals, dy = ctx.diary;
    var out = "";

    /* ---- Skor kartı ---- */
    var score = ctx.score;
    out += '<div class="chart-card"><div class="score-card">' +
      gauge(score.total, "genel skor") +
      '<div class="score-breakdown">' + score.parts.map(function (p) {
        return '<div class="score-row"' + tipAttr(p.name, p.hint) + ">" +
          '<span class="score-name">' + U.escape(p.name) +
            ' <span class="faint">%' + p.weight + "</span></span>" +
          '<span class="score-track"><span class="score-fill" style="width:' +
            n2(clamp(p.value, 0, 100)) + "%;background:" + p.color + '"></span></span>' +
          '<span class="score-num">' + fmtNum(p.value, 0) + "</span>" +
        "</div>";
      }).join("") + "</div>" +
    "</div></div>";

    /* ---- Anahtar göstergeler ---- */
    var netSpark = ex.details.map(function (d) { return d.net; });
    var lastNet = netSpark.length ? netSpark[netSpark.length - 1] : 0;
    var prevNet = netSpark.length > 1 ? netSpark[netSpark.length - 2] : null;
    var totalQuestions = ctx.curriculum ? ctx.curriculum.totals.questions : 0;
    var examQuestions = sum(ex.details.map(function (d) { return d.answered; }));

    out += kpiGrid([
      kpiCard({
        label: "Toplam çalışma", value: fmtDur(st.total), icon: "fa-stopwatch",
        color: COLOR.brand, spark: st.byDay.values,
        note: "Günlük ortalama " + fmtDur(st.dailyAverage),
        tip: st.sessions.length + " oturum · çalışılan günlerde ortalama " + fmtDur(st.activeAverage)
      }),
      kpiCard({
        label: "Aktif gün", value: st.activeDays, unit: "/ " + span.count,
        icon: "fa-calendar-check", color: COLOR.ok,
        note: "Süreklilik " + fmtPct(st.consistency, 0),
        tone: st.consistency >= 60 ? "up" : st.consistency >= 35 ? "flat" : "down",
        tip: "Şu anki seri " + st.streak + " gün · en uzun seri " + st.bestStreak + " gün"
      }),
      kpiCard({
        label: S.typeLabel(examType) + " son net",
        value: netSpark.length ? fmtNum(lastNet, 2) : "—",
        icon: "fa-clipboard-list", color: COLOR.brand2, spark: netSpark,
        note: prevNet == null
          ? ex.details.length + " deneme kayıtlı"
          : "Önceki denemeye göre " + signed(lastNet - prevNet, 2),
        tone: prevNet == null ? "" : trendOf(lastNet - prevNet, 0.05),
        tip: "Ortalama " + fmtNum(avg(netSpark), 2) + " · en iyi " +
          (netSpark.length ? fmtNum(maxOf(netSpark), 2) : "—")
      }),
      kpiCard({
        label: "Müfredat", value: ctx.curriculum ? fmtPct(ctx.curriculum.totals.pct, 0) : "—",
        icon: "fa-book-open", color: "#38bdf8",
        note: ctx.curriculum
          ? ctx.curriculum.totals.done + " / " + ctx.curriculum.totals.topics + " konu bitti"
          : "Müfredat kataloğu yüklenmedi",
        tip: ctx.curriculum
          ? ctx.curriculum.totals.learning + " konu çalışılıyor, " +
            ctx.curriculum.totals.review + " konu tekrar bekliyor"
          : ""
      }),
      kpiCard({
        label: "Hedef tamamlama", value: gl.totalDue ? fmtPct(gl.rate, 0) : "—",
        icon: "fa-bullseye", color: COLOR.warn,
        note: gl.totalDue ? gl.totalDone + " / " + gl.totalDue + " hedef günü" : "Aralıkta hedef yok",
        tone: gl.totalDue ? (gl.rate >= 70 ? "up" : gl.rate >= 40 ? "flat" : "down") : "",
        tip: "Kusursuz gün " + gl.perfectDays + " · seri " + gl.streak + " gün"
      }),
      kpiCard({
        label: "Çözülen soru", value: fmtInt(totalQuestions + examQuestions),
        icon: "fa-list-check", color: "#a3e635",
        note: fmtInt(totalQuestions) + " konu çalışması + " + fmtInt(examQuestions) + " denemede",
        tip: "Ders takibi ve denemelerde işaretlenen soruların toplamı"
      }),
      kpiCard({
        label: "Günlük kaydı", value: dy.count, unit: "yazı",
        icon: "fa-feather-pointed", color: "#f472b6",
        note: dy.count ? "Ortalama ruh hâli " + fmtNum(dy.moodAverage, 1) + " / 5" : "Bu aralıkta yazı yok",
        tip: dy.count ? "Seri " + dy.streak + " gün · toplam " + fmtInt(dy.words) + " kelime" : ""
      }),
      kpiCard({
        label: "Deneme sayısı", value: ex.details.length, unit: S.typeLabel(examType),
        icon: "fa-file-pen", color: "#fb923c",
        note: "Tüm türlerde " + ex.allCount + " deneme",
        tip: S.types.map(function (t) {
          return t.label + ": " + (ex.counts[t.value] || 0);
        }).join(" · ")
      })
    ]);

    /* ---- İçgörüler ---- */
    out += sectionHead("fa-lightbulb", "Öne çıkanlar", "Verinin cümleye dönüşmüş hâli.");
    out += insightGrid();

    /* ---- Çalışma ısı haritası ---- */
    out += sectionHead("fa-calendar", "Çalışma takvimi",
      "Koyu kareler o gün hiç kayıt olmadığını, parlak kareler yoğun günleri gösterir.");

    out += chartCard({
      icon: "fa-fire", title: "Günlük çalışma yoğunluğu",
      meta: [
        "Seri <strong>" + st.streak + " gün</strong>",
        "En uzun <strong>" + st.bestStreak + " gün</strong>",
        heatScale()
      ],
      body: calendarHeatmap({
        days: span.days,
        valueOf: function (ds) { return st.byDay.map[ds] || 0; },
        fmt: function (v) { return fmtDur(v); },
        zeroText: "Çalışma kaydı yok",
        title: "Günlük çalışma yoğunluğu"
      }),
      foot: span.days.length > HEATMAP_MAX_DAYS
        ? "Aralık uzun olduğu için haritada son " + HEATMAP_MAX_DAYS + " gün gösteriliyor."
        : ""
    });

    /* ---- İki eğilim grafiği yan yana ---- */
    var dayLabels = span.days.map(shortDs);

    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-chart-area", title: "Günlük çalışma süresi",
      meta: ["Toplam <strong>" + fmtDur(st.total) + "</strong>"],
      body: lineChart({
        labels: dayLabels,
        series: [{
          name: "Çalışma", color: COLOR.brand, area: true,
          values: st.byDay.values.map(function (v) { return v / 3600; }),
          dots: span.days.length <= 40
        }],
        height: 260,
        fmt: function (v) { return fmtNum(v, v >= 10 ? 0 : 1) + " sa"; },
        tipTitle: function (i) { return longDs(span.days[i]); },
        title: "Günlük çalışma süresi"
      })
    });

    out += chartCard({
      icon: "fa-chart-line", title: S.typeLabel(examType) + " net gelişimi",
      meta: ex.details.length
        ? ["Ortalama <strong>" + fmtNum(avg(netSpark), 2) + "</strong>"]
        : [],
      body: ex.details.length
        ? lineChart({
            labels: ex.details.map(function (d) { return shortDs(d.ds); }),
            series: [{ name: "Toplam net", color: COLOR.brand2, area: true, values: netSpark }],
            height: 260, fmt: function (v) { return fmtNum(v, 1); },
            tipTitle: function (i) { return ex.details[i].name; },
            title: "Net gelişimi"
          })
        : emptyChart("Bu sınav türünde henüz deneme yok.", "fa-clipboard-list")
    });

    out += "</div>";

    return out;
  }

  /* ==========================================================
     8d) BÖLÜM — Çalışma
     ========================================================== */
  function renderStudy() {
    var st = ctx.study;

    if (!raw.sureler.length) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-stopwatch"></i>' +
        "<h3>Henüz çalışma kaydın yok</h3>" +
        "<p>Çalışma Sayacı modülünde bir oturum tamamladığında süreler burada raporlanır. " +
        "Bir dakikanın altındaki oturumlar kaydedilmez.</p>" +
        '<a class="btn-x btn-primary-x" href="sayac.html">' +
          '<i class="fa-solid fa-stopwatch"></i> Sayacı aç</a>' +
      "</div>";
    }

    var out = "";
    var dayLabels = span.days.map(shortDs);
    var hourValues = ctx.study.hours;

    /* ---- Göstergeler ---- */
    var sessionSeconds = st.sessions.map(function (s) { return num(s.seconds); });

    out += kpiGrid([
      kpiCard({
        label: "Toplam süre", value: fmtDur(st.total), icon: "fa-hourglass-half",
        color: COLOR.brand, spark: st.byDay.values,
        note: st.sessions.length + " oturum",
        tip: "Tüm zamanlarda " + st.allCount + " oturum kayıtlı"
      }),
      kpiCard({
        label: "Günlük ortalama", value: fmtDur(st.dailyAverage), icon: "fa-calendar-day",
        color: COLOR.brand2,
        note: "Çalışılan günlerde " + fmtDur(st.activeAverage),
        tip: span.count + " günün " + st.activeDays + " gününde kayıt var"
      }),
      kpiCard({
        label: "Oturum ortalaması", value: fmtDur(avg(sessionSeconds)), icon: "fa-timer",
        color: COLOR.ok,
        note: "En uzun " + (st.best ? fmtDur(st.best.seconds) : "—"),
        tip: st.best && st.best.subjectName
          ? "En uzun oturum: " + st.best.subjectName + " · " + longDs(dsOf(sessionStart(st.best)))
          : ""
      }),
      kpiCard({
        label: "Süreklilik", value: fmtPct(st.consistency, 0), icon: "fa-fire",
        color: COLOR.warn,
        note: "Seri " + st.streak + " gün · en uzun " + st.bestStreak,
        tone: st.consistency >= 60 ? "up" : st.consistency >= 35 ? "flat" : "down"
      })
    ]);

    /* ---- Günlük süre ---- */
    out += sectionHead("fa-chart-area", "Zaman içindeki tempo",
      "Aralıktaki her gün için toplam çalışma süresi ve yedi günlük kayan ortalama.");

    var hours = st.byDay.values.map(function (v) { return v / 3600; });
    var trend = movingAverage(hours, Math.min(7, Math.max(2, Math.round(span.count / 6))));

    out += chartCard({
      icon: "fa-chart-area", title: "Günlük çalışma süresi",
      meta: [
        "Toplam <strong>" + fmtDur(st.total) + "</strong>",
        "En yoğun gün <strong>" + fmtDur(maxOf(st.byDay.values)) + "</strong>"
      ],
      body: lineChart({
        labels: dayLabels,
        series: [
          { name: "Günlük süre", color: COLOR.brand, area: true, values: hours,
            dots: span.days.length <= 40 },
          { name: "Kayan ortalama", color: COLOR.warn, dashed: true, values: trend, dots: false }
        ],
        height: 300, fmt: function (v) { return fmtNum(v, v >= 10 ? 0 : 1) + " sa"; },
        tipTitle: function (i) { return longDs(span.days[i]); },
        title: "Günlük çalışma süresi"
      }),
      legend: legendOf([
        { name: "Günlük süre", color: COLOR.brand },
        { name: "Kayan ortalama", color: COLOR.warn }
      ])
    });

    /* ---- Hafta günü + saat ---- */
    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-calendar-week", title: "Haftanın günlerine göre",
      meta: ["Gün başına ortalama süre"],
      body: barChart({
        labels: st.weekday.map(function (d) { return d.short; }),
        values: st.weekday.map(function (d) { return d.average / 3600; }),
        colors: st.weekday.map(function (d, i) { return i >= 5 ? COLOR.brand2 : COLOR.brand; }),
        height: 260, showValues: true,
        fmt: function (v) { return fmtNum(v, v >= 10 ? 0 : 1) + " sa"; },
        tipSub: function (i) {
          var d = st.weekday[i];
          return "Ortalama " + fmtDur(d.average) + "\nToplam " + fmtDur(d.total) +
            "\n" + d.occurrences + " kez bu aralıkta";
        },
        title: "Haftanın günlerine göre çalışma"
      }),
      foot: "Aralıkta her gün eşit sayıda tekrar etmeyebilir; bu yüzden toplam değil, gün başına ortalama gösteriliyor."
    });

    out += chartCard({
      icon: "fa-clock", title: "Günün saatlerine göre",
      meta: ["Oturumlar saat dilimlerine bölüştürülür"],
      body: barChart({
        labels: hourValues.map(function (_, h) { return pad2(h); }),
        values: hourValues.map(function (v) { return v / 3600; }),
        color: COLOR.ok, height: 260, maxLabels: 12,
        fmt: function (v) { return fmtNum(v, v >= 10 ? 0 : 1) + " sa"; },
        tipSub: function (h) {
          return pad2(h) + ":00 – " + pad2((h + 1) % 24) + ":00\n" + fmtDur(hourValues[h]);
        },
        title: "Saat dilimine göre çalışma"
      }),
      foot: "Saat sınırını aşan oturumlar, gerçekte geçirdikleri süreye göre saatlere paylaştırılır."
    });

    out += "</div>";

    /* ---- Ders dağılımı ---- */
    out += sectionHead("fa-book", "Ders dağılımı",
      "Süre hangi derslere gitmiş — dengesizlikleri buradan yakalarsın.");

    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-chart-pie", title: "Derslere göre süre",
      body: donutChart({
        items: st.subjects.slice(0, 10).map(function (s, i) {
          return { name: s.name, value: s.seconds, color: PALETTE[i % PALETTE.length] };
        }),
        fmt: function (v) { return fmtDur(v); },
        centerValue: fmtDur(st.total), centerLabel: "toplam süre",
        title: "Derslere göre süre"
      }),
      legend: legendOf(st.subjects.slice(0, 10).map(function (s, i) {
        return {
          name: s.name, color: PALETTE[i % PALETTE.length],
          value: fmtPct(st.total ? (s.seconds / st.total) * 100 : 0, 0)
        };
      }))
    });

    out += chartCard({
      icon: "fa-ranking-star", title: "Ders sıralaması",
      meta: [st.subjects.length + " ders"],
      body: rankList(st.subjects.map(function (s, i) {
        return {
          name: s.name, value: s.seconds, label: fmtDur(s.seconds),
          sub: s.count + " oturum", color: PALETTE[i % PALETTE.length],
          tip: fmtDur(s.seconds) + " · toplam sürenin " +
            fmtPct(st.total ? (s.seconds / st.total) * 100 : 0, 1) + " kadarı"
        };
      }), { limit: 12 }),
      tight: true
    });

    out += "</div>";

    /* ---- Sayaç modları + oturum tablosu ---- */
    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-sliders", title: "Sayaç modlarına göre",
      body: donutChart({
        items: st.kinds.map(function (k) {
          return { name: SESSION_KINDS[k.key].label, value: k.seconds, color: SESSION_KINDS[k.key].color };
        }),
        fmt: function (v) { return fmtDur(v); },
        centerValue: String(st.sessions.length), centerLabel: "oturum",
        title: "Sayaç modları"
      }),
      legend: legendOf(st.kinds.map(function (k) {
        return {
          name: SESSION_KINDS[k.key].label, color: SESSION_KINDS[k.key].color,
          value: k.count + " oturum"
        };
      }))
    });

    var longest = st.sessions.slice().sort(function (a, b) {
      return num(b.seconds) - num(a.seconds);
    }).slice(0, 10);

    out += chartCard({
      icon: "fa-trophy", title: "En uzun oturumlar",
      body: dataTable({
        columns: [
          { key: "date", label: "Tarih" },
          { key: "subject", label: "Ders" },
          { key: "kind", label: "Mod" },
          { key: "duration", label: "Süre", num: true }
        ],
        rows: longest.map(function (s) {
          var kind = SESSION_KINDS[s.kind] || SESSION_KINDS.kronometre;
          return {
            date: U.escape(shortDs(dsOf(sessionStart(s)))),
            subject: '<span class="cell-name">' + U.escape(s.subjectName || "Ders seçilmedi") + "</span>",
            kind: '<span class="pill mute"><i class="fa-solid ' + kind.icon + '"></i>' +
              U.escape(kind.label) + "</span>",
            duration: "<strong>" + U.escape(fmtDur(s.seconds)) + "</strong>"
          };
        }),
        emptyText: "Bu aralıkta oturum yok."
      }),
      tight: true
    });

    out += "</div>";

    return out;
  }

  /* ==========================================================
     8e) BÖLÜM — Denemeler
     ========================================================== */
  function renderExams() {
    var ex = ctx.exams;
    var label = S.typeLabel(examType);

    if (!ex.allOfType.length) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-clipboard-list"></i>' +
        "<h3>" + U.escape(label) + " denemesi bulunamadı</h3>" +
        "<p>Deneme Sonuçları modülüne bu türde bir kayıt girdiğinde net gelişimi, isabet oranı " +
        "ve ders bazlı analiz burada oluşur." +
        (ex.allCount ? " Diğer türlerde " + ex.allCount + " deneme kayıtlı." : "") + "</p>" +
        '<a class="btn-x btn-primary-x" href="exams.html">' +
          '<i class="fa-solid fa-plus"></i> Deneme ekle</a>' +
      "</div>";
    }

    if (!ex.details.length) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-calendar-xmark"></i>' +
        "<h3>Seçili aralıkta " + U.escape(label) + " denemesi yok</h3>" +
        "<p>Bu türde " + ex.allOfType.length + " deneme kayıtlı ama hepsi " +
        longDs(span.start) + " tarihinden önce. Aralığı genişletirsen hepsi raporlanır.</p>" +
        '<button type="button" class="btn-x btn-primary-x" id="widen-range">' +
          '<i class="fa-solid fa-arrows-left-right"></i> Tüm zamanları göster</button>' +
      "</div>";
    }

    var details = ex.details;
    var nets = details.map(function (d) { return d.net; });
    var accuracies = details.map(function (d) { return d.accuracy; });
    var maxNet = details[0].max;

    var out = "";

    if (ex.hidden > 0) {
      out += '<div class="insight-card warn" style="margin-bottom:18px">' +
        '<span class="insight-icon"><i class="fa-solid fa-filter"></i></span>' +
        "<div><h4>" + ex.hidden + " deneme aralık dışında</h4>" +
        "<p>Aşağıdaki bütün hesaplar " + longDs(span.start) + " – " + longDs(span.end) +
        " arasındaki " + details.length + " denemeye dayanıyor.</p></div></div>";
    }

    /* ---- Göstergeler ---- */
    var last5 = nets.slice(-5);
    var prev5 = nets.slice(-10, -5);

    out += kpiGrid([
      kpiCard({
        label: "Deneme sayısı", value: details.length, unit: label,
        icon: "fa-file-pen", color: COLOR.brand,
        note: "Tüm türlerde " + ex.allCount,
        tip: S.types.map(function (t) { return t.label + ": " + (ex.counts[t.value] || 0); }).join(" · ")
      }),
      kpiCard({
        label: "Ortalama net", value: fmtNum(avg(nets), 2), unit: "/ " + maxNet,
        icon: "fa-calculator", color: COLOR.brand2, spark: nets,
        note: "Başarı " + fmtPct(maxNet ? (avg(nets) / maxNet) * 100 : 0, 1),
        tip: "Standart sapma " + fmtNum(stdev(nets), 2) + " — düşük sapma istikrar demek"
      }),
      kpiCard({
        label: "En iyi net", value: fmtNum(maxOf(nets), 2),
        icon: "fa-trophy", color: COLOR.ok,
        note: (function () {
          var best = details[nets.indexOf(maxOf(nets))];
          return best ? best.name : "";
        })(),
        tip: "En düşük net " + fmtNum(minOf(nets), 2)
      }),
      kpiCard({
        label: "Son 5 ortalaması", value: fmtNum(avg(last5), 2),
        icon: "fa-wave-square", color: COLOR.warn,
        note: prev5.length
          ? "Önceki 5'e göre " + signed(avg(last5) - avg(prev5), 2)
          : last5.length + " deneme üzerinden",
        tone: prev5.length ? trendOf(avg(last5) - avg(prev5), 0.05) : ""
      }),
      kpiCard({
        label: "İsabet oranı", value: fmtPct(avg(accuracies), 1),
        icon: "fa-crosshairs", color: "#38bdf8", spark: accuracies,
        note: "İşaretlenen sorularda doğru payı",
        tip: "Toplam doğru " + fmtInt(sum(details.map(function (d) { return d.correct; }))) +
          " · yanlış " + fmtInt(sum(details.map(function (d) { return d.wrong; })))
      }),
      kpiCard({
        label: "Soru kapsama", value: fmtPct(avg(details.map(function (d) { return d.coverage; })), 1),
        icon: "fa-list-check", color: "#a3e635",
        note: "Ortalama " + fmtNum(avg(details.map(function (d) { return d.blank; })), 0) + " boş",
        tip: "Sınavdaki soruların yüzde kaçını işaretlediğin"
      }),
      kpiCard({
        label: "Gelişim", value: signed(nets[nets.length - 1] - nets[0], 2), unit: "net",
        icon: trendIcon(trendOf(nets[nets.length - 1] - nets[0], 0.25)),
        color: COLOR.ok,
        note: "Deneme başına " + signed(slope(nets), 2),
        tone: trendOf(nets[nets.length - 1] - nets[0], 0.25),
        tip: "İlkten sona toplam değişim ve en küçük kareler eğimi"
      }),
      kpiCard({
        label: "İstikrar", value: fmtNum(stdev(nets), 2), unit: "sapma",
        icon: "fa-scale-balanced", color: "#f472b6",
        note: stdev(nets) < 3 ? "Netlerin oturmuş" : stdev(nets) < 7 ? "Orta dalgalanma" : "Yüksek dalgalanma",
        tip: "Standart sapma küçüldükçe denemeler arası fark azalır"
      })
    ]);

    /* ---- Net gelişimi ---- */
    out += sectionHead("fa-chart-line", "Net gelişimi",
      "Her nokta bir deneme; kesikli çizgi son üç denemenin kayan ortalamasıdır.");

    out += chartCard({
      icon: "fa-chart-area", title: label + " toplam net",
      meta: [
        details.length + " deneme",
        "Ortalama <strong>" + fmtNum(avg(nets), 2) + "</strong>",
        "En iyi <strong>" + fmtNum(maxOf(nets), 2) + "</strong>"
      ],
      body: lineChart({
        labels: details.map(function (d) { return shortDs(d.ds); }),
        series: [
          { name: "Toplam net", color: COLOR.brand, area: true, values: nets },
          { name: "3 denemelik ortalama", color: COLOR.warn, dashed: true,
            values: movingAverage(nets, 3), dots: false }
        ],
        height: 320, zeroLine: true,
        fmt: function (v) { return fmtNum(v, 1); },
        tipTitle: function (i) { return details[i].name + " · " + shortDs(details[i].ds); },
        title: "Toplam net gelişimi"
      }),
      legend: legendOf([
        { name: "Toplam net", color: COLOR.brand },
        { name: "3 denemelik kayan ortalama", color: COLOR.warn }
      ])
    });

    /* ---- İsabet + doğru/yanlış/boş ---- */
    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-crosshairs", title: "İsabet ve kapsama",
      meta: ["Yüzde"],
      body: lineChart({
        labels: details.map(function (d) { return shortDs(d.ds); }),
        series: [
          { name: "İsabet", color: COLOR.ok, values: accuracies, area: true },
          { name: "Kapsama", color: "#38bdf8", values: details.map(function (d) { return d.coverage; }) }
        ],
        height: 270, fmt: function (v) { return fmtNum(v, 0) + "%"; },
        tipTitle: function (i) { return details[i].name; },
        title: "İsabet ve kapsama"
      }),
      legend: legendOf([
        { name: "İsabet — doğru / işaretlenen", color: COLOR.ok },
        { name: "Kapsama — işaretlenen / toplam soru", color: "#38bdf8" }
      ])
    });

    out += chartCard({
      icon: "fa-layer-group", title: "Doğru · yanlış · boş dağılımı",
      meta: ["Soru sayısı"],
      body: stackedBarChart({
        labels: details.map(function (d) { return shortDs(d.ds); }),
        segments: [
          { name: "Doğru", color: COLOR.ok, values: details.map(function (d) { return d.correct; }) },
          { name: "Yanlış", color: COLOR.danger, values: details.map(function (d) { return d.wrong; }) },
          { name: "Boş", color: "#3a4260", values: details.map(function (d) { return d.blank; }) }
        ],
        height: 270, fmt: function (v) { return fmtNum(v, 0); },
        title: "Doğru yanlış boş dağılımı"
      }),
      legend: legendOf([
        { name: "Doğru", color: COLOR.ok },
        { name: "Yanlış", color: COLOR.danger },
        { name: "Boş", color: "#3a4260" }
      ])
    });

    out += "</div>";

    /* ---- Ders bazlı radar + sıralama ---- */
    out += sectionHead("fa-bullseye", "Ders bazlı performans",
      "Radar, her dersin kendi soru sayısına göre oranlanmış netini gösterir; " +
      "böylece 40 soruluk Matematik ile 5 soruluk Felsefe aynı ölçekte karşılaştırılabilir.");

    var recent = details.slice(-3);
    var recentAnalysis = subjectAnalysis(examType, recent);

    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-bullseye", title: "Ders profili",
      meta: ["Tüm aralık ve son " + recent.length + " deneme"],
      body: radarChart({
        axes: ex.analysis.map(function (a) {
          return { name: a.name.length > 12 ? a.name.slice(0, 11) + "…" : a.name, max: a.max };
        }),
        series: [
          { name: "Genel ortalama", color: COLOR.brand,
            values: ex.analysis.map(function (a) { return a.average; }) },
          { name: "Son " + recent.length + " deneme", color: COLOR.ok,
            values: recentAnalysis.map(function (a) { return a.average; }) }
        ],
        title: "Ders profili"
      }),
      legend: legendOf([
        { name: "Genel ortalama", color: COLOR.brand },
        { name: "Son " + recent.length + " deneme", color: COLOR.ok }
      ]),
      foot: "Yeşil alan mavinin dışına taştığı derslerde son denemelerde yükseliş var."
    });

    out += chartCard({
      icon: "fa-ranking-star", title: "Ders başarı oranı",
      meta: ["Ortalama net / soru sayısı"],
      body: rankList(ex.analysis.slice().sort(function (a, b) { return b.ratio - a.ratio; })
        .map(function (a) {
          return {
            name: a.name, icon: a.icon, value: a.ratio, pct: clamp(a.ratio, 0, 100),
            label: fmtPct(a.ratio, 0), sub: fmtNum(a.average, 2) + " / " + a.max,
            color: a.ratio >= 70 ? COLOR.ok : a.ratio >= 45 ? COLOR.warn : COLOR.danger,
            tip: "Ortalama " + fmtNum(a.average, 2) + " net\nEn iyi " + fmtNum(a.best, 2) +
              "\nGelişim " + signed(a.diff, 2)
          };
        }), { limit: 20 }),
      tight: true
    });

    out += "</div>";

    /* ---- Ders detay tablosu ---- */
    out += chartCard({
      icon: "fa-table-list", title: "Ders bazlı istatistik",
      meta: [details.length + " deneme üzerinden"],
      body: dataTable({
        columns: [
          { key: "name", label: "Ders" },
          { key: "avg", label: "Ortalama", num: true },
          { key: "best", label: "En iyi", num: true },
          { key: "worst", label: "En düşük", num: true },
          { key: "last", label: "Son", num: true },
          { key: "diff", label: "Gelişim", num: true },
          { key: "ratio", label: "Başarı", num: true },
          { key: "accuracy", label: "İsabet", num: true },
          { key: "stdev", label: "Sapma", num: true }
        ],
        rows: ex.analysis.map(function (a) {
          return {
            name: '<span class="cell-name"><i class="fa-solid ' + a.icon + '"></i>' +
              U.escape(a.name) + ' <span class="faint">/ ' + a.max + "</span></span>",
            avg: "<strong>" + fmtNum(a.average, 2) + "</strong>",
            best: fmtNum(a.best, 2),
            worst: fmtNum(a.worst, 2),
            last: fmtNum(a.last, 2),
            diff: deltaCell(a.diff),
            ratio: '<span class="pill ' +
              (a.ratio >= 70 ? "ok" : a.ratio >= 45 ? "warn" : "bad") + '">' +
              fmtPct(a.ratio, 0) + "</span>",
            accuracy: fmtPct(a.accuracy, 0),
            stdev: fmtNum(a.stdev, 2)
          };
        }),
        footer: {
          name: "<strong>Toplam</strong>",
          avg: "<strong>" + fmtNum(avg(nets), 2) + "</strong>",
          best: fmtNum(maxOf(nets), 2),
          worst: fmtNum(minOf(nets), 2),
          last: fmtNum(nets[nets.length - 1], 2),
          diff: deltaCell(nets[nets.length - 1] - nets[0]),
          ratio: fmtPct(maxNet ? (avg(nets) / maxNet) * 100 : 0, 0),
          accuracy: fmtPct(avg(accuracies), 0),
          stdev: fmtNum(stdev(nets), 2)
        }
      }),
      tight: true
    });

    /* ---- Deneme listesi ---- */
    out += chartCard({
      icon: "fa-list-ol", title: "Deneme dökümü",
      meta: ["Yeniden eskiye"],
      body: dataTable({
        columns: [
          { key: "date", label: "Tarih" },
          { key: "name", label: "Deneme" },
          { key: "net", label: "Net", num: true },
          { key: "delta", label: "Fark", num: true },
          { key: "correct", label: "D", num: true },
          { key: "wrong", label: "Y", num: true },
          { key: "blank", label: "B", num: true },
          { key: "accuracy", label: "İsabet", num: true },
          { key: "success", label: "Başarı", num: true }
        ],
        rows: details.slice().reverse().map(function (d, i, arr) {
          /* arr ters çevrilmiş: bir sonraki eleman bir önceki denemedir */
          var previous = arr[i + 1];
          return {
            date: U.escape(shortDs(d.ds)),
            name: '<span class="cell-name">' + U.escape(d.name) + "</span>",
            net: "<strong>" + fmtNum(d.net, 2) + "</strong>",
            delta: previous ? deltaCell(d.net - previous.net) : "—",
            correct: '<span style="color:' + COLOR.ok + '">' + d.correct + "</span>",
            wrong: '<span style="color:' + COLOR.danger + '">' + d.wrong + "</span>",
            blank: '<span class="faint">' + d.blank + "</span>",
            accuracy: fmtPct(d.accuracy, 0),
            success: fmtPct(d.success, 1)
          };
        })
      }),
      tight: true
    });

    return out;
  }

  /* ==========================================================
     8f) BÖLÜM — Müfredat
     ========================================================== */
  function renderCurriculum() {
    var cur = ctx.curriculum;
    var label = S.typeLabel(examType);

    if (!cur) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-book-open"></i>' +
        "<h3>Müfredat kataloğu okunamadı</h3>" +
        "<p>Bu bölüm konular.js içindeki müfredat listesine dayanır. " +
        "Dosya yüklenmediği için ilerleme hesaplanamıyor.</p>" +
      "</div>";
    }

    var t = cur.totals;

    if (!t.started) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-book-open"></i>' +
        "<h3>" + U.escape(label) + " müfredatında henüz işaretleme yok</h3>" +
        "<p>Ders Takibi modülünde bir konuyu \"çalışıyorum\" ya da \"bitti\" olarak " +
        "işaretlediğinde ilerleme, süre ve soru dağılımı burada raporlanır. " +
        "Katalogda " + t.topics + " konu tanımlı.</p>" +
        '<a class="btn-x btn-primary-x" href="dersler.html">' +
          '<i class="fa-solid fa-book-open"></i> Ders takibini aç</a>' +
      "</div>";
    }

    var out = "";

    /* ---- Göstergeler ---- */
    var touched = curriculumTouchDays();

    out += kpiGrid([
      kpiCard({
        label: "Tamamlanan konu", value: t.done, unit: "/ " + t.topics,
        icon: "fa-circle-check", color: COLOR.ok,
        note: fmtPct(t.pct, 1) + " bitti",
        tip: "Kalan konu " + (t.topics - t.done)
      }),
      kpiCard({
        label: "Başlanan konu", value: t.started, unit: "/ " + t.topics,
        icon: "fa-play", color: COLOR.brand,
        note: fmtPct(t.startedPct, 1) + " el değmiş",
        tip: t.learning + " konu çalışılıyor · " + t.review + " konu tekrar bekliyor"
      }),
      kpiCard({
        label: "Konu çalışma süresi", value: fmtMinutes(t.minutes),
        icon: "fa-clock", color: COLOR.brand2,
        note: t.started ? "Konu başına " + fmtMinutes(t.minutes / t.started) : "—",
        tip: "Ders Takibi modülüne elle girilen süreler"
      }),
      kpiCard({
        label: "Çözülen soru", value: fmtInt(t.questions),
        icon: "fa-list-check", color: COLOR.warn,
        note: t.started ? "Konu başına " + fmtNum(t.questions / t.started, 0) : "—",
        tip: "Konu bazında işaretlenen soru sayıları"
      }),
      kpiCard({
        label: "Tekrar bekleyen", value: t.review, unit: "konu",
        icon: "fa-rotate-right", color: COLOR.danger,
        note: t.topics ? fmtPct((t.review / t.topics) * 100, 1) + " oranında" : "",
        tip: "\"Tekrar gerekli\" işaretli konular"
      }),
      kpiCard({
        label: "Bu aralıkta dokunulan gün", value: Object.keys(touched).length,
        unit: "/ " + span.count, icon: "fa-calendar-check", color: "#38bdf8",
        note: "Konu kaydının güncellendiği günler",
        tip: "Ders takibinde bir konuyu güncellediğin gün sayısı"
      })
    ]);

    /* ---- Genel dağılım ---- */
    out += sectionHead("fa-chart-pie", label + " müfredat durumu",
      "Katalogdaki " + t.topics + " konunun durumlara göre dağılımı.");

    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-chart-pie", title: "Konu durumları",
      body: donutChart({
        items: STATUS_ORDER.map(function (k) {
          return { name: TOPIC_STATUS[k].label, value: t[k], color: TOPIC_STATUS[k].color };
        }),
        fmt: function (v) { return fmtNum(v, 0) + " konu"; },
        centerValue: fmtPct(t.pct, 0), centerLabel: "tamamlandı",
        title: "Konu durumları"
      }),
      legend: legendOf(STATUS_ORDER.map(function (k) {
        return { name: TOPIC_STATUS[k].label, color: TOPIC_STATUS[k].color, value: t[k] };
      }))
    });

    out += chartCard({
      icon: "fa-ranking-star", title: "Derslere göre tamamlanma",
      meta: [cur.rows.length + " ders"],
      body: rankList(cur.rows.slice().sort(function (a, b) { return b.pct - a.pct; })
        .map(function (r) {
          return {
            name: r.name, icon: r.icon, value: r.pct, pct: r.pct,
            label: fmtPct(r.pct, 0), sub: r.done + " / " + r.topics,
            color: r.pct >= 70 ? COLOR.ok : r.pct >= 35 ? COLOR.warn : COLOR.danger,
            tip: r.done + " bitti · " + r.learning + " çalışılıyor · " + r.review +
              " tekrar · " + r.none + " başlanmadı"
          };
        }), { limit: 20 }),
      tight: true
    });

    out += "</div>";

    /* ---- Ders bazlı yığılmış dağılım ---- */
    out += chartCard({
      icon: "fa-layer-group", title: "Ders bazlı konu dağılımı",
      meta: ["Konu sayısı"],
      body: stackedBarChart({
        labels: cur.rows.map(function (r) {
          return r.name.length > 10 ? r.name.slice(0, 9) + "…" : r.name;
        }),
        segments: STATUS_ORDER.map(function (k) {
          return {
            name: TOPIC_STATUS[k].label, color: TOPIC_STATUS[k].color,
            values: cur.rows.map(function (r) { return r[k]; })
          };
        }),
        height: 300, maxLabels: 20,
        fmt: function (v) { return fmtNum(v, 0); },
        title: "Ders bazlı konu dağılımı"
      }),
      legend: legendOf(STATUS_ORDER.map(function (k) {
        return { name: TOPIC_STATUS[k].label, color: TOPIC_STATUS[k].color };
      }))
    });

    /* ---- Süre ve soru ---- */
    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-clock", title: "Derse göre konu çalışma süresi",
      body: barChart({
        labels: cur.rows.map(function (r) {
          return r.name.length > 9 ? r.name.slice(0, 8) + "…" : r.name;
        }),
        values: cur.rows.map(function (r) { return r.minutes / 60; }),
        color: COLOR.brand2, height: 260, maxLabels: 20,
        fmt: function (v) { return fmtNum(v, v >= 10 ? 0 : 1) + " sa"; },
        tipSub: function (i) {
          return fmtMinutes(cur.rows[i].minutes) + "\n" + fmtInt(cur.rows[i].questions) + " soru";
        },
        title: "Derse göre çalışma süresi"
      })
    });

    out += chartCard({
      icon: "fa-list-check", title: "Derse göre çözülen soru",
      body: barChart({
        labels: cur.rows.map(function (r) {
          return r.name.length > 9 ? r.name.slice(0, 8) + "…" : r.name;
        }),
        values: cur.rows.map(function (r) { return r.questions; }),
        color: COLOR.warn, height: 260, maxLabels: 20,
        fmt: function (v) { return fmtInt(v); },
        tipSub: function (i) {
          var r = cur.rows[i];
          return fmtInt(r.questions) + " soru\n" +
            (r.minutes ? fmtNum(r.questions / (r.minutes / 60), 0) + " soru/saat" : "süre girilmemiş");
        },
        title: "Derse göre çözülen soru"
      })
    });

    out += "</div>";

    /* ---- Detay tablosu ---- */
    out += chartCard({
      icon: "fa-table-list", title: label + " müfredat dökümü",
      body: dataTable({
        columns: [
          { key: "name", label: "Ders" },
          { key: "topics", label: "Konu", num: true },
          { key: "done", label: "Bitti", num: true },
          { key: "learning", label: "Çalışılıyor", num: true },
          { key: "review", label: "Tekrar", num: true },
          { key: "none", label: "Başlanmadı", num: true },
          { key: "pct", label: "Tamamlanma", num: true },
          { key: "minutes", label: "Süre", num: true },
          { key: "questions", label: "Soru", num: true }
        ],
        rows: cur.rows.map(function (r) {
          return {
            name: '<span class="cell-name"><i class="fa-solid ' + r.icon + '"></i>' +
              U.escape(r.name) + "</span>",
            topics: r.topics,
            done: '<span style="color:' + TOPIC_STATUS.done.color + '">' + r.done + "</span>",
            learning: r.learning,
            review: '<span style="color:' + TOPIC_STATUS.review.color + '">' + r.review + "</span>",
            none: '<span class="faint">' + r.none + "</span>",
            pct: '<span class="pill ' +
              (r.pct >= 70 ? "ok" : r.pct >= 35 ? "warn" : "bad") + '">' + fmtPct(r.pct, 0) + "</span>",
            minutes: fmtMinutes(r.minutes),
            questions: fmtInt(r.questions)
          };
        }),
        footer: {
          name: "<strong>Toplam</strong>",
          topics: "<strong>" + t.topics + "</strong>",
          done: t.done, learning: t.learning, review: t.review, none: t.none,
          pct: "<strong>" + fmtPct(t.pct, 1) + "</strong>",
          minutes: fmtMinutes(t.minutes),
          questions: fmtInt(t.questions)
        }
      }),
      tight: true
    });

    return out;
  }

  /* ==========================================================
     8g) BÖLÜM — Hedefler
     ========================================================== */
  function renderGoals() {
    var gl = ctx.goals;

    if (!gl.allGoals) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-bullseye"></i>' +
        "<h3>Henüz hedefin yok</h3>" +
        "<p>Hedefler modülünde bir hedef oluşturduğunda tamamlama oranı, seri ve " +
        "önceliklere göre dağılım burada raporlanır. Tekrarlı hedefler her gün için ayrı sayılır.</p>" +
        '<a class="btn-x btn-primary-x" href="hedefler.html">' +
          '<i class="fa-solid fa-plus"></i> Hedef ekle</a>' +
      "</div>";
    }

    if (!gl.totalDue) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-calendar-xmark"></i>' +
        "<h3>Seçili aralığa hedef düşmüyor</h3>" +
        "<p>" + gl.allGoals + " hedef kayıtlı ama hiçbiri " + longDs(span.start) + " – " +
        longDs(span.end) + " arasına denk gelmiyor. Aralığı genişletmeyi dene.</p>" +
        '<button type="button" class="btn-x btn-primary-x" id="widen-range">' +
          '<i class="fa-solid fa-arrows-left-right"></i> Tüm zamanları göster</button>' +
      "</div>";
    }

    var out = "";
    var dayLabels = span.days.map(shortDs);

    /* Günlük oran serisi — hedef düşmeyen günler boş bırakılır */
    var rateSeries = gl.perDay.map(function (d) {
      return d.due ? (d.done / d.due) * 100 : null;
    });

    out += kpiGrid([
      kpiCard({
        label: "Tamamlama oranı", value: fmtPct(gl.rate, 1),
        icon: "fa-bullseye", color: COLOR.brand, spark: rateSeries,
        note: gl.totalDone + " / " + gl.totalDue + " hedef günü",
        tone: gl.rate >= 70 ? "up" : gl.rate >= 40 ? "flat" : "down",
        tip: "Tekrarlı hedefler her gün için ayrı sayılır"
      }),
      kpiCard({
        label: "Aktif hedef", value: gl.activeGoals, unit: "/ " + gl.allGoals,
        icon: "fa-list-check", color: COLOR.brand2,
        note: "Bu aralıkta üzerine düşen hedefler",
        tip: "Toplam " + gl.allGoals + " hedef kayıtlı"
      }),
      kpiCard({
        label: "Kusursuz gün", value: gl.perfectDays, unit: "/ " + span.count,
        icon: "fa-star", color: COLOR.ok,
        note: "Tüm hedeflerin bitirildiği günler",
        tip: span.count ? fmtPct((gl.perfectDays / span.count) * 100, 0) + " oranında" : ""
      }),
      kpiCard({
        label: "Seri", value: gl.streak, unit: "gün",
        icon: "fa-fire", color: COLOR.warn,
        note: "En uzun seri " + gl.bestStreak + " gün",
        tone: gl.streak > 0 ? "up" : "flat",
        tip: "Üzerine düşen hedeflerin tamamını bitirdiğin ardışık günler"
      })
    ]);

    /* ---- Günlük yük ve tamamlama ---- */
    out += sectionHead("fa-chart-column", "Günlük hedef yükü",
      "Her gün üzerine kaç hedef düştüğü ve kaçının bittiği.");

    out += chartCard({
      icon: "fa-chart-column", title: "Düşen ve tamamlanan hedefler",
      meta: [
        "Toplam <strong>" + gl.totalDue + "</strong> hedef günü",
        "Tamamlanan <strong>" + gl.totalDone + "</strong>"
      ],
      body: stackedBarChart({
        labels: dayLabels,
        segments: [
          { name: "Tamamlanan", color: COLOR.ok,
            values: gl.perDay.map(function (d) { return d.done; }) },
          { name: "Yarım kalan", color: "#3a4260",
            values: gl.perDay.map(function (d) { return d.due - d.done; }) }
        ],
        height: 280, fmt: function (v) { return fmtNum(v, 0); },
        title: "Günlük hedef yükü"
      }),
      legend: legendOf([
        { name: "Tamamlanan", color: COLOR.ok },
        { name: "Yarım kalan", color: "#3a4260" }
      ])
    });

    out += chartCard({
      icon: "fa-percent", title: "Günlük tamamlama oranı",
      meta: ["Hedef düşmeyen günler çizilmez"],
      body: lineChart({
        labels: dayLabels,
        series: [{ name: "Tamamlama", color: COLOR.brand, area: true, values: rateSeries,
          dots: span.days.length <= 40 }],
        height: 250, fmt: function (v) { return fmtNum(v, 0) + "%"; },
        tipTitle: function (i) { return longDs(span.days[i]); },
        title: "Günlük tamamlama oranı"
      })
    });

    /* ---- Öncelik ve hafta günü ---- */
    var weekdayRate = WEEKDAYS.map(function (name, i) {
      var due = 0, done = 0;
      gl.perDay.forEach(function (d) {
        if (weekIndex(d.ds) !== i) return;
        due += d.due; done += d.done;
      });
      return { name: name, short: WEEKDAYS_SHORT[i], due: due, done: done,
               rate: due ? (done / due) * 100 : 0 };
    });

    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-flag", title: "Önceliğe göre dağılım",
      body: donutChart({
        items: Object.keys(PRIORITIES).map(function (k) {
          return { name: PRIORITIES[k].label + " öncelik", value: gl.byPriority[k].due,
                   color: PRIORITIES[k].color };
        }),
        fmt: function (v) { return fmtNum(v, 0) + " hedef günü"; },
        centerValue: String(gl.totalDue), centerLabel: "hedef günü",
        title: "Önceliğe göre dağılım"
      }),
      legend: legendOf(Object.keys(PRIORITIES).map(function (k) {
        var p = gl.byPriority[k];
        return {
          name: PRIORITIES[k].label, color: PRIORITIES[k].color,
          value: p.due ? fmtPct((p.done / p.due) * 100, 0) + " bitti" : "—"
        };
      })),
      foot: "Yüksek öncelikli hedeflerin tamamlanma oranı düşükse plan gerçekçi olmayabilir."
    });

    out += chartCard({
      icon: "fa-calendar-week", title: "Hafta gününe göre tamamlama",
      body: barChart({
        labels: weekdayRate.map(function (d) { return d.short; }),
        values: weekdayRate.map(function (d) { return d.rate; }),
        colors: weekdayRate.map(function (d) {
          return d.rate >= 70 ? COLOR.ok : d.rate >= 40 ? COLOR.warn : COLOR.danger;
        }),
        height: 260, showValues: true,
        fmt: function (v) { return fmtNum(v, 0) + "%"; },
        tipSub: function (i) {
          var d = weekdayRate[i];
          return d.done + " / " + d.due + " hedef günü tamamlandı";
        },
        title: "Hafta gününe göre tamamlama"
      }),
      foot: "Belirli günlerde oran düşüyorsa o günlere daha az hedef koymak seriyi korur."
    });

    out += "</div>";

    /* ---- Hedef dökümü ---- */
    out += chartCard({
      icon: "fa-table-list", title: "Hedef dökümü",
      meta: [gl.activeGoals + " hedef"],
      body: dataTable({
        columns: [
          { key: "title", label: "Hedef" },
          { key: "priority", label: "Öncelik" },
          { key: "repeat", label: "Tekrar" },
          { key: "subject", label: "Ders" },
          { key: "due", label: "Düşen gün", num: true },
          { key: "done", label: "Biten", num: true },
          { key: "rate", label: "Oran", num: true }
        ],
        rows: gl.perGoal.map(function (g) {
          var repeatLabels = { none: "Tek seferlik", daily: "Her gün",
                               weekday: "Hafta içi", weekly: "Haftalık" };
          return {
            title: '<span class="cell-name">' + U.escape(g.title) + "</span>",
            priority: '<span class="pill" style="color:' + PRIORITIES[g.priority].color +
              ";border-color:" + PRIORITIES[g.priority].color + "33;background:" +
              PRIORITIES[g.priority].color + '1f">' + U.escape(PRIORITIES[g.priority].label) + "</span>",
            repeat: '<span class="faint">' + U.escape(repeatLabels[g.repeat] || "—") + "</span>",
            subject: g.subjectName ? U.escape(g.subjectName) : '<span class="faint">—</span>',
            due: g.due,
            done: g.done,
            rate: '<span class="pill ' +
              (g.rate >= 70 ? "ok" : g.rate >= 40 ? "warn" : "bad") + '">' + fmtPct(g.rate, 0) + "</span>"
          };
        }),
        footer: {
          title: "<strong>Toplam</strong>", priority: "", repeat: "", subject: "",
          due: "<strong>" + gl.totalDue + "</strong>",
          done: "<strong>" + gl.totalDone + "</strong>",
          rate: "<strong>" + fmtPct(gl.rate, 0) + "</strong>"
        }
      }),
      tight: true
    });

    return out;
  }

  /* ==========================================================
     8h) BÖLÜM — Günlük
     ========================================================== */
  function renderDiary() {
    var dy = ctx.diary;

    if (!dy.allCount) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-feather-pointed"></i>' +
        "<h3>Henüz günlük yazın yok</h3>" +
        "<p>Günlüğüm modülünde gününü yazdığında ruh hâli dağılımı, yazma serisi ve " +
        "çalışma süresiyle ilişkisi burada raporlanır.</p>" +
        '<a class="btn-x btn-primary-x" href="gunluk.html">' +
          '<i class="fa-solid fa-plus"></i> Günlük yaz</a>' +
      "</div>";
    }

    if (!dy.count) {
      return '<div class="empty-stats">' +
        '<i class="fa-solid fa-calendar-xmark"></i>' +
        "<h3>Seçili aralıkta yazı yok</h3>" +
        "<p>Toplam " + dy.allCount + " günlük kaydın var ama hiçbiri " + longDs(span.start) +
        " – " + longDs(span.end) + " arasına düşmüyor.</p>" +
        '<button type="button" class="btn-x btn-primary-x" id="widen-range">' +
          '<i class="fa-solid fa-arrows-left-right"></i> Tüm zamanları göster</button>' +
      "</div>";
    }

    var out = "";
    var dayLabels = span.days.map(shortDs);
    var dominant = MOOD_ORDER.slice().sort(function (a, b) {
      return dy.moodCounts[b] - dy.moodCounts[a];
    })[0];

    out += kpiGrid([
      kpiCard({
        label: "Günlük yazısı", value: dy.count, unit: "kayıt",
        icon: "fa-feather-pointed", color: COLOR.brand,
        note: span.count ? fmtPct((dy.count / span.count) * 100, 0) + " günde yazılmış" : "",
        tip: "Tüm zamanlarda " + dy.allCount + " kayıt"
      }),
      kpiCard({
        label: "Ortalama ruh hâli", value: fmtNum(dy.moodAverage, 1), unit: "/ 5",
        icon: "fa-face-smile", color: MOODS[dominant].color,
        note: "En sık: " + MOODS[dominant].face + " " + MOODS[dominant].label,
        tone: dy.moodAverage >= 3.8 ? "up" : dy.moodAverage >= 2.8 ? "flat" : "down",
        tip: MOOD_ORDER.map(function (k) {
          return MOODS[k].label + ": " + dy.moodCounts[k];
        }).join(" · ")
      }),
      kpiCard({
        label: "Yazma serisi", value: dy.streak, unit: "gün",
        icon: "fa-fire", color: COLOR.warn,
        note: "En uzun seri " + dy.bestStreak + " gün",
        tone: dy.streak > 0 ? "up" : "flat"
      }),
      kpiCard({
        label: "Yazılan kelime", value: fmtInt(dy.words),
        icon: "fa-pen-nib", color: "#f472b6",
        note: "Yazı başına " + fmtNum(dy.avgWords, 0) + " kelime",
        tip: "Günlük gövdelerindeki toplam kelime sayısı"
      }),
      kpiCard({
        label: "Günlükte belirtilen süre", value: fmtMinutes(dy.minutes),
        icon: "fa-clock", color: COLOR.brand2,
        note: dy.count ? "Yazı başına " + fmtMinutes(dy.minutes / dy.count) : "",
        tip: "Sayaç kaydından bağımsız, elle yazdığın süreler"
      }),
      kpiCard({
        label: "Etiketlenen ders", value: dy.topSubjects.length, unit: "farklı",
        icon: "fa-tags", color: COLOR.ok,
        note: dy.topSubjects.length ? "En çok " + dy.topSubjects[0].name : "Ders etiketi yok",
        tip: dy.topSubjects.slice(0, 5).map(function (s) {
          return s.name + " (" + s.count + ")";
        }).join(" · ")
      })
    ]);

    /* ---- Ruh hâli ---- */
    out += sectionHead("fa-face-smile", "Ruh hâli",
      "Günlük kayıtlarındaki his; 5 en iyi, 1 en zor günü gösterir.");

    out += '<div class="chart-row">';

    out += chartCard({
      icon: "fa-chart-pie", title: "Ruh hâli dağılımı",
      body: donutChart({
        items: MOOD_ORDER.map(function (k) {
          return { name: MOODS[k].face + " " + MOODS[k].label, value: dy.moodCounts[k],
                   color: MOODS[k].color };
        }),
        fmt: function (v) { return fmtNum(v, 0) + " gün"; },
        centerValue: fmtNum(dy.moodAverage, 1), centerLabel: "ortalama",
        title: "Ruh hâli dağılımı"
      }),
      legend: legendOf(MOOD_ORDER.map(function (k) {
        return {
          name: MOODS[k].face + " " + MOODS[k].label, color: MOODS[k].color,
          value: dy.count ? fmtPct((dy.moodCounts[k] / dy.count) * 100, 0) : "0%"
        };
      }))
    });

    out += chartCard({
      icon: "fa-tags", title: "En çok yazılan dersler",
      meta: [dy.topSubjects.length + " etiket"],
      body: rankList(dy.topSubjects.map(function (s, i) {
        return {
          name: s.name, value: s.count, label: s.count + " gün",
          color: PALETTE[i % PALETTE.length],
          tip: dy.count ? fmtPct((s.count / dy.count) * 100, 0) + " oranında geçiyor" : ""
        };
      }), { limit: 12, emptyText: "Günlüklerde ders etiketi kullanılmamış." }),
      tight: true
    });

    out += "</div>";

    /* ---- Ruh hâli ve çalışma ---- */
    var studyHours = span.days.map(function (ds) {
      return ctx.study.byDay.map[ds] / 3600;
    });
    var r = (function () {
      var xs = [], ys = [];
      dy.moodSeries.forEach(function (m, i) {
        if (m == null) return;
        xs.push(m); ys.push(studyHours[i]);
      });
      return correlation(xs, ys);
    })();

    out += chartCard({
      icon: "fa-chart-line", title: "Ruh hâli ve çalışma süresi",
      meta: r == null
        ? ["İlişki için daha çok kayıt gerekli"]
        : ["İlişki katsayısı <strong>" + fmtNum(r, 2) + "</strong>"],
      body: lineChart({
        labels: dayLabels,
        series: [
          { name: "Ruh hâli (1-5)", color: MOODS.iyi.color, values: dy.moodSeries,
            dots: span.days.length <= 40 },
          { name: "Çalışma (saat)", color: COLOR.brand, values: studyHours, dashed: true, dots: false }
        ],
        height: 280, fmt: function (v) { return fmtNum(v, 1); },
        tipTitle: function (i) { return longDs(span.days[i]); },
        title: "Ruh hâli ve çalışma süresi"
      }),
      legend: legendOf([
        { name: "Ruh hâli (1-5)", color: MOODS.iyi.color },
        { name: "Çalışma süresi (saat)", color: COLOR.brand }
      ]),
      foot: r == null
        ? "İki eğriyi karşılaştırmak için en az üç günlük kaydı gerekiyor."
        : (r > 0.3
            ? "Pozitif ilişki: çok çalıştığın günlerde moralin de yüksek."
            : r < -0.3
              ? "Negatif ilişki: uzun çalışma günlerinde moralin düşüyor, molalara dikkat."
              : "Belirgin bir ilişki yok; ruh hâlini çalışma süresi dışındaki etkenler belirliyor.")
    });

    /* ---- Günlük dökümü ---- */
    out += chartCard({
      icon: "fa-table-list", title: "Günlük dökümü",
      meta: ["Yeniden eskiye"],
      body: dataTable({
        columns: [
          { key: "date", label: "Tarih" },
          { key: "title", label: "Başlık" },
          { key: "mood", label: "Ruh hâli" },
          { key: "subjects", label: "Dersler" },
          { key: "minutes", label: "Süre", num: true },
          { key: "words", label: "Kelime", num: true }
        ],
        rows: dy.entries.slice().reverse().map(function (e) {
          var mood = MOODS[e.mood] || MOODS.normal;
          var body = String(e.body || "").trim();
          var subjects = (Array.isArray(e.subjects) ? e.subjects : []).slice(0, 3);

          return {
            date: U.escape(shortDs(dsOf(e.date))),
            title: '<span class="cell-name">' +
              U.escape(e.title || "Başlıksız") + "</span>",
            mood: '<span class="pill mute">' + mood.face + " " + U.escape(mood.label) + "</span>",
            subjects: subjects.length
              ? U.escape(subjects.join(", "))
              : '<span class="faint">—</span>',
            minutes: e.minutes ? U.escape(fmtMinutes(e.minutes)) : '<span class="faint">—</span>',
            words: body ? fmtInt(body.split(/\s+/).length) : 0
          };
        })
      }),
      tight: true
    });

    return out;
  }

  /* ==========================================================
     9) ÇİZİM DÖNGÜSÜ
     ========================================================== */
  var SECTIONS = {
    genel:    renderGeneral,
    calisma:  renderStudy,
    deneme:   renderExams,
    mufredat: renderCurriculum,
    hedef:    renderGoals,
    gunluk:   renderDiary
  };

  function renderMeta() {
    var info = document.getElementById("range-info");
    if (info) {
      info.innerHTML = "<strong>" + U.escape(longDs(span.start)) + "</strong> – <strong>" +
        U.escape(longDs(span.end)) + "</strong> · " + span.count + " gün";
    }

    var sub = document.getElementById("header-sub");
    if (sub) {
      var pieces = [];
      if (raw.denemeler.length) pieces.push(raw.denemeler.length + " deneme");
      if (raw.sureler.length) pieces.push(raw.sureler.length + " oturum");
      if (raw.hedefler.length) pieces.push(raw.hedefler.length + " hedef");
      if (raw.gunluk.length) pieces.push(raw.gunluk.length + " günlük");

      var topics = Object.keys(raw.dersler).length;
      if (topics) pieces.push(topics + " konu kaydı");

      sub.textContent = pieces.length
        ? pieces.join(" · ") + " tek ekranda"
        : "Tüm modüllerden gelen verinin tek ekranda özeti.";
    }
  }

  function render() {
    var host = document.getElementById("stats-content");
    if (!host) return;

    refreshRange();
    renderMeta();

    if (!hasAnyData()) {
      host.innerHTML =
        '<div class="empty-stats">' +
          '<i class="fa-solid fa-chart-pie"></i>' +
          "<h3>Henüz raporlanacak veri yok</h3>" +
          "<p>Bu ekran diğer modüllerin ürettiği veriden beslenir. Bir deneme gir, " +
          "sayacı çalıştır ya da bir konuyu işaretle; grafikler kendiliğinden oluşur.</p>" +
          '<div class="d-flex flex-wrap gap-2 justify-content-center">' +
            '<a class="btn-x btn-primary-x" href="exams.html">' +
              '<i class="fa-solid fa-clipboard-list"></i> Deneme ekle</a>' +
            '<a class="btn-x btn-ghost-x" href="sayac.html">' +
              '<i class="fa-solid fa-stopwatch"></i> Sayacı aç</a>' +
            '<a class="btn-x btn-ghost-x" href="dersler.html">' +
              '<i class="fa-solid fa-book-open"></i> Ders takibi</a>' +
          "</div>" +
        "</div>";
      return;
    }

    buildContext();

    var renderer = SECTIONS[section] || renderGeneral;
    host.innerHTML = renderer();

    /* Yeni çizilen içerikte "aralığı genişlet" düğmesi olabilir */
    var widen = document.getElementById("widen-range");
    if (widen) {
      widen.addEventListener("click", function () {
        rangeMode = "all";
        var select = document.getElementById("range-select");
        if (select) select.value = "all";
        render();
      });
    }
  }

  /* ==========================================================
     9b) BİLGİ BALONU
     ----------------------------------------------------------
     Tek dinleyici tüm grafikleri kapsar; içerik yeniden
     çizildiğinde bağlamayı yenilemek gerekmez.
     ========================================================== */
  function bindTooltip() {
    var tip = document.getElementById("chart-tip");
    if (!tip) return;

    var active = null;

    function targetOf(node) {
      var el = node;
      while (el && el !== document.body && el.nodeType === 1) {
        if (el.hasAttribute && el.hasAttribute("data-tip")) return el;
        el = el.parentNode;
      }
      return null;
    }

    function place(x, y) {
      var h = tip.offsetHeight;
      var w = tip.offsetWidth;
      var below = y - h - 16 < 6;

      tip.style.left = clamp(x, w / 2 + 8, window.innerWidth - w / 2 - 8) + "px";
      tip.style.top = (below ? y + 20 : y - 12) + "px";
      tip.style.transform = below ? "translate(-50%, 0)" : "translate(-50%, -100%)";
    }

    function show(el, x, y) {
      var title = el.getAttribute("data-tip") || "";
      var sub = el.getAttribute("data-tip-sub") || "";

      tip.innerHTML = '<span class="tip-title">' + U.escape(title) + "</span>" +
        (sub ? '<span class="tip-sub">' + U.escape(sub) + "</span>" : "");
      tip.classList.add("show");
      place(x, y);
    }

    function hide() {
      active = null;
      tip.classList.remove("show");
    }

    document.addEventListener("mouseover", function (e) {
      var el = targetOf(e.target);
      if (!el) return;
      active = el;
      show(el, e.clientX, e.clientY);
    });

    document.addEventListener("mousemove", function (e) {
      if (!active) return;
      /* İmleç hedeften çıktıysa balon da kapansın */
      if (!targetOf(e.target)) { hide(); return; }
      place(e.clientX, e.clientY);
    });

    document.addEventListener("mouseleave", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
  }

  /* ==========================================================
     9c) CSV RAPORU
     ----------------------------------------------------------
     Ekrandaki her başlık ayrı bir blok olarak yazılır; tek
     dosyada bütün özet çıkar.
     ========================================================== */
  function exportCsv() {
    if (!ctx) return YKS.Toast.show("Dışa aktarılacak veri yok.", "warn");

    var rows = [];

    function cell(v) {
      return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    }
    function line() {
      rows.push(Array.prototype.slice.call(arguments).map(cell).join(";"));
    }
    function blank() { rows.push(""); }
    function block(title) { blank(); line(title); }

    var st = ctx.study, ex = ctx.exams, gl = ctx.goals, dy = ctx.diary, cur = ctx.curriculum;
    var label = S.typeLabel(examType);

    /* ---- Başlık ---- */
    line("Bay Porsuk — Grafikler ve İstatistikler");
    line("Kullanıcı", currentUser.fullName || currentUser.username || "");
    line("Aralık", longDs(span.start) + " – " + longDs(span.end), span.count + " gün");
    line("Sınav türü", label);
    line("Rapor tarihi", longDs(today()));

    /* ---- Genel skor ---- */
    block("GENEL SKOR");
    line("Bileşen", "Puan", "Ağırlık");
    ctx.score.parts.forEach(function (p) {
      line(p.name, fmtNum(p.value, 1), "%" + p.weight);
    });
    line("Toplam", fmtNum(ctx.score.total, 1), "%100");

    /* ---- Çalışma ---- */
    block("ÇALIŞMA ÖZETİ");
    line("Toplam süre", fmtDur(st.total));
    line("Oturum sayısı", st.sessions.length);
    line("Aktif gün", st.activeDays, "/ " + span.count);
    line("Süreklilik", fmtNum(st.consistency, 1) + "%");
    line("Günlük ortalama", fmtDur(st.dailyAverage));
    line("Çalışılan günlerde ortalama", fmtDur(st.activeAverage));
    line("Şu anki seri", st.streak + " gün");
    line("En uzun seri", st.bestStreak + " gün");

    block("DERSE GÖRE ÇALIŞMA");
    line("Ders", "Süre", "Saniye", "Oturum", "Pay");
    st.subjects.forEach(function (s) {
      line(s.name, fmtDur(s.seconds), Math.round(s.seconds), s.count,
        fmtNum(st.total ? (s.seconds / st.total) * 100 : 0, 1) + "%");
    });

    block("HAFTANIN GÜNLERİNE GÖRE");
    line("Gün", "Toplam", "Ortalama", "Gün sayısı");
    st.weekday.forEach(function (d) {
      line(d.name, fmtDur(d.total), fmtDur(d.average), d.occurrences);
    });

    block("SAAT DİLİMİNE GÖRE");
    line("Saat", "Süre", "Saniye");
    st.hours.forEach(function (v, h) {
      if (v <= 0) return;
      line(pad2(h) + ":00", fmtDur(v), Math.round(v));
    });

    block("GÜNLÜK ÇALIŞMA SÜRESİ");
    line("Tarih", "Süre", "Dakika");
    span.days.forEach(function (ds) {
      var v = st.byDay.map[ds] || 0;
      line(ds, fmtDur(v), fmtNum(v / 60, 0));
    });

    /* ---- Denemeler ---- */
    if (ex.details.length) {
      block(label + " DENEME DÖKÜMÜ");
      line("Tarih", "Deneme", "Net", "Doğru", "Yanlış", "Boş", "İsabet %", "Başarı %");
      ex.details.forEach(function (d) {
        line(d.ds, d.name, fmtNum(d.net, 2), d.correct, d.wrong, d.blank,
          fmtNum(d.accuracy, 1), fmtNum(d.success, 1));
      });

      block(label + " DERS BAZLI ANALİZ");
      line("Ders", "Soru", "Ortalama", "En iyi", "En düşük", "Son", "Gelişim",
        "Başarı %", "İsabet %", "Sapma");
      ex.analysis.forEach(function (a) {
        line(a.name, a.max, fmtNum(a.average, 2), fmtNum(a.best, 2), fmtNum(a.worst, 2),
          fmtNum(a.last, 2), signed(a.diff, 2), fmtNum(a.ratio, 1),
          fmtNum(a.accuracy, 1), fmtNum(a.stdev, 2));
      });
    }

    /* ---- Müfredat ---- */
    if (cur && cur.totals.topics) {
      block(label + " MÜFREDAT İLERLEMESİ");
      line("Ders", "Konu", "Bitti", "Çalışılıyor", "Tekrar", "Başlanmadı",
        "Tamamlanma %", "Dakika", "Soru");
      cur.rows.forEach(function (r) {
        line(r.name, r.topics, r.done, r.learning, r.review, r.none,
          fmtNum(r.pct, 1), Math.round(r.minutes), Math.round(r.questions));
      });
      var t = cur.totals;
      line("TOPLAM", t.topics, t.done, t.learning, t.review, t.none,
        fmtNum(t.pct, 1), Math.round(t.minutes), Math.round(t.questions));
    }

    /* ---- Hedefler ---- */
    if (gl.totalDue) {
      block("HEDEF ÖZETİ");
      line("Düşen hedef günü", gl.totalDue);
      line("Tamamlanan", gl.totalDone);
      line("Oran", fmtNum(gl.rate, 1) + "%");
      line("Kusursuz gün", gl.perfectDays);
      line("Seri", gl.streak + " gün");

      block("HEDEF DÖKÜMÜ");
      line("Hedef", "Öncelik", "Tekrar", "Ders", "Düşen gün", "Biten", "Oran %");
      gl.perGoal.forEach(function (g) {
        line(g.title, PRIORITIES[g.priority].label, g.repeat, g.subjectName || "",
          g.due, g.done, fmtNum(g.rate, 1));
      });
    }

    /* ---- Günlük ---- */
    if (dy.count) {
      block("GÜNLÜK ÖZETİ");
      line("Yazı sayısı", dy.count);
      line("Ortalama ruh hâli", fmtNum(dy.moodAverage, 2) + " / 5");
      line("Yazma serisi", dy.streak + " gün");
      line("Toplam kelime", dy.words);
      line("Belirtilen süre", fmtMinutes(dy.minutes));

      block("RUH HÂLİ DAĞILIMI");
      line("Ruh hâli", "Gün", "Pay %");
      MOOD_ORDER.forEach(function (k) {
        line(MOODS[k].label, dy.moodCounts[k],
          fmtNum(dy.count ? (dy.moodCounts[k] / dy.count) * 100 : 0, 1));
      });
    }

    var csv = "﻿" + rows.join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = "istatistik-" + examType + "-" + span.start + "_" + span.end + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    YKS.Toast.show("İstatistik raporu indirildi.", "ok");
  }

  /* ==========================================================
     9d) OLAYLAR
     ========================================================== */
  function setSection(next) {
    section = next;

    U.qsa("#section-tabs .exam-tab").forEach(function (tab) {
      var active = tab.getAttribute("data-section") === next;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    render();
    /* Sekme değişince listenin başına dön; uzun bölümlerde
       kullanıcı ortada kalmasın. */
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindEvents() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = "index.html";
    });

    U.qsa("#section-tabs .exam-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        setSection(tab.getAttribute("data-section"));
      });
    });

    document.getElementById("range-select").addEventListener("change", function (e) {
      rangeMode = e.target.value;
      render();
    });

    document.getElementById("type-select").addEventListener("change", function (e) {
      examType = e.target.value;
      render();
    });

    document.getElementById("export-btn").addEventListener("click", exportCsv);

    document.getElementById("print-btn").addEventListener("click", function () {
      window.print();
    });
  }

  /* ==========================================================
     10) BAŞLATMA
     ========================================================== */
  function init() {
    if (!loadUser()) return;

    readData();
    bindEvents();
    bindTooltip();
    render();

    YKS.Particles.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window, document);
