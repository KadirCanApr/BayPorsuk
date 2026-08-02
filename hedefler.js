/* ============================================================
   Aksiyom — hedefler.js
   ------------------------------------------------------------
   Hedefler modülü. Bir hedef; tarihe bağlı, öncelikli, isteğe
   bağlı olarak bir derse bağlanan ve sayıyla ölçülebilen bir
   iştir. Tekrarlı hedefler tek kayıtta tutulur; her gün için
   ayrı kayıt üretilmez, o güne düşüp düşmediği hesaplanır.

   Veri kullanıcı kaydının içinde durur:
     currentUser.data.hedefler = [ hedef, ... ]
     currentUser.data.sureler  = [ ... ]   (sayaç modülü — otomatik ölçüt)

   Bir hedef kaydı:
     id, title, date, description, priority
     examType, subjectId, subjectName        → ders bağlantısı
     metric: { kind, target, auto }          → soru / sayfa / dakika
     steps:  [ { id, text } ]                → alt adımlar
     repeat, repeatUntil                     → tekrar kuralı
     doneDates:      [ "2026-07-29", ... ]   → tamamlanan günler
     progressByDate: { "2026-07-29": 12 }    → ölçüt ilerlemesi
     stepDoneByDate: { "2026-07-29": {id:1} }→ adım durumları
     completed                               → eski sürümlerle uyum
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     1) SABİTLER
     ========================================================== */
  var MONTHS_TR = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  /* Takvim pazartesi ile başlar (0 = Pazartesi) */
  var DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  var DAYS_LONG_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  var PRIORITIES = {
    high:   { label: "Yüksek", weight: 3 },
    medium: { label: "Orta",   weight: 2 },
    low:    { label: "Düşük",  weight: 1 }
  };

  /* Ölçüt türleri — step: hızlı artırma düğmelerinin adımları */
  var METRICS = {
    soru:   { label: "Soru",  unit: "soru",  icon: "fa-list-check", steps: [1, 10], auto: false },
    sayfa:  { label: "Sayfa", unit: "sayfa", icon: "fa-book",       steps: [1, 5],  auto: false },
    dakika: { label: "Süre",  unit: "dk",    icon: "fa-clock",      steps: [5, 25], auto: true }
  };

  var REPEATS = {
    none:    { label: "Tek seferlik", short: "" },
    daily:   { label: "Her gün",      short: "Her gün" },
    weekday: { label: "Hafta içi",    short: "Hafta içi" },
    weekly:  { label: "Haftalık",     short: "Haftalık" }
  };

  /* Tekrarlı hedeflerin listede/istatistikte açıldığı pencere */
  var PAST_WINDOW = 45;
  var FUTURE_WINDOW = 60;
  var STREAK_LIMIT = 400;

  /* ==========================================================
     2) DURUM
     ========================================================== */
  var currentUser = null;

  var viewYear = new Date().getFullYear();
  var viewMonth = new Date().getMonth();
  var selectedDate = null;

  var viewMode = "calendar";      /* calendar | list */
  var filterMode = "all";         /* all | today | week | overdue | done */
  var sortMode = "smart";
  var priorityFilter = "all";
  var searchQuery = "";

  /* Pencere durumu */
  var editingId = null;
  var pendingDeleteId = null;
  var modalPriority = "medium";
  var modalMetric = "none";
  var modalSteps = [];

  /* ==========================================================
     3) TARİH YARDIMCILARI
     ------------------------------------------------------------
     Tarihler her yerde "YYYY-AA-GG" metni olarak taşınır; bu
     biçimde metin karşılaştırması tarih karşılaştırmasıyla
     aynı sonucu verdiği için sıralama ve aralık kontrolleri
     Date nesnesi kurmadan yapılabiliyor.
     ========================================================== */
  function pad2(n) { return String(n).padStart(2, "0"); }

  function dateStr(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function toDate(ds) {
    var p = String(ds).split("-");
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function todayStr() { return dateStr(new Date()); }

  function addDays(ds, n) {
    var d = toDate(ds);
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }

  /** Pazartesi = 0 olacak şekilde haftanın günü */
  function weekIndex(ds) { return (toDate(ds).getDay() + 6) % 7; }

  /** İki tarih arasındaki gün farkı (b - a) */
  function dayDiff(a, b) {
    return Math.round((toDate(b) - toDate(a)) / 86400000);
  }

  function weekStartStr(ds) { return addDays(ds, -weekIndex(ds)); }

  function humanDate(ds) {
    var d = toDate(ds);
    return d.getDate() + " " + MONTHS_TR[d.getMonth()] + " " + d.getFullYear();
  }

  function weekdayName(ds) { return DAYS_LONG_TR[weekIndex(ds)]; }

  /** "Bugün", "Yarın", "3 gün sonra", "2 gün gecikti" */
  function relativeLabel(ds) {
    var diff = dayDiff(todayStr(), ds);
    if (diff === 0) return "Bugün";
    if (diff === 1) return "Yarın";
    if (diff === -1) return "Dün";
    if (diff > 1) return diff + " gün sonra";
    return Math.abs(diff) + " gün gecikti";
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /** Dakikayı "1 sa 25 dk" biçimine çevirir */
  function humanMinutes(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    if (h && m) return h + " sa " + m + " dk";
    if (h) return h + " sa";
    return m + " dk";
  }

  /* ==========================================================
     4) KULLANICI VE KAYIT
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = YKS.Auth.currentUser();

    /* Yönetim koduyla açılan kurucu oturumunun kişisel kaydı yok;
       hedefler kullanıcı kaydında tutulduğu için modül çalışamaz. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    ensureShape();
    return true;
  }

  function ensureShape() {
    if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
    if (!Array.isArray(currentUser.data.hedefler)) currentUser.data.hedefler = [];
    if (!Array.isArray(currentUser.data.sureler)) currentUser.data.sureler = [];

    /* Eski kayıtları güncel şemaya taşı */
    currentUser.data.hedefler = currentUser.data.hedefler
      .map(normalizeGoal)
      .filter(function (g) { return !!g; });
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".goals-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-goals">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim koduyla açılmış kurucu oturumundasın. Hedefler kullanıcı hesabına bağlı tutulur; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  /** data alanını kullanıcı kaydına yazar, bellekteki kopyayı tazeler */
  function saveUserData(errorMessage) {
    var result = YKS.Users.update(currentUser.id, { data: currentUser.data });

    var fresh = YKS.Auth.currentUser();
    if (fresh) currentUser = fresh;
    ensureShape();

    if (!result.ok) {
      YKS.Toast.show(result.error || errorMessage || "Kayıt yazılamadı.", "error");
    }
    return result.ok;
  }

  function goals() { return currentUser.data.hedefler; }

  function goalById(id) {
    var list = goals();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /* ==========================================================
     5) VERİ MODELİ
     ========================================================== */

  /** Kayıttan gelen ham hedefi güncel şemaya çevirir */
  function normalizeGoal(raw) {
    if (!raw || typeof raw !== "object" || !raw.id || !raw.date) return null;

    var metric = null;
    if (raw.metric && METRICS[raw.metric.kind]) {
      metric = {
        kind: raw.metric.kind,
        target: clamp(parseInt(raw.metric.target, 10) || 1, 1, 100000),
        auto: !!(raw.metric.auto && METRICS[raw.metric.kind].auto)
      };
    }

    var steps = [];
    if (Array.isArray(raw.steps)) {
      raw.steps.forEach(function (s) {
        if (!s) return;
        var text = String(s.text == null ? s : s.text).trim();
        if (text) steps.push({ id: s.id || U.uid("step"), text: text.slice(0, 90) });
      });
    }

    var repeat = REPEATS[raw.repeat] ? raw.repeat : "none";
    var doneDates = Array.isArray(raw.doneDates) ? raw.doneDates.slice() : [];

    /* Eski kayıtlarda tamamlanma tek bir boolean'dı */
    if (!doneDates.length && raw.completed) doneDates.push(raw.date);

    return {
      id: raw.id,
      title: String(raw.title || "").trim().slice(0, 120) || "Adsız hedef",
      date: raw.date,
      description: String(raw.description || "").trim().slice(0, 500),
      priority: PRIORITIES[raw.priority] ? raw.priority : "medium",

      examType: raw.examType || null,
      subjectId: raw.subjectId || null,
      subjectName: raw.subjectName || null,

      metric: metric,
      steps: steps,

      repeat: repeat,
      repeatUntil: (repeat !== "none" && raw.repeatUntil) ? raw.repeatUntil : null,

      doneDates: doneDates,
      progressByDate: (raw.progressByDate && typeof raw.progressByDate === "object") ? raw.progressByDate : {},
      stepDoneByDate: (raw.stepDoneByDate && typeof raw.stepDoneByDate === "object") ? raw.stepDoneByDate : {},

      completed: !!raw.completed,
      createdAt: raw.createdAt || Date.now(),
      updatedAt: raw.updatedAt || Date.now(),
      completedAt: raw.completedAt || null
    };
  }

  /** Hedef o güne düşüyor mu? */
  function occursOn(goal, ds) {
    if (ds < goal.date) return false;
    if (goal.repeat === "none") return ds === goal.date;
    if (goal.repeatUntil && ds > goal.repeatUntil) return false;
    if (goal.repeat === "daily") return true;
    if (goal.repeat === "weekday") return weekIndex(ds) <= 4;
    if (goal.repeat === "weekly") return weekIndex(ds) === weekIndex(goal.date);
    return false;
  }

  /** Sayaç modülünden o güne ait çalışma dakikası */
  function autoMinutes(goal, ds) {
    var total = 0;
    currentUser.data.sureler.forEach(function (s) {
      if (!s || !s.endedAt) return;
      if (dateStr(new Date(s.endedAt)) !== ds) return;
      if (goal.subjectId && s.subjectId !== goal.subjectId) return;
      if (!goal.subjectId && goal.examType && s.examType !== goal.examType) return;
      total += (s.seconds || 0);
    });
    return Math.round(total / 60);
  }

  function metricCurrent(goal, ds) {
    if (!goal.metric) return 0;
    if (goal.metric.auto) return autoMinutes(goal, ds);
    return clamp(parseInt(goal.progressByDate[ds], 10) || 0, 0, goal.metric.target);
  }

  function stepDone(goal, ds, stepId) {
    var map = goal.stepDoneByDate[ds];
    return !!(map && map[stepId]);
  }

  function doneStepCount(goal, ds) {
    var n = 0;
    goal.steps.forEach(function (s) { if (stepDone(goal, ds, s.id)) n++; });
    return n;
  }

  /**
   * Bir günün tamamlanma durumu.
   * Ölçüt varsa sayaç belirler, yoksa alt adımlar, o da yoksa
   * doğrudan işaretleme. Böylece kart üzerindeki her gösterge
   * aynı gerçeği anlatır.
   */
  function isDone(goal, ds) {
    if (goal.metric) return metricCurrent(goal, ds) >= goal.metric.target;
    if (goal.steps.length) return doneStepCount(goal, ds) === goal.steps.length;
    return goal.doneDates.indexOf(ds) !== -1;
  }

  /** Ekranda çizilecek tek bir gün kaydı */
  function makeOcc(goal, ds) {
    var done = isDone(goal, ds);
    var metric = null;

    if (goal.metric) {
      var current = metricCurrent(goal, ds);
      metric = {
        kind: goal.metric.kind,
        unit: METRICS[goal.metric.kind].unit,
        target: goal.metric.target,
        current: current,
        auto: goal.metric.auto,
        percent: Math.round(clamp(current / goal.metric.target, 0, 1) * 100)
      };
    }

    return {
      goal: goal,
      id: goal.id,
      date: ds,
      done: done,
      overdue: !done && ds < todayStr(),
      metric: metric,
      stepsDone: doneStepCount(goal, ds)
    };
  }

  /* ==========================================================
     6) TÜRETİLMİŞ LİSTELER
     ========================================================== */

  /** Arama ve öncelik süzgeci */
  function passesFilters(occ) {
    var g = occ.goal;

    if (priorityFilter !== "all" && g.priority !== priorityFilter) return false;

    if (searchQuery) {
      var hay = (g.title + " " + g.description + " " + (g.subjectName || "")).toLocaleLowerCase("tr");
      if (hay.indexOf(searchQuery) === -1) return false;
    }
    return true;
  }

  function occurrencesOn(ds) {
    var out = [];
    goals().forEach(function (g) {
      if (occursOn(g, ds)) out.push(makeOcc(g, ds));
    });
    return out.filter(passesFilters);
  }

  /**
   * Pencere içindeki tüm gün kayıtları.
   * Tek seferlik hedefler pencere dışında kalsa bile listelenir;
   * tekrarlı olanlar yalnızca pencere içinde açılır.
   */
  function buildPool() {
    var today = todayStr();
    var from = addDays(today, -PAST_WINDOW);
    var to = addDays(today, FUTURE_WINDOW);
    var out = [];

    goals().forEach(function (g) {
      if (g.repeat === "none") {
        out.push(makeOcc(g, g.date));
        return;
      }

      var cursor = g.date > from ? g.date : from;
      var end = (g.repeatUntil && g.repeatUntil < to) ? g.repeatUntil : to;
      var guard = 0;

      while (cursor <= end && guard++ < PAST_WINDOW + FUTURE_WINDOW + 2) {
        if (occursOn(g, cursor)) out.push(makeOcc(g, cursor));
        cursor = addDays(cursor, 1);
      }
    });

    return out.filter(passesFilters);
  }

  /** Sekme süzgeci */
  function applyTabFilter(pool, mode) {
    var today = todayStr();
    var wStart = weekStartStr(today);
    var wEnd = addDays(wStart, 6);

    if (mode === "today") return pool.filter(function (o) { return o.date === today; });
    if (mode === "week") return pool.filter(function (o) { return o.date >= wStart && o.date <= wEnd; });
    if (mode === "overdue") return pool.filter(function (o) { return o.overdue; });
    if (mode === "done") return pool.filter(function (o) { return o.done; });
    return pool;
  }

  function sortOccurrences(list) {
    var mode = sortMode;

    return list.slice().sort(function (a, b) {
      if (mode === "date-asc") return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      if (mode === "date-desc") return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
      if (mode === "title") return a.goal.title.localeCompare(b.goal.title, "tr");

      if (mode === "priority") {
        var pd = PRIORITIES[b.goal.priority].weight - PRIORITIES[a.goal.priority].weight;
        if (pd) return pd;
        return a.date < b.date ? -1 : 1;
      }

      if (mode === "progress") {
        var ap = a.metric ? a.metric.percent : (a.done ? 100 : 0);
        var bp = b.metric ? b.metric.percent : (b.done ? 100 : 0);
        if (ap !== bp) return ap - bp;
        return a.date < b.date ? -1 : 1;
      }

      /* Akıllı: geciken → bitmemiş → öncelik → tarih */
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.done !== b.done) return a.done ? 1 : -1;
      var w = PRIORITIES[b.goal.priority].weight - PRIORITIES[a.goal.priority].weight;
      if (w) return w;
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.goal.title.localeCompare(b.goal.title, "tr");
    });
  }

  /** Kesintisiz tamamlama serisi — bugün bitmemişse dünden sayar */
  function streakInfo() {
    var today = todayStr();
    var cursor = today;

    function dayComplete(ds) {
      var list = [];
      goals().forEach(function (g) { if (occursOn(g, ds)) list.push(makeOcc(g, ds)); });
      if (!list.length) return null;                       /* hedefsiz gün seriyi bozmaz */
      return list.every(function (o) { return o.done; });
    }

    var todayState = dayComplete(today);
    if (todayState === false) cursor = addDays(today, -1);

    var current = 0, guard = 0;
    while (guard++ < STREAK_LIMIT) {
      var state = dayComplete(cursor);
      if (state === false) break;
      if (state === true) current++;
      cursor = addDays(cursor, -1);
    }

    /* En uzun seri — kayıtların başlangıcına kadar geriye tarar */
    var best = 0, run = 0;
    var scan = addDays(today, -STREAK_LIMIT);
    for (var i = 0; i <= STREAK_LIMIT; i++) {
      var s = dayComplete(scan);
      if (s === false) run = 0;
      else if (s === true) { run++; if (run > best) best = run; }
      scan = addDays(scan, 1);
    }

    return { current: current, best: Math.max(best, current), todayComplete: todayState === true };
  }

  /* ==========================================================
     7) İSTATİSTİK KARTLARI
     ========================================================== */
  function renderStats() {
    var host = document.getElementById("goal-stats");
    var today = todayStr();
    var pool = buildPool();

    var todayList = pool.filter(function (o) { return o.date === today; });
    var todayDone = todayList.filter(function (o) { return o.done; }).length;

    var wStart = weekStartStr(today), wEnd = addDays(wStart, 6);
    var weekList = pool.filter(function (o) { return o.date >= wStart && o.date <= wEnd; });
    var weekDone = weekList.filter(function (o) { return o.done; }).length;

    var active = pool.filter(function (o) { return !o.done && o.date >= today; });
    var activeHigh = active.filter(function (o) { return o.goal.priority === "high"; }).length;

    var overdue = pool.filter(function (o) { return o.overdue; });
    var oldest = overdue.reduce(function (acc, o) { return (!acc || o.date < acc) ? o.date : acc; }, null);

    var streak = streakInfo();

    var todayPct = todayList.length ? Math.round((todayDone / todayList.length) * 100) : 0;
    var weekPct = weekList.length ? Math.round((weekDone / weekList.length) * 100) : 0;

    var cards = [
      {
        label: "Bugün",
        value: todayList.length ? todayDone + "<small> / " + todayList.length + "</small>" : "—",
        icon: "fa-calendar-day",
        note: todayList.length
          ? (todayDone === todayList.length ? "Günü bitirdin, helal olsun." : "%" + todayPct + " tamamlandı")
          : "Bugüne hedef yok",
        bar: todayList.length ? todayPct : null,
        tone: (todayList.length && todayDone === todayList.length) ? "tone-ok" : ""
      },
      {
        label: "Bu hafta",
        value: weekList.length ? weekDone + "<small> / " + weekList.length + "</small>" : "—",
        icon: "fa-calendar-week",
        note: weekList.length ? "%" + weekPct + " tamamlandı" : "Bu haftaya hedef yok",
        bar: weekList.length ? weekPct : null,
        tone: ""
      },
      {
        label: "Aktif hedef",
        value: String(active.length),
        icon: "fa-list-check",
        note: activeHigh ? activeHigh + " tanesi yüksek öncelikli" : "Bugün ve sonrası",
        bar: null,
        tone: ""
      },
      {
        label: "Geciken",
        value: String(overdue.length),
        icon: "fa-triangle-exclamation",
        note: overdue.length ? "En eskisi: " + relativeLabel(oldest).toLocaleLowerCase("tr") : "Gecikme yok",
        bar: null,
        tone: overdue.length ? "tone-danger" : "tone-ok"
      },
      {
        label: "Seri",
        value: streak.current + "<small> gün</small>",
        icon: "fa-fire",
        note: streak.best > streak.current ? "En uzun seri: " + streak.best + " gün" : "En iyi serindesin",
        bar: null,
        tone: streak.current ? "tone-warn" : ""
      }
    ];

    host.innerHTML = cards.map(function (c) {
      return '<div class="goal-stat-card ' + c.tone + '">' +
        '<i class="stat-icon fa-solid ' + c.icon + '"></i>' +
        '<div class="stat-label">' + c.label + "</div>" +
        '<div class="stat-value">' + c.value + "</div>" +
        '<div class="stat-note">' + U.escape(c.note) + "</div>" +
        (c.bar === null ? "" : '<div class="stat-bar"><span style="width:' + c.bar + '%"></span></div>') +
      "</div>";
    }).join("");

    /* Üst bar özeti ve seri rozeti */
    var chip = document.getElementById("streak-chip");
    chip.innerHTML = '<i class="fa-solid fa-fire"></i> <b>' + streak.current + "</b> gün";
    chip.className = "streak-chip" + (streak.current ? "" : " cold");

    var sub = document.getElementById("header-sub");
    if (!pool.length) {
      sub.textContent = "Planla, takip et, bitir.";
    } else if (todayList.length) {
      sub.textContent = "Bugün " + todayList.length + " hedeften " + todayDone + " tanesi tamam" +
        (overdue.length ? " · " + overdue.length + " geciken" : "");
    } else {
      sub.textContent = "Bugüne hedef yok" + (overdue.length ? " · " + overdue.length + " geciken" : "") ;
    }

    renderTabCounts(pool);
  }

  function renderTabCounts(pool) {
    var counts = {
      all: pool.length,
      today: applyTabFilter(pool, "today").length,
      week: applyTabFilter(pool, "week").length,
      overdue: applyTabFilter(pool, "overdue").length,
      done: applyTabFilter(pool, "done").length
    };

    Object.keys(counts).forEach(function (key) {
      var el = document.querySelector('[data-count="' + key + '"]');
      if (el) el.textContent = counts[key];
    });

    var overdueTab = document.querySelector('.goal-tab[data-filter="overdue"]');
    if (overdueTab) overdueTab.classList.toggle("has-items", counts.overdue > 0);
  }

  /* ==========================================================
     8) TAKVİM
     ========================================================== */
  function renderCalendar() {
    var grid = document.getElementById("calendar-grid");
    var today = todayStr();

    document.getElementById("calendar-title").textContent = MONTHS_TR[viewMonth] + " " + viewYear;

    var firstDay = new Date(viewYear, viewMonth, 1);
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var lead = (firstDay.getDay() + 6) % 7;                  /* pazartesi başlangıcı */
    var daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    var html = DAYS_TR.map(function (d) {
      return '<div class="calendar-day-header">' + d + "</div>";
    }).join("");

    for (var i = lead - 1; i >= 0; i--) {
      html += '<div class="calendar-day other-month"><span class="calendar-day-number">' +
        (daysInPrev - i) + "</span></div>";
    }

    var monthTotal = 0, monthDone = 0;

    for (var day = 1; day <= daysInMonth; day++) {
      var ds = viewYear + "-" + pad2(viewMonth + 1) + "-" + pad2(day);
      var list = occurrencesOn(ds);
      var done = list.filter(function (o) { return o.done; }).length;
      var overdue = list.some(function (o) { return o.overdue; });

      monthTotal += list.length;
      monthDone += done;

      var cls = ["calendar-day"];
      if (ds === today) cls.push("today");
      if (ds === selectedDate) cls.push("selected");
      if (list.length && done === list.length) cls.push("all-done");
      else if (overdue) cls.push("overdue");

      var pct = list.length ? Math.round((done / list.length) * 100) : 0;

      html += '<div class="' + cls.join(" ") + '" data-date="' + ds + '" role="button" tabindex="0" ' +
              'title="' + humanDate(ds) + (list.length ? " · " + done + "/" + list.length + " tamam" : "") + '">' +
        (list.length && done === list.length ? '<i class="day-check fa-solid fa-check"></i>' : "") +
        '<span class="calendar-day-number">' + day + "</span>" +
        dayDotsHtml(list) +
        (list.length ? '<div class="day-bar"><span style="width:' + pct + '%"></span></div>' : "") +
      "</div>";
    }

    var trailing = (7 - ((lead + daysInMonth) % 7)) % 7;
    for (var j = 1; j <= trailing; j++) {
      html += '<div class="calendar-day other-month"><span class="calendar-day-number">' + j + "</span></div>";
    }

    grid.innerHTML = html;
    renderMonthSummary(monthTotal, monthDone);
  }

  /** Gün hücresindeki öncelik noktaları (en fazla 3 + artan sayı) */
  function dayDotsHtml(list) {
    if (!list.length) return '<div class="day-dots"></div>';

    var order = { high: 0, medium: 1, low: 2 };
    var sorted = list.slice().sort(function (a, b) {
      return order[a.goal.priority] - order[b.goal.priority];
    });

    var dots = sorted.slice(0, 3).map(function (o) {
      return '<i class="' + o.goal.priority + '"></i>';
    }).join("");

    if (sorted.length > 3) dots += '<i class="more">+' + (sorted.length - 3) + "</i>";
    return '<div class="day-dots">' + dots + "</div>";
  }

  function renderMonthSummary(total, done) {
    var host = document.getElementById("month-summary");

    if (!total) {
      host.innerHTML = '<span class="ms-text">Bu ayda hedef yok.</span>' +
        '<button type="button" class="link-btn" data-act="new-goal">Hedef ekle</button>';
      return;
    }

    var pct = Math.round((done / total) * 100);
    host.innerHTML =
      '<span class="ms-text"><strong>' + MONTHS_TR[viewMonth] + "</strong> · " + done + " / " + total + " hedef</span>" +
      '<div class="ms-bar"><span style="width:' + pct + '%"></span></div>' +
      '<span class="ms-pct">%' + pct + "</span>";
  }

  /* ==========================================================
     9) GÜN PANELİ
     ========================================================== */
  function renderDayPanel() {
    var list = document.getElementById("goals-list");
    var title = document.getElementById("selected-date-title");
    var sub = document.getElementById("selected-date-sub");
    var actions = document.getElementById("day-panel-actions");

    if (!selectedDate) {
      document.getElementById("day-ring").innerHTML = ringHtml(0, "—");
      title.textContent = "Gün seç";
      sub.textContent = "Takvimden bir gün seç.";
      actions.innerHTML = "";
      list.innerHTML = '<div class="empty-day"><i class="fa-solid fa-hand-pointer"></i>' +
        "Takvimden bir güne tıkla, o günün hedefleri burada açılsın.</div>";
      return;
    }

    var occs = sortOccurrences(occurrencesOn(selectedDate));
    var done = occs.filter(function (o) { return o.done; }).length;
    var pct = occs.length ? Math.round((done / occs.length) * 100) : 0;

    document.getElementById("day-ring").innerHTML =
      ringHtml(pct, occs.length ? "%" + pct : "—");

    title.textContent = humanDate(selectedDate);
    sub.textContent = weekdayName(selectedDate) + " · " + relativeLabel(selectedDate) +
      (occs.length ? " · " + done + "/" + occs.length + " tamam" : "");

    /* Gün eylemleri */
    var buttons = ['<button type="button" class="btn-x btn-primary-x" data-act="new-goal">' +
      '<i class="fa-solid fa-plus"></i> Bu güne ekle</button>'];

    var pending = occs.filter(function (o) { return !o.done; });

    if (pending.length) {
      buttons.push('<button type="button" class="btn-x btn-ghost-x" data-act="complete-day">' +
        '<i class="fa-solid fa-check-double"></i> Tümünü bitir</button>');

      var movable = pending.filter(function (o) { return o.goal.repeat === "none"; });
      if (movable.length && selectedDate < todayStr()) {
        buttons.push('<button type="button" class="btn-x btn-ghost-x" data-act="move-today">' +
          '<i class="fa-solid fa-forward"></i> Bugüne taşı (' + movable.length + ")</button>");
      } else if (movable.length) {
        buttons.push('<button type="button" class="btn-x btn-ghost-x" data-act="move-next">' +
          '<i class="fa-solid fa-forward"></i> Ertesi güne taşı (' + movable.length + ")</button>");
      }
    }

    actions.innerHTML = buttons.join("");

    if (!occs.length) {
      var filtered = searchQuery || priorityFilter !== "all";
      list.innerHTML = '<div class="empty-day"><i class="fa-solid fa-mug-hot"></i>' +
        (filtered
          ? "Süzgeçlere uyan hedef yok."
          : "Bu güne hedef eklenmemiş. Yukarıdaki düğmeyle ekleyebilirsin.") +
        "</div>";
      return;
    }

    list.innerHTML = occs.map(function (o) { return goalCardHtml(o, false); }).join("");
  }

  /** Dairesel ilerleme göstergesi */
  function ringHtml(percent, label) {
    var r = 24, c = 2 * Math.PI * r;
    var fill = (clamp(percent, 0, 100) / 100) * c;

    return '<svg width="56" height="56" viewBox="0 0 56 56">' +
      "<defs><linearGradient id=\"ringGrad\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
        '<stop offset="0%" stop-color="#5b6cff"/><stop offset="100%" stop-color="#a259ff"/>' +
      "</linearGradient></defs>" +
      '<circle class="ring-track" cx="28" cy="28" r="' + r + '" fill="none" stroke-width="6"/>' +
      '<circle class="ring-fill" cx="28" cy="28" r="' + r + '" fill="none" stroke-width="6" ' +
        'stroke-dasharray="' + fill.toFixed(1) + " " + c.toFixed(1) + '"/>' +
    "</svg>" +
    '<span class="ring-text">' + label + "</span>";
  }

  /* ==========================================================
     10) HEDEF KARTI
     ========================================================== */
  function goalCardHtml(occ, showDate) {
    var g = occ.goal;
    var cls = ["goal-card", "priority-" + g.priority];
    if (occ.done) cls.push("completed");
    if (occ.overdue) cls.push("is-overdue");

    var chips = ['<span class="goal-chip ' + g.priority + '"><i class="fa-solid fa-flag"></i>' +
      PRIORITIES[g.priority].label + "</span>"];

    if (showDate) {
      chips.push('<span class="goal-chip date"><i class="fa-solid fa-calendar"></i>' +
        humanDate(occ.date) + "</span>");
    }

    if (occ.overdue) {
      chips.push('<span class="goal-chip overdue"><i class="fa-solid fa-clock-rotate-left"></i>' +
        relativeLabel(occ.date) + "</span>");
    }

    if (g.subjectName) {
      chips.push('<span class="goal-chip subject"><i class="fa-solid fa-book-open"></i>' +
        U.escape(g.subjectName) +
        (g.examType ? " · " + YKS.Subjects.typeLabel(g.examType) : "") + "</span>");
    } else if (g.examType) {
      chips.push('<span class="goal-chip subject"><i class="fa-solid fa-book-open"></i>' +
        YKS.Subjects.typeLabel(g.examType) + "</span>");
    }

    if (g.repeat !== "none") {
      chips.push('<span class="goal-chip repeat"><i class="fa-solid fa-repeat"></i>' +
        REPEATS[g.repeat].short + "</span>");
    }

    if (occ.metric && occ.metric.auto) {
      chips.push('<span class="goal-chip auto"><i class="fa-solid fa-bolt"></i>Sayaçtan</span>');
    }

    /* Eylemler — tekrarlı hedefler ertelenemez */
    var actions = "";
    if (!occ.done && g.repeat === "none") {
      actions += '<button type="button" class="goal-action-btn" data-act="postpone" data-id="' + g.id +
        '" data-date="' + occ.date + '" title="Bir gün ertele"><i class="fa-solid fa-forward"></i></button>';
    }
    actions += '<button type="button" class="goal-action-btn" data-act="edit" data-id="' + g.id +
      '" title="Düzenle"><i class="fa-solid fa-pen"></i></button>' +
      '<button type="button" class="goal-action-btn delete" data-act="delete" data-id="' + g.id +
      '" title="Sil"><i class="fa-solid fa-trash"></i></button>';

    return '<div class="' + cls.join(" ") + '" data-id="' + g.id + '" data-date="' + occ.date + '">' +
      '<div class="goal-header">' +
        '<button type="button" class="goal-checkbox' + (occ.done ? " checked" : "") + '" ' +
          'data-act="toggle" data-id="' + g.id + '" data-date="' + occ.date + '" ' +
          'aria-label="Tamamlandı olarak işaretle"><i class="fa-solid fa-check"></i></button>' +
        '<div class="goal-content">' +
          '<h5 class="goal-title">' + U.escape(g.title) + "</h5>" +
          (g.description ? '<p class="goal-description">' + U.escape(g.description) + "</p>" : "") +
          metricHtml(occ) +
          stepsHtml(occ) +
          '<div class="goal-meta">' + chips.join("") + "</div>" +
        "</div>" +
        '<div class="goal-actions">' + actions + "</div>" +
      "</div>" +
    "</div>";
  }

  function metricHtml(occ) {
    if (!occ.metric) return "";

    var m = occ.metric;
    var def = METRICS[m.kind];
    var value = m.kind === "dakika"
      ? humanMinutes(m.current) + ' <em>/ ' + humanMinutes(m.target) + "</em>"
      : m.current + ' <em>/ ' + m.target + " " + m.unit + "</em>";

    var btns = "";
    if (m.auto) {
      btns = '<span class="metric-value"><em>otomatik</em></span>';
    } else {
      btns = '<div class="metric-btns">' +
        '<button type="button" class="metric-btn" data-act="metric" data-id="' + occ.id +
          '" data-date="' + occ.date + '" data-delta="' + (-def.steps[0]) + '"' +
          (m.current <= 0 ? " disabled" : "") + ">−" + def.steps[0] + "</button>" +
        '<button type="button" class="metric-btn" data-act="metric" data-id="' + occ.id +
          '" data-date="' + occ.date + '" data-delta="' + def.steps[0] + '"' +
          (m.current >= m.target ? " disabled" : "") + ">+" + def.steps[0] + "</button>" +
        '<button type="button" class="metric-btn" data-act="metric" data-id="' + occ.id +
          '" data-date="' + occ.date + '" data-delta="' + def.steps[1] + '"' +
          (m.current >= m.target ? " disabled" : "") + ">+" + def.steps[1] + "</button>" +
      "</div>";
    }

    return '<div class="goal-metric">' +
      '<span class="metric-value">' + value + "</span>" +
      '<div class="metric-bar"><span style="width:' + m.percent + '%"></span></div>' +
      btns +
    "</div>";
  }

  function stepsHtml(occ) {
    var g = occ.goal;
    if (!g.steps.length) return "";

    var rows = g.steps.map(function (s) {
      var done = stepDone(g, occ.date, s.id);
      return '<button type="button" class="goal-step' + (done ? " done" : "") + '" ' +
        'data-act="step" data-id="' + g.id + '" data-date="' + occ.date + '" data-step="' + s.id + '">' +
        '<i class="fa-' + (done ? "solid fa-square-check" : "regular fa-square") + '"></i>' +
        "<span>" + U.escape(s.text) + "</span>" +
      "</button>";
    }).join("");

    return '<div class="goal-steps">' + rows +
      '<span class="steps-progress">' + occ.stepsDone + " / " + g.steps.length + " adım</span></div>";
  }

  /* ==========================================================
     11) LİSTE GÖRÜNÜMÜ
     ========================================================== */
  function renderList() {
    var host = document.getElementById("view-list");
    var pool = sortOccurrences(applyTabFilter(buildPool(), filterMode));

    if (!pool.length) {
      host.innerHTML = emptyStateHtml();
      return;
    }

    var today = todayStr();
    var wEnd = addDays(weekStartStr(today), 6);

    var groups = [
      { key: "overdue", title: "Geciken", icon: "fa-triangle-exclamation", tone: "tone-danger", items: [] },
      { key: "today",   title: "Bugün",   icon: "fa-calendar-day",         tone: "",            items: [] },
      { key: "tomorrow",title: "Yarın",   icon: "fa-sun",                  tone: "",            items: [] },
      { key: "week",    title: "Bu hafta",icon: "fa-calendar-week",        tone: "",            items: [] },
      { key: "later",   title: "Sonra",   icon: "fa-calendar-plus",        tone: "",            items: [] },
      { key: "done",    title: "Tamamlanan", icon: "fa-circle-check",      tone: "tone-ok",     items: [] }
    ];

    var index = {};
    groups.forEach(function (g) { index[g.key] = g; });

    pool.forEach(function (o) {
      if (o.done) index.done.items.push(o);
      else if (o.overdue) index.overdue.items.push(o);
      else if (o.date === today) index.today.items.push(o);
      else if (o.date === addDays(today, 1)) index.tomorrow.items.push(o);
      else if (o.date <= wEnd) index.week.items.push(o);
      else index.later.items.push(o);
    });

    host.innerHTML = groups.filter(function (g) { return g.items.length; }).map(function (g) {
      return '<section class="goal-group ' + g.tone + '">' +
        '<div class="goal-group-head">' +
          '<i class="fa-solid ' + g.icon + '"></i>' +
          "<h3>" + g.title + "</h3>" +
          '<span class="group-count">' + g.items.length + " hedef</span>" +
        "</div>" +
        '<div class="goal-group-body">' +
          g.items.map(function (o) { return goalCardHtml(o, true); }).join("") +
        "</div>" +
      "</section>";
    }).join("");
  }

  function emptyStateHtml() {
    var hasAny = goals().length > 0;
    var filtered = searchQuery || priorityFilter !== "all" || filterMode !== "all";

    if (hasAny && filtered) {
      return '<div class="empty-goals">' +
        '<i class="fa-solid fa-filter-circle-xmark"></i>' +
        "<h3>Bu süzgeçlere uyan hedef yok</h3>" +
        "<p>Aramayı temizleyip yeniden dene.</p>" +
        '<button type="button" class="btn-x btn-ghost-x" data-act="clear-filters">' +
          '<i class="fa-solid fa-rotate-left"></i> Süzgeçleri sıfırla</button>' +
      "</div>";
    }

    return '<div class="empty-goals">' +
      '<i class="fa-solid fa-bullseye"></i>' +
      "<h3>Henüz hedef yok</h3>" +
      "<p>İlk hedefini ekle; takvim, seri ve ilerleme kartları kendiliğinden dolmaya başlasın.</p>" +
      '<button type="button" class="btn-x btn-primary-x" data-act="new-goal">' +
        '<i class="fa-solid fa-plus"></i> Yeni Hedef</button>' +
    "</div>";
  }

  /* ==========================================================
     12) TOPLU ÇİZİM
     ========================================================== */
  function renderAll() {
    renderStats();

    if (viewMode === "calendar") {
      renderCalendar();
      renderDayPanel();
    } else {
      renderList();
    }

    renderResultLabel();
  }

  function renderResultLabel() {
    var label = document.getElementById("goal-result-label");

    if (viewMode === "list") {
      var pool = applyTabFilter(buildPool(), filterMode);
      var done = pool.filter(function (o) { return o.done; }).length;
      label.textContent = pool.length
        ? pool.length + " hedef · " + done + " tamamlandı"
        : "Kayıt yok";
      return;
    }

    var monthOccs = [];
    var days = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (var d = 1; d <= days; d++) {
      monthOccs = monthOccs.concat(occurrencesOn(viewYear + "-" + pad2(viewMonth + 1) + "-" + pad2(d)));
    }
    var mDone = monthOccs.filter(function (o) { return o.done; }).length;

    label.textContent = monthOccs.length
      ? MONTHS_TR[viewMonth] + ": " + monthOccs.length + " hedef · %" +
        Math.round((mDone / monthOccs.length) * 100) + " tamam"
      : MONTHS_TR[viewMonth] + ": kayıt yok";
  }

  function setView(mode) {
    viewMode = mode;

    document.getElementById("view-calendar").classList.toggle("is-hidden", mode !== "calendar");
    document.getElementById("view-list").classList.toggle("is-hidden", mode !== "list");

    U.qsa(".view-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === mode);
    });

    /* Takvim tek gün gösterir; aralık süzgeçleri listeye ait */
    if (mode === "calendar" && filterMode !== "all") setFilter("all", true);

    renderAll();
  }

  function setFilter(mode, silent) {
    filterMode = mode;

    U.qsa(".goal-tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-filter") === mode);
    });

    /* Tarih aralığı süzgeci seçildiğinde liste görünümüne geç */
    if (mode !== "all" && viewMode !== "list" && !silent) {
      setView("list");
      return;
    }

    if (!silent) renderAll();
  }

  /* ==========================================================
     13) HEDEF İŞLEMLERİ
     ========================================================== */

  /** Tamamlandı durumunu yazar; ölçüt ve adımlar buna uydurulur */
  function setDone(goal, ds, value) {
    if (goal.metric && goal.metric.auto) {
      YKS.Toast.show("Bu hedef çalışma sayacından hesaplanıyor; elle işaretlenemez.", "info");
      return false;
    }

    if (goal.metric) {
      goal.progressByDate[ds] = value ? goal.metric.target : 0;
    }

    if (goal.steps.length) {
      var map = {};
      if (value) goal.steps.forEach(function (s) { map[s.id] = true; });
      goal.stepDoneByDate[ds] = map;
    }

    var i = goal.doneDates.indexOf(ds);
    if (value && i === -1) goal.doneDates.push(ds);
    if (!value && i !== -1) goal.doneDates.splice(i, 1);

    goal.updatedAt = Date.now();
    if (value) goal.completedAt = Date.now();
    if (goal.repeat === "none") goal.completed = value;

    return true;
  }

  function toggleGoal(id, ds) {
    var goal = goalById(id);
    if (!goal) return;

    var wasDone = isDone(goal, ds);
    if (!setDone(goal, ds, !wasDone)) return;

    if (saveUserData("Hedef güncellenemedi.")) {
      if (!wasDone) {
        var left = occurrencesOn(ds).filter(function (o) { return !o.done; }).length;
        YKS.Toast.show(left ? "Hedef tamamlandı. " + left + " tane kaldı." : "Günün hedeflerini bitirdin!", "ok");
      }
      renderAll();
    }
  }

  function changeMetric(id, ds, delta) {
    var goal = goalById(id);
    if (!goal || !goal.metric || goal.metric.auto) return;

    var before = metricCurrent(goal, ds);
    var next = clamp(before + delta, 0, goal.metric.target);
    if (next === before) return;

    goal.progressByDate[ds] = next;
    goal.updatedAt = Date.now();

    /* Ölçüt dolunca hedef kendiliğinden tamamlanmış sayılır */
    var i = goal.doneDates.indexOf(ds);
    if (next >= goal.metric.target && i === -1) goal.doneDates.push(ds);
    if (next < goal.metric.target && i !== -1) goal.doneDates.splice(i, 1);
    if (goal.repeat === "none") goal.completed = next >= goal.metric.target;

    if (saveUserData("İlerleme yazılamadı.")) {
      if (before < goal.metric.target && next >= goal.metric.target) {
        YKS.Toast.show("Hedefi doldurdun: " + goal.title, "ok");
      }
      renderAll();
    }
  }

  function toggleStep(id, ds, stepId) {
    var goal = goalById(id);
    if (!goal) return;

    var map = goal.stepDoneByDate[ds] || {};
    if (map[stepId]) delete map[stepId];
    else map[stepId] = true;
    goal.stepDoneByDate[ds] = map;

    /* Ölçüt yoksa tamamlanma adımlardan geliyor; kaydı da eşitle */
    if (!goal.metric) {
      var all = doneStepCount(goal, ds) === goal.steps.length;
      var i = goal.doneDates.indexOf(ds);
      if (all && i === -1) goal.doneDates.push(ds);
      if (!all && i !== -1) goal.doneDates.splice(i, 1);
      if (goal.repeat === "none") goal.completed = all;
    }

    goal.updatedAt = Date.now();
    if (saveUserData("Adım güncellenemedi.")) renderAll();
  }

  function postponeGoal(id, targetDate) {
    var goal = goalById(id);
    if (!goal || goal.repeat !== "none") return;

    var next = targetDate || addDays(goal.date, 1);
    goal.date = next;
    goal.updatedAt = Date.now();

    if (saveUserData("Hedef taşınamadı.")) {
      YKS.Toast.show("Hedef " + humanDate(next) + " tarihine taşındı.", "ok");
      selectedDate = next;
      viewYear = toDate(next).getFullYear();
      viewMonth = toDate(next).getMonth();
      renderAll();
    }
  }

  function completeDay() {
    if (!selectedDate) return;

    var pending = occurrencesOn(selectedDate).filter(function (o) { return !o.done; });
    if (!pending.length) return;

    var changed = 0;
    pending.forEach(function (o) {
      if (setDone(o.goal, selectedDate, true)) changed++;
    });

    if (!changed) return;

    if (saveUserData("Hedefler güncellenemedi.")) {
      YKS.Toast.show(changed + " hedef tamamlandı olarak işaretlendi.", "ok");
      renderAll();
    }
  }

  function moveDayGoals(targetDate) {
    if (!selectedDate) return;

    var movable = occurrencesOn(selectedDate).filter(function (o) {
      return !o.done && o.goal.repeat === "none";
    });
    if (!movable.length) return;

    movable.forEach(function (o) {
      o.goal.date = targetDate;
      o.goal.updatedAt = Date.now();
    });

    if (saveUserData("Hedefler taşınamadı.")) {
      YKS.Toast.show(movable.length + " hedef " + humanDate(targetDate) + " tarihine taşındı.", "ok");
      selectDate(targetDate);
    }
  }

  function askDelete(id) {
    var goal = goalById(id);
    if (!goal) return;

    pendingDeleteId = id;
    document.getElementById("delete-goal-name").textContent = goal.title;
    document.getElementById("delete-goal-text").textContent = goal.repeat === "none"
      ? "Bu hedef kalıcı olarak silinecek. Emin misin?"
      : "Tekrarlı bir hedefi siliyorsun; geçmiş günlerdeki kayıtları da gidecek. Emin misin?";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("delete-modal")).show();
  }

  function confirmDelete() {
    var goal = goalById(pendingDeleteId);
    if (!goal) return;

    currentUser.data.hedefler = goals().filter(function (g) { return g.id !== pendingDeleteId; });
    pendingDeleteId = null;

    bootstrap.Modal.getOrCreateInstance(document.getElementById("delete-modal")).hide();

    if (saveUserData("Hedef silinemedi.")) {
      YKS.Toast.show("Hedef silindi.", "ok");
      renderAll();
    }
  }

  function selectDate(ds) {
    selectedDate = ds;
    var d = toDate(ds);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderAll();
  }

  /* ==========================================================
     14) HEDEF PENCERESİ
     ========================================================== */
  function openGoalModal(goalId, presetDate) {
    editingId = goalId || null;
    var goal = goalId ? goalById(goalId) : null;

    document.getElementById("goal-modal-title").innerHTML = goal
      ? '<i class="fa-solid fa-pen"></i> Hedefi Düzenle'
      : '<i class="fa-solid fa-bullseye"></i> Yeni Hedef';

    document.getElementById("goal-title").value = goal ? goal.title : "";
    document.getElementById("goal-description").value = goal ? goal.description : "";
    document.getElementById("goal-date").value = goal ? goal.date : (presetDate || selectedDate || todayStr());

    setModalPriority(goal ? goal.priority : "medium");

    /* Ders bağlantısı */
    var typeSel = document.getElementById("goal-exam-type");
    typeSel.value = goal && goal.examType ? goal.examType : "";
    fillSubjects(typeSel.value, goal ? goal.subjectId : null);

    /* Ölçüt */
    setModalMetric(goal && goal.metric ? goal.metric.kind : "none");
    document.getElementById("goal-metric-target").value = goal && goal.metric ? goal.metric.target : 20;
    document.getElementById("goal-metric-auto").checked = !!(goal && goal.metric && goal.metric.auto);

    /* Tekrar */
    document.getElementById("goal-repeat").value = goal ? goal.repeat : "none";
    document.getElementById("goal-repeat-until").value = goal && goal.repeatUntil ? goal.repeatUntil : "";
    syncRepeatFields();

    /* Adımlar */
    modalSteps = goal ? goal.steps.map(function (s) { return { id: s.id, text: s.text }; }) : [];
    renderStepsEditor();

    updateDateHint();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("goal-modal")).show();

    window.setTimeout(function () { document.getElementById("goal-title").focus(); }, 350);
  }

  function setModalPriority(value) {
    modalPriority = PRIORITIES[value] ? value : "medium";
    U.qsa("#priority-picker .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-priority") === modalPriority);
    });
  }

  function setModalMetric(kind) {
    modalMetric = METRICS[kind] ? kind : "none";

    U.qsa("#metric-picker .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-metric") === modalMetric);
    });

    var config = document.getElementById("metric-config");
    var autoLine = document.getElementById("metric-auto-line");

    config.classList.toggle("is-hidden", modalMetric === "none");
    autoLine.classList.toggle("is-hidden", modalMetric !== "dakika");

    if (modalMetric !== "dakika") document.getElementById("goal-metric-auto").checked = false;

    if (METRICS[modalMetric]) {
      document.getElementById("metric-unit-label").textContent = METRICS[modalMetric].unit;
    }
  }

  function fillSubjects(type, selectedId) {
    var sel = document.getElementById("goal-subject");

    if (!type) {
      sel.innerHTML = '<option value="">Önce sınav seç</option>';
      sel.disabled = true;
      return;
    }

    var html = '<option value="">Genel (ders seçme)</option>';
    YKS.Subjects.groupsOf(type).forEach(function (group) {
      html += '<optgroup label="' + U.escape(group.name) + '">';
      group.subjects.forEach(function (s) {
        html += '<option value="' + s.id + '">' + U.escape(s.name) + "</option>";
      });
      html += "</optgroup>";
    });

    sel.innerHTML = html;
    sel.disabled = false;
    if (selectedId) sel.value = selectedId;
  }

  function syncRepeatFields() {
    var repeat = document.getElementById("goal-repeat").value;
    document.getElementById("repeat-until-field").classList.toggle("is-hidden", repeat === "none");
  }

  function updateDateHint() {
    var value = document.getElementById("goal-date").value;
    var hint = document.getElementById("goal-date-hint");

    if (!value) { hint.textContent = "—"; return; }

    hint.textContent = weekdayName(value) + " · " + relativeLabel(value);
    hint.className = "hint mb-0" + (value < todayStr() ? " hint-error" : "");
  }

  function renderStepsEditor() {
    var host = document.getElementById("steps-editor");

    host.innerHTML = modalSteps.map(function (s, i) {
      return '<div class="step-row">' +
        '<span class="step-order">' + (i + 1) + "</span>" +
        '<span class="step-text">' + U.escape(s.text) + "</span>" +
        '<button type="button" class="step-del" data-step-del="' + s.id + '" aria-label="Adımı sil">' +
          '<i class="fa-solid fa-xmark"></i></button>' +
      "</div>";
    }).join("");
  }

  function addStepFromInput() {
    var input = document.getElementById("step-input");
    var text = input.value.trim();

    if (!text) return;
    if (modalSteps.length >= 12) {
      YKS.Toast.show("Bir hedefe en fazla 12 adım ekleyebilirsin.", "warn");
      return;
    }

    modalSteps.push({ id: U.uid("step"), text: text.slice(0, 90) });
    input.value = "";
    renderStepsEditor();
    input.focus();
  }

  function saveGoal() {
    var title = document.getElementById("goal-title").value.trim();
    var date = document.getElementById("goal-date").value;
    var description = document.getElementById("goal-description").value.trim();
    var examType = document.getElementById("goal-exam-type").value || null;
    var subjectId = examType ? (document.getElementById("goal-subject").value || null) : null;
    var repeat = document.getElementById("goal-repeat").value;
    var repeatUntil = repeat !== "none" ? (document.getElementById("goal-repeat-until").value || null) : null;

    if (!title) {
      YKS.Toast.show("Hedef başlığı boş bırakılamaz.", "error");
      document.getElementById("goal-title").focus();
      return;
    }

    if (!date) {
      YKS.Toast.show("Tarih seçmelisin.", "error");
      return;
    }

    if (repeatUntil && repeatUntil < date) {
      YKS.Toast.show("Tekrar bitişi, başlangıç tarihinden önce olamaz.", "error");
      return;
    }

    var metric = null;
    if (modalMetric !== "none") {
      var target = parseInt(document.getElementById("goal-metric-target").value, 10);
      if (!target || target < 1) {
        YKS.Toast.show("Ölçüt için 1'den büyük bir hedef miktarı gir.", "error");
        return;
      }
      metric = {
        kind: modalMetric,
        target: clamp(target, 1, 100000),
        auto: modalMetric === "dakika" && document.getElementById("goal-metric-auto").checked
      };
    }

    var subject = subjectId ? YKS.Subjects.find(examType, subjectId) : null;
    var existing = editingId ? goalById(editingId) : null;

    var record = normalizeGoal({
      id: existing ? existing.id : U.uid("goal"),
      title: title,
      date: date,
      description: description,
      priority: modalPriority,
      examType: examType,
      subjectId: subject ? subject.id : null,
      subjectName: subject ? subject.name : null,
      metric: metric,
      steps: modalSteps,
      repeat: repeat,
      repeatUntil: repeatUntil,
      doneDates: existing ? existing.doneDates : [],
      progressByDate: existing ? existing.progressByDate : {},
      stepDoneByDate: existing ? existing.stepDoneByDate : {},
      completed: existing ? existing.completed : false,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      completedAt: existing ? existing.completedAt : null
    });

    if (existing) {
      currentUser.data.hedefler = goals().map(function (g) {
        return g.id === existing.id ? record : g;
      });
    } else {
      goals().push(record);
    }

    if (!saveUserData("Hedef kaydedilemedi.")) return;

    bootstrap.Modal.getOrCreateInstance(document.getElementById("goal-modal")).hide();
    YKS.Toast.show(existing ? "Hedef güncellendi." : "Hedef eklendi.", "ok");

    selectedDate = date;
    viewYear = toDate(date).getFullYear();
    viewMonth = toDate(date).getMonth();
    editingId = null;
    renderAll();
  }

  /* ==========================================================
     15) OLAYLAR
     ========================================================== */

  /** Kart üzerindeki tüm düğmeler tek dinleyiciyle karşılanır */
  function handleAction(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;

    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    var ds = btn.getAttribute("data-date");

    if (act === "toggle") { toggleGoal(id, ds); return; }
    if (act === "metric") { changeMetric(id, ds, parseInt(btn.getAttribute("data-delta"), 10)); return; }
    if (act === "step") { toggleStep(id, ds, btn.getAttribute("data-step")); return; }
    if (act === "edit") { openGoalModal(id); return; }
    if (act === "delete") { askDelete(id); return; }
    if (act === "postpone") { postponeGoal(id, addDays(ds, 1)); return; }
    if (act === "new-goal") { openGoalModal(null, selectedDate || todayStr()); return; }
    if (act === "complete-day") { completeDay(); return; }
    if (act === "move-today") { moveDayGoals(todayStr()); return; }
    if (act === "move-next") { moveDayGoals(addDays(selectedDate, 1)); return; }

    if (act === "clear-filters") {
      searchQuery = "";
      priorityFilter = "all";
      document.getElementById("goal-search").value = "";
      document.getElementById("goal-priority-filter").value = "all";
      setFilter("all");
      return;
    }
  }

  function shiftMonth(step) {
    viewMonth += step;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
    renderResultLabel();
  }

  function goToToday() {
    selectDate(todayStr());
  }

  function bindEvents() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = "index.html";
    });

    document.getElementById("add-goal-btn").addEventListener("click", function () {
      openGoalModal(null, selectedDate || todayStr());
    });

    /* Takvim gezinme */
    document.getElementById("prev-month").addEventListener("click", function () { shiftMonth(-1); });
    document.getElementById("next-month").addEventListener("click", function () { shiftMonth(1); });
    document.getElementById("today-btn").addEventListener("click", goToToday);

    document.getElementById("calendar-grid").addEventListener("click", function (e) {
      var cell = e.target.closest(".calendar-day:not(.other-month)");
      if (cell) selectDate(cell.getAttribute("data-date"));
    });

    document.getElementById("calendar-grid").addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var cell = e.target.closest(".calendar-day:not(.other-month)");
      if (!cell) return;
      e.preventDefault();
      selectDate(cell.getAttribute("data-date"));
    });

    /* Kart eylemleri — kapsayıcılara tek dinleyici */
    document.getElementById("goals-list").addEventListener("click", handleAction);
    document.getElementById("view-list").addEventListener("click", handleAction);
    document.getElementById("day-panel-actions").addEventListener("click", handleAction);
    document.getElementById("month-summary").addEventListener("click", handleAction);

    /* Sekmeler ve görünüm */
    U.qsa(".goal-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { setFilter(tab.getAttribute("data-filter")); });
    });

    U.qsa(".view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { setView(btn.getAttribute("data-view")); });
    });

    /* Araç çubuğu */
    document.getElementById("goal-search").addEventListener("input", U.debounce(function (e) {
      searchQuery = e.target.value.trim().toLocaleLowerCase("tr");
      renderAll();
    }, 220));

    document.getElementById("goal-priority-filter").addEventListener("change", function (e) {
      priorityFilter = e.target.value;
      renderAll();
    });

    document.getElementById("goal-sort").addEventListener("change", function (e) {
      sortMode = e.target.value;
      renderAll();
    });

    /* Pencere içi alanlar */
    U.qsa("#priority-picker .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { setModalPriority(b.getAttribute("data-priority")); });
    });

    U.qsa("#metric-picker .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { setModalMetric(b.getAttribute("data-metric")); });
    });

    document.getElementById("goal-exam-type").addEventListener("change", function (e) {
      fillSubjects(e.target.value, null);
    });

    document.getElementById("goal-repeat").addEventListener("change", syncRepeatFields);
    document.getElementById("goal-date").addEventListener("change", updateDateHint);

    document.getElementById("step-add-btn").addEventListener("click", addStepFromInput);

    document.getElementById("step-input").addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addStepFromInput();
    });

    document.getElementById("steps-editor").addEventListener("click", function (e) {
      var del = e.target.closest("[data-step-del]");
      if (!del) return;
      var stepId = del.getAttribute("data-step-del");
      modalSteps = modalSteps.filter(function (s) { return s.id !== stepId; });
      renderStepsEditor();
    });

    document.getElementById("save-goal-btn").addEventListener("click", saveGoal);

    document.getElementById("goal-form").addEventListener("submit", function (e) {
      e.preventDefault();
      saveGoal();
    });

    document.getElementById("confirm-delete-btn").addEventListener("click", confirmDelete);

    /* Kısayollar — yazı yazarken veya pencere açıkken devre dışı */
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (document.querySelector(".modal.show")) return;

      var key = e.key.toLocaleLowerCase("tr");

      if (key === "n") { e.preventDefault(); openGoalModal(null, selectedDate || todayStr()); return; }
      if (key === "t") { e.preventDefault(); goToToday(); return; }

      if (viewMode !== "calendar") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); shiftMonth(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); shiftMonth(1); }
    });
  }

  /* ==========================================================
     16) BAŞLATMA
     ========================================================== */
  function init() {
    if (!loadUser()) return;

    selectedDate = todayStr();
    viewYear = new Date().getFullYear();
    viewMonth = new Date().getMonth();

    bindEvents();
    renderAll();

    YKS.Particles.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window, document);
