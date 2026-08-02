/* ============================================================
   Aksiyom — dersler.js
   ------------------------------------------------------------
   Ders Takibi modülü. Müfredat kataloğu konular.js içindeki
   YKS.Curriculum'dan okunur; bu dosya yalnızca kullanıcının
   ilerlemesini yönetir.

   Kullanıcı kaydı:
     currentUser.data.dersler = {
       "tyt.matematik.temel-kavramlar": {
         status:    "none" | "learning" | "review" | "done",
         minutes:   120,          → toplam çalışma süresi
         questions: 240,          → çözülen soru
         note:      "…",
         updatedAt: 1750000000000
       }
     }

   Kayıt konu anahtarıyla tutulduğu için müfredat listesi
   güncellense bile girilen süre ve notlar korunur.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;
  var C = YKS.Curriculum;

  /* ==========================================================
     1) SABİTLER
     ========================================================== */
  var STATUSES = {
    none:     { label: "Başlanmadı",    icon: "fa-regular fa-circle",       order: 0 },
    learning: { label: "Çalışıyorum",   icon: "fa-solid fa-spinner",        order: 1 },
    review:   { label: "Tekrar gerekli", icon: "fa-solid fa-rotate-right",  order: 2 },
    done:     { label: "Bitti",         icon: "fa-solid fa-circle-check",   order: 3 }
  };

  /* Durum düğmesine basıldıkça izlenen sıra */
  var STATUS_CYCLE = ["none", "learning", "done", "review"];

  /* ==========================================================
     2) DURUM
     ========================================================== */
  var currentUser = null;

  var currentType = "tyt";
  var searchQuery = "";
  var subjectFilter = "";
  var statusFilter = "";

  /* Açık ders bölümleri — tür değişince sıfırlanır */
  var openSubjects = {};
  var allOpen = false;

  /* Pencerede düzenlenen konu */
  var editingTopic = null;
  var modalStatus = "none";

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

    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    ensureShape();
    return true;
  }

  /**
   * "dersler" alanı ilk sürümde boş dizi olarak açılmıştı;
   * konu takibi anahtar-değer sözlüğü kullanır. Eski kayıt
   * dizi ise sözlüğe çevrilir, veri kaybolmaz.
   */
  function ensureShape() {
    if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
    if (!Array.isArray(currentUser.data.sureler)) currentUser.data.sureler = [];

    var store = currentUser.data.dersler;

    if (Array.isArray(store)) {
      var converted = {};
      store.forEach(function (row) {
        if (row && row.key) converted[row.key] = row;
      });
      currentUser.data.dersler = converted;
      return;
    }

    if (!store || typeof store !== "object") currentUser.data.dersler = {};
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".topics-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-topics">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim koduyla açılmış kurucu oturumundasın. Konu takibi kullanıcı hesabına bağlı tutulur; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

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

  function store() { return currentUser.data.dersler; }

  /** Konunun kaydı — yoksa boş varsayılan döner */
  function recordOf(key) {
    var row = store()[key];
    return {
      status: (row && STATUSES[row.status]) ? row.status : "none",
      minutes: (row && parseInt(row.minutes, 10)) || 0,
      questions: (row && parseInt(row.questions, 10)) || 0,
      note: (row && row.note) || "",
      updatedAt: (row && row.updatedAt) || null
    };
  }

  function writeRecord(key, patch) {
    var current = recordOf(key);
    var next = {
      status: patch.status !== undefined ? patch.status : current.status,
      minutes: patch.minutes !== undefined ? patch.minutes : current.minutes,
      questions: patch.questions !== undefined ? patch.questions : current.questions,
      note: patch.note !== undefined ? patch.note : current.note,
      updatedAt: Date.now()
    };

    /* Hiçbir iz kalmadıysa kaydı tut­ma; sözlük şişmesin */
    if (next.status === "none" && !next.minutes && !next.questions && !next.note) {
      delete store()[key];
    } else {
      store()[key] = next;
    }

    return saveUserData("Konu kaydedilemedi.");
  }

  /* ==========================================================
     4) YARDIMCILAR
     ========================================================== */
  function humanMinutes(min) {
    if (!min) return "0 dk";
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    if (h && m) return h + " sa " + m + " dk";
    if (h) return h + " sa";
    return m + " dk";
  }

  /** Sayaç modülünden bir derse ait toplam süre (dakika) */
  function timerMinutesOf(type, subjectId) {
    var total = 0;
    currentUser.data.sureler.forEach(function (s) {
      if (!s) return;
      if (s.examType !== type) return;
      if (s.subjectId !== subjectId) return;
      total += (s.seconds || 0);
    });
    return Math.round(total / 60);
  }

  /** Süzgeçlerden geçen konular */
  function visibleTopics(subject) {
    var out = [];

    subject.groups.forEach(function (group) {
      group.topics.forEach(function (topic) {
        var key = C.topicKey(currentType, subject.subject, topic);
        var rec = recordOf(key);

        if (statusFilter) {
          if (statusFilter === "studied") {
            if (!rec.minutes) return;
          } else if (rec.status !== statusFilter) {
            return;
          }
        }

        if (searchQuery) {
          var hay = (topic + " " + group.name + " " + subject.name + " " + rec.note)
            .toLocaleLowerCase("tr");
          if (hay.indexOf(searchQuery) === -1) return;
        }

        out.push({ key: key, name: topic, group: group.name, record: rec });
      });
    });

    return out;
  }

  /** Bir dersin özeti */
  function subjectSummary(subject) {
    var total = 0, done = 0, minutes = 0, questions = 0, started = 0;

    subject.groups.forEach(function (group) {
      group.topics.forEach(function (topic) {
        var rec = recordOf(C.topicKey(currentType, subject.subject, topic));
        total++;
        if (rec.status === "done") done++;
        if (rec.status !== "none" || rec.minutes) started++;
        minutes += rec.minutes;
        questions += rec.questions;
      });
    });

    return {
      total: total,
      done: done,
      started: started,
      minutes: minutes,
      questions: questions,
      percent: total ? Math.round((done / total) * 100) : 0
    };
  }

  /** Seçili sınav türünün genel özeti */
  function typeSummary() {
    var totals = { total: 0, done: 0, learning: 0, review: 0, minutes: 0, questions: 0 };

    C.subjectsOf(currentType).forEach(function (subject) {
      subject.groups.forEach(function (group) {
        group.topics.forEach(function (topic) {
          var rec = recordOf(C.topicKey(currentType, subject.subject, topic));
          totals.total++;
          if (rec.status === "done") totals.done++;
          if (rec.status === "learning") totals.learning++;
          if (rec.status === "review") totals.review++;
          totals.minutes += rec.minutes;
          totals.questions += rec.questions;
        });
      });
    });

    totals.percent = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
    return totals;
  }

  /* ==========================================================
     5) ÇİZİM — ÜST BÖLÜM
     ========================================================== */
  function renderTabCounts() {
    ["tyt", "ayt", "kpss"].forEach(function (type) {
      var el = document.querySelector('[data-count="' + type + '"]');
      if (el) el.textContent = C.totalTopics(type);
    });
  }

  function renderStats() {
    var s = typeSummary();
    var label = YKS.Subjects.typeLabel(currentType);

    var cards = [
      {
        label: "Toplam çalışma",
        value: humanMinutes(s.minutes),
        icon: "fa-hourglass-half",
        note: s.minutes ? "Ortalama " + humanMinutes(Math.round(s.minutes / Math.max(1, s.done + s.learning + s.review))) + " / konu" : "Henüz süre girilmedi",
        bar: null,
        tone: ""
      },
      {
        label: "Tamamlanan konu",
        value: s.done + "<small> / " + s.total + "</small>",
        icon: "fa-circle-check",
        note: "%" + s.percent + " tamamlandı",
        bar: s.percent,
        tone: s.percent === 100 ? "tone-ok" : ""
      },
      {
        label: "Çalışılıyor",
        value: String(s.learning),
        icon: "fa-spinner",
        note: s.learning ? "Devam eden konu" : "Açık konu yok",
        bar: null,
        tone: ""
      },
      {
        label: "Tekrar gerekli",
        value: String(s.review),
        icon: "fa-rotate-right",
        note: s.review ? "Tekrara ayrılan konu" : "Tekrar listesi boş",
        bar: null,
        tone: s.review ? "tone-warn" : ""
      },
      {
        label: "Çözülen soru",
        value: String(s.questions),
        icon: "fa-list-check",
        note: label + " genelinde",
        bar: null,
        tone: ""
      }
    ];

    document.getElementById("topic-stats").innerHTML = cards.map(function (c) {
      return '<div class="topic-stat-card ' + c.tone + '">' +
        '<i class="stat-icon fa-solid ' + c.icon + '"></i>' +
        '<div class="stat-label">' + c.label + "</div>" +
        '<div class="stat-value">' + c.value + "</div>" +
        '<div class="stat-note">' + U.escape(c.note) + "</div>" +
        (c.bar === null ? "" : '<div class="stat-bar"><span style="width:' + c.bar + '%"></span></div>') +
      "</div>";
    }).join("");

    /* Üst bar */
    document.getElementById("hours-chip").innerHTML =
      '<i class="fa-solid fa-hourglass-half"></i> <b>' + humanMinutes(s.minutes) + "</b>";

    document.getElementById("header-sub").textContent =
      label + " · " + s.total + " konudan " + s.done + " tanesi bitti" +
      (s.review ? " · " + s.review + " tekrar" : "");
  }

  function renderSubjectFilter() {
    var sel = document.getElementById("subject-filter");
    var current = subjectFilter;

    sel.innerHTML = '<option value="">Tüm dersler</option>' +
      C.subjectsOf(currentType).map(function (s) {
        return '<option value="' + s.subject + '">' + U.escape(s.name) + "</option>";
      }).join("");

    /* Tür değişince önceki ders süzgeci geçersiz olabilir */
    if (current && C.find(currentType, current)) {
      sel.value = current;
    } else {
      subjectFilter = "";
      sel.value = "";
    }
  }

  /* ==========================================================
     6) ÇİZİM — DERS LİSTESİ
     ========================================================== */
  function renderSubjects() {
    var host = document.getElementById("subjects-wrap");
    var subjects = C.subjectsOf(currentType);
    var shownTopics = 0;

    if (subjectFilter) {
      subjects = subjects.filter(function (s) { return s.subject === subjectFilter; });
    }

    var blocks = subjects.map(function (subject) {
      var topics = visibleTopics(subject);
      if (!topics.length) return "";

      shownTopics += topics.length;
      return subjectBlockHtml(subject, topics);
    }).filter(Boolean);

    document.getElementById("result-label").textContent = shownTopics
      ? shownTopics + " konu listeleniyor"
      : "Sonuç yok";

    if (!blocks.length) {
      host.innerHTML = '<div class="empty-topics">' +
        '<i class="fa-solid fa-filter-circle-xmark"></i>' +
        "<h3>Süzgece uyan konu yok</h3>" +
        "<p>Arama veya durum süzgecini değiştirip yeniden dene.</p>" +
        '<button type="button" class="btn-x btn-ghost-x" data-act="clear-filters">' +
          '<i class="fa-solid fa-rotate-left"></i> Süzgeçleri sıfırla</button>' +
      "</div>";
      return;
    }

    host.innerHTML = blocks.join("");
  }

  function subjectBlockHtml(subject, topics) {
    var sum = subjectSummary(subject);
    var timer = timerMinutesOf(currentType, subject.subject);

    /* Arama yapılırken eşleşen bölümler kendiliğinden açılır */
    var isOpen = allOpen || !!openSubjects[subject.subject] || !!searchQuery || !!statusFilter;

    /* Ünitelere göre grupla — süzgeçten geçen konular */
    var byGroup = [];
    var index = {};

    topics.forEach(function (t) {
      if (!index[t.group]) {
        index[t.group] = { name: t.group, rows: [] };
        byGroup.push(index[t.group]);
      }
      index[t.group].rows.push(t);
    });

    var body = byGroup.map(function (g) {
      var doneInGroup = g.rows.filter(function (r) { return r.record.status === "done"; }).length;

      return '<div class="unit-block">' +
        '<div class="unit-head">' +
          '<i class="fa-solid fa-diamond"></i>' + U.escape(g.name) +
          '<span class="unit-count">' + doneInGroup + " / " + g.rows.length + "</span>" +
        "</div>" +
        '<div class="topic-rows">' + g.rows.map(topicRowHtml).join("") + "</div>" +
      "</div>";
    }).join("");

    return '<section class="subject-block' + (isOpen ? " open" : "") +
        (sum.percent === 100 ? " completed" : "") + '" data-subject="' + subject.subject + '">' +
      '<button type="button" class="subject-head" data-act="toggle-subject" data-subject="' + subject.subject + '">' +
        '<span class="subject-icon"><i class="fa-solid ' + subject.icon + '"></i></span>' +
        '<span class="subject-main">' +
          "<h3>" + U.escape(subject.name) + "</h3>" +
          '<span class="subject-meta">' +
            "<span>" + sum.done + " / " + sum.total + " konu</span>" +
            '<span class="dot-sep">·</span>' +
            "<span>" + humanMinutes(sum.minutes) + " çalışma</span>" +
            (sum.questions ? '<span class="dot-sep">·</span><span>' + sum.questions + " soru</span>" : "") +
            (timer ? '<span class="dot-sep">·</span><span title="Çalışma sayacından gelen süre">' +
              "sayaç: " + humanMinutes(timer) + "</span>" : "") +
          "</span>" +
          '<span class="subject-progress"><span style="width:' + sum.percent + '%"></span></span>' +
        "</span>" +
        '<span class="subject-pct">%' + sum.percent + "</span>" +
        '<i class="fa-solid fa-chevron-right subject-caret"></i>' +
      "</button>" +
      '<div class="subject-body">' + body + "</div>" +
    "</section>";
  }

  function topicRowHtml(topic) {
    var rec = topic.record;
    var status = STATUSES[rec.status];

    var chips = "";
    if (rec.minutes) {
      chips += '<span class="topic-chip time"><i class="fa-solid fa-clock"></i>' +
        humanMinutes(rec.minutes) + "</span>";
    }
    if (rec.questions) {
      chips += '<span class="topic-chip quest"><i class="fa-solid fa-list-check"></i>' +
        rec.questions + " soru</span>";
    }
    if (rec.note) {
      chips += '<span class="topic-chip note"><i class="fa-solid fa-note-sticky"></i>Not var</span>';
    }
    if (rec.status !== "none") {
      chips += '<span class="topic-chip">' + status.label + "</span>";
    }

    return '<div class="topic-row status-' + rec.status + '" data-key="' + topic.key + '">' +
      '<button type="button" class="status-btn" data-act="cycle" data-key="' + topic.key +
        '" title="Durum: ' + status.label + '"><i class="' + status.icon + '"></i></button>' +
      '<div class="topic-main">' +
        '<div class="topic-name">' + U.escape(topic.name) + "</div>" +
        (chips ? '<div class="topic-chips">' + chips + "</div>" : "") +
      "</div>" +
      '<div class="topic-actions">' +
        '<button type="button" class="topic-btn" data-act="add-time" data-key="' + topic.key +
          '" data-min="30" title="30 dakika ekle">+30dk</button>' +
        '<button type="button" class="topic-btn" data-act="add-time" data-key="' + topic.key +
          '" data-min="60" title="1 saat ekle">+1sa</button>' +
        '<button type="button" class="topic-btn detail" data-act="detail" data-key="' + topic.key +
          '" title="Detay ve not"><i class="fa-solid fa-pen"></i></button>' +
      "</div>" +
    "</div>";
  }

  function renderAll() {
    renderStats();
    renderSubjects();
  }

  /* ==========================================================
     7) İŞLEMLER
     ========================================================== */

  /** Konu anahtarından katalog kaydını bulur */
  function topicByKey(key) {
    var found = null;

    ["tyt", "ayt", "kpss"].some(function (type) {
      return C.subjectsOf(type).some(function (subject) {
        return subject.groups.some(function (group) {
          return group.topics.some(function (topic) {
            if (C.topicKey(type, subject.subject, topic) !== key) return false;
            found = {
              key: key,
              type: type,
              subject: subject,
              group: group.name,
              name: topic
            };
            return true;
          });
        });
      });
    });

    return found;
  }

  function cycleStatus(key) {
    var rec = recordOf(key);
    var next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(rec.status) + 1) % STATUS_CYCLE.length];

    if (writeRecord(key, { status: next })) {
      var topic = topicByKey(key);
      YKS.Toast.show((topic ? topic.name : "Konu") + " → " + STATUSES[next].label, "ok");
      renderAll();
    }
  }

  function addTime(key, minutes) {
    var rec = recordOf(key);
    var patch = { minutes: rec.minutes + minutes };

    /* İlk süre girildiğinde konu kendiliğinden "çalışılıyor" olur */
    if (rec.status === "none") patch.status = "learning";

    if (writeRecord(key, patch)) {
      YKS.Toast.show(humanMinutes(minutes) + " eklendi · toplam " + humanMinutes(patch.minutes), "ok");
      renderAll();
    }
  }

  /* ==========================================================
     8) KONU PENCERESİ
     ========================================================== */
  function openTopicModal(key) {
    var topic = topicByKey(key);
    if (!topic) return;

    editingTopic = topic;
    var rec = recordOf(key);

    document.getElementById("topic-modal-title").innerHTML =
      '<i class="fa-solid ' + topic.subject.icon + '"></i> ' + U.escape(topic.name);

    document.getElementById("topic-path").textContent =
      YKS.Subjects.typeLabel(topic.type) + " · " + topic.subject.name + " · " + topic.group;

    setModalStatus(rec.status);

    document.getElementById("topic-hours").value = Math.floor(rec.minutes / 60);
    document.getElementById("topic-minutes").value = rec.minutes % 60;
    document.getElementById("topic-questions").value = rec.questions;
    document.getElementById("topic-note").value = rec.note;

    updateNoteCount();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("topic-modal")).show();
  }

  function setModalStatus(status) {
    modalStatus = STATUSES[status] ? status : "none";
    U.qsa("#status-picker .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-status") === modalStatus);
    });
  }

  function modalMinutes() {
    var h = parseInt(document.getElementById("topic-hours").value, 10) || 0;
    var m = parseInt(document.getElementById("topic-minutes").value, 10) || 0;
    return Math.max(0, h * 60 + m);
  }

  function setModalMinutes(total) {
    var safe = Math.max(0, total);
    document.getElementById("topic-hours").value = Math.floor(safe / 60);
    document.getElementById("topic-minutes").value = safe % 60;
  }

  function updateNoteCount() {
    var input = document.getElementById("topic-note");
    document.getElementById("topic-note-count").textContent = input.value.length + "/2000";
  }

  function saveTopic() {
    if (!editingTopic) return;

    var minutes = modalMinutes();
    var questions = Math.max(0, parseInt(document.getElementById("topic-questions").value, 10) || 0);
    var note = document.getElementById("topic-note").value.trim();

    if (writeRecord(editingTopic.key, {
      status: modalStatus,
      minutes: minutes,
      questions: questions,
      note: note
    })) {
      bootstrap.Modal.getOrCreateInstance(document.getElementById("topic-modal")).hide();
      YKS.Toast.show(editingTopic.name + " kaydedildi.", "ok");
      editingTopic = null;
      renderAll();
    }
  }

  function resetTopic() {
    if (!editingTopic) return;

    delete store()[editingTopic.key];

    if (saveUserData("Kayıt temizlenemedi.")) {
      bootstrap.Modal.getOrCreateInstance(document.getElementById("topic-modal")).hide();
      YKS.Toast.show(editingTopic.name + " kaydı temizlendi.", "info");
      editingTopic = null;
      renderAll();
    }
  }

  /* ==========================================================
     9) OLAYLAR
     ========================================================== */
  function handleAction(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;

    var act = btn.getAttribute("data-act");
    var key = btn.getAttribute("data-key");

    if (act === "cycle") { cycleStatus(key); return; }
    if (act === "add-time") { addTime(key, parseInt(btn.getAttribute("data-min"), 10)); return; }
    if (act === "detail") { openTopicModal(key); return; }

    if (act === "toggle-subject") {
      var id = btn.getAttribute("data-subject");
      var block = btn.parentNode;
      var willOpen = !block.classList.contains("open");

      block.classList.toggle("open", willOpen);
      openSubjects[id] = willOpen;
      return;
    }

    if (act === "clear-filters") {
      searchQuery = "";
      statusFilter = "";
      subjectFilter = "";
      document.getElementById("topic-search").value = "";
      document.getElementById("status-filter").value = "";
      document.getElementById("subject-filter").value = "";
      renderAll();
    }
  }

  function setType(type) {
    currentType = type;
    openSubjects = {};
    allOpen = false;

    U.qsa(".exam-tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-type") === type);
    });

    document.getElementById("toggle-all-btn").innerHTML =
      '<i class="fa-solid fa-chevron-down"></i> Tümünü aç';

    renderSubjectFilter();
    renderAll();
  }

  function toggleAll() {
    allOpen = !allOpen;

    C.subjectsOf(currentType).forEach(function (s) { openSubjects[s.subject] = allOpen; });

    document.getElementById("toggle-all-btn").innerHTML = allOpen
      ? '<i class="fa-solid fa-chevron-up"></i> Tümünü kapat'
      : '<i class="fa-solid fa-chevron-down"></i> Tümünü aç';

    renderSubjects();
  }

  function bindEvents() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = "index.html";
    });

    document.getElementById("toggle-all-btn").addEventListener("click", toggleAll);

    U.qsa(".exam-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { setType(tab.getAttribute("data-type")); });
    });

    document.getElementById("subjects-wrap").addEventListener("click", handleAction);

    document.getElementById("topic-search").addEventListener("input", U.debounce(function (e) {
      searchQuery = e.target.value.trim().toLocaleLowerCase("tr");
      renderSubjects();
    }, 220));

    document.getElementById("subject-filter").addEventListener("change", function (e) {
      subjectFilter = e.target.value;
      renderSubjects();
    });

    document.getElementById("status-filter").addEventListener("change", function (e) {
      statusFilter = e.target.value;
      renderSubjects();
    });

    /* Pencere içi */
    U.qsa("#status-picker .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { setModalStatus(b.getAttribute("data-status")); });
    });

    U.qsa("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        setModalMinutes(modalMinutes() + parseInt(b.getAttribute("data-add"), 10));
        if (modalStatus === "none") setModalStatus("learning");
      });
    });

    U.qsa("[data-add-q]").forEach(function (b) {
      b.addEventListener("click", function () {
        var input = document.getElementById("topic-questions");
        input.value = (parseInt(input.value, 10) || 0) + parseInt(b.getAttribute("data-add-q"), 10);
      });
    });

    document.getElementById("topic-note").addEventListener("input", updateNoteCount);
    document.getElementById("topic-save-btn").addEventListener("click", saveTopic);
    document.getElementById("topic-reset-btn").addEventListener("click", resetTopic);
  }

  /* ==========================================================
     10) BAŞLATMA
     ========================================================== */
  function init() {
    if (!loadUser()) return;

    bindEvents();
    renderTabCounts();
    renderSubjectFilter();
    renderAll();

    YKS.Particles.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window, document);
