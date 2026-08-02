/* ============================================================
   Aksiyom — mesajlar.js
   ------------------------------------------------------------
   Mesajlaşma modülü:
     • Solda sohbet listesi (okunmamış sayısı ve son mesaj)
     • Sağda seçili sohbetin balonları
     • Enter gönderir, Shift+Enter alt satır açar
     • Yalnızca arkadaş listendekilere yazılabilir
   Veri katmanı script.js içindeki YKS.Messages'tadır.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     1) DURUM
     ========================================================== */
  var currentUser = null;
  var activePeerId = null;
  var searchQuery = "";

  /* Son çizimdeki mesaj imzası — boşuna yeniden çizmemek için */
  var lastSignature = "";

  /* Kullanıcı yukarı kaydırdıysa yeni mesajda zıplatma */
  var stickToBottom = true;

  var POLL_MS = 2500;

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

    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }
    return true;
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".chat-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-people">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim koduyla açılmış kurucu oturumundasın. Mesajlar kullanıcı hesabına bağlı tutulur; kendi hesabınla giriş yaparsan bu bölüm açılır. Yönetici olarak yazışmaları panelden sorgulayabilirsin."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  /* ==========================================================
     3) ZAMAN YARDIMCILARI
     ========================================================== */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function clockOf(ts) {
    var d = new Date(ts);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function dayLabel(ts) {
    var today = dayKey(Date.now());
    var yesterday = dayKey(Date.now() - 86400000);
    var key = dayKey(ts);

    if (key === today) return "Bugün";
    if (key === yesterday) return "Dün";
    return U.formatDate(ts);
  }

  /** Listedeki kısa zaman etiketi */
  function shortTime(ts) {
    if (dayKey(ts) === dayKey(Date.now())) return clockOf(ts);
    if (dayKey(ts) === dayKey(Date.now() - 86400000)) return "Dün";

    var d = new Date(ts);
    return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1);
  }

  /* ==========================================================
     4) SOHBET LİSTESİ
     ------------------------------------------------------------
     Konuşma geçmişi olan arkadaşlar ve henüz yazışılmamış
     arkadaşlar aynı listede toplanır; böylece yeni sohbet
     başlatmak için ayrı bir ekran gerekmiyor.
     ========================================================== */
  function buildRows() {
    var me = currentUser.id;
    var rows = YKS.Messages.conversations(me);
    var seen = {};

    rows.forEach(function (r) { seen[r.peerId] = true; });

    YKS.Friends.friendsOf(me).forEach(function (friend) {
      if (seen[friend.id]) return;
      rows.push({ peerId: friend.id, peer: friend, last: null, unread: 0, total: 0 });
    });

    if (searchQuery) {
      rows = rows.filter(function (r) {
        var hay = (r.peer.fullName + " " + r.peer.username +
          (r.last ? " " + r.last.text : "")).toLocaleLowerCase("tr");
        return hay.indexOf(searchQuery) !== -1;
      });
    }

    /* Yazışılanlar üstte, sonra alfabetik */
    return rows.sort(function (a, b) {
      if (!!a.last !== !!b.last) return a.last ? -1 : 1;
      if (a.last && b.last) return b.last.createdAt - a.last.createdAt;
      return a.peer.fullName.localeCompare(b.peer.fullName, "tr");
    });
  }

  function renderList() {
    var host = document.getElementById("chat-list");
    var rows = buildRows();

    if (!rows.length) {
      host.innerHTML = '<div class="chat-list-empty">' +
        '<i class="fa-solid fa-user-group"></i>' +
        (searchQuery
          ? "Aramana uyan sohbet yok."
          : 'Sohbet için önce arkadaş eklemelisin.<br /><a href="arkadaslar.html">Arkadaş bul</a>') +
      "</div>";
      return;
    }

    host.innerHTML = rows.map(function (r) {
      var avatar = r.peer.avatar || U.fallbackAvatar(r.peer.fullName, r.peer.username);
      var preview = r.last
        ? (r.last.fromId === currentUser.id ? '<span class="me-tag">Sen: </span>' : "") + U.escape(r.last.text)
        : "Yeni sohbet başlat";

      return '<button type="button" class="chat-row' +
          (r.peerId === activePeerId ? " active" : "") +
          (r.unread ? " unread" : "") + '" data-peer="' + r.peerId + '">' +
        '<img class="chat-row-avatar" src="' + avatar + '" alt="" />' +
        '<div class="chat-row-main">' +
          '<div class="chat-row-top">' +
            '<span class="chat-row-name">' + U.escape(r.peer.fullName) + "</span>" +
            (r.last ? '<span class="chat-row-time">' + shortTime(r.last.createdAt) + "</span>" : "") +
          "</div>" +
          '<div class="chat-row-preview">' + preview + "</div>" +
        "</div>" +
        (r.unread ? '<span class="chat-row-badge">' + r.unread + "</span>" : "") +
      "</button>";
    }).join("");
  }

  /* ==========================================================
     5) SOHBET BÖLMESİ
     ========================================================== */
  function renderThread() {
    var head = document.getElementById("thread-head");
    var body = document.getElementById("thread-body");
    var composer = document.getElementById("composer");

    if (!activePeerId) {
      head.classList.add("is-hidden");
      composer.classList.add("is-hidden");
      body.innerHTML = '<div class="thread-empty">' +
        '<i class="fa-solid fa-comments"></i>' +
        "<h3>Bir sohbet seç</h3>" +
        "<p>Soldaki listeden arkadaşını seç ve yazmaya başla. " +
        "Henüz arkadaşın yoksa önce arkadaş ekle.</p>" +
        '<a class="btn-x btn-primary-x" href="arkadaslar.html">' +
          '<i class="fa-solid fa-user-plus"></i> Arkadaş Bul</a>' +
      "</div>";
      return;
    }

    head.classList.remove("is-hidden");

    var peer = YKS.Users.byId(activePeerId);
    if (!peer) {
      activePeerId = null;
      renderThread();
      return;
    }

    /* Başlık */
    document.getElementById("thread-avatar").src =
      peer.avatar || U.fallbackAvatar(peer.fullName, peer.username);
    document.getElementById("thread-name").textContent = peer.fullName;

    var stillFriends = YKS.Friends.areFriends(currentUser.id, peer.id);
    document.getElementById("thread-handle").textContent =
      "@" + peer.username + (stillFriends ? "" : " · arkadaş değilsiniz");

    document.getElementById("thread-actions").innerHTML =
      '<a class="icon-action" href="arkadaslar.html" title="Arkadaşlar">' +
        '<i class="fa-solid fa-user-group"></i></a>';

    /* Balonlar */
    var messages = YKS.Messages.thread(currentUser.id, peer.id);

    if (!messages.length) {
      body.innerHTML = '<div class="thread-empty">' +
        '<i class="fa-solid fa-hand-sparkles"></i>' +
        "<h3>" + U.escape(peer.fullName) + " ile ilk mesaj</h3>" +
        "<p>Sohbeti sen başlat. Yazdıkların yalnızca ikinizin sohbetinde görünür; " +
        "yöneticiler denetim amacıyla yazışmaları sorgulayabilir.</p>" +
      "</div>";
    } else {
      var html = "";
      var lastDay = "";
      var lastFrom = "";

      messages.forEach(function (m) {
        var key = dayKey(m.createdAt);
        if (key !== lastDay) {
          html += '<div class="day-sep">' + dayLabel(m.createdAt) + "</div>";
          lastDay = key;
          lastFrom = "";
        }

        var mine = m.fromId === currentUser.id;
        var firstOfGroup = m.fromId !== lastFrom;
        lastFrom = m.fromId;

        var who = mine ? currentUser : peer;
        var avatar = who.avatar || U.fallbackAvatar(who.fullName, who.username);

        html += '<div class="bubble-row ' + (mine ? "mine" : "theirs") +
            (firstOfGroup ? " first-of-group" : "") + '">' +
          '<img class="bubble-avatar" src="' + avatar + '" alt="" />' +
          '<div class="bubble">' +
            U.escape(m.text) +
            '<div class="bubble-meta">' +
              clockOf(m.createdAt) +
              (mine ? (m.readAt ? ' <i class="fa-solid fa-check-double" title="Okundu"></i>'
                               : ' <i class="fa-solid fa-check" title="Gönderildi"></i>') : "") +
              (mine ? '<button type="button" class="bubble-del" data-del="' + m.id +
                '" title="Mesajı sil"><i class="fa-solid fa-trash"></i></button>' : "") +
            "</div>" +
          "</div>" +
        "</div>";
      });

      body.innerHTML = html;
    }

    /* Yazma alanı — arkadaşlık bozulduysa kilitlenir */
    var locked = document.getElementById("composer-locked");
    if (locked) locked.remove();

    if (stillFriends) {
      composer.classList.remove("is-hidden");
    } else {
      composer.classList.add("is-hidden");
      var warn = document.createElement("div");
      warn.className = "composer-locked";
      warn.id = "composer-locked";
      warn.innerHTML = '<i class="fa-solid fa-lock"></i>' +
        "<span>Bu kişi arkadaş listende değil. Yeniden arkadaş olduğunuzda sohbet açılır.</span>";
      composer.parentNode.appendChild(warn);
    }

    if (stickToBottom) scrollToBottom();
  }

  function scrollToBottom() {
    var body = document.getElementById("thread-body");
    body.scrollTop = body.scrollHeight;
  }

  /* ==========================================================
     6) TOPLU ÇİZİM
     ========================================================== */
  function signature() {
    var me = currentUser.id;
    var rows = YKS.Messages.conversations(me);
    var parts = rows.map(function (r) {
      return r.peerId + ":" + r.total + ":" + r.unread + ":" + (r.last ? r.last.id : "");
    });

    /* Arkadaş listesi de imzaya girsin ki yeni arkadaş anında görünsün */
    parts.push("f" + YKS.Friends.friendsOf(me).length);
    return parts.join("|");
  }

  function renderAll(force) {
    var fresh = YKS.Auth.currentUser();
    if (fresh) currentUser = fresh;

    var sig = signature() + "|" + activePeerId + "|" + searchQuery;
    if (!force && sig === lastSignature) return;
    lastSignature = sig;

    renderList();
    renderThread();
    updateHeaderSub();
  }

  function updateHeaderSub() {
    var unread = YKS.Messages.unreadTotal(currentUser.id);
    var friends = YKS.Friends.friendsOf(currentUser.id).length;

    document.getElementById("header-sub").textContent = friends
      ? friends + " arkadaş" + (unread ? " · " + unread + " okunmamış mesaj" : "")
      : "Önce arkadaş ekle, sohbet burada açılsın.";
  }

  /* ==========================================================
     7) İŞLEMLER
     ========================================================== */
  function openThread(peerId) {
    activePeerId = peerId;
    stickToBottom = true;

    /* Açılan sohbetteki okunmamışları okundu yap */
    YKS.Messages.markRead(currentUser.id, peerId);

    document.getElementById("chat-shell").classList.add("show-thread");
    renderAll(true);

    var input = document.getElementById("composer-input");
    if (!input.classList.contains("is-hidden")) input.focus();
  }

  function sendMessage() {
    var input = document.getElementById("composer-input");
    var text = input.value.trim();

    if (!activePeerId) return;
    if (!text) return;

    var result = YKS.Messages.send(currentUser.id, activePeerId, text);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    input.value = "";
    autoGrow();
    updateCount();
    stickToBottom = true;
    renderAll(true);
    scrollToBottom();
  }

  function deleteMessage(id) {
    var result = YKS.Messages.remove(id, currentUser.id);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    YKS.Toast.show("Mesaj silindi.", "info");
    renderAll(true);
  }

  function autoGrow() {
    var input = document.getElementById("composer-input");
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }

  function updateCount() {
    var input = document.getElementById("composer-input");
    var max = YKS.Config.message.textMax;
    var label = document.getElementById("composer-count");

    label.textContent = input.value.length + "/" + max;
    label.classList.toggle("near-limit", input.value.length > max * 0.9);

    document.getElementById("send-btn").disabled = !input.value.trim();
  }

  /* ==========================================================
     8) OLAYLAR
     ========================================================== */
  function bindEvents() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = "index.html";
    });

    document.getElementById("chat-list").addEventListener("click", function (e) {
      var row = e.target.closest("[data-peer]");
      if (row) openThread(row.getAttribute("data-peer"));
    });

    document.getElementById("thread-back").addEventListener("click", function () {
      document.getElementById("chat-shell").classList.remove("show-thread");
    });

    document.getElementById("thread-body").addEventListener("click", function (e) {
      var del = e.target.closest("[data-del]");
      if (del) deleteMessage(del.getAttribute("data-del"));
    });

    /* Kullanıcı yukarı kaydırdıysa yeni mesaj gelince zıplatma */
    document.getElementById("thread-body").addEventListener("scroll", function (e) {
      var el = e.target;
      stickToBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 60;
    });

    document.getElementById("chat-search").addEventListener("input", U.debounce(function (e) {
      searchQuery = e.target.value.trim().toLocaleLowerCase("tr");
      renderAll(true);
    }, 200));

    var input = document.getElementById("composer-input");

    input.addEventListener("input", function () {
      autoGrow();
      updateCount();
    });

    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      sendMessage();
    });

    document.getElementById("send-btn").addEventListener("click", sendMessage);

    /* Başka sekmede mesaj gelirse anında yansısın */
    window.addEventListener("storage", function (e) {
      if (e.key === YKS.Config.keys.messages ||
          e.key === YKS.Config.keys.friendships ||
          e.key === YKS.Config.keys.friendships) {
        if (activePeerId) YKS.Messages.markRead(currentUser.id, activePeerId);
        renderAll(true);
      }
    });

    /* Aynı sekmede açık kalan sayfa için hafif yoklama */
    window.setInterval(function () {
      if (activePeerId) YKS.Messages.markRead(currentUser.id, activePeerId);
      renderAll(false);
    }, POLL_MS);
  }

  /* ==========================================================
     9) BAŞLATMA
     ========================================================== */
  function init() {
    if (!loadUser()) return;

    bindEvents();
    updateCount();

    /* arkadaslar.html'den "Mesaj Gönder" ile gelinmiş olabilir */
    var params = new URLSearchParams(window.location.search);
    var target = params.get("u");

    if (target && YKS.Friends.areFriends(currentUser.id, target)) {
      openThread(target);
    } else {
      renderAll(true);
    }

    YKS.Particles.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window, document);
