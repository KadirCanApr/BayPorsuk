/* ============================================================
   Aksiyom — duyurular.js
   ------------------------------------------------------------
   Duyurular modülü:
     • Herkes duyuruları okur
     • Yöneticiler duyuru yayımlar, düzenler, sabitler, siler
     • Son ziyaretten sonra yayımlananlar "Yeni" rozetiyle işaretlenir
   Veri katmanı script.js içindeki YKS.Announcements'tadır.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     1) Durum
     ========================================================== */
  var currentUser = null;
  var isAdmin = false;

  var editingId = null;
  var deleteId = null;

  var searchQuery = "";
  var levelFilter = "";

  /* Sayfa açıldığı andaki "son görülme" damgası.
     Rozetler bu değere göre çizilir; damga sayfa açılışında
     bir kez güncellenir ki rozetler oturum boyunca kaybolmasın. */
  var lastSeen = 0;

  /* ==========================================================
     2) Yardımcılar
     ========================================================== */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function formatMoment(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }) +
      " · " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /** Metni kaçırır, satır sonlarını korur */
  function bodyHTML(text) {
    return U.escape(text).replace(/\r?\n/g, "<br />");
  }

  /* ==========================================================
     3) Kullanıcı ve okundu bilgisi
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    isAdmin = YKS.Auth.isAdmin();
    currentUser = YKS.Auth.currentUser();

    if (currentUser) {
      if (!currentUser.data || typeof currentUser.data !== "object") currentUser.data = {};
      lastSeen = Number(currentUser.data.duyuruSonGorulme) || 0;
    }

    return true;
  }

  /**
   * "Son görülme" damgasını ileri alır.
   * Kurucu oturumunda kullanıcı kaydı olmadığı için atlanır.
   */
  function markSeen() {
    if (!currentUser) return;

    var newest = 0;
    YKS.Announcements.all().forEach(function (a) {
      if ((a.createdAt || 0) > newest) newest = a.createdAt || 0;
    });
    if (newest <= lastSeen) return;

    currentUser.data.duyuruSonGorulme = newest;
    var result = YKS.Users.update(currentUser.id, { data: currentUser.data });
    if (result.ok) {
      var fresh = YKS.Auth.currentUser();
      if (fresh) currentUser = fresh;
    }
  }

  /* ==========================================================
     4) Liste
     ========================================================== */
  function visibleAnnouncements() {
    var list = YKS.Announcements.all();

    if (levelFilter) {
      list = list.filter(function (a) { return a.level === levelFilter; });
    }

    if (searchQuery) {
      var q = searchQuery.toLocaleLowerCase("tr");
      list = list.filter(function (a) {
        var haystack = ((a.title || "") + " " + (a.body || "")).toLocaleLowerCase("tr");
        return haystack.indexOf(q) !== -1;
      });
    }

    return list;
  }

  function renderList() {
    var box = document.getElementById("duyuru-list");
    if (!box) return;

    var total = YKS.Announcements.count();
    var list = visibleAnnouncements();

    updateCountLabel(list.length, total);

    /* Hiç duyuru yok */
    if (!total) {
      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-bullhorn"></i>' +
          "<h3>Henüz duyuru yok</h3>" +
          "<p>" + (isAdmin
            ? "İlk duyuruyu sen yayımla; giriş yapan herkes burada görecek."
            : "Yöneticiler bir duyuru yayımladığında burada görünecek.") + "</p>" +
          (isAdmin
            ? '<button type="button" class="btn-x btn-primary-x" id="empty-new-btn">' +
                '<i class="fa-solid fa-plus"></i> Duyuru yayımla</button>'
            : "") +
        "</div>";

      var emptyBtn = document.getElementById("empty-new-btn");
      if (emptyBtn) emptyBtn.addEventListener("click", openCreate);
      return;
    }

    /* Duyuru var ama süzgeç eşleşmedi */
    if (!list.length) {
      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid fa-magnifying-glass"></i>' +
          "<h3>Eşleşme yok</h3>" +
          "<p>Arama veya tür süzgecini değiştirip tekrar dene.</p>" +
          '<button type="button" class="btn-x btn-ghost-x" id="clear-filters-btn">' +
            '<i class="fa-solid fa-xmark"></i> Süzgeçleri temizle</button>' +
        "</div>";

      var clearBtn = document.getElementById("clear-filters-btn");
      if (clearBtn) {
        clearBtn.addEventListener("click", function () {
          document.getElementById("duyuru-search").value = "";
          document.getElementById("duyuru-level-filter").value = "";
          searchQuery = "";
          levelFilter = "";
          renderList();
        });
      }
      return;
    }

    box.innerHTML = list.map(cardHTML).join("");
    bindCardActions(box);
  }

  function updateCountLabel(shown, total) {
    var label = document.getElementById("duyuru-count");
    if (!label) return;

    if (!total) { label.textContent = "Duyuru yok"; return; }

    var unread = YKS.Announcements.unreadCount(lastSeen);
    var text = (shown === total ? total + " duyuru" : shown + " / " + total + " duyuru");
    label.textContent = unread > 0 ? text + " · " + unread + " yeni" : text;
  }

  function cardHTML(a) {
    var level = YKS.Announcements.levelInfo(a.level);
    var isNew = (a.createdAt || 0) > lastSeen;

    var badges =
      '<span class="duyuru-level ' + a.level + '">' +
        '<i class="fa-solid ' + level.icon + '"></i> ' + level.label +
      "</span>" +
      (a.pinned ? '<span class="duyuru-flag pin"><i class="fa-solid fa-thumbtack"></i> Sabit</span>' : "") +
      (isNew ? '<span class="duyuru-flag new">Yeni</span>' : "");

    var actions = "";
    if (isAdmin) {
      actions =
        '<div class="duyuru-actions">' +
          '<button type="button" class="icon-action" data-pin="' + a.id + '" ' +
            'title="' + (a.pinned ? "Sabitlemeyi kaldır" : "Başa sabitle") + '" ' +
            'aria-label="' + (a.pinned ? "Sabitlemeyi kaldır" : "Başa sabitle") + '">' +
            '<i class="fa-solid fa-thumbtack"></i>' +
          "</button>" +
          '<button type="button" class="icon-action" data-edit="' + a.id + '" ' +
            'title="Düzenle" aria-label="Duyuruyu düzenle">' +
            '<i class="fa-solid fa-pen"></i>' +
          "</button>" +
          '<button type="button" class="icon-action danger" data-delete="' + a.id + '" ' +
            'title="Sil" aria-label="Duyuruyu sil">' +
            '<i class="fa-solid fa-trash"></i>' +
          "</button>" +
        "</div>";
    }

    var edited = a.updatedAt
      ? '<span><i class="fa-solid fa-pen-to-square"></i>' +
          formatMoment(a.updatedAt) + " tarihinde düzenlendi</span>"
      : "";

    return '<article class="duyuru-card level-' + a.level +
        (a.pinned ? " pinned" : "") + (isNew ? " is-new" : "") + '">' +
      '<div class="duyuru-card-head">' +
        '<div class="duyuru-badges">' + badges + "</div>" +
        actions +
      "</div>" +
      "<h3>" + U.escape(a.title) + "</h3>" +
      '<div class="duyuru-body">' + bodyHTML(a.body) + "</div>" +
      '<div class="duyuru-foot">' +
        '<span><i class="fa-solid fa-user-shield"></i>' +
          U.escape(a.authorName || "Yönetici") +
          (a.authorUsername ? ' <span class="faint">@' + U.escape(a.authorUsername) + "</span>" : "") +
        "</span>" +
        '<span><i class="fa-solid fa-calendar-day"></i>' + formatMoment(a.createdAt) + "</span>" +
        edited +
      "</div>" +
    "</article>";
  }

  function bindCardActions(root) {
    U.qsa("[data-edit]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { openEdit(btn.getAttribute("data-edit")); });
    });

    U.qsa("[data-delete]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { openDelete(btn.getAttribute("data-delete")); });
    });

    U.qsa("[data-pin]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { togglePin(btn.getAttribute("data-pin")); });
    });
  }

  /* ==========================================================
     5) Yazma ve düzenleme
     ========================================================== */
  function fillForm(values) {
    document.getElementById("d-title").value = values.title || "";
    document.getElementById("d-level").value = values.level || "info";
    document.getElementById("d-pinned").checked = !!values.pinned;
    document.getElementById("d-body").value = values.body || "";
    updateBodyCount();
  }

  function openCreate() {
    if (!isAdmin) return;

    editingId = null;
    document.getElementById("duyuru-modal-title").innerHTML =
      '<i class="fa-solid fa-plus-circle"></i> Yeni duyuru';
    document.getElementById("d-save").innerHTML =
      '<i class="fa-solid fa-paper-plane"></i> Yayımla';

    fillForm({ level: "info" });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("duyuru-modal")).show();
  }

  function openEdit(id) {
    if (!isAdmin) return;

    var a = YKS.Announcements.byId(id);
    if (!a) return YKS.Toast.show("Duyuru bulunamadı.", "error");

    editingId = id;
    document.getElementById("duyuru-modal-title").innerHTML =
      '<i class="fa-solid fa-pen"></i> Duyuruyu düzenle';
    document.getElementById("d-save").innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i> Değişiklikleri kaydet';

    fillForm(a);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("duyuru-modal")).show();
  }

  function saveAnnouncement() {
    var input = {
      title: document.getElementById("d-title").value,
      level: document.getElementById("d-level").value,
      pinned: document.getElementById("d-pinned").checked,
      body: document.getElementById("d-body").value
    };

    var result = editingId
      ? YKS.Announcements.update(editingId, input)
      : YKS.Announcements.create(input);

    if (!result.ok) return YKS.Toast.show(result.error, "error");

    YKS.Toast.show(editingId ? "Duyuru güncellendi." : "Duyuru yayımlandı.", "ok");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("duyuru-modal")).hide();

    /* Kendi yayımladığın duyuru "yeni" olarak işaretlenmesin */
    if (!editingId) markSeen();

    renderList();
  }

  function togglePin(id) {
    var result = YKS.Announcements.togglePin(id);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    YKS.Toast.show(result.pinned ? "Duyuru başa sabitlendi." : "Sabitleme kaldırıldı.", "ok", 2200);
    renderList();
  }

  /* ==========================================================
     6) Silme
     ========================================================== */
  function openDelete(id) {
    var a = YKS.Announcements.byId(id);
    if (!a) return;

    deleteId = id;
    document.getElementById("delete-duyuru-name").textContent = a.title;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("duyuru-delete-modal")).show();
  }

  function confirmDelete() {
    if (!deleteId) return;

    var result = YKS.Announcements.remove(deleteId);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    YKS.Toast.show("Duyuru silindi.", "ok");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("duyuru-delete-modal")).hide();

    deleteId = null;
    renderList();
  }

  /* ==========================================================
     7) Olay bağları
     ========================================================== */
  function updateBodyCount() {
    var body = document.getElementById("d-body");
    document.getElementById("d-body-count").textContent = body.value.length;
  }

  function bindToolbar() {
    var search = document.getElementById("duyuru-search");
    search.addEventListener("input", U.debounce(function () {
      searchQuery = search.value.trim();
      renderList();
    }, 180));

    var level = document.getElementById("duyuru-level-filter");
    level.addEventListener("change", function () {
      levelFilter = level.value;
      renderList();
    });
  }

  function bindModals() {
    document.getElementById("d-save").addEventListener("click", saveAnnouncement);
    document.getElementById("d-delete-ok").addEventListener("click", confirmDelete);

    document.getElementById("d-body").addEventListener("input", updateBodyCount);

    /* Başlık alanında Enter kaydetsin, sayfa yenilenmesin */
    document.getElementById("duyuru-form").addEventListener("submit", function (e) {
      e.preventDefault();
      saveAnnouncement();
    });

    document.getElementById("duyuru-modal").addEventListener("hidden.bs.modal", function () {
      editingId = null;
    });
    document.getElementById("duyuru-delete-modal").addEventListener("hidden.bs.modal", function () {
      deleteId = null;
    });
  }

  function bindShell() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = isAdmin ? "admin.html" : "index.html";
    });

    var newBtn = document.getElementById("new-btn");
    newBtn.style.display = isAdmin ? "inline-flex" : "none";
    newBtn.addEventListener("click", openCreate);

    /* Başka sekmede duyuru eklenirse liste tazelensin */
    window.addEventListener("storage", function (e) {
      if (e.key === YKS.Config.keys.announcements) renderList();
    });
  }

  /* ==========================================================
     8) Başlangıç
     ========================================================== */
  YKS.hazir(function () {
    if (!loadUser()) return;

    bindShell();
    bindToolbar();
    bindModals();

    renderList();

    /* Rozetler çizildikten sonra damgayı ilerlet */
    markSeen();
  });

})(window, document);
