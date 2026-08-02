/* ============================================================
   Aksiyom — exams.js
   ------------------------------------------------------------
   Deneme Sonuçları modülü:
     • TYT, AYT, KPSS deneme ekleme / düzenleme / silme
     • Ders bazlı net girişi (canlı hesap, sınır denetimi)
     • İstatistikler: ortalama, en iyi, son net, son 5 ortalaması
     • Bir önceki denemeye göre fark rozeti
     • Arama, sıralama ve CSV dışa aktarma
   Çekirdek fonksiyonlar script.js içindeki YKS ad alanından gelir.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     0) Sabitler
     ========================================================== */

  /* Deneme tipleri ve dersleri — ortak katalog script.js içinde.
     Buradaki her ders: { id, name, icon, max } */
  var EXAM_SUBJECTS = YKS.Subjects.byType;

  var TYPES = YKS.Subjects.types.map(function (t) { return t.value; });

  /* ==========================================================
     1) Durum
     ========================================================== */
  var currentUser = null;
  var currentExamType = "tyt";
  var editingExamId = null;
  var deleteExamId = null;
  var searchQuery = "";
  var sortMode = "date-desc";

  /* ==========================================================
     2) Küçük yardımcılar
     ========================================================== */

  /** Sayıyı verilen aralığa sıkıştırır; geçersiz değer 0 sayılır */
  function clampInt(value, min, max) {
    var n = parseInt(value, 10);
    if (isNaN(n)) n = 0;
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
  }

  /** Bir deneme tipindeki toplam soru sayısı */
  function totalQuestions(type) {
    return (EXAM_SUBJECTS[type] || []).reduce(function (sum, s) {
      return sum + s.max;
    }, 0);
  }

  /** Ders tanımını id ile bulur (eski kayıtlarda "max" olmayabilir) */
  function subjectDef(type, id) {
    var list = EXAM_SUBJECTS[type] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /**
   * "2026-07-29" → yerel saatle öğlen 12:00 zaman damgası.
   * Öğlen seçilir; böylece yaz saati / saat dilimi kaymalarında
   * tarih bir gün geri veya ileri atmaz.
   */
  function fromDateInput(str) {
    var parts = String(str || "").split("-");
    if (parts.length !== 3) return NaN;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return NaN;
    return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  }

  /** Zaman damgası → <input type="date"> değeri (yerel saatle) */
  function toDateInput(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
      ("0" + d.getDate()).slice(-2);
  }

  /** Okunur tarih */
  function formatDate(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }

  /** İşaretli sayı: 3.5 → "+3.50" */
  function signed(value, digits) {
    var n = Number(value) || 0;
    return (n >= 0 ? "+" : "") + n.toFixed(digits === undefined ? 2 : digits);
  }

  /* ==========================================================
     3) Kullanıcı ve veri erişimi
     ========================================================== */

  /**
   * Oturumu doğrular ve kullanıcıyı yükler.
   * @returns {boolean} sayfa çizilmeye devam etsin mi
   */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = YKS.Auth.currentUser();

    /* Yönetim kodu ile açılan "kurucu" oturumunun kişisel bir hesabı
       yoktur. Deneme verisi kullanıcı kaydında tutulduğu için bu
       oturumda modül çalışamaz — sessizce yönlendirmek yerine
       ne yapılması gerektiğini söylüyoruz. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    /* Eski yedeklerden gelen kayıtlarda "data" eksik olabilir */
    if (!currentUser.data || typeof currentUser.data !== "object") {
      currentUser.data = {};
    }
    if (!Array.isArray(currentUser.data.denemeler)) {
      currentUser.data.denemeler = [];
    }
    return true;
  }

  /** Kişisel hesap gerektiren durumda gösterilen bilgi ekranı */
  function renderAccountRequired(isGate) {
    var container = document.querySelector(".exams-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-exams">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim kodu ile açılmış kurucu oturumundasın. Deneme sonuçları kullanıcı hesabına bağlı tutulur; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<div class="d-flex flex-wrap gap-2 justify-content-center">' +
          '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
            '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
          "</a>" +
        "</div>" +
      "</div>";
  }

  /** Değişiklikleri kullanıcı kaydına yazar */
  function saveExams() {
    var result = YKS.Users.update(currentUser.id, { data: currentUser.data });

    if (result.ok) {
      var fresh = YKS.Auth.currentUser();
      if (fresh) currentUser = fresh;
      if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
      if (!Array.isArray(currentUser.data.denemeler)) currentUser.data.denemeler = [];
    }

    return result;
  }

  /** Bir tipin tüm denemeleri — yeniden eskiye */
  function allExamsOfType(type) {
    return currentUser.data.denemeler
      .filter(function (exam) { return exam && exam.type === type; })
      .sort(function (a, b) { return b.date - a.date; });
  }

  /** Arama ve sıralama uygulanmış liste */
  function visibleExams() {
    var list = allExamsOfType(currentExamType);

    if (searchQuery) {
      var q = searchQuery.toLocaleLowerCase("tr");
      list = list.filter(function (exam) {
        var haystack = ((exam.name || "") + " " + (exam.notes || "")).toLocaleLowerCase("tr");
        return haystack.indexOf(q) !== -1;
      });
    }

    if (sortMode === "date-asc") {
      list.sort(function (a, b) { return a.date - b.date; });
    } else if (sortMode === "net-desc") {
      list.sort(function (a, b) { return (b.totalNet || 0) - (a.totalNet || 0); });
    } else if (sortMode === "net-asc") {
      list.sort(function (a, b) { return (a.totalNet || 0) - (b.totalNet || 0); });
    }

    return list;
  }

  /**
   * Her denemenin bir öncekine göre net farkı.
   * Karşılaştırma tarih sırasına göre yapılır, listedeki sıraya değil.
   */
  function buildDeltaMap(type) {
    var chrono = allExamsOfType(type).slice().sort(function (a, b) { return a.date - b.date; });
    var map = {};
    for (var i = 1; i < chrono.length; i++) {
      map[chrono[i].id] = (Number(chrono[i].totalNet) || 0) - (Number(chrono[i - 1].totalNet) || 0);
    }
    return map;
  }

  /* ==========================================================
     4) Sekmeler
     ========================================================== */
  function switchTab(type) {
    currentExamType = type;

    U.qsa(".exam-tab").forEach(function (tab) {
      var isActive = tab.getAttribute("data-type") === type;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    renderStats();
    renderExamsList();
  }

  function bindTabs() {
    U.qsa(".exam-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab.getAttribute("data-type"));
      });
    });
  }

  function updateTabCounts() {
    TYPES.forEach(function (type) {
      var el = document.getElementById(type + "-count");
      if (el) el.textContent = allExamsOfType(type).length;
    });
  }

  /* ==========================================================
     5) İstatistikler
     ========================================================== */

  /** @param exams yeniden eskiye sıralı liste */
  function calculateStats(exams) {
    if (!exams.length) {
      return { total: 0, avgNet: 0, bestNet: 0, lastNet: 0, last5: 0, delta: null, rate: 0 };
    }

    var nets = exams.map(function (exam) { return Number(exam.totalNet) || 0; });
    var sum = nets.reduce(function (a, b) { return a + b; }, 0);
    var last5 = nets.slice(0, 5);
    var last5Sum = last5.reduce(function (a, b) { return a + b; }, 0);
    var max = totalQuestions(currentExamType);

    return {
      total: nets.length,
      avgNet: sum / nets.length,
      bestNet: Math.max.apply(null, nets),
      lastNet: nets[0],
      last5: last5Sum / last5.length,
      delta: nets.length > 1 ? nets[0] - nets[1] : null,
      rate: max > 0 ? (nets[0] / max) * 100 : 0
    };
  }

  function statCardHTML(icon, label, value, extraHTML) {
    return '<div class="stat-card-exam">' +
      '<i class="icon fa-solid ' + icon + '"></i>' +
      '<div class="label">' + label + "</div>" +
      '<div class="value">' + value + "</div>" +
      (extraHTML || "") +
    "</div>";
  }

  function renderStats() {
    var stats = calculateStats(allExamsOfType(currentExamType));
    var container = document.getElementById("stats-grid");
    if (!container) return;

    var deltaHTML = "";
    if (stats.delta !== null) {
      var dir = stats.delta > 0.001 ? "up" : (stats.delta < -0.001 ? "down" : "flat");
      var icon = dir === "up" ? "fa-arrow-trend-up" : (dir === "down" ? "fa-arrow-trend-down" : "fa-minus");
      deltaHTML = '<div class="stat-delta ' + dir + '">' +
        '<i class="fa-solid ' + icon + '"></i> ' + signed(stats.delta) + " net" +
      "</div>";
    }

    var rateHTML = stats.total
      ? '<div class="stat-note">Başarı %' + stats.rate.toFixed(1) + "</div>"
      : "";

    container.innerHTML =
      statCardHTML("fa-clipboard-list", "Toplam Deneme", stats.total) +
      statCardHTML("fa-chart-line", "Ortalama Net", stats.avgNet.toFixed(2)) +
      statCardHTML("fa-trophy", "En İyi Net", stats.bestNet.toFixed(2)) +
      statCardHTML("fa-calendar-check", "Son Net", stats.lastNet.toFixed(2), deltaHTML + rateHTML) +
      statCardHTML("fa-layer-group", "Son 5 Ortalaması", stats.last5.toFixed(2));
  }

  /* ==========================================================
     6) Deneme listesi
     ========================================================== */
  function renderExamsList() {
    var container = document.getElementById("exams-list");
    if (!container) return;

    var total = allExamsOfType(currentExamType).length;
    var exams = visibleExams();

    /* Hiç deneme yok */
    if (!total) {
      container.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-clipboard-question"></i>' +
          "<h3>Henüz deneme eklenmemiş</h3>" +
          "<p>İlk deneme sonucunu ekleyerek başla!</p>" +
          '<button type="button" class="btn-x btn-primary-x" id="add-empty-exam">' +
            '<i class="fa-solid fa-plus"></i> Deneme Ekle' +
          "</button>" +
        "</div>";

      var btn = document.getElementById("add-empty-exam");
      if (btn) btn.addEventListener("click", openAddModal);
      updateResultLabel(0, 0);
      return;
    }

    /* Deneme var ama arama eşleşmedi */
    if (!exams.length) {
      container.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-magnifying-glass"></i>' +
          "<h3>Eşleşme yok</h3>" +
          "<p>Aramayı değiştirip tekrar dene.</p>" +
          '<button type="button" class="btn-x btn-ghost-x" id="clear-search-btn">' +
            '<i class="fa-solid fa-xmark"></i> Aramayı temizle' +
          "</button>" +
        "</div>";

      var clearBtn = document.getElementById("clear-search-btn");
      if (clearBtn) {
        clearBtn.addEventListener("click", function () {
          var input = document.getElementById("exam-search");
          if (input) input.value = "";
          searchQuery = "";
          renderExamsList();
        });
      }
      updateResultLabel(0, total);
      return;
    }

    var deltas = buildDeltaMap(currentExamType);
    container.innerHTML = exams.map(function (exam) {
      return examCardHTML(exam, deltas[exam.id]);
    }).join("");

    updateResultLabel(exams.length, total);
    bindExamActions();
  }

  function updateResultLabel(shown, total) {
    var label = document.getElementById("exam-result-label");
    if (!label) return;
    label.textContent = total === 0
      ? "Kayıt yok"
      : (shown === total ? total + " deneme" : shown + " / " + total + " deneme");
  }

  function examCardHTML(exam, delta) {
    /* Eski kayıtlarda Fen / Sosyal tek satırdı; okurken alt
       derslere dağıtılıyor, toplam net değişmiyor. */
    var subjects = YKS.Subjects.normalizeExamSubjects(exam);
    var maxQuestions = totalQuestions(exam.type);
    var totalNet = Number(exam.totalNet) || 0;

    /* En iyi ve en zayıf ders — netin soru sayısına oranına göre */
    var bestId = null, worstId = null;
    var bestRatio = -Infinity, worstRatio = Infinity;
    subjects.forEach(function (subj) {
      var def = subjectDef(exam.type, subj.id);
      var max = subj.max || (def ? def.max : 0);
      if (!max) return;
      var ratio = (Number(subj.net) || 0) / max;
      if (ratio > bestRatio) { bestRatio = ratio; bestId = subj.id; }
      if (ratio < worstRatio) { worstRatio = ratio; worstId = subj.id; }
    });
    /* Tek ders varsa "en iyi / en zayıf" ayrımı anlamsız */
    if (subjects.length < 2) { bestId = null; worstId = null; }

    var subjectsHTML = subjects.map(function (subj) {
      var cls = "subject-item";
      if (subj.id === bestId) cls += " best";
      else if (subj.id === worstId) cls += " worst";

      var def = subjectDef(exam.type, subj.id);
      var max = subj.max || (def ? def.max : 0);

      return '<div class="' + cls + '" title="' +
          U.escape(subj.name + (max ? " · " + max + " soru" : "")) + '">' +
        '<div class="name">' + U.escape(subj.name) + "</div>" +
        '<div class="net">' + (Number(subj.net) || 0).toFixed(2) + "</div>" +
        '<div class="correct">' +
          (subj.correct || 0) + "D " + (subj.wrong || 0) + "Y " + (subj.blank || 0) + "B" +
        "</div>" +
      "</div>";
    }).join("");

    var deltaHTML = "";
    if (delta !== undefined) {
      var dir = delta > 0.001 ? "up" : (delta < -0.001 ? "down" : "flat");
      var icon = dir === "up" ? "fa-arrow-up" : (dir === "down" ? "fa-arrow-down" : "fa-minus");
      deltaHTML = '<span class="exam-delta ' + dir + '" title="Bir önceki denemeye göre">' +
        '<i class="fa-solid ' + icon + '"></i> ' + signed(delta) +
      "</span>";
    } else {
      deltaHTML = '<span class="exam-delta first" title="Bu tipteki ilk deneme">İlk deneme</span>';
    }

    var notesHTML = exam.notes
      ? '<div class="exam-notes"><strong>Notlar:</strong> ' + U.escape(exam.notes) + "</div>"
      : "";

    var rate = maxQuestions > 0 ? (totalNet / maxQuestions) * 100 : 0;

    return '<div class="exam-card">' +
      '<div class="exam-card-header">' +
        '<div class="exam-card-title">' +
          '<span class="exam-type-badge ' + exam.type + '">' +
            '<i class="fa-solid fa-certificate"></i> ' + String(exam.type).toUpperCase() +
          "</span>" +
          '<div class="exam-card-info">' +
            "<h3>" + U.escape(exam.name) + "</h3>" +
            '<div class="exam-card-meta">' +
              '<span><i class="fa-solid fa-calendar"></i>' + formatDate(exam.date) + "</span>" +
              '<span><i class="fa-solid fa-percent"></i>Başarı %' + rate.toFixed(1) + "</span>" +
              deltaHTML +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="exam-card-actions">' +
          '<button type="button" class="btn-x btn-ghost-x" data-edit="' + exam.id + '" ' +
            'title="Düzenle" aria-label="Denemeyi düzenle">' +
            '<i class="fa-solid fa-pen"></i>' +
          "</button>" +
          '<button type="button" class="btn-x btn-danger-x" data-delete="' + exam.id + '" ' +
            'title="Sil" aria-label="Denemeyi sil">' +
            '<i class="fa-solid fa-trash"></i>' +
          "</button>" +
        "</div>" +
      "</div>" +
      '<div class="exam-card-body">' +
        '<div class="subjects-grid">' + subjectsHTML + "</div>" +
        '<div class="exam-total">' +
          '<span class="label">Toplam Net' +
            (maxQuestions ? ' <span class="faint">/ ' + maxQuestions + " soru</span>" : "") +
          "</span>" +
          '<span class="value">' + totalNet.toFixed(2) + "</span>" +
        "</div>" +
        notesHTML +
      "</div>" +
    "</div>";
  }

  function bindExamActions() {
    U.qsa("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openEditModal(btn.getAttribute("data-edit"));
      });
    });

    U.qsa("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openDeleteModal(btn.getAttribute("data-delete"));
      });
    });
  }

  /* ==========================================================
     7) Ekleme / düzenleme penceresi
     ========================================================== */
  function openAddModal() {
    editingExamId = null;

    document.getElementById("modal-title").innerHTML =
      '<i class="fa-solid fa-plus-circle"></i> Yeni Deneme Ekle';

    var typeSelect = document.getElementById("exam-type");
    typeSelect.value = currentExamType;
    typeSelect.disabled = false;

    document.getElementById("exam-name").value = "";
    /* Varsayılan tarih bugün — en sık girilen değer */
    document.getElementById("exam-date").value = toDateInput(Date.now());
    document.getElementById("exam-notes").value = "";

    renderSubjectInputs(currentExamType);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("exam-modal")).show();
  }

  function openEditModal(id) {
    var exam = currentUser.data.denemeler.find(function (e) { return e.id === id; });
    if (!exam) return YKS.Toast.show("Deneme bulunamadı.", "error");

    editingExamId = id;

    document.getElementById("modal-title").innerHTML =
      '<i class="fa-solid fa-pen"></i> Denemeyi Düzenle';

    var typeSelect = document.getElementById("exam-type");
    typeSelect.value = exam.type;
    /* Tip değişirse ders listesi de değişir; düzenlemede sabit tutulur */
    typeSelect.disabled = true;

    document.getElementById("exam-name").value = exam.name || "";
    document.getElementById("exam-date").value = toDateInput(exam.date);
    document.getElementById("exam-notes").value = exam.notes || "";

    renderSubjectInputs(exam.type, YKS.Subjects.normalizeExamSubjects(exam));
    bootstrap.Modal.getOrCreateInstance(document.getElementById("exam-modal")).show();
  }

  /** Tek bir dersin doğru / yanlış / boş / net satırı */
  function subjectInputHTML(subj, existingData) {
    var existing = existingData
      ? existingData.find(function (s) { return s.id === subj.id; })
      : null;

    var correct = existing ? clampInt(existing.correct, 0, subj.max) : 0;
    var wrong = existing ? clampInt(existing.wrong, 0, subj.max - correct) : 0;
    var blank = subj.max - correct - wrong;
    var net = correct - wrong / 4;

    return '<div class="subject-input-group">' +
      '<span class="subject-label">' +
        '<i class="fa-solid ' + subj.icon + '"></i> ' + U.escape(subj.name) +
        '<span class="faint"> · ' + subj.max + " soru</span></span>" +
      '<div class="subject-inputs">' +
        "<div>" +
          "<label>Doğru</label>" +
          '<input class="input input-small" type="number" inputmode="numeric" min="0" max="' + subj.max + '" ' +
            'data-subject="' + subj.id + '" data-max="' + subj.max + '" data-field="correct" value="' + correct + '" />' +
        "</div>" +
        "<div>" +
          "<label>Yanlış</label>" +
          '<input class="input input-small" type="number" inputmode="numeric" min="0" max="' + subj.max + '" ' +
            'data-subject="' + subj.id + '" data-max="' + subj.max + '" data-field="wrong" value="' + wrong + '" />' +
        "</div>" +
        "<div>" +
          "<label>Boş</label>" +
          '<input class="input input-small" type="text" readonly tabindex="-1" ' +
            'data-subject="' + subj.id + '" data-field="blank" value="' + blank + '" />' +
        "</div>" +
        "<div>" +
          "<label>Net</label>" +
          '<input class="input input-small net-output" type="text" readonly tabindex="-1" ' +
            'data-subject="' + subj.id + '" data-field="net" value="' + net.toFixed(2) + '" />' +
        "</div>" +
      "</div>" +
    "</div>";
  }

  /**
   * Ders girişleri sınavdaki üst başlıklara göre gruplanır:
   * Fen Bilimleri altında Fizik / Kimya / Biyoloji gibi.
   * Tek dersli başlıklarda ayrıca bir başlık satırı çizilmez.
   */
  function renderSubjectInputs(type, existingData) {
    var container = document.getElementById("subjects-container");

    container.innerHTML =
      '<h6 class="subjects-heading">' +
        '<i class="fa-solid fa-book-open"></i> Ders Netleri' +
        '<span class="faint">Boş ve net alanları kendiliğinden hesaplanır</span>' +
      "</h6>" +
      YKS.Subjects.groupsOf(type).map(function (group) {
        var header = group.subjects.length > 1
          ? '<div class="subject-group-head">' +
              "<span>" + U.escape(group.name) + "</span>" +
              '<span class="faint">' + group.max + " soru</span>" +
              '<span class="group-net" data-group-net="' + group.id + '">0.00 net</span>' +
            "</div>"
          : "";

        return '<div class="subject-group' + (header ? " has-head" : "") + '">' +
          header +
          group.subjects.map(function (subj) {
            return subjectInputHTML(subj, existingData);
          }).join("") +
        "</div>";
      }).join("");

    bindNetCalculation();
    updateModalTotals();
  }

  /** Bir dersin girilen değerlerini sınırlara göre okur */
  function readSubject(subj) {
    var correctInput = U.qs('[data-subject="' + subj.id + '"][data-field="correct"]');
    var wrongInput = U.qs('[data-subject="' + subj.id + '"][data-field="wrong"]');

    var correct = clampInt(correctInput ? correctInput.value : 0, 0, subj.max);
    /* Doğru + yanlış toplam soruyu geçemez */
    var wrong = clampInt(wrongInput ? wrongInput.value : 0, 0, subj.max - correct);

    return {
      id: subj.id,
      name: subj.name,
      group: subj.group,
      max: subj.max,
      correct: correct,
      wrong: wrong,
      blank: subj.max - correct - wrong,
      net: correct - wrong / 4
    };
  }

  /** Tüm derslerin okunmuş hali */
  function readAllSubjects(type) {
    return (EXAM_SUBJECTS[type] || []).map(readSubject);
  }

  /** Pencere içindeki canlı toplam şeridi */
  function updateModalTotals() {
    var box = document.getElementById("modal-totals");
    if (!box) return;

    var type = document.getElementById("exam-type").value;
    var rows = readAllSubjects(type);

    var correct = 0, wrong = 0, blank = 0, net = 0;
    rows.forEach(function (r) {
      correct += r.correct;
      wrong += r.wrong;
      blank += r.blank;
      net += r.net;
    });

    var max = totalQuestions(type);
    var rate = max > 0 ? (net / max) * 100 : 0;

    /* Grup alt toplamları (Fen Bilimleri: 12.50 net gibi) */
    var groupNet = {};
    rows.forEach(function (r) {
      var gid = r.group || r.id;
      groupNet[gid] = (groupNet[gid] || 0) + r.net;
    });
    U.qsa("[data-group-net]").forEach(function (el) {
      var gid = el.getAttribute("data-group-net");
      el.textContent = (groupNet[gid] || 0).toFixed(2) + " net";
    });

    box.innerHTML =
      '<div class="modal-total-item"><span class="label">Doğru</span>' +
        '<span class="value ok">' + correct + "</span></div>" +
      '<div class="modal-total-item"><span class="label">Yanlış</span>' +
        '<span class="value bad">' + wrong + "</span></div>" +
      '<div class="modal-total-item"><span class="label">Boş</span>' +
        '<span class="value">' + blank + "</span></div>" +
      '<div class="modal-total-item strong"><span class="label">Toplam Net</span>' +
        '<span class="value">' + net.toFixed(2) + '<small> / ' + max + "</small></span></div>" +
      '<div class="modal-total-item"><span class="label">Başarı</span>' +
        '<span class="value">%' + rate.toFixed(1) + "</span></div>";
  }

  /** Doğru/yanlış alanlarını sınırlar ve boş/net alanlarını günceller */
  function bindNetCalculation() {
    U.qsa("#subjects-container [data-subject][data-field]").forEach(function (input) {
      var field = input.getAttribute("data-field");
      if (field !== "correct" && field !== "wrong") return;

      function recalc() {
        var subjectId = input.getAttribute("data-subject");
        var max = parseInt(input.getAttribute("data-max"), 10) || 0;

        var correctInput = U.qs('[data-subject="' + subjectId + '"][data-field="correct"]');
        var wrongInput = U.qs('[data-subject="' + subjectId + '"][data-field="wrong"]');
        var blankInput = U.qs('[data-subject="' + subjectId + '"][data-field="blank"]');
        var netInput = U.qs('[data-subject="' + subjectId + '"][data-field="net"]');

        var correct = clampInt(correctInput.value, 0, max);
        var wrong = clampInt(wrongInput.value, 0, max);

        /* Toplam soruyu aşan girişte, o an yazılmayan alan geri çekilir */
        if (correct + wrong > max) {
          if (field === "correct") {
            wrong = max - correct;
            wrongInput.value = wrong;
          } else {
            correct = max - wrong;
            correctInput.value = correct;
          }
        }

        /* Negatif ya da sınır dışı değer yazıldıysa alanı düzelt */
        if (String(correct) !== correctInput.value) correctInput.value = correct;
        if (String(wrong) !== wrongInput.value) wrongInput.value = wrong;

        var net = correct - wrong / 4;
        blankInput.value = max - correct - wrong;
        netInput.value = net.toFixed(2);
        netInput.classList.toggle("negative", net < 0);

        updateModalTotals();
      }

      input.addEventListener("input", recalc);
      /* Alandan çıkarken de düzelt: boş bırakılan ya da yapıştırılan
         değerler "input" olayını her tarayıcıda tetiklemiyor. */
      input.addEventListener("change", recalc);
      input.addEventListener("blur", recalc);
    });
  }

  /* ==========================================================
     8) Kaydetme
     ========================================================== */
  function saveExam() {
    var type = document.getElementById("exam-type").value;
    var name = document.getElementById("exam-name").value.trim();
    var dateStr = document.getElementById("exam-date").value;
    var notes = document.getElementById("exam-notes").value.trim();

    if (!name) return YKS.Toast.show("Deneme adı gerekli.", "error");
    if (!dateStr) return YKS.Toast.show("Deneme tarihi gerekli.", "error");

    var date = fromDateInput(dateStr);
    if (isNaN(date)) return YKS.Toast.show("Geçerli bir tarih seç.", "error");

    var subjects = readAllSubjects(type);
    var totalNet = subjects.reduce(function (sum, subj) { return sum + subj.net; }, 0);

    /* Hiçbir şey girilmemişse boş kayıt oluşturmayalım */
    var answered = subjects.reduce(function (sum, subj) { return sum + subj.correct + subj.wrong; }, 0);
    if (answered === 0) {
      return YKS.Toast.show("En az bir derse doğru veya yanlış gir.", "error");
    }

    var examData = {
      type: type,
      name: name,
      date: date,
      notes: notes,
      subjects: subjects,
      totalNet: totalNet,
      /* Ders şeması sürümü — okurken eski kayıtlardan ayırt etmek için */
      v: YKS.Subjects.schemaVersion
    };

    if (editingExamId) {
      var index = currentUser.data.denemeler.findIndex(function (e) { return e.id === editingExamId; });
      if (index === -1) return YKS.Toast.show("Deneme bulunamadı.", "error");

      var previous = currentUser.data.denemeler[index];
      examData.id = editingExamId;
      examData.createdAt = previous.createdAt || Date.now();
      examData.updatedAt = Date.now();
      currentUser.data.denemeler[index] = examData;
    } else {
      examData.id = U.uid("exam");
      examData.createdAt = Date.now();
      examData.updatedAt = Date.now();
      currentUser.data.denemeler.push(examData);
    }

    var result = saveExams();
    if (!result.ok) {
      /* Yazılamadıysa bellekteki listeyi kayıttan tazeleyip geri al */
      var restored = YKS.Auth.currentUser();
      if (restored) currentUser = restored;
      return YKS.Toast.show(result.error || "Kaydedilemedi.", "error");
    }

    YKS.Toast.show(editingExamId ? "Deneme güncellendi." : "Deneme eklendi.", "ok");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("exam-modal")).hide();

    /* Kaydedilen deneme hangi tipteyse o sekmeye geç */
    if (type !== currentExamType) {
      switchTab(type);
      updateTabCounts();
      return;
    }

    updateTabCounts();
    renderStats();
    renderExamsList();
  }

  /* ==========================================================
     9) Silme
     ========================================================== */
  function openDeleteModal(id) {
    var exam = currentUser.data.denemeler.find(function (e) { return e.id === id; });
    if (!exam) return;

    deleteExamId = id;

    var nameEl = document.getElementById("delete-exam-name");
    if (nameEl) nameEl.textContent = exam.name + " · " + formatDate(exam.date);

    bootstrap.Modal.getOrCreateInstance(document.getElementById("delete-modal")).show();
  }

  function deleteExam() {
    if (!deleteExamId) return;

    currentUser.data.denemeler = currentUser.data.denemeler.filter(function (e) {
      return e.id !== deleteExamId;
    });

    var result = saveExams();
    if (!result.ok) {
      var restored = YKS.Auth.currentUser();
      if (restored) currentUser = restored;
      return YKS.Toast.show(result.error || "Silinemedi.", "error");
    }

    YKS.Toast.show("Deneme silindi.", "ok");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("delete-modal")).hide();

    deleteExamId = null;
    updateTabCounts();
    renderStats();
    renderExamsList();
  }

  /* ==========================================================
     10) CSV dışa aktarma
     ----------------------------------------------------------
     Ayraç olarak noktalı virgül kullanılır; Türkçe Excel
     kurulumları virgülü ondalık ayracı saydığı için sütunları
     doğru ayırmanın en güvenli yolu bu.
     ========================================================== */
  function exportCsv() {
    var exams = allExamsOfType(currentExamType).slice().sort(function (a, b) {
      return a.date - b.date;
    });

    if (!exams.length) {
      return YKS.Toast.show("Bu sekmede dışa aktarılacak deneme yok.", "warn");
    }

    var subjects = EXAM_SUBJECTS[currentExamType] || [];

    function cell(value) {
      var text = String(value == null ? "" : value);
      return '"' + text.replace(/"/g, '""') + '"';
    }
    function num(value) {
      /* Ondalık ayracı virgül — Türkçe Excel böyle bekliyor */
      return cell((Number(value) || 0).toFixed(2).replace(".", ","));
    }

    var header = ["Tarih", "Deneme"];
    subjects.forEach(function (subj) {
      header.push(subj.name + " D", subj.name + " Y", subj.name + " Net");
    });
    header.push("Toplam Net", "Not");

    var rows = exams.map(function (exam) {
      var byId = {};
      YKS.Subjects.normalizeExamSubjects(exam).forEach(function (s) { byId[s.id] = s; });

      var row = [cell(toDateInput(exam.date)), cell(exam.name)];
      subjects.forEach(function (subj) {
        var s = byId[subj.id];
        row.push(cell(s ? s.correct : 0), cell(s ? s.wrong : 0), num(s ? s.net : 0));
      });
      row.push(num(exam.totalNet), cell(exam.notes || ""));
      return row.join(";");
    });

    /* BOM: Excel dosyayı UTF-8 olarak açsın, Türkçe karakterler bozulmasın */
    var csv = "\uFEFF" + header.map(cell).join(";") + "\r\n" + rows.join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = "denemeler-" + currentExamType + "-" + toDateInput(Date.now()) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    YKS.Toast.show(exams.length + " deneme dışa aktarıldı.", "ok");
  }

  /* ==========================================================
     11) Araç çubuğu
     ========================================================== */
  function bindToolbar() {
    var search = document.getElementById("exam-search");
    if (search) {
      search.addEventListener("input", U.debounce(function () {
        searchQuery = search.value.trim();
        renderExamsList();
      }, 180));
    }

    var sort = document.getElementById("exam-sort");
    if (sort) {
      sort.addEventListener("change", function () {
        sortMode = sort.value;
        renderExamsList();
      });
    }

    var csv = document.getElementById("export-csv-btn");
    if (csv) csv.addEventListener("click", exportCsv);
  }

  /* ==========================================================
     12) Navigasyon ve olaylar
     ========================================================== */
  function bindNavigation() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = YKS.Auth.isAdmin() ? "admin.html" : "index.html";
    });
  }

  function bindEvents() {
    document.getElementById("add-exam-btn").addEventListener("click", openAddModal);
    document.getElementById("save-exam-btn").addEventListener("click", saveExam);
    document.getElementById("confirm-delete-btn").addEventListener("click", deleteExam);

    document.getElementById("exam-type").addEventListener("change", function () {
      renderSubjectInputs(this.value);
    });

    /* Pencere kapanınca düzenleme durumunu bırak */
    document.getElementById("exam-modal").addEventListener("hidden.bs.modal", function () {
      editingExamId = null;
    });
    document.getElementById("delete-modal").addEventListener("hidden.bs.modal", function () {
      deleteExamId = null;
    });

    /* Deneme adı alanında Enter kaydetsin */
    document.getElementById("exam-form").addEventListener("submit", function (e) {
      e.preventDefault();
      saveExam();
    });
  }

  /* ==========================================================
     13) Başlangıç
     ========================================================== */
  YKS.hazir(function () {
    /* Oturum uygun değilse hiçbir şey bağlanmaz; aksi hâlde
       aşağıdaki çizimler null kullanıcı üzerinde patlar. */
    if (!loadUser()) return;

    bindTabs();
    bindNavigation();
    bindEvents();
    bindToolbar();

    updateTabCounts();
    renderStats();
    renderExamsList();
  });

})(window, document);
