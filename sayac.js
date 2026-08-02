/* ============================================================
   Bay Porsuk — sayac.js
   ------------------------------------------------------------
   Çalışma Sayacı modülü — üç mod:
     1) Kronometre   → yukarı sayar, tur kaydı tutar
     2) Zaman Tutma  → geri sayar, bitince alarm çalar
     3) Tren Gidene Kadar Çalış
        Seçilen süre boyunca Türkiye haritası üzerinde bir tren
        İstanbul'dan doğuya doğru yol alır. Süre bittiğinde tren
        varış noktasına ulaşır ve düdük çalar.

   Zaman ölçümü Date.now() farkına dayanır; sekme arka plana
   alınsa da sayaç kaymaz. Alarm sesi Web Audio ile üretilir,
   dışarıdan ses dosyası yüklenmez.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     0) SABİTLER
     ========================================================== */

  /* Hazır süre seçenekleri (dakika) */
  var COUNTDOWN_PRESETS = [5, 10, 15, 25, 30, 45, 60, 90];
  var TRAIN_PRESETS = [25, 45, 60, 90, 120, 180, 240];

  /**
   * Tren rotası: İstanbul'dan doğuya.
   * min → İstanbul'dan o istasyona yaklaşık tren yolculuğu süresi (dakika).
   * Konumlar gerçek koordinatlardan, süreler gerçek sefer sürelerine
   * yakın yuvarlanmış değerlerden alındı.
   */
  var ROUTE = [
    { name: "İstanbul",  lon: 28.98, lat: 41.01, min: 0 },
    { name: "Gebze",     lon: 29.43, lat: 40.80, min: 25 },
    { name: "İzmit",     lon: 29.92, lat: 40.77, min: 45 },
    { name: "Arifiye",   lon: 30.37, lat: 40.72, min: 65 },
    { name: "Bilecik",   lon: 29.98, lat: 40.15, min: 95 },
    { name: "Bozüyük",   lon: 30.04, lat: 39.91, min: 115 },
    { name: "Eskişehir", lon: 30.52, lat: 39.78, min: 140 },
    { name: "Polatlı",   lon: 32.15, lat: 39.58, min: 200 },
    { name: "Ankara",    lon: 32.85, lat: 39.93, min: 240 },
    { name: "Kırıkkale", lon: 33.51, lat: 39.84, min: 330 },
    { name: "Yozgat",    lon: 34.81, lat: 39.82, min: 420 },
    { name: "Kayseri",   lon: 35.48, lat: 38.73, min: 540 },
    { name: "Sivas",     lon: 37.02, lat: 39.75, min: 690 },
    { name: "Divriği",   lon: 38.12, lat: 39.37, min: 870 },
    { name: "Erzincan",  lon: 39.49, lat: 39.75, min: 1080 },
    { name: "Erzurum",   lon: 41.28, lat: 39.90, min: 1320 },
    { name: "Horasan",   lon: 42.17, lat: 40.04, min: 1470 },
    { name: "Kars",      lon: 43.10, lat: 40.60, min: 1680 }
  ];

  /* Haritada adı yazılacak istasyonlar — hepsi yazılırsa okunmuyor */
  var LABELLED = ["İstanbul", "Eskişehir", "Ankara", "Kayseri", "Sivas", "Erzurum", "Kars"];

  /**
   * Türkiye sınırının sadeleştirilmiş dış hattı (boylam, enlem).
   * Amaç coğrafi doğruluk değil, tanınabilir bir silüet.
   */
  var TURKEY_OUTLINE = [
    [28.03, 41.88], [29.05, 41.20], [30.15, 41.10], [32.00, 41.60],
    [35.15, 42.03], [36.33, 41.35], [37.88, 41.00], [39.72, 41.00],
    [41.42, 41.42], [41.55, 41.52], [43.45, 41.10], [43.60, 40.05],
    [44.05, 39.85], [44.40, 39.75], [44.30, 38.60], [44.80, 37.90],
    [44.35, 37.30], [43.00, 37.35], [42.35, 37.25], [41.20, 37.10],
    [40.00, 36.85], [38.90, 36.70], [37.50, 36.70], [36.65, 36.80],
    [36.20, 36.00], [35.95, 36.30], [35.55, 36.55], [34.60, 36.80],
    [33.70, 36.30], [32.83, 36.07], [31.50, 36.30], [31.00, 36.85],
    [30.20, 36.30], [29.64, 36.20], [28.90, 36.75], [27.43, 37.03],
    [27.25, 38.00], [26.30, 38.30], [26.70, 39.20], [26.10, 39.55],
    [26.20, 40.10], [26.70, 40.40], [26.05, 40.75], [26.35, 41.70],
    [27.50, 42.00]
  ];

  var MAP_W = 1000, MAP_H = 400;
  var RING_RADIUS = 120;
  var RING_LENGTH = 2 * Math.PI * RING_RADIUS;

  /* ==========================================================
     1) DURUM
     ========================================================== */
  var currentUser = null;
  var canSave = false;          /* kurucu oturumunda kayıt tutulmaz */
  var activeMode = "stopwatch";
  var raf = null;

  /* Biten ama henüz dersi sorulmamış oturum */
  var pendingSession = null;
  var askType = null;

  var sessionsExpanded = false;
  var pendingConfirm = null;

  var stopwatch = {
    running: false,
    startedAt: 0,        /* son başlatma anı */
    accumulated: 0,      /* duraklamalardan biriken süre (ms) */
    laps: []
  };

  var countdown = {
    running: false,
    total: 25 * 60 * 1000,
    remaining: 25 * 60 * 1000,
    endsAt: 0,
    lastShown: -1,
    recorded: false      /* bu oturum kayda geçti mi */
  };

  var train = {
    running: false,
    total: 60 * 60 * 1000,
    remaining: 60 * 60 * 1000,
    endsAt: 0,
    lastShown: -1,
    lastMapAt: 0,
    recorded: false
  };

  /* ==========================================================
     2) YARDIMCILAR
     ========================================================== */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /** ms → "01:23:45" (istenirse ".67" salise eki ile) */
  function formatClock(ms, withCenti) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var text = pad2(Math.floor(totalSec / 3600)) + ":" +
      pad2(Math.floor((totalSec % 3600) / 60)) + ":" +
      pad2(totalSec % 60);
    return withCenti ? text + "." + pad2(Math.floor((ms % 1000) / 10)) : text;
  }

  /** Geri sayım için: 1 saatin altında "25:00", üstünde "01:25:00" */
  function formatCountdown(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.ceil(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(m) + ":" + pad2(s);
  }

  /** saniye → "1 sa 25 dk" */
  function humanDuration(seconds) {
    var totalMin = Math.round(seconds / 60);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h && m) return h + " sa " + m + " dk";
    if (h) return h + " sa";
    return m + " dk";
  }

  /** Dakika → "1 sa 25 dk" (tam sayı dakika için) */
  function humanMinutes(minutes) { return humanDuration(minutes * 60); }

  /* Boylam / enlem → harita koordinatı */
  function mx(lon) { return (lon - 25.5) * 50; }
  function my(lat) { return (42.5 - lat) * (MAP_H / 7); }

  /* ==========================================================
     3) KULLANICI VE KAYIT
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = YKS.Auth.currentUser();

    /* Yönetim kodu ile açılan kurucu oturumunun kişisel kaydı yok.
       Sayaçlar yine de çalışır, sadece süre kaydı tutulmaz. */
    canSave = !!currentUser;

    if (currentUser) {
      if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
      if (!Array.isArray(currentUser.data.sureler)) currentUser.data.sureler = [];
    }
    return true;
  }

  /** data alanını kullanıcı kaydına yazar, bellekteki kopyayı tazeler */
  function saveUserData(errorMessage) {
    var result = YKS.Users.update(currentUser.id, { data: currentUser.data });

    /* Yazma başarısız olursa bellekteki liste kayıttan geri okunur;
       aksi hâlde ekranda olmayan bir veri görünür kalır. */
    var fresh = YKS.Auth.currentUser();
    if (fresh) currentUser = fresh;
    if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
    if (!Array.isArray(currentUser.data.sureler)) currentUser.data.sureler = [];

    if (!result.ok) {
      YKS.Toast.show(result.error || errorMessage || "Kayıt yazılamadı.", "error");
    }
    return result.ok;
  }

  /**
   * Biten bir oturumu kullanıcı kaydına yazar.
   * @param {object|null} subject YKS.Subjects kaydı (ders seçilmediyse null)
   */
  function recordSession(kind, seconds, note, examType, subject) {
    if (!canSave || seconds < 60) return;

    currentUser.data.sureler.push({
      id: U.uid("sure"),
      kind: kind,                       /* kronometre | zamanlayici | tren */
      seconds: Math.round(seconds),
      note: note || "",
      examType: examType || null,       /* tyt | ayt | kpss | null */
      subjectId: subject ? subject.id : null,
      subjectName: subject ? subject.name : null,
      endedAt: Date.now()
    });

    saveUserData("Süre kaydedilemedi.");
    refreshRecords();
  }

  function allSessions() {
    if (!currentUser || !Array.isArray(currentUser.data.sureler)) return [];
    return currentUser.data.sureler;
  }

  function refreshRecords() {
    renderTotals();
    renderSessions();
    renderReport();
  }

  /* ---------- Kayıt silme ---------- */
  function deleteSession(id) {
    var before = allSessions().length;
    currentUser.data.sureler = allSessions().filter(function (s) { return s.id !== id; });
    if (currentUser.data.sureler.length === before) return;

    if (saveUserData("Kayıt silinemedi.")) {
      YKS.Toast.show("Çalışma kaydı silindi.", "ok");
    }
    refreshRecords();
  }

  function clearAllSessions() {
    var count = allSessions().length;
    if (!count) return;

    currentUser.data.sureler = [];
    if (saveUserData("Kayıtlar silinemedi.")) {
      YKS.Toast.show(count + " çalışma kaydı silindi.", "ok");
    }
    sessionsExpanded = false;
    refreshRecords();
  }

  function renderTotals() {
    var chip = document.getElementById("today-total");
    if (!chip) return;

    if (!canSave) {
      chip.textContent = "kayıt kapalı";
      return;
    }

    var dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    var startTs = dayStart.getTime();

    var todaySeconds = allSessions().reduce(function (sum, s) {
      return s.endedAt >= startTs ? sum + (s.seconds || 0) : sum;
    }, 0);

    chip.textContent = todaySeconds ? humanDuration(todaySeconds) : "0 dk";
  }

  var KIND_ICONS = {
    kronometre: "fa-stopwatch",
    zamanlayici: "fa-hourglass-half",
    tren: "fa-train"
  };
  var KIND_LABELS = {
    kronometre: "Kronometre",
    zamanlayici: "Zaman tutma",
    tren: "Tren yolculuğu"
  };

  function sessionWhen(ts) {
    var when = new Date(ts);
    if (isNaN(when.getTime())) return "-";
    return when.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }) +
      " · " + pad2(when.getHours()) + ":" + pad2(when.getMinutes());
  }

  function renderSessions() {
    var box = document.getElementById("session-list");
    var clearBtn = document.getElementById("clear-sessions");
    if (!box) return;

    if (!canSave) {
      if (clearBtn) clearBtn.style.display = "none";
      box.innerHTML =
        '<p class="muted mb-0" style="font-size:13.5px">' +
        "Yönetim kodu ile açılan kurucu oturumundasın; süre kayıtları " +
        "kullanıcı hesabına yazıldığı için burada tutulmuyor. Sayaçların " +
        "hepsi yine de çalışıyor.</p>";
      return;
    }

    var all = allSessions().slice().sort(function (a, b) {
      return b.endedAt - a.endedAt;
    });

    if (clearBtn) clearBtn.style.display = all.length ? "inline-flex" : "none";

    if (!all.length) {
      box.innerHTML =
        '<p class="muted mb-0" style="font-size:13.5px">' +
        "Henüz kayıt yok. 1 dakikadan uzun her oturum buraya düşer.</p>";
      return;
    }

    var list = sessionsExpanded ? all : all.slice(0, 8);

    var rows = list.map(function (s) {
      /* Alt satır: ders · sınav · yöntem — hangisi varsa */
      var parts = [];
      if (s.subjectName) parts.push(U.escape(s.subjectName));
      if (s.examType) parts.push(YKS.Subjects.typeLabel(s.examType));
      parts.push(KIND_LABELS[s.kind] || "Çalışma");
      if (s.note) parts.push(U.escape(s.note));

      var subjectDef = s.examType && s.subjectId
        ? YKS.Subjects.find(s.examType, s.subjectId)
        : null;

      return '<div class="session-row">' +
        '<i class="fa-solid ' +
          (subjectDef ? subjectDef.icon : (KIND_ICONS[s.kind] || "fa-clock")) + '"></i>' +
        '<div class="session-main">' +
          "<strong>" + humanDuration(s.seconds || 0) + "</strong>" +
          "<span>" + parts.join(" · ") + "</span>" +
        "</div>" +
        '<span class="session-when">' + sessionWhen(s.endedAt) + "</span>" +
        '<button type="button" class="session-del" data-del-session="' + s.id + '" ' +
          'title="Bu kaydı sil" aria-label="Bu çalışma kaydını sil">' +
          '<i class="fa-solid fa-xmark"></i>' +
        "</button>" +
      "</div>";
    }).join("");

    var more = "";
    if (all.length > 8) {
      more = '<button type="button" class="link-btn session-more" id="session-more">' +
        (sessionsExpanded
          ? '<i class="fa-solid fa-chevron-up"></i> Daha az göster'
          : '<i class="fa-solid fa-chevron-down"></i> Tümünü göster (' + all.length + ")") +
        "</button>";
    }

    box.innerHTML = '<div class="session-rows">' + rows + "</div>" + more;

    U.qsa("[data-del-session]", box).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del-session");
        var record = allSessions().filter(function (s) { return s.id === id; })[0];
        if (!record) return;

        askConfirm(
          "Kaydı sil",
          humanDuration(record.seconds || 0) + " · " + sessionWhen(record.endedAt) +
            " kaydı silinecek.",
          function () { deleteSession(id); }
        );
      });
    });

    var moreBtn = document.getElementById("session-more");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        sessionsExpanded = !sessionsExpanded;
        renderSessions();
      });
    }
  }

  /* ==========================================================
     3b) ONAY PENCERESİ
     ========================================================== */
  function askConfirm(title, text, onOk) {
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-text").textContent = text;
    pendingConfirm = onOk;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("confirm-modal")).show();
  }

  function bindConfirm() {
    document.getElementById("confirm-ok").addEventListener("click", function () {
      var fn = pendingConfirm;
      pendingConfirm = null;
      bootstrap.Modal.getOrCreateInstance(document.getElementById("confirm-modal")).hide();
      if (typeof fn === "function") fn();
    });

    document.getElementById("clear-sessions").addEventListener("click", function () {
      var count = allSessions().length;
      if (!count) return;
      askConfirm(
        "Tüm kayıtları sil",
        count + " çalışma kaydının hepsi silinecek. Bu işlem geri alınamaz.",
        clearAllSessions
      );
    });
  }

  /* ==========================================================
     3c) DERS SORMA AKIŞI
     ----------------------------------------------------------
     Süre bittiğinde önce sınav türü, sonra ders sorulur.
     Pencere kapatılırsa oturum yine kaydedilir — ders bilgisi
     uğruna çalışma süresi kaybolmasın.
     ========================================================== */
  function finishSession(kind, seconds, note) {
    if (seconds < 60) return;

    if (!canSave) {
      /* Kurucu oturumunda kayıt tutulmuyor; yine de geri bildirim ver */
      YKS.Toast.show(humanDuration(seconds) + " çalıştın.", "ok");
      return;
    }

    pendingSession = { kind: kind, seconds: seconds, note: note || "" };
    openSubjectModal();
  }

  function openSubjectModal() {
    askType = null;

    document.getElementById("ask-summary").textContent =
      humanDuration(pendingSession.seconds) + " çalıştın" +
      (pendingSession.note ? " (" + pendingSession.note + ")" : "") +
      ". Bu süreyi hangi derse yazalım?";

    document.getElementById("ask-step-type").hidden = false;
    document.getElementById("ask-step-subject").hidden = true;

    document.getElementById("ask-types").innerHTML =
      YKS.Subjects.types.map(function (t) {
        return '<button type="button" class="ask-card" data-ask-type="' + t.value + '">' +
          '<i class="fa-solid ' + t.icon + '"></i>' +
          "<strong>" + t.label + "</strong>" +
          "<span>" + t.full + "</span>" +
        "</button>";
      }).join("");

    U.qsa("[data-ask-type]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showSubjectStep(btn.getAttribute("data-ask-type"));
      });
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById("subject-modal")).show();
  }

  function showSubjectStep(type) {
    askType = type;

    document.getElementById("ask-step-type").hidden = true;
    document.getElementById("ask-step-subject").hidden = false;
    document.getElementById("ask-type-label").textContent =
      YKS.Subjects.typeLabel(type) + " dersleri";

    /* Dersler sınavdaki üst başlıklara göre gruplanır:
       Fen Bilimleri altında Fizik / Kimya / Biyoloji gibi.
       Tek dersli başlıklarda ayrı bir başlık satırı çizilmez. */
    document.getElementById("ask-subjects").innerHTML =
      YKS.Subjects.groupsOf(type).map(function (group) {
        var cards = group.subjects.map(function (s) {
          return '<button type="button" class="ask-card small" data-ask-subject="' + s.id + '">' +
            '<i class="fa-solid ' + s.icon + '"></i>' +
            "<strong>" + U.escape(s.name) + "</strong>" +
          "</button>";
        }).join("");

        if (group.subjects.length < 2) {
          return '<div class="ask-group single">' + cards + "</div>";
        }

        return '<div class="ask-group">' +
          '<div class="ask-group-head">' + U.escape(group.name) + "</div>" +
          '<div class="ask-group-cards">' + cards + "</div>" +
        "</div>";
      }).join("");

    U.qsa("[data-ask-subject]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        commitSession(askType, btn.getAttribute("data-ask-subject"));
        bootstrap.Modal.getOrCreateInstance(document.getElementById("subject-modal")).hide();
      });
    });
  }

  /** Bekleyen oturumu kaydeder; ders bilgisi olmadan da çalışır */
  function commitSession(examType, subjectId) {
    var session = pendingSession;
    if (!session) return;

    /* Önce boşalt: pencere kapanma olayı ikinci kez kaydetmesin */
    pendingSession = null;

    var subject = examType && subjectId ? YKS.Subjects.find(examType, subjectId) : null;
    recordSession(session.kind, session.seconds, session.note,
      subject ? examType : null, subject);

    YKS.Toast.show(
      humanDuration(session.seconds) + " kaydedildi" +
      (subject ? " · " + subject.name : "") + ".", "ok");
  }

  function bindSubjectModal() {
    document.getElementById("ask-back").addEventListener("click", function () {
      askType = null;
      document.getElementById("ask-step-type").hidden = false;
      document.getElementById("ask-step-subject").hidden = true;
    });

    document.getElementById("ask-skip").addEventListener("click", function () {
      commitSession(null, null);
      bootstrap.Modal.getOrCreateInstance(document.getElementById("subject-modal")).hide();
    });

    /* Pencere kapatılırsa süre yine de kaybolmasın */
    document.getElementById("subject-modal").addEventListener("hidden.bs.modal", function () {
      if (pendingSession) commitSession(null, null);
    });
  }

  /* ==========================================================
     4) ALARM — Web Audio ile üretilen ses
     ----------------------------------------------------------
     Dosya yüklenmez; osilatörle ton üretilir. Tarayıcılar sesi
     yalnızca kullanıcı etkileşiminden sonra açtığı için
     AudioContext ilk "Başlat" tıklamasında kurulur.
     ========================================================== */
  var Alarm = {
    ctx: null,
    loop: null,
    autoStop: null,
    muted: false,

    /** Ses tercihi ayarlarda saklanır */
    loadPreference: function () {
      var settings = YKS.Store.get(YKS.Config.keys.settings, {}) || {};
      this.muted = !!settings.sayacMuted;
      this.paint();
    },

    savePreference: function () {
      var settings = YKS.Store.get(YKS.Config.keys.settings, {}) || {};
      settings.sayacMuted = this.muted;
      YKS.Store.set(YKS.Config.keys.settings, settings);
    },

    paint: function () {
      var btn = document.getElementById("sound-toggle");
      if (!btn) return;
      btn.innerHTML = '<i class="fa-solid ' +
        (this.muted ? "fa-volume-xmark" : "fa-volume-high") + '"></i>';
      btn.classList.toggle("muted", this.muted);
      btn.setAttribute("title", this.muted ? "Alarm sesi kapalı" : "Alarm sesi açık");
    },

    toggleMute: function () {
      this.muted = !this.muted;
      if (this.muted) this.stop();
      this.savePreference();
      this.paint();
      YKS.Toast.show(this.muted ? "Alarm sesi kapatıldı." : "Alarm sesi açıldı.", "info", 1800);
    },

    /** Kullanıcı etkileşiminde çağrılır; sesi hazırlar */
    prime: function () {
      if (this.muted) return null;
      if (!this.ctx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        try { this.ctx = new Ctx(); } catch (e) { return null; }
      }
      if (this.ctx.state === "suspended" && this.ctx.resume) this.ctx.resume();
      return this.ctx;
    },

    _tone: function (freq, start, duration, type, peak) {
      var ctx = this.ctx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, start);

      /* exponentialRamp sıfıra inemez; çok küçük bir değere iniyoruz */
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak || 0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    },

    _chord: function (freqs, start, duration, type, peak) {
      var self = this;
      freqs.forEach(function (f) { self._tone(f, start, duration, type, peak); });
    },

    /**
     * @param {"alarm"|"horn"} kind
     */
    start: function (kind) {
      this.stop();
      var ctx = this.prime();
      if (!ctx) return;

      var self = this;
      function pattern() {
        var t = self.ctx.currentTime + 0.02;
        if (kind === "horn") {
          /* Tren düdüğü: iki kalın ton üst üste */
          self._chord([196, 246.94], t, 1.0, "sawtooth", 0.13);
          self._chord([164.81, 207.65], t + 1.15, 1.3, "sawtooth", 0.13);
        } else {
          /* Klasik çalar saat: üç kısa bip */
          self._tone(880, t, 0.15, "square", 0.14);
          self._tone(1174.66, t + 0.22, 0.15, "square", 0.14);
          self._tone(880, t + 0.44, 0.18, "square", 0.14);
        }
      }

      pattern();
      this.loop = setInterval(pattern, kind === "horn" ? 2800 : 1400);
      /* Kullanıcı masadan kalkmışsa sonsuza kadar ötmesin */
      this.autoStop = setTimeout(function () { self.stop(); }, 60000);
    },

    stop: function () {
      if (this.loop) clearInterval(this.loop);
      if (this.autoStop) clearTimeout(this.autoStop);
      this.loop = null;
      this.autoStop = null;
    }
  };

  /* Alarm şeridi */
  function showAlarmBanner(title, desc) {
    document.getElementById("alarm-title").textContent = title;
    document.getElementById("alarm-desc").textContent = desc;
    document.getElementById("alarm-banner").classList.add("show");
  }

  function hideAlarmBanner() {
    document.getElementById("alarm-banner").classList.remove("show");
    Alarm.stop();
  }

  /* ==========================================================
     5) SAYFA BAŞLIĞI — arka plandaki sekmede kalan süre görünsün
     ========================================================== */
  var BASE_TITLE = "Çalışma Sayacı · Bay Porsuk";
  var lastTitle = "";

  function updateTitle() {
    var next;
    if (countdown.running) {
      next = "⏳ " + formatCountdown(countdown.remaining) + " · Sayaç";
    } else if (train.running) {
      next = "🚆 " + formatCountdown(train.remaining) + " · Sayaç";
    } else if (stopwatch.running) {
      next = "⏱ " + formatClock(elapsedOf(stopwatch)) + " · Sayaç";
    } else {
      next = BASE_TITLE;
    }

    /* Kronometrede saniyede 60 kez çağrılıyor; aynı metni
       tekrar yazmanın anlamı yok */
    if (next !== lastTitle) {
      lastTitle = next;
      document.title = next;
    }
  }

  /* ==========================================================
     6) MOD 1 — KRONOMETRE
     ========================================================== */
  function elapsedOf(sw) {
    return sw.accumulated + (sw.running ? Date.now() - sw.startedAt : 0);
  }

  /* Saniyede 60 kez çalışıyor: innerHTML yerine hazır iki
     düğümün metni değiştiriliyor, ayrıca değişmeyen değer
     tekrar yazılmıyor. */
  var swLastMain = "", swLastCenti = "";

  function renderStopwatch() {
    var text = formatClock(elapsedOf(stopwatch), true);
    var dot = text.indexOf(".");
    var main = text.slice(0, dot);
    var centi = text.slice(dot);

    if (main !== swLastMain) {
      swLastMain = main;
      document.getElementById("sw-main").textContent = main;
    }
    if (centi !== swLastCenti) {
      swLastCenti = centi;
      document.getElementById("sw-centi").textContent = centi;
    }
  }

  function paintStopwatchButtons() {
    var toggle = document.getElementById("sw-toggle");
    toggle.innerHTML = stopwatch.running
      ? '<i class="fa-solid fa-pause"></i> Duraklat'
      : '<i class="fa-solid fa-play"></i> ' + (elapsedOf(stopwatch) > 0 ? "Devam et" : "Başlat");

    document.getElementById("sw-lap").disabled = !stopwatch.running;
    document.getElementById("sw-reset").disabled = elapsedOf(stopwatch) === 0;
  }

  function toggleStopwatch() {
    if (stopwatch.running) {
      stopwatch.accumulated += Date.now() - stopwatch.startedAt;
      stopwatch.running = false;
    } else {
      Alarm.prime();
      stopwatch.startedAt = Date.now();
      stopwatch.running = true;
      startLoop();
    }
    paintStopwatchButtons();
    renderStopwatch();
    updateTitle();
  }

  function addLap() {
    if (!stopwatch.running) return;
    var ms = elapsedOf(stopwatch);
    var previous = stopwatch.laps.length ? stopwatch.laps[0].at : 0;
    stopwatch.laps.unshift({ at: ms, split: ms - previous });
    renderLaps();
  }

  function renderLaps() {
    var box = document.getElementById("sw-laps");
    if (!stopwatch.laps.length) { box.innerHTML = ""; return; }

    var count = stopwatch.laps.length;
    box.innerHTML = '<div class="lap-head">Turlar</div>' +
      stopwatch.laps.map(function (lap, i) {
        return '<div class="lap-row">' +
          '<span class="lap-no">#' + (count - i) + "</span>" +
          '<span class="lap-split">+' + formatClock(lap.split, true) + "</span>" +
          '<span class="lap-total">' + formatClock(lap.at, true) + "</span>" +
        "</div>";
      }).join("");
  }

  function resetStopwatch() {
    var seconds = elapsedOf(stopwatch) / 1000;

    stopwatch.running = false;
    stopwatch.accumulated = 0;
    stopwatch.startedAt = 0;
    stopwatch.laps = [];

    finishSession("kronometre", seconds);

    renderStopwatch();
    renderLaps();
    paintStopwatchButtons();
    updateTitle();
  }

  /* ==========================================================
     7) MOD 2 — ZAMAN TUTMA
     ========================================================== */
  function renderPresets(containerId, values, onPick) {
    var box = document.getElementById(containerId);
    box.innerHTML = values.map(function (m) {
      return '<button type="button" class="preset-btn" data-minutes="' + m + '">' +
        humanMinutes(m) + "</button>";
    }).join("");

    U.qsa(".preset-btn", box).forEach(function (btn) {
      btn.addEventListener("click", function () {
        onPick(parseInt(btn.getAttribute("data-minutes"), 10));
      });
    });
  }

  function markActivePreset(containerId, minutes) {
    U.qsa("#" + containerId + " .preset-btn").forEach(function (btn) {
      btn.classList.toggle("active",
        parseInt(btn.getAttribute("data-minutes"), 10) === minutes);
    });
  }

  function setCountdown(minutes) {
    if (countdown.running) {
      return YKS.Toast.show("Önce sayacı duraklat.", "warn");
    }
    minutes = Math.max(1, Math.min(12 * 60, Math.round(minutes) || 0));

    countdown.total = minutes * 60 * 1000;
    countdown.remaining = countdown.total;
    countdown.lastShown = -1;
    countdown.recorded = false;

    document.getElementById("cd-hours").value = Math.floor(minutes / 60);
    document.getElementById("cd-minutes").value = minutes % 60;

    markActivePreset("cd-presets", minutes);
    renderCountdown(true);
    paintCountdownButtons();
  }

  function renderCountdown(force) {
    var seconds = Math.ceil(countdown.remaining / 1000);
    if (!force && seconds === countdown.lastShown) return;
    countdown.lastShown = seconds;

    document.getElementById("cd-display").textContent = formatCountdown(countdown.remaining);

    var done = countdown.total > 0
      ? 1 - Math.max(0, countdown.remaining) / countdown.total
      : 0;
    var ring = document.getElementById("cd-ring");
    ring.setAttribute("stroke-dasharray", RING_LENGTH.toFixed(2));
    ring.setAttribute("stroke-dashoffset", (RING_LENGTH * (1 - done)).toFixed(2));

    var label = document.getElementById("cd-label");
    if (countdown.running) label.textContent = "Çalışıyor";
    else if (countdown.remaining <= 0) label.textContent = "Bitti";
    else if (countdown.remaining < countdown.total) label.textContent = "Duraklatıldı";
    else label.textContent = humanMinutes(Math.round(countdown.total / 60000)) + " hazır";
  }

  function paintCountdownButtons() {
    document.getElementById("cd-toggle").innerHTML = countdown.running
      ? '<i class="fa-solid fa-pause"></i> Duraklat'
      : '<i class="fa-solid fa-play"></i> ' +
        (countdown.remaining < countdown.total && countdown.remaining > 0 ? "Devam et" : "Başlat");

    document.getElementById("cd-reset").disabled =
      !countdown.running && countdown.remaining === countdown.total;
  }

  function toggleCountdown() {
    if (countdown.running) {
      countdown.remaining = Math.max(0, countdown.endsAt - Date.now());
      countdown.running = false;
    } else {
      if (countdown.remaining <= 0) countdown.remaining = countdown.total;
      Alarm.prime();
      hideAlarmBanner();
      countdown.endsAt = Date.now() + countdown.remaining;
      countdown.running = true;
      startLoop();
    }
    renderCountdown(true);
    paintCountdownButtons();
    updateTitle();
  }

  function tickCountdown(now) {
    countdown.remaining = countdown.endsAt - now;

    if (countdown.remaining <= 0) {
      countdown.remaining = 0;
      countdown.running = false;

      var seconds = countdown.total / 1000;
      countdown.recorded = true;

      Alarm.start("alarm");
      showAlarmBanner("Süre doldu!",
        humanDuration(seconds) + " çalıştın. Kısa bir mola iyi gelir.");
      finishSession("zamanlayici", seconds);

      paintCountdownButtons();
    }

    renderCountdown(false);
    updateTitle();
  }

  function resetCountdown() {
    if (countdown.running) {
      countdown.remaining = Math.max(0, countdown.endsAt - Date.now());
      countdown.running = false;
    }

    /* Yarım bırakılan oturum da çalışmadır; süresi doldurulup
       zaten kaydedilmişse ikinci kez yazılmaz. */
    var worked = (countdown.total - Math.max(0, countdown.remaining)) / 1000;
    var pending = !countdown.recorded && worked >= 60;

    countdown.remaining = countdown.total;
    countdown.lastShown = -1;
    countdown.recorded = false;

    if (pending) finishSession("zamanlayici", worked, "yarım kalan oturum");

    hideAlarmBanner();
    renderCountdown(true);
    paintCountdownButtons();
    updateTitle();
  }

  /* ==========================================================
     8) MOD 3 — TREN GİDENE KADAR ÇALIŞ
     ========================================================== */

  /** Verilen dakikada trenin harita üzerindeki konumu */
  function routePointAt(minutes) {
    var last = ROUTE[ROUTE.length - 1];

    if (minutes <= 0) {
      return { x: mx(ROUTE[0].lon), y: my(ROUTE[0].lat), index: 0 };
    }
    if (minutes >= last.min) {
      return { x: mx(last.lon), y: my(last.lat), index: ROUTE.length - 1 };
    }

    for (var i = 1; i < ROUTE.length; i++) {
      if (minutes <= ROUTE[i].min) {
        var a = ROUTE[i - 1], b = ROUTE[i];
        var t = (minutes - a.min) / (b.min - a.min);
        return {
          x: mx(a.lon) + (mx(b.lon) - mx(a.lon)) * t,
          y: my(a.lat) + (my(b.lat) - my(a.lat)) * t,
          index: i - 1
        };
      }
    }
    return { x: mx(last.lon), y: my(last.lat), index: ROUTE.length - 1 };
  }

  /** Bir noktanın okunur adı: istasyon ya da "A – B arası" */
  function describePoint(minutes) {
    var last = ROUTE[ROUTE.length - 1];
    if (minutes >= last.min) return last.name;

    var point = routePointAt(minutes);
    var a = ROUTE[point.index];
    var b = ROUTE[point.index + 1];
    if (!b) return a.name;

    if (minutes - a.min <= 3) return a.name;
    if (b.min - minutes <= 3) return b.name;
    return a.name + " – " + b.name + " arası";
  }

  function trainMinutes() { return train.total / 60000; }

  function setTrain(minutes) {
    if (train.running) {
      return YKS.Toast.show("Önce yolculuğu duraklat.", "warn");
    }
    minutes = Math.max(1, Math.min(24 * 60, Math.round(minutes) || 0));

    train.total = minutes * 60 * 1000;
    train.remaining = train.total;
    train.lastShown = -1;
    train.recorded = false;

    document.getElementById("tr-hours").value = Math.floor(minutes / 60);
    document.getElementById("tr-minutes").value = minutes % 60;

    markActivePreset("tr-presets", minutes);
    renderJourney();
    updateMap(0);
    paintTrainButtons();
  }

  function renderJourney() {
    var box = document.getElementById("tr-journey");
    var totalMin = trainMinutes();
    var elapsedMin = (train.total - Math.max(0, train.remaining)) / 60000;

    var destination = describePoint(totalMin);
    var current = routePointAt(elapsedMin);
    var passed = current.index;              /* geçilen istasyon sayısı */
    var next = ROUTE[current.index + 1];
    var progress = train.total > 0
      ? Math.min(100, Math.max(0, (1 - train.remaining / train.total) * 100))
      : 0;

    var finished = train.remaining <= 0;

    box.innerHTML =
      '<div class="journey-top">' +
        '<div class="journey-end">' +
          '<span class="journey-label">Kalkış</span>' +
          "<strong>İstanbul</strong>" +
        "</div>" +
        '<div class="journey-clock">' +
          '<div class="timer-display small">' + formatCountdown(train.remaining) + "</div>" +
          '<span class="journey-label">' +
            (finished ? "Vardı" : (train.running ? "yolda" : "kalan süre")) +
          "</span>" +
        "</div>" +
        '<div class="journey-end right">' +
          '<span class="journey-label">Varış</span>' +
          "<strong>" + U.escape(destination) + "</strong>" +
        "</div>" +
      "</div>" +
      '<div class="journey-track">' +
        '<div class="journey-fill" style="width:' + progress.toFixed(2) + '%"></div>' +
      "</div>" +
      '<div class="journey-meta">' +
        "<span><i class=\"fa-solid fa-map-pin\"></i> " +
          (finished ? "Varış noktasındasın" : "Şu an: " + U.escape(describePoint(elapsedMin))) +
        "</span>" +
        "<span><i class=\"fa-solid fa-flag-checkered\"></i> " + passed + " istasyon geçildi</span>" +
        (next && !finished
          ? "<span><i class=\"fa-solid fa-forward\"></i> Sıradaki: " + U.escape(next.name) + "</span>"
          : "") +
      "</div>";
  }

  function paintTrainButtons() {
    document.getElementById("tr-toggle").innerHTML = train.running
      ? '<i class="fa-solid fa-pause"></i> Duraklat'
      : '<i class="fa-solid fa-play"></i> ' +
        (train.remaining < train.total && train.remaining > 0 ? "Devam et" : "Yolculuğu başlat");

    document.getElementById("tr-reset").disabled =
      !train.running && train.remaining === train.total;
  }

  function toggleTrain() {
    if (train.running) {
      train.remaining = Math.max(0, train.endsAt - Date.now());
      train.running = false;
    } else {
      if (train.remaining <= 0) train.remaining = train.total;
      Alarm.prime();
      hideAlarmBanner();
      train.endsAt = Date.now() + train.remaining;
      train.running = true;
      startLoop();
    }
    setMapRunning(train.running);
    renderJourney();
    paintTrainButtons();
    updateTitle();
  }

  function tickTrain(now) {
    train.remaining = train.endsAt - now;

    if (train.remaining <= 0) {
      train.remaining = 0;
      train.running = false;
      setMapRunning(false);

      var seconds = train.total / 1000;
      var destination = describePoint(trainMinutes());
      train.recorded = true;

      Alarm.start("horn");
      showAlarmBanner("Tren vardı: " + destination,
        humanDuration(seconds) + " çalıştın ve tren varış noktasına ulaştı.");

      paintTrainButtons();
      renderJourney();
      updateMap(trainMinutes());
      updateTitle();

      finishSession("tren", seconds, "İstanbul → " + destination);
      return;
    }

    var seconds2 = Math.ceil(train.remaining / 1000);
    if (seconds2 !== train.lastShown) {
      train.lastShown = seconds2;
      renderJourney();
      updateTitle();
    }

    /* Harita saniyede birkaç kez yenilenmesi yeterli */
    if (now - train.lastMapAt > 200) {
      train.lastMapAt = now;
      updateMap((train.total - train.remaining) / 60000);
    }
  }

  function resetTrain() {
    if (train.running) {
      train.remaining = Math.max(0, train.endsAt - Date.now());
      train.running = false;
    }

    var worked = (train.total - Math.max(0, train.remaining)) / 1000;
    var pending = !train.recorded && worked >= 60;
    var reached = describePoint(worked / 60);

    train.remaining = train.total;
    train.lastShown = -1;
    train.recorded = false;

    hideAlarmBanner();
    setMapRunning(false);
    renderJourney();
    updateMap(0);
    paintTrainButtons();
    updateTitle();

    if (pending) {
      finishSession("tren", worked, "İstanbul → " + reached + " (yarım kalan yolculuk)");
    }
  }

  /* ==========================================================
     9) HARİTA
     ----------------------------------------------------------
     Tek seferde çizilir; her karede yalnızca kat edilen yol,
     tren konumu ve geçilen istasyonlar güncellenir.
     ========================================================== */
  function buildMap() {
    var outline = TURKEY_OUTLINE.map(function (p, i) {
      return (i === 0 ? "M" : "L") + mx(p[0]).toFixed(1) + "," + my(p[1]).toFixed(1);
    }).join(" ") + " Z";

    var fullRoute = ROUTE.map(function (s) {
      return mx(s.lon).toFixed(1) + "," + my(s.lat).toFixed(1);
    }).join(" ");

    var stations = ROUTE.map(function (s, i) {
      var x = mx(s.lon), y = my(s.lat);
      var dot = '<circle class="station-dot" id="st-dot-' + i + '" cx="' + x.toFixed(1) +
        '" cy="' + y.toFixed(1) + '" r="4"><title>' + U.escape(s.name) +
        " · İstanbul'dan " + humanMinutes(s.min) + "</title></circle>";

      var label = LABELLED.indexOf(s.name) === -1 ? "" :
        '<text class="station-label" id="st-label-' + i + '" x="' + x.toFixed(1) +
        '" y="' + (y - 12).toFixed(1) + '" text-anchor="middle">' +
        U.escape(s.name) + "</text>";

      return dot + label;
    }).join("");

    document.getElementById("tr-map").innerHTML =
      '<svg class="turkey-map" id="turkey-map" viewBox="0 0 ' + MAP_W + " " + MAP_H + '" ' +
           'role="img" aria-label="Türkiye haritası üzerinde tren yolculuğu">' +
        "<defs>" +
          '<linearGradient id="landFill" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#1b2036" />' +
            '<stop offset="100%" stop-color="#141826" />' +
          "</linearGradient>" +
        "</defs>" +

        '<path class="land" d="' + outline + '" />' +
        '<polyline class="route-base" points="' + fullRoute + '" />' +
        '<polyline class="route-done" id="route-done" points="" />' +
        stations +

        '<g class="train-marker" id="train-marker" transform="translate(' +
            mx(ROUTE[0].lon).toFixed(1) + "," + my(ROUTE[0].lat).toFixed(1) + ')">' +
          '<g class="smoke">' +
            '<circle cx="-6" cy="-18" r="3.4" />' +
            '<circle cx="-10" cy="-24" r="2.8" />' +
            '<circle cx="-14" cy="-29" r="2.2" />' +
          "</g>" +
          '<ellipse class="train-shadow" cx="0" cy="12" rx="17" ry="3.5" />' +
          '<rect class="train-body" x="-16" y="-11" width="30" height="19" rx="6" />' +
          '<rect class="train-nose" x="10" y="-7" width="7" height="12" rx="3" />' +
          '<rect class="train-window" x="-12" y="-7" width="8" height="7" rx="2" />' +
          '<rect class="train-window" x="-2" y="-7" width="8" height="7" rx="2" />' +
          '<circle class="train-wheel" cx="-8" cy="9" r="3" />' +
          '<circle class="train-wheel" cx="7" cy="9" r="3" />' +
        "</g>" +
      "</svg>";
  }

  function setMapRunning(isRunning) {
    var svg = document.getElementById("turkey-map");
    if (svg) svg.classList.toggle("running", !!isRunning);
  }

  function updateMap(elapsedMinutes) {
    var svg = document.getElementById("turkey-map");
    if (!svg) return;

    var point = routePointAt(elapsedMinutes);

    /* Kat edilen yol: geçilen istasyonlar + şu anki konum */
    var done = [];
    for (var i = 0; i <= point.index; i++) {
      done.push(mx(ROUTE[i].lon).toFixed(1) + "," + my(ROUTE[i].lat).toFixed(1));
    }
    done.push(point.x.toFixed(1) + "," + point.y.toFixed(1));

    document.getElementById("route-done").setAttribute("points", done.join(" "));
    document.getElementById("train-marker").setAttribute(
      "transform", "translate(" + point.x.toFixed(1) + "," + point.y.toFixed(1) + ")");

    /* Geçilen istasyonlar yansın */
    for (var j = 0; j < ROUTE.length; j++) {
      var dot = document.getElementById("st-dot-" + j);
      if (dot) dot.classList.toggle("reached", ROUTE[j].min <= elapsedMinutes);
    }
  }

  /* ==========================================================
     9b) KAÇ SAAT ÇALIŞTIM? — RAPOR
     ========================================================== */
  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** @param days 1 = bugün, 7/30 = son N gün, 0 = tümü */
  function sessionsInRange(days, examType) {
    var list = allSessions();

    if (days > 0) {
      var start = startOfToday();
      start.setDate(start.getDate() - (days - 1));
      var from = start.getTime();
      list = list.filter(function (s) { return s.endedAt >= from; });
    }
    if (examType) {
      list = list.filter(function (s) { return s.examType === examType; });
    }
    return list;
  }

  function sumSeconds(list) {
    return list.reduce(function (sum, s) { return sum + (s.seconds || 0); }, 0);
  }

  /** Gün gün kovalar — takvim günlerine göre, saat farkı taşımaz */
  function dailyBuckets(list, dayCount) {
    var buckets = [];
    var cursor = startOfToday();
    cursor.setDate(cursor.getDate() - (dayCount - 1));

    for (var i = 0; i < dayCount; i++) {
      var start = new Date(cursor);
      var next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      buckets.push({ from: start.getTime(), to: next.getTime(), date: start, seconds: 0 });
      cursor = next;
    }

    list.forEach(function (s) {
      for (var j = 0; j < buckets.length; j++) {
        if (s.endedAt >= buckets[j].from && s.endedAt < buckets[j].to) {
          buckets[j].seconds += s.seconds || 0;
          return;
        }
      }
    });

    return buckets;
  }

  /** Ders bazlı toplamlar — süreye göre çoktan aza */
  function subjectGroups(list) {
    var map = {}, order = [];

    list.forEach(function (s) {
      /* Ders kimlikleri türler arasında tekrar edebiliyor
         (matematik hem TYT hem AYT'de), anahtar tür ile birlikte */
      var key = (s.examType || "-") + "|" + (s.subjectId || "-");

      if (!map[key]) {
        var def = s.examType && s.subjectId ? YKS.Subjects.find(s.examType, s.subjectId) : null;
        map[key] = {
          name: s.subjectName || (def ? def.name : "Belirtilmemiş"),
          type: s.examType || null,
          icon: def ? def.icon : "fa-circle-question",
          seconds: 0,
          count: 0
        };
        order.push(key);
      }

      map[key].seconds += s.seconds || 0;
      map[key].count++;
    });

    return order.map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.seconds - a.seconds; });
  }

  function reportCard(icon, label, value, note) {
    return '<div class="report-card">' +
      '<i class="report-icon fa-solid ' + icon + '"></i>' +
      '<div class="report-label">' + label + "</div>" +
      '<div class="report-value">' + value + "</div>" +
      (note ? '<div class="report-note">' + note + "</div>" : "") +
    "</div>";
  }

  function blockHead(icon, title, right) {
    return '<div class="report-block-head">' +
      "<h3><i class=\"fa-solid " + icon + '"></i> ' + title + "</h3>" +
      (right ? '<span class="faint">' + right + "</span>" : "") +
    "</div>";
  }

  function renderReport() {
    var box = document.getElementById("report-content");
    if (!box) return;

    if (!canSave) {
      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-user-lock"></i>' +
          "<h3>Rapor için kişisel hesap gerekli</h3>" +
          "<p>Kurucu oturumunda çalışma süreleri kaydedilmediği için " +
          "rapor üretilemiyor. Kendi hesabınla giriş yaparsan burası dolar.</p>" +
        "</div>";
      return;
    }

    var days = parseInt(document.getElementById("rp-range").value, 10);
    if (isNaN(days)) days = 7;
    var examType = document.getElementById("rp-type").value;

    var list = sessionsInRange(days, examType);

    if (!list.length) {
      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-chart-pie"></i>' +
          "<h3>Bu dönemde kayıt yok</h3>" +
          "<p>Sayaçlardan birini çalıştırıp bitirdiğinde, seçtiğin dersle " +
          "birlikte süren buraya işlenir.</p>" +
        "</div>";
      return;
    }

    var total = sumSeconds(list);
    var groups = subjectGroups(list);
    var top = groups[0];

    /* Kaç ayrı günde çalışılmış */
    var seenDays = {}, activeDays = 0;
    list.forEach(function (s) {
      var d = new Date(s.endedAt);
      var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
      if (!seenDays[key]) { seenDays[key] = true; activeDays++; }
    });

    var divisor = days > 0 ? days : Math.max(1, activeDays);

    /* ---- Özet kartları ---- */
    var summaryHTML = '<div class="report-grid">' +
      reportCard("fa-clock", "Toplam süre", humanDuration(total),
        list.length + " oturum") +
      reportCard("fa-calendar-day", "Günlük ortalama", humanDuration(total / divisor),
        days > 0 ? days + " günlük dönem" : activeDays + " aktif gün") +
      reportCard("fa-fire", "Çalışılan gün", activeDays + " gün",
        days > 0 ? days + " günün " + activeDays + " günü" : "toplam") +
      reportCard(top.icon, "En çok çalışılan", U.escape(top.name),
        humanDuration(top.seconds) +
        (top.type ? " · " + YKS.Subjects.typeLabel(top.type) : "")) +
    "</div>";

    /* ---- Günlük dağılım ---- */
    var chartDays = days > 0 ? Math.min(days, 30) : 14;
    var buckets = dailyBuckets(list, chartDays);
    var maxSeconds = 0;
    buckets.forEach(function (b) { if (b.seconds > maxSeconds) maxSeconds = b.seconds; });
    if (maxSeconds <= 0) maxSeconds = 1;

    var labelStep = chartDays > 14 ? 5 : 1;

    var chartHTML = '<div class="report-block">' +
      blockHead("fa-chart-column", "Günlük dağılım", "son " + chartDays + " gün") +
      '<div class="day-chart">' +
        buckets.map(function (b, i) {
          var ratio = (b.seconds / maxSeconds) * 100;
          var height = b.seconds > 0 ? Math.max(6, ratio) : 2;
          var label = (i % labelStep === 0 || i === buckets.length - 1) ? b.date.getDate() : "";
          var tip = b.date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }) +
            " · " + (b.seconds ? humanDuration(b.seconds) : "çalışma yok");

          return '<div class="day-col" title="' + U.escape(tip) + '">' +
            '<div class="day-bar-wrap">' +
              '<div class="day-bar' + (b.seconds ? "" : " empty") +
                '" style="height:' + height.toFixed(1) + '%"></div>' +
            "</div>" +
            '<span class="day-label">' + label + "</span>" +
          "</div>";
        }).join("") +
      "</div>" +
    "</div>";

    /* ---- Sınav türü dağılımı (tür filtresi yokken anlamlı) ---- */
    var typeHTML = "";
    if (!examType) {
      var typeTotals = {};
      list.forEach(function (s) {
        var key = s.examType || "none";
        typeTotals[key] = (typeTotals[key] || 0) + (s.seconds || 0);
      });

      var typeRows = YKS.Subjects.types.map(function (t) {
        return { label: t.label, value: t.value, seconds: typeTotals[t.value] || 0 };
      });
      if (typeTotals.none) {
        typeRows.push({ label: "Belirtilmemiş", value: null, seconds: typeTotals.none });
      }
      typeRows = typeRows.filter(function (r) { return r.seconds > 0; })
        .sort(function (a, b) { return b.seconds - a.seconds; });

      typeHTML = '<div class="report-block">' +
        blockHead("fa-layer-group", "Sınav türüne göre") +
        '<div class="type-report">' +
          typeRows.map(function (r) {
            var pct = (r.seconds / total) * 100;
            return '<div class="type-report-row">' +
              '<span class="type-report-name">' + r.label + "</span>" +
              '<div class="type-report-bar">' +
                '<div class="fill' + (r.value ? " " + r.value : "") +
                  '" style="width:' + pct.toFixed(1) + '%"></div>' +
              "</div>" +
              '<span class="type-report-time">' + humanDuration(r.seconds) +
                ' <span class="faint">%' + pct.toFixed(0) + "</span></span>" +
            "</div>";
          }).join("") +
        "</div>" +
      "</div>";
    }

    /* ---- Ders bazlı liste ---- */
    var subjectHTML = '<div class="report-block">' +
      blockHead("fa-book-open", "Derse göre çalışma süresi", groups.length + " ders") +
      '<div class="subject-report">' +
        groups.map(function (g) {
          var pct = (g.seconds / total) * 100;
          return '<div class="subject-report-row">' +
            '<i class="fa-solid ' + g.icon + '"></i>' +
            '<div class="subject-report-main">' +
              '<div class="subject-report-top">' +
                "<strong>" + U.escape(g.name) + "</strong>" +
                (g.type
                  ? '<span class="exam-type-badge ' + g.type + '">' +
                      YKS.Subjects.typeLabel(g.type) + "</span>"
                  : "") +
                '<span class="subject-report-time">' + humanDuration(g.seconds) + "</span>" +
              "</div>" +
              '<div class="subject-report-bar">' +
                '<div class="fill" style="width:' + pct.toFixed(1) + '%"></div>' +
              "</div>" +
              '<div class="subject-report-meta">' +
                g.count + " oturum · toplam sürenin %" + pct.toFixed(1) + "'i" +
              "</div>" +
            "</div>" +
          "</div>";
        }).join("") +
      "</div>" +
    "</div>";

    box.innerHTML = summaryHTML + chartHTML + typeHTML + subjectHTML;
  }

  function bindReport() {
    document.getElementById("rp-range").addEventListener("change", renderReport);
    document.getElementById("rp-type").addEventListener("change", renderReport);
  }

  /* ==========================================================
     10) MOD GEÇİŞİ
     ========================================================== */
  function switchMode(mode) {
    activeMode = mode;
    if (mode === "report") renderReport();

    U.qsa(".exam-tab[data-mode]").forEach(function (tab) {
      var isActive = tab.getAttribute("data-mode") === mode;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    U.qsa(".mode-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "mode-" + mode);
    });
  }

  function bindModes() {
    U.qsa(".exam-tab[data-mode]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchMode(tab.getAttribute("data-mode"));
      });
    });
  }

  /* ==========================================================
     11) ANA DÖNGÜ
     ----------------------------------------------------------
     Süreler Date.now() farkından okunur; sekme arka planda
     yavaşlasa bile geri dönüldüğünde doğru değer görünür.
     ========================================================== */
  function loop() {
    var now = Date.now();

    if (stopwatch.running) renderStopwatch();
    if (countdown.running) tickCountdown(now);
    if (train.running) tickTrain(now);

    if (stopwatch.running) updateTitle();

    if (stopwatch.running || countdown.running || train.running) {
      raf = window.requestAnimationFrame(loop);
    } else {
      raf = null;
      updateTitle();
    }
  }

  function startLoop() {
    if (!raf) raf = window.requestAnimationFrame(loop);
  }

  /* ==========================================================
     12) OLAY BAĞLARI
     ========================================================== */
  function bindStopwatch() {
    document.getElementById("sw-toggle").addEventListener("click", toggleStopwatch);
    document.getElementById("sw-lap").addEventListener("click", addLap);
    document.getElementById("sw-reset").addEventListener("click", resetStopwatch);
  }

  function bindCountdown() {
    renderPresets("cd-presets", COUNTDOWN_PRESETS, setCountdown);

    document.getElementById("cd-set").addEventListener("click", function () {
      var h = parseInt(document.getElementById("cd-hours").value, 10) || 0;
      var m = parseInt(document.getElementById("cd-minutes").value, 10) || 0;
      var total = h * 60 + m;
      if (total < 1) return YKS.Toast.show("En az 1 dakika seç.", "error");
      setCountdown(total);
    });

    document.getElementById("cd-toggle").addEventListener("click", toggleCountdown);
    document.getElementById("cd-reset").addEventListener("click", resetCountdown);
  }

  function bindTrain() {
    renderPresets("tr-presets", TRAIN_PRESETS, setTrain);

    document.getElementById("tr-set").addEventListener("click", function () {
      var h = parseInt(document.getElementById("tr-hours").value, 10) || 0;
      var m = parseInt(document.getElementById("tr-minutes").value, 10) || 0;
      var total = h * 60 + m;
      if (total < 1) return YKS.Toast.show("En az 1 dakika seç.", "error");
      setTrain(total);
    });

    document.getElementById("tr-toggle").addEventListener("click", toggleTrain);
    document.getElementById("tr-reset").addEventListener("click", resetTrain);
  }

  function bindShell() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = YKS.Auth.isAdmin() ? "admin.html" : "index.html";
    });

    document.getElementById("sound-toggle").addEventListener("click", function () {
      Alarm.toggleMute();
    });

    document.getElementById("alarm-stop").addEventListener("click", hideAlarmBanner);

    /* Sayfadan ayrılırken çalan alarm arkada kalmasın */
    window.addEventListener("pagehide", function () { Alarm.stop(); });
  }

  /* ==========================================================
     13) BAŞLANGIÇ
     ========================================================== */
  YKS.hazir(function () {
    if (!loadUser()) return;

    bindModes();
    bindShell();
    bindStopwatch();
    bindCountdown();
    bindTrain();
    bindConfirm();
    bindSubjectModal();
    bindReport();

    Alarm.loadPreference();

    renderStopwatch();
    paintStopwatchButtons();

    setCountdown(25);

    buildMap();
    setTrain(60);

    refreshRecords();
    updateTitle();
  });

})(window, document);
