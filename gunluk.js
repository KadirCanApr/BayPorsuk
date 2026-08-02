/* ============================================================
   Aksiyom — gunluk.js
   ------------------------------------------------------------
   Günlüğüm modülü:
     • Gün gün günlük tutma (o gün ne çalıştım, nasıl geçti)
     • Ruh hali, çalışılan dersler ve süre etiketleri
     • Arama, ay süzgeci, sıralama
     • Toplam sayfa / bu ay / seri / süre özeti
   Veri kullanıcı kaydında tutulur: user.data.gunluk
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     0) Sabitler
     ========================================================== */
  var MOODS = {
    harika: { face: "😄", label: "Harika" },
    iyi:    { face: "🙂", label: "İyi" },
    normal: { face: "😐", label: "Normal" },
    yorgun: { face: "😴", label: "Yorgun" },
    kotu:   { face: "😔", label: "Kötü" }
  };

  var DEFAULT_MOOD = "iyi";

  /* Kart içinde katlanmadan gösterilen en fazla karakter */
  var CLAMP_LIMIT = 420;

  /* ==========================================================
     1) Durum
     ========================================================== */
  var currentUser = null;
  var isAdmin = false;

  var editingId = null;
  var deleteId = null;
  var selectedMood = DEFAULT_MOOD;

  var searchQuery = "";
  var monthFilter = "";
  var sortMode = "date-desc";

  /* ==========================================================
     2) Küçük yardımcılar
     ========================================================== */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /** Tarihi günün başına çeker — aynı gün kayıtları eşitlensin */
  function dayStart(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return 0;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  function toDateInput(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function fromDateInput(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) return NaN;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  }

  /** "2026-07" → ay süzgeci anahtarı */
  function monthKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }

  function monthLabel(ts) {
    return new Date(ts).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  }

  function shortMonth(ts) {
    return new Date(ts).toLocaleDateString("tr-TR", { month: "long" });
  }

  function weekdayOf(ts) {
    return new Date(ts).toLocaleDateString("tr-TR", { weekday: "long" });
  }

  function fullDate(ts) {
    return new Date(ts).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "long", year: "numeric"
    });
  }

  function moodOf(value) {
    return MOODS[value] || MOODS[DEFAULT_MOOD];
  }

  /** 240 → "4 sa 0 dk" biçiminde okunur süre */
  function humanMinutes(minutes) {
    var total = Number(minutes) || 0;
    var hours = Math.floor(total / 60);
    var mins = total % 60;
    if (hours && mins) return hours + " sa " + mins + " dk";
    if (hours) return hours + " sa";
    return mins + " dk";
  }

  function wordCount(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  /* ==========================================================
     3) Kullanıcı ve veri katmanı
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    isAdmin = YKS.Auth.isAdmin();
    currentUser = YKS.Auth.currentUser();

    /* Yönetim kodu ile açılan kurucu oturumunun kişisel hesabı yok;
       günlük kullanıcı kaydında tutulduğu için modül çalışamaz. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
    if (!Array.isArray(currentUser.data.gunluk)) currentUser.data.gunluk = [];

    return true;
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".gunluk-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-exams">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim kodu ile açılmış kurucu oturumundasın. Günlük kayıtları kullanıcı hesabına bağlı tutulur; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  function allEntries() {
    if (!currentUser || !Array.isArray(currentUser.data.gunluk)) return [];
    return currentUser.data.gunluk;
  }

  function entryById(id) {
    return allEntries().filter(function (e) { return e.id === id; })[0] || null;
  }

  /** Değişiklikleri kullanıcı kaydına yazar */
  function saveEntries(errorMessage) {
    var result = YKS.Users.update(currentUser.id, { data: currentUser.data });

    if (result.ok) {
      var fresh = YKS.Auth.currentUser();
      if (fresh) currentUser = fresh;
      if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
      if (!Array.isArray(currentUser.data.gunluk)) currentUser.data.gunluk = [];
    } else {
      YKS.Toast.show(result.error || errorMessage || "Kaydedilemedi.", "error");
    }

    return result.ok;
  }

  /* ==========================================================
     4) Özet şeridi
     ========================================================== */

  /** Bugünden (ya da dünden) geriye kesintisiz gün sayısı */
  function streakOf(entries) {
    if (!entries.length) return 0;

    var days = {};
    entries.forEach(function (e) { days[dayStart(e.date)] = true; });

    var oneDay = 86400000;
    var cursor = dayStart(Date.now());

    /* Bugün yazılmadıysa seri dünden sayılır — gün bitmeden bozulmasın */
    if (!days[cursor]) cursor -= oneDay;

    var count = 0;
    while (days[cursor]) {
      count++;
      cursor -= oneDay;
    }
    return count;
  }

  function renderStats() {
    var box = document.getElementById("gunluk-stats");
    if (!box) return;

    var entries = allEntries();
    if (!entries.length) { box.innerHTML = ""; return; }

    var thisMonth = monthKey(Date.now());
    var monthCount = entries.filter(function (e) {
      return monthKey(e.date) === thisMonth;
    }).length;

    var totalMinutes = entries.reduce(function (sum, e) {
      return sum + (Number(e.minutes) || 0);
    }, 0);

    var totalWords = entries.reduce(function (sum, e) {
      return sum + wordCount(e.body);
    }, 0);

    var streak = streakOf(entries);

    function card(cls, icon, label, value, note) {
      return '<div class="gunluk-stat ' + cls + '">' +
        '<div class="label"><i class="fa-solid ' + icon + '"></i>' + label + "</div>" +
        '<div class="value">' + value + "</div>" +
        '<div class="note">' + note + "</div>" +
      "</div>";
    }

    box.innerHTML =
      card("", "fa-book", "Toplam sayfa", entries.length,
        totalWords + " kelime yazdın") +
      card("", "fa-calendar-day", "Bu ay", monthCount,
        monthLabel(Date.now())) +
      card("streak", "fa-fire", "Seri", streak + " gün",
        streak > 1 ? "Üst üste yazıyorsun" : "Bugün de yaz, seri büyüsün") +
      card("", "fa-stopwatch", "Kayıtlı süre", humanMinutes(totalMinutes),
        "Günlüklerde yazdığın toplam");
  }

  /* ==========================================================
     5) Süzgeçler ve liste
     ========================================================== */
  function fillMonthOptions() {
    var select = document.getElementById("gunluk-month");
    if (!select) return;

    var seen = {};
    var months = [];

    allEntries().forEach(function (e) {
      var key = monthKey(e.date);
      if (seen[key]) return;
      seen[key] = true;
      months.push({ key: key, label: monthLabel(e.date), date: e.date });
    });

    months.sort(function (a, b) { return b.date - a.date; });

    var previous = select.value;
    select.innerHTML = '<option value="">Tüm aylar</option>' +
      months.map(function (m) {
        return '<option value="' + m.key + '">' + U.escape(m.label) + "</option>";
      }).join("");

    /* Seçili ay hâlâ listedeyse korunur */
    select.value = seen[previous] ? previous : "";
    monthFilter = select.value;
  }

  function visibleEntries() {
    var list = allEntries().slice();

    if (monthFilter) {
      list = list.filter(function (e) { return monthKey(e.date) === monthFilter; });
    }

    if (searchQuery) {
      var q = searchQuery.toLocaleLowerCase("tr");
      list = list.filter(function (e) {
        var haystack = [
          e.title || "",
          e.body || "",
          (e.subjects || []).join(" ")
        ].join(" ").toLocaleLowerCase("tr");
        return haystack.indexOf(q) !== -1;
      });
    }

    list.sort(function (a, b) {
      return sortMode === "date-asc" ? a.date - b.date : b.date - a.date;
    });

    return list;
  }

  function updateCountLabel(shown, total) {
    var label = document.getElementById("gunluk-count");
    if (!label) return;

    if (!total) { label.textContent = "Kayıt yok"; return; }
    label.textContent = shown === total
      ? total + " günlük"
      : shown + " / " + total + " günlük";
  }

  function entryHTML(entry) {
    var mood = moodOf(entry.mood);
    var date = new Date(entry.date);

    var title = entry.title
      ? U.escape(entry.title)
      : fullDate(entry.date);

    var tags = (entry.subjects || []).map(function (s) {
      return '<span class="gunluk-tag"><i class="fa-solid fa-book"></i>' + U.escape(s) + "</span>";
    }).join("");

    if (entry.minutes) {
      tags += '<span class="gunluk-tag time"><i class="fa-solid fa-stopwatch"></i>' +
        humanMinutes(entry.minutes) + " çalışma</span>";
    }

    var body = U.escape(entry.body || "");
    var long = (entry.body || "").length > CLAMP_LIMIT;

    var edited = entry.updatedAt && entry.updatedAt !== entry.createdAt
      ? '<span><i class="fa-solid fa-pen-to-square"></i>düzenlendi</span>'
      : "";

    return '<article class="gunluk-entry" data-id="' + entry.id + '">' +
      '<div class="gunluk-date">' +
        '<div class="gunluk-day">' + pad2(date.getDate()) + "</div>" +
        '<div class="gunluk-month-label">' + U.escape(shortMonth(entry.date)) + "</div>" +
        '<div class="gunluk-weekday">' + U.escape(weekdayOf(entry.date)) + "</div>" +
        '<div class="gunluk-mood" title="' + mood.label + '">' + mood.face + "</div>" +
      "</div>" +

      '<div class="gunluk-main">' +
        '<div class="gunluk-entry-head">' +
          "<h3>" + title + "</h3>" +
          '<div class="gunluk-actions">' +
            '<button type="button" class="gunluk-action" data-edit="' + entry.id + '" ' +
              'title="Düzenle" aria-label="Günlüğü düzenle"><i class="fa-solid fa-pen"></i></button>' +
            '<button type="button" class="gunluk-action danger" data-delete="' + entry.id + '" ' +
              'title="Sil" aria-label="Günlüğü sil"><i class="fa-solid fa-trash"></i></button>' +
          "</div>" +
        "</div>" +

        (tags ? '<div class="gunluk-tags">' + tags + "</div>" : "") +

        '<div class="gunluk-body' + (long ? " clamped" : "") + '">' + body + "</div>" +
        (long ? '<button type="button" class="gunluk-more" data-more="' + entry.id + '">Devamını oku</button>' : "") +

        '<div class="gunluk-foot">' +
          '<span><i class="fa-solid fa-calendar-day"></i>' + fullDate(entry.date) + "</span>" +
          '<span><i class="fa-solid fa-face-smile"></i>' + mood.label + "</span>" +
          '<span><i class="fa-solid fa-align-left"></i>' + wordCount(entry.body) + " kelime</span>" +
          edited +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function renderList() {
    var box = document.getElementById("gunluk-list");
    if (!box) return;

    var total = allEntries().length;
    var list = visibleEntries();

    updateCountLabel(list.length, total);

    /* Hiç kayıt yok */
    if (!total) {
      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-feather-pointed"></i>' +
          "<h3>Günlüğün henüz boş</h3>" +
          "<p>Bugün ne çalıştığını, ne iyi gitti neye takıldığını yaz. " +
          "Birkaç gün sonra geriye dönüp bakmak en iyi motivasyon olacak.</p>" +
          '<button type="button" class="btn-x btn-primary-x" id="empty-new-btn">' +
            '<i class="fa-solid fa-pen-nib"></i> İlk sayfayı yaz</button>' +
        "</div>";

      var emptyBtn = document.getElementById("empty-new-btn");
      if (emptyBtn) emptyBtn.addEventListener("click", openCreate);
      return;
    }

    /* Kayıt var ama süzgeç eşleşmedi */
    if (!list.length) {
      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-magnifying-glass"></i>' +
          "<h3>Eşleşme yok</h3>" +
          "<p>Arama veya ay süzgecini değiştirip tekrar dene.</p>" +
          '<button type="button" class="btn-x btn-ghost-x" id="clear-filters-btn">' +
            '<i class="fa-solid fa-xmark"></i> Süzgeçleri temizle</button>' +
        "</div>";

      var clearBtn = document.getElementById("clear-filters-btn");
      if (clearBtn) {
        clearBtn.addEventListener("click", function () {
          document.getElementById("gunluk-search").value = "";
          document.getElementById("gunluk-month").value = "";
          searchQuery = "";
          monthFilter = "";
          renderList();
        });
      }
      return;
    }

    box.innerHTML = list.map(entryHTML).join("");
    bindEntryActions(box);
  }

  function bindEntryActions(root) {
    U.qsa("[data-edit]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { openEdit(btn.getAttribute("data-edit")); });
    });

    U.qsa("[data-delete]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { openDelete(btn.getAttribute("data-delete")); });
    });

    U.qsa("[data-more]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".gunluk-entry");
        var body = card ? card.querySelector(".gunluk-body") : null;
        if (!body) return;

        /* toggle true dönerse metin yeniden katlandı demektir */
        var clamped = body.classList.toggle("clamped");
        btn.textContent = clamped ? "Devamını oku" : "Daha az göster";
      });
    });
  }

  /* ==========================================================
     6) Yazma ve düzenleme
     ========================================================== */
  function setMood(value) {
    selectedMood = MOODS[value] ? value : DEFAULT_MOOD;

    U.qsa(".mood-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-mood") === selectedMood);
    });
  }

  function updateBodyCount() {
    var body = document.getElementById("g-body");
    document.getElementById("g-body-count").textContent = body.value.length;
  }

  function fillForm(values) {
    document.getElementById("g-date").value = toDateInput(values.date || Date.now());
    document.getElementById("g-title").value = values.title || "";
    document.getElementById("g-minutes").value = values.minutes || "";
    document.getElementById("g-subjects").value = (values.subjects || []).join(", ");
    document.getElementById("g-body").value = values.body || "";
    setMood(values.mood || DEFAULT_MOOD);
    updateBodyCount();
  }

  function openCreate() {
    editingId = null;
    document.getElementById("gunluk-modal-title").innerHTML =
      '<i class="fa-solid fa-pen-nib"></i> Bugünün günlüğü';
    document.getElementById("g-save").innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i> Kaydet';

    fillForm({ date: Date.now(), mood: DEFAULT_MOOD });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("gunluk-modal")).show();

    setTimeout(function () { document.getElementById("g-body").focus(); }, 300);
  }

  function openEdit(id) {
    var entry = entryById(id);
    if (!entry) return YKS.Toast.show("Günlük bulunamadı.", "error");

    editingId = id;
    document.getElementById("gunluk-modal-title").innerHTML =
      '<i class="fa-solid fa-pen"></i> Günlüğü düzenle';
    document.getElementById("g-save").innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i> Değişiklikleri kaydet';

    fillForm(entry);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("gunluk-modal")).show();
  }

  /** "Matematik, Fizik" → ["Matematik", "Fizik"] */
  function parseSubjects(value) {
    return String(value || "")
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; })
      .slice(0, 10);
  }

  function saveEntry() {
    var dateStr = document.getElementById("g-date").value;
    var date = fromDateInput(dateStr);
    if (isNaN(date)) return YKS.Toast.show("Geçerli bir tarih seç.", "error");

    var body = document.getElementById("g-body").value.trim();
    if (!body) return YKS.Toast.show("Günün notunu yazmadan kaydedemezsin.", "error");

    var minutes = parseInt(document.getElementById("g-minutes").value, 10);
    if (isNaN(minutes) || minutes < 0) minutes = 0;
    if (minutes > 1440) minutes = 1440;

    var entryData = {
      date: date,
      title: document.getElementById("g-title").value.trim(),
      mood: selectedMood,
      subjects: parseSubjects(document.getElementById("g-subjects").value),
      minutes: minutes,
      body: body
    };

    var list = currentUser.data.gunluk;

    if (editingId) {
      var index = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === editingId) { index = i; break; }
      }
      if (index === -1) return YKS.Toast.show("Günlük bulunamadı.", "error");

      entryData.id = editingId;
      entryData.createdAt = list[index].createdAt || Date.now();
      entryData.updatedAt = Date.now();
      list[index] = entryData;
    } else {
      entryData.id = U.uid("gun");
      entryData.createdAt = Date.now();
      entryData.updatedAt = entryData.createdAt;
      list.push(entryData);
    }

    if (!saveEntries("Günlük kaydedilemedi.")) {
      /* Yazılamadıysa bellekteki listeyi kayıttan tazele */
      var restored = YKS.Auth.currentUser();
      if (restored) currentUser = restored;
      return;
    }

    YKS.Toast.show(editingId ? "Günlük güncellendi." : "Günlük kaydedildi.", "ok");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("gunluk-modal")).hide();

    editingId = null;
    refresh();
  }

  /* ==========================================================
     7) Silme
     ========================================================== */
  function openDelete(id) {
    var entry = entryById(id);
    if (!entry) return;

    deleteId = id;
    document.getElementById("delete-gunluk-name").textContent =
      (entry.title ? entry.title + " · " : "") + fullDate(entry.date);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("gunluk-delete-modal")).show();
  }

  function confirmDelete() {
    if (!deleteId) return;

    currentUser.data.gunluk = allEntries().filter(function (e) { return e.id !== deleteId; });

    if (!saveEntries("Günlük silinemedi.")) return;

    YKS.Toast.show("Günlük sayfası silindi.", "ok");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("gunluk-delete-modal")).hide();

    deleteId = null;
    refresh();
  }

  /* ==========================================================
     8) Olay bağları
     ========================================================== */
  function bindToolbar() {
    var search = document.getElementById("gunluk-search");
    search.addEventListener("input", U.debounce(function () {
      searchQuery = search.value.trim();
      renderList();
    }, 180));

    var month = document.getElementById("gunluk-month");
    month.addEventListener("change", function () {
      monthFilter = month.value;
      renderList();
    });

    var sort = document.getElementById("gunluk-sort");
    sort.addEventListener("change", function () {
      sortMode = sort.value;
      renderList();
    });
  }

  function bindModals() {
    document.getElementById("g-save").addEventListener("click", saveEntry);
    document.getElementById("g-delete-ok").addEventListener("click", confirmDelete);
    document.getElementById("g-body").addEventListener("input", updateBodyCount);

    U.qsa(".mood-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMood(btn.getAttribute("data-mood"));
      });
    });

    /* Form içinde Enter sayfayı yenilemesin */
    document.getElementById("gunluk-form").addEventListener("submit", function (e) {
      e.preventDefault();
      saveEntry();
    });

    document.getElementById("gunluk-modal").addEventListener("hidden.bs.modal", function () {
      editingId = null;
    });
    document.getElementById("gunluk-delete-modal").addEventListener("hidden.bs.modal", function () {
      deleteId = null;
    });
  }

  function bindShell() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = isAdmin ? "admin.html" : "index.html";
    });

    document.getElementById("new-btn").addEventListener("click", openCreate);
  }

  /** Özet + süzgeç + liste birlikte tazelenir */
  function refresh() {
    renderStats();
    fillMonthOptions();
    renderList();
  }

  /* ==========================================================
     9) Başlangıç
     ========================================================== */
  YKS.hazir(function () {
    if (!loadUser()) return;

    bindShell();
    bindToolbar();
    bindModals();

    refresh();
  });

})(window, document);
