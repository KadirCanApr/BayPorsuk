/* ============================================================
   Aksiyom — arkadaslar.js
   ------------------------------------------------------------
   Arkadaşlar modülü:
     • Kişi bul, arkadaşlık isteği gönder
     • Gelen istekleri kabul et / reddet
     • Gönderdiğin isteği geri çek
     • Arkadaşlarınla sohbete geç, listeden çıkar
   Veri katmanı script.js içindeki YKS.Friends'tedir.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     1) DURUM
     ========================================================== */
  var currentUser = null;

  var activeTab = "friends";      /* friends | incoming | outgoing | discover */
  var searchQuery = "";
  var fieldFilter = "";
  var pendingUnfriendId = null;

  /* ==========================================================
     2) KULLANICI
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    currentUser = YKS.Auth.currentUser();

    /* Kurucu oturumunun kişisel hesabı yok; arkadaşlık kişiye bağlı */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }
    return true;
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".friends-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-people">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim koduyla açılmış kurucu oturumundasın. Arkadaşlık bağları kullanıcı hesabına bağlı tutulur; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  /** Tazelenmiş oturum kaydı — başka sekmede değişmiş olabilir */
  function refreshUser() {
    var fresh = YKS.Auth.currentUser();
    if (fresh) currentUser = fresh;
  }

  /* ==========================================================
     3) LİSTELER
     ------------------------------------------------------------
     Her sekme, ekranda aynı kartı çizen ortak bir satır biçimine
     çevrilir: { user, relation, requestId, note }
     ========================================================== */
  function rowsForTab(tab) {
    var me = currentUser.id;

    if (tab === "friends") {
      return YKS.Friends.friendsOf(me).map(function (user) {
        var unread = YKS.Messages.conversations(me).filter(function (c) {
          return c.peerId === user.id;
        })[0];

        return {
          user: user,
          relation: "friends",
          requestId: null,
          note: unread && unread.unread
            ? unread.unread + " okunmamış mesaj"
            : (unread ? "Son mesaj: " + shortMoment(unread.last.createdAt) : "Henüz mesajlaşmadınız")
        };
      });
    }

    if (tab === "incoming") {
      return YKS.Friends.incoming(me).map(function (f) {
        return {
          user: YKS.Users.byId(f.fromId),
          relation: "incoming",
          requestId: f.id,
          note: "İstek gönderdi · " + shortMoment(f.createdAt)
        };
      }).filter(function (r) { return !!r.user; });
    }

    if (tab === "outgoing") {
      return YKS.Friends.outgoing(me).map(function (f) {
        return {
          user: YKS.Users.byId(f.toId),
          relation: "outgoing",
          requestId: f.id,
          note: "İstek gönderildi · " + shortMoment(f.createdAt)
        };
      }).filter(function (r) { return !!r.user; });
    }

    /* Keşfet — arkadaş olmayan ve istek bağı bulunmayan herkes */
    return YKS.Users.all()
      .filter(function (user) {
        if (user.id === me) return false;
        return YKS.Friends.statusBetween(me, user.id) === "none";
      })
      .sort(function (a, b) { return b.createdAt - a.createdAt; })
      .map(function (user) {
        return {
          user: user,
          relation: "none",
          requestId: null,
          note: "Katıldı: " + U.formatDate(user.createdAt)
        };
      });
  }

  /** Arama ve alan süzgeci */
  function applyFilters(rows) {
    return rows.filter(function (row) {
      if (fieldFilter && row.user.examField !== fieldFilter) return false;

      if (searchQuery) {
        var hay = (row.user.fullName + " " + row.user.username + " " +
          (row.user.description || "")).toLocaleLowerCase("tr");
        if (hay.indexOf(searchQuery) === -1) return false;
      }
      return true;
    });
  }

  function shortMoment(ts) {
    var diff = Date.now() - ts;
    var min = Math.floor(diff / 60000);

    if (min < 1) return "az önce";
    if (min < 60) return min + " dk önce";

    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + " saat önce";

    var day = Math.floor(hour / 24);
    if (day < 7) return day + " gün önce";

    return U.formatDate(ts);
  }

  /* ==========================================================
     4) ÇİZİM
     ========================================================== */
  function renderCounts() {
    var me = currentUser.id;
    var counts = YKS.Friends.counts(me);
    var discover = rowsForTab("discover").length;

    var map = {
      friends: counts.friends,
      incoming: counts.incoming,
      outgoing: counts.outgoing,
      discover: discover
    };

    Object.keys(map).forEach(function (key) {
      var el = document.querySelector('[data-count="' + key + '"]');
      if (el) el.textContent = map[key];
    });

    var incomingTab = document.querySelector('.friend-tab[data-tab="incoming"]');
    if (incomingTab) incomingTab.classList.toggle("has-items", counts.incoming > 0);

    /* Üst bar özeti */
    var sub = document.getElementById("header-sub");
    sub.textContent = counts.friends
      ? counts.friends + " arkadaş" +
        (counts.incoming ? " · " + counts.incoming + " bekleyen istek" : "")
      : "Kişi bul, istek gönder, sohbete başla.";

    /* Okunmamış mesaj rozeti */
    var unread = YKS.Messages.unreadTotal(me);
    var chip = document.getElementById("unread-chip");
    chip.innerHTML = '<i class="fa-solid fa-comments"></i> <b>' + unread + "</b>";
    chip.className = "msg-chip" + (unread ? " has-unread" : "");
    chip.title = unread ? unread + " okunmamış mesaj" : "Mesajlara git";
  }

  function renderList() {
    var host = document.getElementById("people-grid");
    var rows = applyFilters(rowsForTab(activeTab));

    document.getElementById("result-label").textContent =
      rows.length ? rows.length + " kişi" : "Sonuç yok";

    if (!rows.length) {
      host.innerHTML = emptyStateHtml();
      return;
    }

    host.innerHTML = rows.map(personCardHtml).join("");
  }

  function personCardHtml(row) {
    var u = row.user;
    var avatar = u.avatar || U.fallbackAvatar(u.fullName, u.username);
    var bannerStyle = u.banner ? ' style="background-image:url(' + U.escape(u.banner) + ')"' : "";

    var flag = "";
    if (row.relation === "incoming") {
      flag = '<span class="person-flag incoming"><i class="fa-solid fa-inbox"></i>İstek geldi</span>';
    } else if (row.relation === "outgoing") {
      flag = '<span class="person-flag outgoing"><i class="fa-solid fa-hourglass-half"></i>Bekliyor</span>';
    } else if (row.relation === "friends") {
      flag = '<span class="person-flag friend"><i class="fa-solid fa-user-check"></i>Arkadaş</span>';
    } else if (u.role === "admin") {
      flag = '<span class="person-flag admin"><i class="fa-solid fa-shield-halved"></i>Admin</span>';
    }

    return '<article class="person-card">' +
      '<div class="person-banner"' + bannerStyle + "></div>" +
      flag +
      '<div class="person-body">' +
        '<img class="person-avatar" src="' + avatar + '" alt="' + U.escape(u.fullName) + '" />' +
        '<div class="person-id">' +
          "<h4>" + U.escape(u.fullName) + "</h4>" +
          '<span class="person-handle">@' + U.escape(u.username) + "</span>" +
        "</div>" +
        '<div class="person-badges">' +
          '<span class="badge-x"><i class="fa-solid fa-book"></i>' +
            U.escape(U.labelOf(YKS.Config.fields, u.examField)) + "</span>" +
          '<span class="badge-x"><i class="fa-solid fa-cake-candles"></i>' + U.escape(u.age) + " yaş</span>" +
        "</div>" +
        (u.description ? '<p class="person-bio">' + U.escape(u.description) + "</p>" : "") +
        '<div class="person-note"><i class="fa-solid fa-circle-info"></i>' + U.escape(row.note) + "</div>" +
        '<div class="person-actions">' + actionsHtml(row) + "</div>" +
      "</div>" +
    "</article>";
  }

  function actionsHtml(row) {
    var id = row.user.id;

    if (row.relation === "friends") {
      return '<a class="btn-x btn-primary-x" href="mesajlar.html?u=' + encodeURIComponent(id) + '">' +
          '<i class="fa-solid fa-comment-dots"></i> Mesaj Gönder</a>' +
        '<button type="button" class="btn-x btn-ghost-x btn-icon-x" data-act="unfriend" data-id="' + id +
          '" title="Arkadaşlıktan çıkar"><i class="fa-solid fa-user-minus"></i></button>';
    }

    if (row.relation === "incoming") {
      return '<button type="button" class="btn-x btn-primary-x" data-act="accept" data-req="' + row.requestId + '">' +
          '<i class="fa-solid fa-check"></i> Kabul Et</button>' +
        '<button type="button" class="btn-x btn-danger-x" data-act="reject" data-req="' + row.requestId + '">' +
          '<i class="fa-solid fa-xmark"></i> Reddet</button>';
    }

    if (row.relation === "outgoing") {
      return '<button type="button" class="btn-x btn-ghost-x" data-act="cancel" data-req="' + row.requestId + '">' +
        '<i class="fa-solid fa-rotate-left"></i> İsteği Geri Çek</button>';
    }

    return '<button type="button" class="btn-x btn-primary-x" data-act="request" data-id="' + id + '">' +
      '<i class="fa-solid fa-user-plus"></i> Arkadaşlık İsteği</button>';
  }

  function emptyStateHtml() {
    var filtered = searchQuery || fieldFilter;

    if (filtered) {
      return '<div class="empty-people">' +
        '<i class="fa-solid fa-filter-circle-xmark"></i>' +
        "<h3>Aramana uyan kimse yok</h3>" +
        "<p>Farklı bir isim dene ya da süzgeci temizle.</p>" +
        '<button type="button" class="btn-x btn-ghost-x" data-act="clear-filters">' +
          '<i class="fa-solid fa-rotate-left"></i> Süzgeçleri sıfırla</button>' +
      "</div>";
    }

    var states = {
      friends: {
        icon: "fa-user-group",
        title: "Henüz arkadaşın yok",
        text: "Kişi Bul sekmesinden diğer üyelere istek gönder, kabul edildiğinde sohbet açılır.",
        action: '<button type="button" class="btn-x btn-primary-x" data-act="go-discover">' +
          '<i class="fa-solid fa-compass"></i> Kişi Bul</button>'
      },
      incoming: {
        icon: "fa-inbox",
        title: "Bekleyen istek yok",
        text: "Sana arkadaşlık isteği gönderildiğinde burada görünecek.",
        action: ""
      },
      outgoing: {
        icon: "fa-paper-plane",
        title: "Gönderilmiş istek yok",
        text: "Kişi Bul sekmesinden istek gönderdiğinde cevap bekleyenler burada listelenir.",
        action: '<button type="button" class="btn-x btn-primary-x" data-act="go-discover">' +
          '<i class="fa-solid fa-compass"></i> Kişi Bul</button>'
      },
      discover: {
        icon: "fa-compass",
        title: "Eklenecek kimse kalmadı",
        text: "Sistemdeki herkesle bağlantın var ya da başka üye yok.",
        action: ""
      }
    };

    var s = states[activeTab];
    return '<div class="empty-people">' +
      '<i class="fa-solid ' + s.icon + '"></i>' +
      "<h3>" + s.title + "</h3>" +
      "<p>" + s.text + "</p>" +
      s.action +
    "</div>";
  }

  function renderAll() {
    refreshUser();
    renderCounts();
    renderList();
  }

  function setTab(tab) {
    activeTab = tab;
    U.qsa(".friend-tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === tab);
    });
    renderList();
  }

  /* ==========================================================
     5) İŞLEMLER
     ========================================================== */
  function sendRequest(userId) {
    var result = YKS.Friends.request(currentUser.id, userId);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    var target = YKS.Users.byId(userId);
    var nowFriends = YKS.Friends.areFriends(currentUser.id, userId);

    YKS.Toast.show(nowFriends
      ? target.fullName + " ile arkadaş oldunuz."
      : "İstek gönderildi: " + target.fullName, "ok");

    renderAll();
  }

  function acceptRequest(requestId) {
    var result = YKS.Friends.accept(requestId, currentUser.id);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    var other = YKS.Users.byId(result.friendship.fromId);
    YKS.Toast.show((other ? other.fullName : "Kullanıcı") + " artık arkadaşın. Sohbet açıldı.", "ok");
    renderAll();
  }

  function rejectRequest(requestId, isCancel) {
    var result = YKS.Friends.reject(requestId, currentUser.id);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    YKS.Toast.show(isCancel ? "İstek geri çekildi." : "İstek reddedildi.", "info");
    renderAll();
  }

  function askUnfriend(userId) {
    var user = YKS.Users.byId(userId);
    if (!user) return;

    pendingUnfriendId = userId;
    document.getElementById("unfriend-name").textContent = user.fullName + " (@" + user.username + ")";
    bootstrap.Modal.getOrCreateInstance(document.getElementById("unfriend-modal")).show();
  }

  function confirmUnfriend() {
    var result = YKS.Friends.unfriend(currentUser.id, pendingUnfriendId);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("unfriend-modal")).hide();

    if (!result.ok) return YKS.Toast.show(result.error, "error");

    pendingUnfriendId = null;
    YKS.Toast.show("Arkadaş listenden çıkarıldı.", "ok");
    renderAll();
  }

  /* ==========================================================
     6) OLAYLAR
     ========================================================== */
  function handleAction(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;

    var act = btn.getAttribute("data-act");

    if (act === "request") { sendRequest(btn.getAttribute("data-id")); return; }
    if (act === "accept") { acceptRequest(btn.getAttribute("data-req")); return; }
    if (act === "reject") { rejectRequest(btn.getAttribute("data-req"), false); return; }
    if (act === "cancel") { rejectRequest(btn.getAttribute("data-req"), true); return; }
    if (act === "unfriend") { askUnfriend(btn.getAttribute("data-id")); return; }
    if (act === "go-discover") { setTab("discover"); return; }

    if (act === "clear-filters") {
      searchQuery = "";
      fieldFilter = "";
      document.getElementById("friend-search").value = "";
      document.getElementById("field-filter").value = "";
      renderList();
    }
  }

  function bindEvents() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = "index.html";
    });

    document.getElementById("discover-btn").addEventListener("click", function () {
      setTab("discover");
      document.getElementById("friend-search").focus();
    });

    U.qsa(".friend-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { setTab(tab.getAttribute("data-tab")); });
    });

    document.getElementById("people-grid").addEventListener("click", handleAction);

    document.getElementById("friend-search").addEventListener("input", U.debounce(function (e) {
      searchQuery = e.target.value.trim().toLocaleLowerCase("tr");
      renderList();
    }, 200));

    document.getElementById("field-filter").addEventListener("change", function (e) {
      fieldFilter = e.target.value;
      renderList();
    });

    document.getElementById("confirm-unfriend-btn").addEventListener("click", confirmUnfriend);

    /* Başka sekmede istek geldiyse liste kendiliğinden tazelensin */
    window.addEventListener("storage", function (e) {
      if (e.key === YKS.Config.keys.friendships ||
          e.key === YKS.Config.keys.messages ||
          e.key === YKS.Config.keys.friendships) {
        renderAll();
      }
    });
  }

  /* ==========================================================
     7) BAŞLATMA
     ========================================================== */
  function init() {
    if (!loadUser()) return;

    bindEvents();
    renderAll();

    /* Gelen istek varsa doğrudan o sekmeyle karşıla */
    if (YKS.Friends.incoming(currentUser.id).length) setTab("incoming");

    YKS.Particles.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window, document);
