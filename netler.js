/* ============================================================
   Aksiyom — netler.js
   ------------------------------------------------------------
   TYT / AYT Netleri modülü:
     • Denemelerden gelen ders ders net dökümü (tablo)
     • Sınav türüne göre ayrı listeleme: TYT / AYT / KPSS
     • Ders bazlı ortalama, en iyi, son deneme farkı
     • Arama, aralık, sıralama ve CSV dışa aktarma

   Veri exams.js ile aynı kaynaktan okunur: user.data.denemeler
   Bu modül yalnızca okur; deneme girişi exams.html üzerinden.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     1) DURUM
     ========================================================== */
  var currentUser = null;
  var currentType = "tyt";

  var searchQuery = "";
  var rangeMode = "all";        /* all | 10 | 5 */
  var sortMode = "date-desc";

  /* ==========================================================
     2) YARDIMCILAR
     ========================================================== */

  /** Net değerini Türkçe ondalık ayracıyla yazar */
  function fmt(value) {
    return (Number(value) || 0).toFixed(2).replace(".", ",");
  }

  function signedFmt(value) {
    var n = Number(value) || 0;
    return (n > 0 ? "+" : "") + fmt(n);
  }

  function shortDate(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
  }

  function toDateInput(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
      ("0" + d.getDate()).slice(-2);
  }

  function average(list) {
    if (!list.length) return 0;
    return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
  }

  /* ==========================================================
     3) KULLANICI VE VERİ
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = YKS.Auth.currentUser();

    /* Kurucu oturumunun kişisel kaydı yok; netler deneme
       verisinden üretildiği için modül çalışamaz. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
    if (!Array.isArray(currentUser.data.denemeler)) currentUser.data.denemeler = [];
    return true;
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".nets-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-nets">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim koduyla açılmış kurucu oturumundasın. Netler kullanıcı hesabına bağlı deneme verisinden üretilir; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  /** Bir türün tüm denemeleri — eskiden yeniye, dersleri güncel kataloğa göre */
  function examsOfType(type) {
    return currentUser.data.denemeler
      .filter(function (e) { return e && e.type === type; })
      .sort(function (a, b) { return a.date - b.date; })
      .map(function (exam) {
        return {
          id: exam.id,
          name: exam.name,
          date: exam.date,
          type: exam.type,
          notes: exam.notes || "",
          totalNet: Number(exam.totalNet) || 0,
          subjects: YKS.Subjects.normalizeExamSubjects(exam)
        };
      });
  }

  /** Arama, aralık ve sıralama uygulanmış liste */
  function visibleExams() {
    var list = examsOfType(currentType);

    /* Aralık her zaman en yeni denemelerden sayılır */
    if (rangeMode !== "all") {
      var n = parseInt(rangeMode, 10);
      if (!isNaN(n) && list.length > n) list = list.slice(-n);
    }

    if (searchQuery) {
      list = list.filter(function (e) {
        return (e.name || "").toLocaleLowerCase("tr").indexOf(searchQuery) !== -1;
      });
    }

    var sorted = list.slice();
    if (sortMode === "date-desc") sorted.sort(function (a, b) { return b.date - a.date; });
    if (sortMode === "date-asc") sorted.sort(function (a, b) { return a.date - b.date; });
    if (sortMode === "net-desc") sorted.sort(function (a, b) { return b.totalNet - a.totalNet; });
    if (sortMode === "net-asc") sorted.sort(function (a, b) { return a.totalNet - b.totalNet; });

    return sorted;
  }

  /* ==========================================================
     4) İSTATİSTİK KARTLARI
     ========================================================== */
  function renderTabCounts() {
    ["tyt", "ayt", "kpss"].forEach(function (type) {
      var el = document.querySelector('[data-count="' + type + '"]');
      if (el) {
        el.textContent = currentUser.data.denemeler.filter(function (e) {
          return e && e.type === type;
        }).length;
      }
    });
  }

  function renderStats() {
    var host = document.getElementById("net-stats");
    var chrono = examsOfType(currentType);          /* eskiden yeniye, süzgeçsiz */
    var label = YKS.Subjects.typeLabel(currentType);
    var maxQuestions = YKS.Subjects.totalQuestions(currentType);

    if (!chrono.length) {
      host.innerHTML = "";
      document.getElementById("header-sub").textContent =
        label + " için henüz deneme girilmemiş.";
      return;
    }

    var nets = chrono.map(function (e) { return e.totalNet; });
    var avg = average(nets);

    var best = chrono.reduce(function (acc, e) {
      return (!acc || e.totalNet > acc.totalNet) ? e : acc;
    }, null);

    var last = chrono[chrono.length - 1];
    var prev = chrono.length > 1 ? chrono[chrono.length - 2] : null;
    var delta = prev ? last.totalNet - prev.totalNet : 0;

    var deltaClass = !prev ? "flat" : (delta > 0 ? "up" : (delta < 0 ? "down" : "flat"));
    var deltaIcon = deltaClass === "up" ? "fa-arrow-trend-up"
      : (deltaClass === "down" ? "fa-arrow-trend-down" : "fa-minus");

    var successPct = maxQuestions ? Math.round((avg / maxQuestions) * 100) : 0;

    var cards = [
      {
        label: "Deneme sayısı",
        value: String(chrono.length),
        icon: "fa-clipboard-list",
        note: label + " denemesi",
        extra: ""
      },
      {
        label: "Ortalama net",
        value: fmt(avg) + "<small> / " + maxQuestions + "</small>",
        icon: "fa-calculator",
        note: "%" + successPct + " başarı",
        extra: ""
      },
      {
        label: "En yüksek net",
        value: fmt(best.totalNet),
        icon: "fa-trophy",
        note: best.name,
        extra: ""
      },
      {
        label: "Son deneme",
        value: fmt(last.totalNet),
        icon: "fa-flag-checkered",
        note: shortDate(last.date) + " · " + last.name,
        extra: '<span class="stat-delta ' + deltaClass + '">' +
          '<i class="fa-solid ' + deltaIcon + '"></i>' +
          (prev ? signedFmt(delta) + " net" : "ilk deneme") + "</span>"
      }
    ];

    host.innerHTML = cards.map(function (c) {
      return '<div class="net-stat-card">' +
        '<i class="stat-icon fa-solid ' + c.icon + '"></i>' +
        '<div class="stat-label">' + c.label + "</div>" +
        '<div class="stat-value">' + c.value + "</div>" +
        '<div class="stat-note" title="' + U.escape(c.note) + '">' + U.escape(c.note) + "</div>" +
        c.extra +
      "</div>";
    }).join("");

    document.getElementById("header-sub").textContent =
      label + " · " + chrono.length + " deneme · ortalama " + fmt(avg) + " net";
  }

  /* ==========================================================
     5) NET TABLOSU
     ========================================================== */
  function renderTable(exams) {
    var subjects = YKS.Subjects.list(currentType);

    var head = '<tr><th class="sticky-col">Deneme</th>' +
      subjects.map(function (s) {
        return "<th>" + U.escape(s.name) + '<span class="th-max">' + s.max + " soru</span></th>";
      }).join("") +
      '<th class="total-col">Toplam<span class="th-max">' +
        YKS.Subjects.totalQuestions(currentType) + " soru</span></th></tr>";

    var body = exams.map(function (exam) {
      var byId = {};
      exam.subjects.forEach(function (s) { byId[s.id] = s; });

      /* Satırdaki en iyi ve en zayıf dersi soru sayısına oranla bul */
      var ratios = subjects.map(function (s) {
        var row = byId[s.id];
        return s.max ? ((row ? row.net : 0) / s.max) : 0;
      });
      var maxRatio = Math.max.apply(null, ratios);
      var minRatio = Math.min.apply(null, ratios);
      var hasSpread = maxRatio !== minRatio;

      var cells = subjects.map(function (s, i) {
        var row = byId[s.id];
        var net = row ? row.net : 0;
        var ratio = ratios[i];

        var cls = ["net-cell"];
        if (!row || (!row.correct && !row.wrong)) cls.push("zero");
        else if (ratio >= 0.7) cls.push("good");
        else if (ratio >= 0.4) cls.push("mid");
        else cls.push("weak");

        if (hasSpread && ratio === maxRatio) cls.push("row-best", "best");
        if (hasSpread && ratio === minRatio) cls.push("row-worst");

        return '<td class="' + cls.join(" ") + '" title="' + U.escape(s.name) + ": " +
          (row ? row.correct : 0) + " doğru / " + (row ? row.wrong : 0) + ' yanlış">' +
          fmt(net) + "</td>";
      }).join("");

      return '<tr>' +
        '<td class="sticky-col exam-cell">' +
          "<strong>" + U.escape(exam.name) + "</strong>" +
          "<span>" + shortDate(exam.date) + "</span>" +
        "</td>" +
        cells +
        '<td class="total-col">' + fmt(exam.totalNet) + "</td>" +
      "</tr>";
    }).join("");

    /* Özet satırları — listedeki denemeler üzerinden */
    var avgCells = subjects.map(function (s) {
      var values = exams.map(function (e) {
        var row = e.subjects.filter(function (x) { return x.id === s.id; })[0];
        return row ? row.net : 0;
      });
      return "<td>" + fmt(average(values)) + "</td>";
    }).join("");

    var bestCells = subjects.map(function (s) {
      var values = exams.map(function (e) {
        var row = e.subjects.filter(function (x) { return x.id === s.id; })[0];
        return row ? row.net : 0;
      });
      return "<td>" + fmt(Math.max.apply(null, values)) + "</td>";
    }).join("");

    var totals = exams.map(function (e) { return e.totalNet; });

    var foot =
      '<tr class="avg-row"><td class="sticky-col">Ortalama</td>' + avgCells +
        '<td class="total-col">' + fmt(average(totals)) + "</td></tr>" +
      '<tr class="best-row"><td class="sticky-col">En yüksek</td>' + bestCells +
        '<td class="total-col">' + fmt(Math.max.apply(null, totals)) + "</td></tr>";

    return '<div class="net-card">' +
      '<div class="net-card-head">' +
        '<i class="fa-solid fa-table-list"></i>' +
        "<h3>Net Tablosu</h3>" +
        '<span class="head-note">' + exams.length + " deneme · yeşil hücre o denemedeki en güçlü ders</span>" +
      "</div>" +
      '<div class="table-scroll"><table class="net-table">' +
        "<thead>" + head + "</thead>" +
        "<tbody>" + body + "</tbody>" +
        "<tfoot>" + foot + "</tfoot>" +
      "</table></div>" +
    "</div>";
  }

  /* ==========================================================
     6) DERS ÖZET KARTLARI
     ========================================================== */
  function renderSubjectCards(exams) {
    var subjects = YKS.Subjects.list(currentType);

    /* Kartlar tarih sırasına göre okunur; sıralama seçeneği
       yalnızca tabloyu etkilesin */
    var chrono = exams.slice().sort(function (a, b) { return a.date - b.date; });

    var cards = subjects.map(function (s) {
      var values = chrono.map(function (e) {
        var row = e.subjects.filter(function (x) { return x.id === s.id; })[0];
        return row ? row.net : 0;
      });

      var avg = average(values);
      var best = Math.max.apply(null, values);
      var last = values[values.length - 1];
      var prev = values.length > 1 ? values[values.length - 2] : null;
      var delta = prev === null ? 0 : last - prev;

      var ratio = s.max ? avg / s.max : 0;
      var tone = ratio >= 0.7 ? "good" : (ratio < 0.4 ? "weak" : "");

      var deltaClass = prev === null ? "flat" : (delta > 0 ? "up" : (delta < 0 ? "down" : "flat"));
      var deltaIcon = deltaClass === "up" ? "fa-caret-up"
        : (deltaClass === "down" ? "fa-caret-down" : "fa-minus");

      return '<div class="subject-net-card ' + tone + '">' +
        '<div class="subject-net-head">' +
          '<i class="fa-solid ' + s.icon + '"></i>' +
          "<strong>" + U.escape(s.name) + "</strong>" +
          '<span class="max-tag">' + s.max + " soru</span>" +
        "</div>" +
        '<div class="subject-net-value">' + fmt(avg) + "<small> ort. net</small></div>" +
        '<div class="subject-net-bar"><span style="width:' +
          Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%"></span></div>' +
        '<div class="subject-net-meta">' +
          "<span>Son: <b>" + fmt(last) + "</b></span>" +
          '<span class="dot-sep">·</span>' +
          "<span>En iyi: <b>" + fmt(best) + "</b></span>" +
          '<span class="dot-sep">·</span>' +
          '<span class="delta ' + deltaClass + '">' +
            '<i class="fa-solid ' + deltaIcon + '"></i> ' +
            (prev === null ? "ilk" : signedFmt(delta)) +
          "</span>" +
        "</div>" +
        sparkHtml(values, s.max) +
      "</div>";
    }).join("");

    return '<div class="net-card">' +
      '<div class="net-card-head">' +
        '<i class="fa-solid fa-list-ol"></i>' +
        "<h3>Ders Bazlı Netler</h3>" +
        '<span class="head-note">' + chrono.length + " deneme ortalaması</span>" +
      "</div>" +
      '<div class="subject-net-grid">' + cards + "</div>" +
    "</div>";
  }

  /** Son denemelerin net seyri — küçük çizgi grafiği */
  function sparkHtml(values, max) {
    if (values.length < 2) return "";

    var points = values.slice(-10);
    var w = 100, h = 32, pad = 3;
    var top = Math.max(max || 1, Math.max.apply(null, points), 1);

    var coords = points.map(function (v, i) {
      var x = pad + (i * (w - pad * 2)) / (points.length - 1);
      var y = h - pad - (Math.max(0, v) / top) * (h - pad * 2);
      return { x: x, y: y };
    });

    var line = coords.map(function (c, i) {
      return (i ? "L" : "M") + c.x.toFixed(1) + " " + c.y.toFixed(1);
    }).join(" ");

    var area = line + " L" + coords[coords.length - 1].x.toFixed(1) + " " + (h - pad) +
      " L" + coords[0].x.toFixed(1) + " " + (h - pad) + " Z";

    var lastPoint = coords[coords.length - 1];

    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="spark-area" d="' + area + '"/>' +
      '<path class="spark-line" d="' + line + '" vector-effect="non-scaling-stroke"/>' +
      '<circle class="spark-dot" cx="' + lastPoint.x.toFixed(1) + '" cy="' + lastPoint.y.toFixed(1) + '" r="2"/>' +
    "</svg>";
  }

  /* ==========================================================
     7) TOPLU ÇİZİM
     ========================================================== */
  function renderContent() {
    var host = document.getElementById("nets-content");
    var exams = visibleExams();
    var totalOfType = examsOfType(currentType).length;
    var label = YKS.Subjects.typeLabel(currentType);

    document.getElementById("result-label").textContent = exams.length
      ? exams.length + " deneme listeleniyor"
      : "Sonuç yok";

    if (!totalOfType) {
      host.innerHTML = '<div class="empty-nets">' +
        '<i class="fa-solid fa-chart-simple"></i>' +
        "<h3>" + label + " için net kaydı yok</h3>" +
        "<p>Netler denemelerden üretilir. Bir " + label +
          " denemesi eklediğinde tablo ve ders ortalamaları burada oluşur.</p>" +
        '<a class="btn-x btn-primary-x" href="exams.html">' +
          '<i class="fa-solid fa-plus"></i> Deneme ekle</a>' +
      "</div>";
      return;
    }

    if (!exams.length) {
      host.innerHTML = '<div class="empty-nets">' +
        '<i class="fa-solid fa-filter-circle-xmark"></i>' +
        "<h3>Aramana uyan deneme yok</h3>" +
        "<p>Arama kutusunu temizle ya da aralığı genişlet.</p>" +
        '<button type="button" class="btn-x btn-ghost-x" id="clear-filters-btn">' +
          '<i class="fa-solid fa-rotate-left"></i> Süzgeçleri sıfırla</button>' +
      "</div>";

      var btn = document.getElementById("clear-filters-btn");
      if (btn) btn.addEventListener("click", clearFilters);
      return;
    }

    host.innerHTML = renderTable(exams) + renderSubjectCards(exams);
  }

  function renderAll() {
    renderTabCounts();
    renderStats();
    renderContent();
  }

  function clearFilters() {
    searchQuery = "";
    rangeMode = "all";
    document.getElementById("net-search").value = "";
    document.getElementById("range-select").value = "all";
    renderContent();
  }

  /* ==========================================================
     8) CSV DIŞA AKTARMA
     ----------------------------------------------------------
     Ayraç noktalı virgül, ondalık ayracı virgül: Türkçe Excel
     kurulumlarında sütunlar doğru ayrılsın.
     ========================================================== */
  function exportCsv() {
    var exams = visibleExams().slice().sort(function (a, b) { return a.date - b.date; });

    if (!exams.length) {
      return YKS.Toast.show("Bu sekmede dışa aktarılacak net yok.", "warn");
    }

    var subjects = YKS.Subjects.list(currentType);

    function cell(value) {
      var text = String(value == null ? "" : value);
      return '"' + text.replace(/"/g, '""') + '"';
    }
    function num(value) {
      return cell((Number(value) || 0).toFixed(2).replace(".", ","));
    }

    var header = ["Tarih", "Deneme"];
    subjects.forEach(function (s) { header.push(s.name + " Net"); });
    header.push("Toplam Net");

    var rows = exams.map(function (exam) {
      var byId = {};
      exam.subjects.forEach(function (s) { byId[s.id] = s; });

      var row = [cell(toDateInput(exam.date)), cell(exam.name)];
      subjects.forEach(function (s) { row.push(num(byId[s.id] ? byId[s.id].net : 0)); });
      row.push(num(exam.totalNet));
      return row.join(";");
    });

    /* Ortalama satırı da dosyaya girsin */
    var avgRow = [cell(""), cell("ORTALAMA")];
    subjects.forEach(function (s) {
      avgRow.push(num(average(exams.map(function (e) {
        var row = e.subjects.filter(function (x) { return x.id === s.id; })[0];
        return row ? row.net : 0;
      }))));
    });
    avgRow.push(num(average(exams.map(function (e) { return e.totalNet; }))));
    rows.push(avgRow.join(";"));

    /* BOM: Excel dosyayı UTF-8 açsın, Türkçe karakter bozulmasın */
    var csv = "﻿" + header.map(cell).join(";") + "\r\n" + rows.join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = "netler-" + currentType + "-" + toDateInput(Date.now()) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    YKS.Toast.show(exams.length + " denemenin netleri dışa aktarıldı.", "ok");
  }

  /* ==========================================================
     9) OLAYLAR
     ========================================================== */
  function setType(type) {
    currentType = type;

    U.qsa(".exam-tab").forEach(function (tab) {
      var active = tab.getAttribute("data-type") === type;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    renderStats();
    renderContent();
  }

  function bindEvents() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = "index.html";
    });

    U.qsa(".exam-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { setType(tab.getAttribute("data-type")); });
    });

    document.getElementById("net-search").addEventListener("input", U.debounce(function (e) {
      searchQuery = e.target.value.trim().toLocaleLowerCase("tr");
      renderContent();
    }, 200));

    document.getElementById("range-select").addEventListener("change", function (e) {
      rangeMode = e.target.value;
      renderContent();
    });

    document.getElementById("sort-select").addEventListener("change", function (e) {
      sortMode = e.target.value;
      renderContent();
    });

    document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
  }

  /* ==========================================================
     10) BAŞLATMA
     ========================================================== */
  function init() {
    if (!loadUser()) return;

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
