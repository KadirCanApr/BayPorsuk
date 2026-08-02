/* ============================================================
   Aksiyom — progress.js
   ------------------------------------------------------------
   Ders Başarı Takip modülü:
     • Toplam net gelişim grafiği (SVG, harici kütüphane yok)
     • Ders bazlı net gelişimi, trend ve gelişim analizi
     • Özet kartları: en çok gelişen / gerileyen ders
     • Aralık (son 5 / son 10 / tümü) ve sıralama seçenekleri
     • Detaylı istatistik tablosu
   Veriler exams.js ile aynı kaynaktan okunur: user.data.denemeler
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     0) Sabitler
     ========================================================== */
  /* Ortak ders kataloğu script.js içinde tanımlı */
  var EXAM_SUBJECTS = YKS.Subjects.byType;

  var TYPE_LABELS = { tyt: "TYT", ayt: "AYT", kpss: "KPSS" };

  /* ==========================================================
     1) Durum
     ========================================================== */
  var currentUser = null;
  var currentExamType = "tyt";
  var rangeMode = "all";     /* "all" | "5" | "10" */
  var sortMode = "default";  /* "default" | "improvement" | "average" */

  /* ==========================================================
     2) Küçük yardımcılar
     ========================================================== */
  function formatDate(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }

  /** Grafik ekseni için kısa tarih: "29.07" */
  function shortDate(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2);
  }

  function signed(value, digits) {
    var n = Number(value) || 0;
    return (n >= 0 ? "+" : "") + n.toFixed(digits === undefined ? 2 : digits);
  }

  function average(list) {
    if (!list.length) return 0;
    return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
  }

  function totalQuestions(type) {
    return (EXAM_SUBJECTS[type] || []).reduce(function (sum, s) { return sum + s.max; }, 0);
  }

  /* ==========================================================
     3) Kullanıcı ve veri erişimi
     ========================================================== */

  /** @returns {boolean} sayfa çizilmeye devam etsin mi */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = YKS.Auth.currentUser();

    /* Yönetim kodu ile açılan kurucu oturumunun kişisel kaydı yok;
       deneme verisi kullanıcı hesabında tutulduğu için modül çalışamaz. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    if (!currentUser.data || typeof currentUser.data !== "object") {
      currentUser.data = {};
    }
    if (!Array.isArray(currentUser.data.denemeler)) {
      currentUser.data.denemeler = [];
    }
    return true;
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".progress-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-progress">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim kodu ile açılmış kurucu oturumundasın. Ders başarı takibi kullanıcı hesabına bağlı deneme verisinden üretilir; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  /**
   * Seçili tipin denemeleri — eskiden yeniye, aralık uygulanmış.
   * Dersler güncel kataloğa göre okunur: eski kayıtlardaki
   * "Fen Bilimleri" gibi toplu satırlar alt derslere dağıtılır,
   * böylece geçmiş veriler de Fizik / Kimya / Biyoloji kırılımında
   * grafiklere düşer.
   */
  function getUserExams(type) {
    var list = currentUser.data.denemeler
      .filter(function (exam) { return exam && exam.type === type; })
      .sort(function (a, b) { return a.date - b.date; });

    if (rangeMode !== "all") {
      var n = parseInt(rangeMode, 10);
      if (!isNaN(n) && list.length > n) list = list.slice(-n);
    }

    return list.map(function (exam) {
      return {
        id: exam.id,
        name: exam.name,
        date: exam.date,
        type: exam.type,
        totalNet: exam.totalNet,
        subjects: YKS.Subjects.normalizeExamSubjects(exam)
      };
    });
  }

  /** Seçili tipteki toplam deneme sayısı (aralıktan bağımsız) */
  function totalExamCount(type) {
    return currentUser.data.denemeler.filter(function (exam) {
      return exam && exam.type === type;
    }).length;
  }

  /* ==========================================================
     4) Sekmeler ve araç çubuğu
     ========================================================== */
  function switchTab(type) {
    currentExamType = type;

    U.qsa(".exam-tab").forEach(function (tab) {
      var isActive = tab.getAttribute("data-type") === type;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    renderProgress();
  }

  function bindTabs() {
    U.qsa(".exam-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab.getAttribute("data-type"));
      });
    });
  }

  function bindToolbar() {
    var range = document.getElementById("range-select");
    if (range) {
      range.addEventListener("change", function () {
        rangeMode = range.value;
        renderProgress();
      });
    }

    var sort = document.getElementById("sort-select");
    if (sort) {
      sort.addEventListener("change", function () {
        sortMode = sort.value;
        renderProgress();
      });
    }
  }

  function updateTabCounts() {
    ["tyt", "ayt", "kpss"].forEach(function (type) {
      var el = document.getElementById(type + "-count");
      if (el) el.textContent = totalExamCount(type);
    });
  }

  /* ==========================================================
     5) Ders bazlı analiz
     ========================================================== */

  /**
   * Bir dersin denemeler boyunca gidişatını çıkarır.
   * @param exams eskiden yeniye sıralı deneme listesi
   */
  function analyzeSubjectProgress(subjectId, exams) {
    var entries = [];

    exams.forEach(function (exam) {
      var subjects = Array.isArray(exam.subjects) ? exam.subjects : [];
      var subject = subjects.filter(function (s) { return s.id === subjectId; })[0];
      if (!subject) return;
      entries.push({
        net: Number(subject.net) || 0,
        correct: subject.correct || 0,
        wrong: subject.wrong || 0,
        blank: subject.blank || 0,
        name: exam.name || "Deneme",
        date: exam.date
      });
    });

    var nets = entries.map(function (e) { return e.net; });

    if (!nets.length) {
      return {
        count: 0, entries: [], nets: [],
        average: 0, best: 0, worst: 0, first: 0, last: 0,
        diff: 0, trend: "neutral", trendValue: 0
      };
    }

    var first = nets[0];
    var last = nets[nets.length - 1];

    /* Trend: son k denemenin ortalaması, ondan önceki k denemeye karşı.
       Tek bir denemeye bakmak gürültülü; k en fazla 3 tutulur. */
    var trend = "neutral";
    var trendValue = 0;
    var k = Math.min(3, Math.floor(nets.length / 2));
    if (k >= 1) {
      var recent = average(nets.slice(-k));
      var older = average(nets.slice(-2 * k, -k));
      trendValue = recent - older;
      if (trendValue > 0.5) trend = "up";
      else if (trendValue < -0.5) trend = "down";
    }

    return {
      count: nets.length,
      entries: entries,
      nets: nets,
      average: average(nets),
      best: Math.max.apply(null, nets),
      worst: Math.min.apply(null, nets),
      first: first,
      last: last,
      /* Gelişim yüzde değil net farkı olarak tutulur: ilk deneme 0 ya da
         eksi net olduğunda yüzde hesabı yanıltıcı (hatta ters) çıkıyor. */
      diff: last - first,
      trend: trend,
      trendValue: trendValue
    };
  }

  /* ==========================================================
     6) Toplam net gelişim grafiği (SVG)
     ========================================================== */
  function renderNetChart(exams) {
    var nets = exams.map(function (e) { return Number(e.totalNet) || 0; });

    var W = 820, H = 300;
    var padL = 54, padR = 20, padT = 26, padB = 52;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    var min = Math.min.apply(null, nets);
    var max = Math.max.apply(null, nets);

    /* Tüm değerler aynıysa düz bir çizgi çıkar; ekseni yapay olarak aç */
    if (max - min < 1) { max += 0.5; min -= 0.5; }
    var breathe = (max - min) * 0.12;
    min -= breathe;
    max += breathe;
    var span = max - min || 1;

    function px(i) {
      if (exams.length === 1) return padL + innerW / 2;
      return padL + (i / (exams.length - 1)) * innerW;
    }
    function py(value) {
      return padT + innerH - ((value - min) / span) * innerH;
    }

    /* Yatay ızgara ve değer etiketleri */
    var gridHTML = "";
    var levels = 4;
    for (var g = 0; g <= levels; g++) {
      var value = min + (span * g) / levels;
      var y = py(value);
      gridHTML +=
        '<line class="grid-line" x1="' + padL + '" y1="' + y.toFixed(1) +
          '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" />' +
        '<text class="axis-label" x="' + (padL - 10) + '" y="' + (y + 4).toFixed(1) +
          '" text-anchor="end">' + value.toFixed(1) + "</text>";
    }

    /* Sıfır çizgisi — eksi netler varsa referans olsun */
    var zeroHTML = "";
    if (min < 0 && max > 0) {
      zeroHTML = '<line class="zero-line" x1="' + padL + '" y1="' + py(0).toFixed(1) +
        '" x2="' + (W - padR) + '" y2="' + py(0).toFixed(1) + '" />';
    }

    var points = exams.map(function (exam, i) {
      return px(i).toFixed(1) + "," + py(nets[i]).toFixed(1);
    });

    var areaHTML = "", lineHTML = "";
    if (points.length > 1) {
      var baseline = (padT + innerH).toFixed(1);
      areaHTML = '<path class="net-area" d="M' + points[0] +
        " L" + points.slice(1).join(" L") +
        " L" + px(exams.length - 1).toFixed(1) + "," + baseline +
        " L" + px(0).toFixed(1) + "," + baseline + ' Z" />';
      lineHTML = '<polyline class="net-line" points="' + points.join(" ") + '" />';
    }

    var dotsHTML = exams.map(function (exam, i) {
      return '<g class="net-dot">' +
        '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(nets[i]).toFixed(1) + '" r="5" />' +
        "<title>" + U.escape(exam.name || "Deneme") + " — " + formatDate(exam.date) +
          "&#10;" + nets[i].toFixed(2) + " net</title>" +
      "</g>";
    }).join("");

    /* X ekseninde en fazla 6 etiket; kalabalıkta okunmuyor */
    var step = Math.max(1, Math.ceil(exams.length / 6));
    var xLabels = exams.map(function (exam, i) {
      if (i % step !== 0 && i !== exams.length - 1) return "";
      return '<text class="axis-label" x="' + px(i).toFixed(1) + '" y="' + (H - padB + 26) +
        '" text-anchor="middle">' + shortDate(exam.date) + "</text>";
    }).join("");

    var totalMax = totalQuestions(currentExamType);
    var avgNet = average(nets);

    return '<div class="net-chart-card">' +
      '<div class="net-chart-head">' +
        "<h3><i class=\"fa-solid fa-chart-area\"></i> Toplam Net Gelişimi</h3>" +
        '<div class="net-chart-meta">' +
          "<span>" + exams.length + " deneme · " + (TYPE_LABELS[currentExamType] || "") + "</span>" +
          "<span>Ortalama <strong>" + avgNet.toFixed(2) + "</strong>" +
            (totalMax ? " / " + totalMax : "") + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="net-chart-body">' +
        '<svg class="net-chart" viewBox="0 0 ' + W + " " + H + '" ' +
             'role="img" aria-label="Toplam net gelişim grafiği">' +
          "<defs>" +
            '<linearGradient id="netAreaFill" x1="0" y1="0" x2="0" y2="1">' +
              '<stop offset="0%" stop-color="#5b6cff" stop-opacity="0.38" />' +
              '<stop offset="100%" stop-color="#a259ff" stop-opacity="0.02" />' +
            "</linearGradient>" +
          "</defs>" +
          gridHTML + zeroHTML + areaHTML + lineHTML + dotsHTML + xLabels +
        "</svg>" +
      "</div>" +
    "</div>";
  }

  /* ==========================================================
     7) Özet kartları
     ========================================================== */
  function renderSummary(subjects, exams) {
    var nets = exams.map(function (e) { return Number(e.totalNet) || 0; });
    var avg = average(nets);
    var lastNet = nets[nets.length - 1];
    var totalDiff = nets.length > 1 ? lastNet - nets[0] : null;

    /* En çok gelişen ve gerileyen ders */
    var rising = null, falling = null;
    subjects.forEach(function (subject) {
      var analysis = analyzeSubjectProgress(subject.id, exams);
      if (analysis.count < 2) return;
      if (!rising || analysis.diff > rising.diff) {
        rising = { name: subject.name, icon: subject.icon, diff: analysis.diff };
      }
      if (!falling || analysis.diff < falling.diff) {
        falling = { name: subject.name, icon: subject.icon, diff: analysis.diff };
      }
    });

    function card(icon, label, value, note, tone) {
      return '<div class="summary-card' + (tone ? " " + tone : "") + '">' +
        '<i class="summary-icon fa-solid ' + icon + '"></i>' +
        '<div class="summary-label">' + label + "</div>" +
        '<div class="summary-value">' + value + "</div>" +
        (note ? '<div class="summary-note">' + note + "</div>" : "") +
      "</div>";
    }

    var diffNote = totalDiff === null
      ? "İlk denemen"
      : "İlk denemeye göre " + signed(totalDiff) + " net";

    var risingCard = rising
      ? card("fa-arrow-trend-up", "En Çok Gelişen", U.escape(rising.name),
             signed(rising.diff) + " net", rising.diff >= 0 ? "positive" : "negative")
      : card("fa-arrow-trend-up", "En Çok Gelişen", "—", "En az 2 deneme gerekli");

    var fallingCard = falling
      ? card("fa-arrow-trend-down", "En Çok Gerileyen", U.escape(falling.name),
             signed(falling.diff) + " net", falling.diff >= 0 ? "positive" : "negative")
      : card("fa-arrow-trend-down", "En Çok Gerileyen", "—", "En az 2 deneme gerekli");

    return '<div class="summary-grid">' +
      card("fa-clipboard-list", "Deneme", String(exams.length),
           rangeMode === "all" ? "Tümü" : "Son " + rangeMode) +
      card("fa-chart-simple", "Ortalama Toplam Net", avg.toFixed(2), diffNote) +
      risingCard +
      fallingCard +
    "</div>";
  }

  /* ==========================================================
     8) Ders kartları
     ========================================================== */
  function renderSubjectCard(subject, exams) {
    var analysis = analyzeSubjectProgress(subject.id, exams);

    if (analysis.count === 0) {
      return '<div class="subject-progress-card is-empty">' +
        '<div class="subject-progress-header">' +
          "<h3><i class=\"fa-solid " + subject.icon + '"></i> ' + U.escape(subject.name) + "</h3>" +
          '<div class="subject-stats">Bu derste veri yok</div>' +
        "</div>" +
      "</div>";
    }

    var trendIcon = analysis.trend === "up" ? "fa-arrow-trend-up" :
                    analysis.trend === "down" ? "fa-arrow-trend-down" : "fa-minus";
    var trendText = analysis.trend === "up" ? "Yükseliş" :
                    analysis.trend === "down" ? "Düşüş" : "Stabil";
    /* CSS "stable" sınıfını renklendiriyor; "neutral" karşılığı odur */
    var trendClass = analysis.trend === "neutral" ? "stable" : analysis.trend;

    /*
      Çubuk yüksekliği: ölçek tepe değere değil, [taban, tepe] aralığına
      göre kurulur. Böylece tüm netler 0 olduğunda 0/0 = NaN çıkmaz ve
      eksi netler ters yöne taşmaz.
    */
    var top = Math.max(analysis.best, 0);
    var bottom = Math.min(analysis.worst, 0);
    var range = top - bottom;
    if (range < 0.001) range = 1;

    var chartHTML = '<div class="progress-chart">';
    analysis.entries.forEach(function (entry, index) {
      var height = ((entry.net - bottom) / range) * 100;
      if (!isFinite(height)) height = 0;
      height = Math.max(3, Math.min(100, height));

      var barClass = "neutral";
      if (index > 0) {
        var prev = analysis.nets[index - 1];
        if (entry.net > prev) barClass = "positive";
        else if (entry.net < prev) barClass = "negative";
      }

      var tip = entry.name + " — " + formatDate(entry.date) + " · " +
        entry.net.toFixed(2) + " net (" + entry.correct + "D " + entry.wrong + "Y " + entry.blank + "B)";

      chartHTML += '<div class="chart-bar ' + barClass + '" style="height:' + height.toFixed(1) + '%" ' +
        'title="' + U.escape(tip) + '">' +
        '<span class="chart-bar-value">' + entry.net.toFixed(1) + "</span>" +
      "</div>";
    });
    chartHTML += "</div>";

    var diffTone = analysis.diff > 0.001 ? "positive" :
                   (analysis.diff < -0.001 ? "negative" : "neutral");

    var maxNet = subject.max || 0;
    var rate = maxNet ? (analysis.last / maxNet) * 100 : null;

    return '<div class="subject-progress-card">' +
      '<div class="subject-progress-header">' +
        "<h3><i class=\"fa-solid " + subject.icon + '"></i> ' + U.escape(subject.name) + "</h3>" +
        '<div class="subject-stats">' +
          "<span>" + analysis.count + " deneme</span>" +
          (maxNet ? "<span>" + maxNet + " soru</span>" : "") +
          (rate !== null ? "<span>Son: %" + rate.toFixed(0) + "</span>" : "") +
        "</div>" +
      "</div>" +
      '<div class="subject-progress-body">' +
        chartHTML +
        '<div class="progress-stats-row">' +
          '<div class="progress-stat-item neutral">' +
            '<div class="label">Ortalama</div>' +
            '<div class="value">' + analysis.average.toFixed(2) + "</div>" +
          "</div>" +
          '<div class="progress-stat-item neutral">' +
            '<div class="label">En İyi</div>' +
            '<div class="value">' + analysis.best.toFixed(2) + "</div>" +
          "</div>" +
          '<div class="progress-stat-item ' + diffTone + '">' +
            '<div class="label">Gelişim</div>' +
            '<div class="value">' + signed(analysis.diff) + "</div>" +
          "</div>" +
        "</div>" +
        '<div class="progress-trend ' + trendClass + '">' +
          '<i class="fa-solid ' + trendIcon + '"></i>' +
          "<span>" + trendText + ": " + signed(analysis.trendValue) + " net</span>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  /* ==========================================================
     9) Detay tablosu
     ========================================================== */
  function renderDetailTable(subjects, exams) {
    var tableRows = subjects.map(function (subject) {
      var analysis = analyzeSubjectProgress(subject.id, exams);

      if (analysis.count === 0) {
        return "<tr>" +
          "<td>" + U.escape(subject.name) + "</td>" +
          "<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>" +
        "</tr>";
      }

      var trendIcon = analysis.trend === "up" ? "fa-arrow-up" :
                      analysis.trend === "down" ? "fa-arrow-down" : "fa-minus";
      var trendClass = analysis.trend === "neutral" ? "neutral" : analysis.trend;
      var diffClass = analysis.diff > 0.001 ? "up" :
                      (analysis.diff < -0.001 ? "down" : "neutral");

      return "<tr>" +
        "<td><strong>" + U.escape(subject.name) + "</strong></td>" +
        "<td>" + analysis.count + "</td>" +
        "<td>" + analysis.average.toFixed(2) + "</td>" +
        "<td>" + analysis.best.toFixed(2) + "</td>" +
        "<td>" + analysis.worst.toFixed(2) + "</td>" +
        "<td>" + analysis.last.toFixed(2) + "</td>" +
        '<td class="trend-cell ' + diffClass + '">' +
          '<i class="fa-solid ' + trendIcon + '"></i>' + signed(analysis.diff) +
        "</td>" +
      "</tr>";
    }).join("");

    return '<div class="progress-table">' +
      '<div class="progress-table-header">' +
        "<h3><i class=\"fa-solid fa-table\"></i> Detaylı İstatistikler</h3>" +
      "</div>" +
      '<div class="progress-table-body">' +
        "<table>" +
          "<thead><tr>" +
            "<th>Ders</th><th>Deneme</th><th>Ortalama</th>" +
            "<th>En İyi</th><th>En Kötü</th><th>Son</th><th>Gelişim</th>" +
          "</tr></thead>" +
          "<tbody>" + tableRows + "</tbody>" +
        "</table>" +
      "</div>" +
    "</div>";
  }

  /* ==========================================================
     10) Ana çizim
     ========================================================== */
  function renderProgress() {
    var container = document.getElementById("progress-content");
    if (!container) return;

    var exams = getUserExams(currentExamType);
    updateTabCounts();

    if (!exams.length) {
      container.innerHTML =
        '<div class="empty-progress">' +
          '<i class="fa-solid fa-chart-line"></i>' +
          "<h3>Bu sekmede deneme yok</h3>" +
          "<p>" + (TYPE_LABELS[currentExamType] || "") +
            " denemesi ekledikçe gelişim grafiğin burada oluşur.</p>" +
          '<a href="exams.html" class="btn-x btn-primary-x">' +
            '<i class="fa-solid fa-plus"></i> Deneme Ekle' +
          "</a>" +
        "</div>";
      return;
    }

    var subjects = (EXAM_SUBJECTS[currentExamType] || []).slice();

    /* Kartları sıralama — zayıf tarafı öne çıkarmak için */
    if (sortMode === "improvement" || sortMode === "average") {
      var scored = subjects.map(function (subject) {
        var analysis = analyzeSubjectProgress(subject.id, exams);
        return {
          subject: subject,
          hasData: analysis.count > 0,
          score: sortMode === "improvement" ? analysis.diff : analysis.average
        };
      });
      scored.sort(function (a, b) {
        /* Verisi olmayan dersler her zaman sona */
        if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
        return b.score - a.score;
      });
      subjects = scored.map(function (item) { return item.subject; });
    }

    var noticeHTML = "";
    if (exams.length === 1) {
      noticeHTML =
        '<div class="progress-notice">' +
          '<i class="fa-solid fa-circle-info"></i>' +
          "<span>Tek deneme var. Gelişim ve trend hesabı için en az 2 deneme gerekiyor; " +
          "şimdilik mevcut netlerini görüyorsun.</span>" +
        "</div>";
    }

    container.innerHTML =
      noticeHTML +
      renderSummary(subjects, exams) +
      renderNetChart(exams) +
      '<div class="subjects-progress-grid">' +
        subjects.map(function (subject) {
          return renderSubjectCard(subject, exams);
        }).join("") +
      "</div>" +
      renderDetailTable(subjects, exams);
  }

  /* ==========================================================
     11) Navigasyon
     ========================================================== */
  function bindNavigation() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = YKS.Auth.isAdmin() ? "admin.html" : "index.html";
    });
  }

  /* ==========================================================
     12) Başlangıç
     ========================================================== */
  YKS.hazir(function () {
    if (!loadUser()) return;

    bindTabs();
    bindToolbar();
    bindNavigation();

    renderProgress();
  });

})(window, document);
