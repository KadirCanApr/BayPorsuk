/* ============================================================
   YKS Takip Sistemi — login.js
   ------------------------------------------------------------
   Giriş ekranı mantığı:
     • E-posta + şifre ile giriş (Supabase Auth)
     • Doğrulama e-postasını yeniden gönderme, şifre sıfırlama
     • Giriş yapan üyenin karşılama ekranı
   Çekirdek fonksiyonlar script.js içindeki YKS ad alanından gelir.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     1) Panel yönetimi
     ========================================================== */
  var PANELS = ["panel-login", "panel-member"];

  /** Yalnızca istenen paneli görünür yapar */
  function showPanel(id) {
    PANELS.forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.classList.toggle("active", p === id);
    });
    
    /* Üye ekranına geçildiğinde sol paneli gizle */
    var authPage = document.querySelector(".auth-page");
    if (id === "panel-member" && authPage) {
      authPage.classList.add("logged-in");
    } else if (authPage) {
      authPage.classList.remove("logged-in");
    }
  }

  /** Panel içindeki hata şeridini gösterir */
  function showAlert(boxId, textId, message) {
    var box = document.getElementById(boxId);
    document.getElementById(textId).textContent = message;
    box.classList.add("show");
  }

  function hideAlert(boxId) {
    document.getElementById(boxId).classList.remove("show");
  }

  /* ==========================================================
     2) Sol paneller — açılır kapanır listeler
     ----------------------------------------------------------
     Üç panel de kapalı başlar, başlığa tıklanınca açılır:
       • Kayıtlı Üyeler
       • En Çok Net Sahipleri (TYT / KPSS / AYT ayrı listeler)
       • En Aktif Kullanıcılar
     ========================================================== */

  /* Net panelinde seçili sınav türü */
  var netType = "tyt";

  /** Paneli açar / kapatır ve erişilebilirlik durumunu günceller */
  function setPanelOpen(panel, head, open) {
    panel.classList.toggle("open", open);
    head.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function bindSidePanels() {
    U.qsa(".side-head").forEach(function (head) {
      var panel = document.getElementById(head.getAttribute("data-panel"));
      if (!panel) return;

      /* Varsayılan: kapalı */
      setPanelOpen(panel, head, false);

      head.addEventListener("click", function () {
        setPanelOpen(panel, head, !panel.classList.contains("open"));
      });
    });
  }

  function bindNetTabs() {
    U.qsa(".side-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        netType = tab.getAttribute("data-net-type");

        U.qsa(".side-tab").forEach(function (other) {
          var on = other === tab;
          other.classList.toggle("active", on);
          other.setAttribute("aria-selected", on ? "true" : "false");
        });

        renderTopNets();
      });
    });
  }

  /* ---------- Ortak biçimlendirme yardımcıları ---------- */

  /** 78.5 → "78,50" */
  function fmtNet(value) {
    return (Number(value) || 0).toFixed(2).replace(".", ",");
  }

  /** Saniyeyi "3s 20dk" / "45dk" biçiminde yazar */
  function fmtDuration(seconds) {
    var total = Math.round((Number(seconds) || 0) / 60);
    var hours = Math.floor(total / 60);
    var mins = total % 60;
    if (hours && mins) return hours + "s " + mins + "dk";
    if (hours) return hours + "s";
    return mins + "dk";
  }

  /** Bir kullanıcının veri kutusundaki diziyi güvenle okur */
  function dataList(user, key) {
    var box = user && user.data;
    return (box && Array.isArray(box[key])) ? box[key] : [];
  }

  /** Sıralama listesi için tek satır üretir */
  function rankRow(user, index, value, unit, meta) {
    var avatar = user.avatar || U.fallbackAvatar(user.fullName, user.username);
    var topClass = index < 3 ? " top-" + (index + 1) : "";

    return '<div class="rank-item' + topClass + '">' +
      '<span class="rank-no">' + (index + 1) + "</span>" +
      '<img class="rank-avatar" src="' + avatar + '" alt="' + U.escape(user.fullName) + '" />' +
      '<div class="rank-id">' +
        '<div class="rank-name">' + U.escape(user.fullName) + "</div>" +
        '<div class="rank-meta">@' + U.escape(user.username) + " · " + meta + "</div>" +
      "</div>" +
      '<div class="rank-score">' +
        '<span class="rank-value">' + value + "</span>" +
        '<span class="rank-unit">' + unit + "</span>" +
      "</div>" +
    "</div>";
  }

  function emptyRank(icon, text) {
    return '<div class="rank-empty"><i class="fa-solid ' + icon + '"></i>' + text + "</div>";
  }

  /**
   * Giriş ekranındaki listeler üye verisi okuyor.
   *
   * supabase/acik-liderlik.sql çalıştırıldıysa bu veri ziyaretçiye de
   * açıktır ve listeler normal görünür. Çalıştırılmadıysa RLS boş liste
   * döndürür — o zaman "Henüz kayıtlı üye yok" yazmak yalan olurdu
   * (üye var, ziyaretçi göremiyor), bunun yerine giriş daveti gösterilir.
   *
   * Bu yüzden ölçüt "giriş yapılmadı" değil, "giriş yapılmadı VE veri
   * gelmedi" — iki kurulumda da doğru davranır.
   */
  function girisGerekliMi() {
    return !YKS.Auth.isLoggedIn() && YKS.Users.all().length === 0;
  }

  function girisGerekliKutu(metin) {
    return '<div class="rank-empty"><i class="fa-solid fa-lock"></i>' +
      (metin || "Görmek için giriş yap.") + "</div>";
  }

  /* ---------- 2a) En çok net sahipleri ---------- */

  /**
   * Seçili sınav türünde her üyenin en iyi netini hesaplar.
   * Veri kaynağı exams.html ile aynı: user.data.denemeler
   */
  function topNetsOf(type) {
    var rows = [];

    YKS.Users.all().forEach(function (user) {
      var exams = dataList(user, "denemeler").filter(function (e) {
        return e && e.type === type;
      });
      if (!exams.length) return;

      var best = -Infinity;
      var sum = 0;

      exams.forEach(function (exam) {
        var net = Number(exam.totalNet) || 0;
        sum += net;
        if (net > best) best = net;
      });

      rows.push({
        user: user,
        best: best,
        average: sum / exams.length,
        count: exams.length
      });
    });

    rows.sort(function (a, b) {
      if (b.best !== a.best) return b.best - a.best;
      return b.average - a.average;
    });

    return rows.slice(0, 10);
  }

  function renderTopNets() {
    var container = document.getElementById("nets-list");
    if (!container) return;

    if (girisGerekliMi()) {
      container.innerHTML = girisGerekliKutu("Sıralamayı görmek için giriş yap.");
      return;
    }

    var label = YKS.Subjects.typeLabel(netType) || netType.toUpperCase();
    var rows = topNetsOf(netType);

    if (!rows.length) {
      container.innerHTML = emptyRank("fa-chart-simple",
        label + " için kayıtlı deneme yok.");
      return;
    }

    container.innerHTML = rows.map(function (row, i) {
      var meta = row.count + " deneme · ort " + fmtNet(row.average);
      return rankRow(row.user, i, fmtNet(row.best), label + " en iyi net", meta);
    }).join("");
  }

  /* ---------- 2b) En aktif kullanıcılar ---------- */

  /**
   * Aktiflik puanı:
   *   her 10 dk çalışma → 1 puan
   *   her deneme        → 5 puan
   *   her ders kaydı    → 2 puan
   *   her hedef         → 3 puan
   */
  function activityOf(user) {
    var sessions = dataList(user, "sureler");
    var exams = dataList(user, "denemeler");
    var lessons = dataList(user, "dersler");
    var goals = dataList(user, "hedefler");

    var seconds = sessions.reduce(function (sum, s) {
      return sum + (Number(s && s.seconds) || 0);
    }, 0);

    var score = Math.round(seconds / 600) +
      exams.length * 5 +
      lessons.length * 2 +
      goals.length * 3;

    return {
      user: user,
      score: score,
      seconds: seconds,
      exams: exams.length,
      lessons: lessons.length,
      goals: goals.length
    };
  }

  function renderActiveUsers() {
    var container = document.getElementById("active-list");
    var sub = document.getElementById("active-count");
    if (!container) return;

    if (girisGerekliMi()) {
      if (sub) sub.textContent = "Giriş gerekli";
      container.innerHTML = girisGerekliKutu("Sıralamayı görmek için giriş yap.");
      return;
    }

    var rows = YKS.Users.all()
      .map(activityOf)
      .filter(function (row) { return row.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 10);

    if (sub) {
      sub.textContent = rows.length
        ? rows.length + " kişi sıralandı"
        : "Çalışma · deneme · hedef";
    }

    if (!rows.length) {
      container.innerHTML = emptyRank("fa-bolt",
        "Henüz aktivite kaydı yok.");
      return;
    }

    container.innerHTML = rows.map(function (row, i) {
      var parts = [];
      if (row.seconds) parts.push(fmtDuration(row.seconds) + " çalışma");
      if (row.exams) parts.push(row.exams + " deneme");
      if (row.goals) parts.push(row.goals + " hedef");
      if (row.lessons) parts.push(row.lessons + " ders");
      return rankRow(row.user, i, row.score, "puan", parts.join(" · ") || "yeni kayıt");
    }).join("");
  }

  /* ---------- 2c) En uzun ders çalışma süresi ---------- */

  /**
   * Her üyenin en uzun tek çalışma oturumunu bulur.
   * Kaynak: sayac.html kayıtları — user.data.sureler
   */
  function longestSessionOf(user) {
    var sessions = dataList(user, "sureler");
    var best = null;
    var total = 0;

    sessions.forEach(function (s) {
      var seconds = Number(s && s.seconds) || 0;
      if (!seconds) return;
      total += seconds;
      if (!best || seconds > best.seconds) best = { seconds: seconds, session: s };
    });

    if (!best) return null;

    return {
      user: user,
      seconds: best.seconds,
      session: best.session,
      total: total
    };
  }

  /** "TYT Matematik" / "Matematik" / "Genel çalışma" */
  function sessionSubject(session) {
    var name = session && session.subjectName;
    if (!name) return "Genel çalışma";

    var type = session.examType ? YKS.Subjects.typeLabel(session.examType) : "";
    return type ? type + " " + name : name;
  }

  function renderLongestLessons() {
    var container = document.getElementById("longest-list");
    var sub = document.getElementById("longest-count");
    if (!container) return;

    if (girisGerekliMi()) {
      if (sub) sub.textContent = "Giriş gerekli";
      container.innerHTML = girisGerekliKutu("Sıralamayı görmek için giriş yap.");
      return;
    }

    var rows = YKS.Users.all()
      .map(longestSessionOf)
      .filter(Boolean)
      .sort(function (a, b) { return b.seconds - a.seconds; })
      .slice(0, 10);

    if (sub) {
      sub.textContent = rows.length
        ? "Rekor: " + fmtDuration(rows[0].seconds)
        : "Tek oturum rekorları";
    }

    if (!rows.length) {
      container.innerHTML = emptyRank("fa-hourglass-half",
        "Henüz çalışma kaydı yok.");
      return;
    }

    container.innerHTML = rows.map(function (row, i) {
      var meta = U.escape(sessionSubject(row.session)) +
        " · toplam " + fmtDuration(row.total);
      return rankRow(row.user, i, fmtDuration(row.seconds), "en uzun oturum", meta);
    }).join("");
  }

  /* ---------- 2d) Bekleyen kayıt başvuruları ---------- */

  /* Başvuru e-postası giriş ekranında kısaltılarak gösterilir.
     Tam adresi göstermek istersen bunu false yap. */
  var MASK_APPLICATION_EMAIL = true;

  /** "kadircan@gmail.com" → "kad•••@gmail.com" */
  function maskEmail(mail) {
    var value = String(mail || "");
    if (!MASK_APPLICATION_EMAIL) return value;

    var at = value.indexOf("@");
    if (at < 1) return value;

    var name = value.slice(0, at);
    var domain = value.slice(at);
    var head = name.slice(0, Math.min(3, name.length));
    return head + "•••" + domain;
  }

  /** "3 gün önce" / "2 saat önce" / "az önce" */
  function timeAgo(ts) {
    var diff = Date.now() - (Number(ts) || 0);
    if (diff < 0) diff = 0;

    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "az önce";
    if (minutes < 60) return minutes + " dakika önce";

    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " saat önce";

    var days = Math.floor(hours / 24);
    if (days < 30) return days + " gün önce";

    return Math.floor(days / 30) + " ay önce";
  }

  function appRow(icon, text) {
    return '<div class="app-row"><i class="fa-solid ' + icon + '"></i><span>' + text + "</span></div>";
  }

  /**
   * Bekleyen başvuru listesi kaldırıldı: kayıt artık e-posta
   * doğrulamayla tamamlanıyor, onay bekleyen kimse olmuyor.
   * Panelin yeri boş kalmasın diye en yeni üyeler gösteriliyor.
   */
  function renderPendingApplications() {
    var box = document.getElementById("apps-list");
    var sayac = document.getElementById("apps-count");
    if (!box) return;

    if (girisGerekliMi()) {
      if (sayac) sayac.textContent = "Giriş gerekli";
      box.innerHTML = girisGerekliKutu("Üyeleri görmek için giriş yap.");
      return;
    }

    var list = YKS.Users.all().slice().sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }).slice(0, 8);

    if (sayac) sayac.textContent = list.length ? list.length + " üye" : "Kayıt yok";

    if (!list.length) {
      box.innerHTML = emptyRank("fa-user-plus", "Henüz kimse katılmadı.");
      return;
    }

    box.innerHTML = list.map(function (u, i) {
      return rankRow(u, i, "", "", U.formatDate(u.createdAt));
    }).join("");
  }

  /* ---------- 2e) Kayıtlı üyeler ---------- */
  function renderMembersList() {
    var list = YKS.Users.all().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    var container = document.getElementById("members-list");
    var sub = document.getElementById("members-count");

    if (girisGerekliMi()) {
      if (sub) sub.textContent = "Giriş gerekli";
      container.innerHTML = girisGerekliKutu("Üye listesini görmek için giriş yap.");
      return;
    }

    if (sub) sub.textContent = list.length ? list.length + " üye" : "Kayıt yok";

    if (!list.length) {
      container.innerHTML = 
        '<div class="empty-members">' +
        '<i class="fa-solid fa-users"></i>' +
        '<p>Henüz kayıtlı üye yok</p>' +
        '</div>';
      return;
    }

    container.innerHTML = list.map(function (user) {
      var avatar = user.avatar || U.fallbackAvatar(user.fullName, user.username);
      var bannerStyle = user.banner ? ' style="background-image:url(' + user.banner + ')"' : '';
      
      return '<div class="member-item">' +
        '<div class="member-banner-small"' + bannerStyle + '></div>' +
        '<div class="member-info">' +
          '<img class="member-avatar-small" src="' + avatar + '" alt="' + U.escape(user.fullName) + '" />' +
          '<div class="member-name-small">' + U.escape(user.fullName) + '</div>' +
          '<div class="member-username-small">@' + U.escape(user.username) + '</div>' +
          '<div class="member-tags-small">' +
            '<span class="badge-x"><i class="fa-solid fa-cake-candles"></i> ' + user.age + '</span>' +
            '<span class="badge-x"><i class="fa-solid fa-book"></i> ' + 
              U.escape(U.labelOf(YKS.Config.fields, user.examField)) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /** Veriden beslenen listeleri birden tazeler */
  function refreshSideLists() {
    renderMembersList();
    renderTopNets();
    renderActiveUsers();
    renderLongestLessons();
    renderPendingApplications();
  }

  /* ==========================================================
     3) Şifre göster / gizle düğmeleri
     ========================================================== */
  function bindPasswordToggles() {
    U.qsa("[data-toggle-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-toggle-password"));
        if (!input) return;
        var isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        btn.querySelector("i").className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
        btn.setAttribute("aria-label", isHidden ? "Şifreyi gizle" : "Şifreyi göster");
        input.focus();
      });
    });
  }

  /* ==========================================================
     3b) Giriş
     ----------------------------------------------------------
     Kimlik doğrulama Supabase'de. Şifre bu koda hiç girmez;
     signIn çağrısı sunucuya gider, sunucu bcrypt ile doğrular.

     Eski CAPTCHA kaldırıldı: kaba kuvvet koruması artık Supabase
     tarafında (oran sınırlama). İstemcide sayaç tutmak zaten
     caydırıcıydı, gerçek koruma değildi.
     ========================================================== */
  function bindLoginForm() {
    var form = document.getElementById("login-form");
    var btn = document.getElementById("login-submit");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideAlert("login-alert");

      var email = document.getElementById("login-email").value;
      var password = document.getElementById("login-password").value;

      if (!email.trim() || !password) {
        showAlert("login-alert", "login-alert-text", "E-posta ve şifreyi doldur.");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Giriş yapılıyor…';

      YKS.Auth.signIn(email, password).then(function (r) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Giriş yap';

        if (!r.ok) {
          showAlert("login-alert", "login-alert-text", r.error);
          if (/doğrulaman gerekiyor/i.test(r.error)) {
            var bag = document.getElementById("resend-row");
            if (bag) bag.style.display = "";
          }
          return;
        }

        YKS.Toast.show("Giriş yapıldı. Hoş geldin " + r.user.fullName + ".", "ok");
        refreshSideLists();

        if (r.user.role === "admin") {
          setTimeout(function () { window.location.href = "admin.html"; }, 450);
          return;
        }
        renderMember(r.user);
        showPanel("panel-member");
      });
    });

    var resend = document.getElementById("resend-btn");
    if (resend) {
      resend.addEventListener("click", function () {
        var email = document.getElementById("login-email").value.trim();
        if (!email) return YKS.Toast.show("Önce e-postanı yaz.", "warn");
        resend.disabled = true;
        YKS.Auth.resendConfirmation(email).then(function (r) {
          resend.disabled = false;
          YKS.Toast.show(r.ok ? "Doğrulama e-postası tekrar gönderildi." : r.error,
                         r.ok ? "ok" : "error");
        });
      });
    }

    var forgot = document.getElementById("forgot-btn");
    if (forgot) {
      forgot.addEventListener("click", function () {
        var email = document.getElementById("login-email").value.trim();
        if (!email) return YKS.Toast.show("Önce e-postanı yaz.", "warn");
        forgot.disabled = true;
        YKS.Auth.resetPassword(email).then(function (r) {
          forgot.disabled = false;
          YKS.Toast.show(r.ok ? "Şifre sıfırlama bağlantısı gönderildi." : r.error,
                         r.ok ? "ok" : "error");
        });
      });
    }
  }

  /* ==========================================================
     5) Üye karşılama ekranı
     ========================================================== */
  function renderMember(user) {
    /* Banner */
    var banner = document.getElementById("member-banner");
    banner.style.backgroundImage = user.banner ? "url(" + user.banner + ")" : "";

    /* Avatar */
    var avatar = document.getElementById("member-avatar");
    avatar.src = user.avatar || U.fallbackAvatar(user.fullName, user.username);
    avatar.alt = user.fullName + " profil fotoğrafı";

    /* Kimlik */
    document.getElementById("member-name").textContent = user.fullName;
    document.getElementById("member-handle").textContent = "@" + user.username;

    /* Etiketler */
    var meta = document.getElementById("member-meta");
    meta.innerHTML =
      '<span class="badge-x badge-' + (user.role === "admin" ? "admin" : "uye") + '">' +
        '<i class="fa-solid ' + (user.role === "admin" ? "fa-shield-halved" : "fa-user") + '"></i>' +
        U.escape(U.labelOf(YKS.Config.roles, user.role)) +
      "</span>" +
      '<span class="badge-x"><i class="fa-solid fa-book"></i>' +
        U.escape(U.labelOf(YKS.Config.fields, user.examField)) + "</span>" +
      '<span class="badge-x"><i class="fa-solid fa-cake-candles"></i>' + U.escape(user.age) + " yaş</span>" +
      '<span class="badge-x"><i class="fa-solid fa-calendar-day"></i>' +
        U.escape(U.formatDate(user.createdAt)) + "</span>";

    /* Açıklama */
    var bio = document.getElementById("member-bio");
    bio.textContent = user.description || "Açıklama eklenmemiş.";

    /* Arkadaşlık ve mesaj kartlarında bekleyen iş varsa sayıyı göster */
    var incoming = YKS.Friends.incoming(user.id).length;
    var unread = YKS.Messages.unreadTotal(user.id);

    var friendsNote = document.getElementById("module-friends-note");
    if (friendsNote) {
      friendsNote.textContent = incoming ? incoming + " yeni istek" : "Aktif";
    }

    var messagesNote = document.getElementById("module-messages-note");
    if (messagesNote) {
      messagesNote.textContent = unread ? unread + " okunmamış" : "Aktif";
    }

    var socialNote = document.getElementById("module-social-note");
    if (socialNote) {
      var gonderi = YKS.Posts.count();
      socialNote.textContent = gonderi ? gonderi + " gönderi" : "Aktif";
    }

    /* Son kazanılan rozetler — rozetler.js motoruyla hesaplanır */
    renderBadgeStrip(user);

    /* Soldaki bildirimler sütunu.
       Beş ayrı modülün verisini topladığı için hata riski en yüksek
       parça burası; patlarsa üye panelinin tamamı çizilmeden kalırdı.
       Bu yüzden ayrı sarmalanıyor. */
    try {
      renderNotifications(user);
    } catch (e) {
      console.error("[YKS] Bildirimler çizilemedi:", e);
      var nl = document.getElementById("notif-list");
      if (nl) {
        nl.innerHTML = '<div class="notif-empty">' +
          '<i class="fa-solid fa-triangle-exclamation"></i>' +
          "Bildirimler yüklenemedi.</div>";
      }
    }

    /* Yakında gelecek modül kartları — YKS.Roadmap'ten üretilir.
       Liste boşsa başlık ve boş ızgara ortada kalmasın diye
       bölümün tamamı gizlenir. */
    var soonSection = document.getElementById("member-soon-section");
    var soon = document.getElementById("member-soon");

    if (!YKS.Roadmap.length) {
      if (soonSection) soonSection.style.display = "none";
    } else {
      if (soonSection) soonSection.style.display = "";
      soon.innerHTML = YKS.Roadmap.slice(0, 8).map(function (m) {
        return '<div class="soon-card">' +
          '<i class="fa-solid ' + m.icon + '"></i>' +
          "<h4>" + U.escape(m.title) + "</h4>" +
          "<span>" + U.escape(m.note) + "</span>" +
        "</div>";
      }).join("");
    }

    /* Admin ise panele kısayol göster */
    document.getElementById("member-admin-link").style.display =
      user.role === "admin" ? "inline-flex" : "none";
  }

  /* ==========================================================
     5b) Bildirimler sütunu
     ----------------------------------------------------------
     Veri YKS.Notifications'tan gelir ve türetilmiştir; burada
     yalnızca çizim ve "okundu" işaretlemesi var.
     ========================================================== */

  /** 1753900000000 → "3 saat önce" */
  function notifZaman(ts) {
    var fark = Date.now() - Number(ts || 0);
    if (fark < 0) fark = 0;

    var dk = Math.floor(fark / 60000);
    if (dk < 1) return "az önce";
    if (dk < 60) return dk + " dk önce";

    var sa = Math.floor(dk / 60);
    if (sa < 24) return sa + " saat önce";

    var gun = Math.floor(sa / 24);
    if (gun < 7) return gun + " gün önce";

    return U.formatDate(ts);
  }

  function renderNotifications(user) {
    var liste = document.getElementById("notif-list");
    if (!liste || !YKS.Notifications) return;

    var kayitlar = YKS.Notifications.list(user, 40);
    var okunmamis = kayitlar.filter(function (n) { return n.unread; }).length;

    /* Başlıktaki sayaç */
    var rozet = document.getElementById("notif-badge");
    rozet.textContent = okunmamis;
    rozet.hidden = okunmamis === 0;

    document.getElementById("notif-sub").textContent = kayitlar.length
      ? (okunmamis ? okunmamis + " yeni bildirim" : kayitlar.length + " bildirim")
      : "Her şey sakin";

    document.getElementById("notif-mark").disabled = okunmamis === 0;
    document.getElementById("notif-clear").disabled = kayitlar.length === 0;

    if (!kayitlar.length) {
      liste.innerHTML =
        '<div class="notif-empty">' +
          '<i class="fa-solid fa-bell-slash"></i>' +
          "Bildirim yok.<br />Yeni bir hareket olduğunda burada görünecek." +
        "</div>";
      return;
    }

    liste.innerHTML = kayitlar.map(function (n) {
      return '<a class="notif-item tone-' + n.tone + (n.unread ? " unread" : "") +
          '" href="' + n.href + '">' +
        '<span class="notif-item-ic"><i class="fa-solid ' + n.icon + '"></i></span>' +
        '<span class="notif-body">' +
          '<span class="notif-text"><b>' + U.escape(n.title) + "</b> " +
            U.escape(n.text) + "</span>" +
          '<span class="notif-time">' + notifZaman(n.at) + "</span>" +
        "</span>" +
        '<button type="button" class="notif-del" data-notif-del="' + U.escape(n.id) + '" ' +
          'title="Bildirimi sil" aria-label="Bildirimi sil">' +
          '<i class="fa-solid fa-xmark"></i></button>' +
      "</a>";
    }).join("");

    bindNotifDelete(liste);
  }

  /** Satırdaki × düğmeleri — bağlantıyı tetiklemeden siler */
  function bindNotifDelete(root) {
    U.qsa("[data-notif-del]", root).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        /* Düğme bir <a> içinde; tıklama sayfayı açmasın */
        e.preventDefault();
        e.stopPropagation();

        var user = YKS.Auth.currentUser();
        if (!user || !YKS.Notifications) return;

        if (!YKS.Notifications.dismiss(user, btn.getAttribute("data-notif-del"))) {
          return YKS.Toast.show("Bildirim silinemedi.", "error");
        }

        renderNotifications(YKS.Auth.currentUser() || user);
      });
    });
  }

  function bindNotifications() {
    var mark = document.getElementById("notif-mark");
    var clear = document.getElementById("notif-clear");
    if (!mark || !clear) return;

    mark.addEventListener("click", function () {
      var user = YKS.Auth.currentUser();
      if (!user || !YKS.Notifications) return;

      if (!YKS.Notifications.markSeen(user)) {
        return YKS.Toast.show("Bildirimler işaretlenemedi.", "error");
      }

      /* Damga kullanıcı kaydına yazıldı; taze kaydı okuyup yeniden çiz */
      renderNotifications(YKS.Auth.currentUser() || user);
      YKS.Toast.show("Bildirimler okundu olarak işaretlendi.", "ok");
    });

    clear.addEventListener("click", function () {
      var user = YKS.Auth.currentUser();
      if (!user || !YKS.Notifications) return;

      var sayi = YKS.Notifications.list(user).length;
      if (!sayi) return;

      if (!YKS.Notifications.clearAll(user)) {
        return YKS.Toast.show("Bildirimler silinemedi.", "error");
      }

      renderNotifications(YKS.Auth.currentUser() || user);
      YKS.Toast.show(sayi + " bildirim silindi.", "ok");
    });
  }

  /**
   * Üye panelindeki "son rozetlerin" şeridi.
   *
   * Rozet motoru rozetler.js ile gelir. O dosya yüklenmemişse şerit
   * sessizce boş kalır; panelin geri kalanı çalışmaya devam eder.
   * Hesap rozetler.html açılmadan da işler — burada da kilit açılır.
   */
  function renderBadgeStrip(user) {
    var box = document.getElementById("member-badges");
    if (!box) return;

    if (!YKS.Rozetler) { box.innerHTML = ""; return; }

    var data = YKS.Rozetler.recent(user, 3);

    /* Modül kartındaki not satırı toplamı göstersin */
    var note = document.getElementById("module-badges-note");
    if (note) {
      note.textContent = data.earned
        ? data.earned + " / " + data.total + " rozet"
        : "Aktif";
    }

    if (!data.list.length) {
      box.innerHTML =
        '<a class="rozet-chip empty" href="rozetler.html">' +
          '<span class="chip-medal"><i class="fa-solid fa-award"></i></span>' +
          '<span class="chip-text">' +
            '<span class="chip-title">Henüz rozetin yok</span>' +
            '<span class="chip-note">Çalışmaya başla, ilki kendiliğinden gelsin</span>' +
          "</span>" +
        "</a>";
      return;
    }

    box.innerHTML = data.list.map(function (row) {
      return '<a class="rozet-chip tier-' + row.def.tier + '" href="rozetler.html" ' +
          'title="' + U.escape(row.def.desc) + '">' +
        '<span class="chip-medal"><i class="fa-solid ' + row.def.icon + '"></i></span>' +
        '<span class="chip-text">' +
          '<span class="chip-title">' + U.escape(row.def.title) + "</span>" +
          '<span class="chip-note">' +
            (row.earnedAt ? U.escape(U.formatDate(row.earnedAt)) : "Kazanıldı") +
          "</span>" +
        "</span>" +
      "</a>";
    }).join("");
  }

  function bindMemberActions() {
    document.getElementById("member-logout").addEventListener("click", function () {
      YKS.Auth.logout();
      YKS.Toast.show("Çıkış yapıldı.", "info");
      document.getElementById("login-form").reset();

      /* Oturum sırasında değişen veriler listelere yansısın */
      refreshSideLists();

      /* Sol paneli tekrar göster */
      var authPage = document.querySelector(".auth-page");
      if (authPage) {
        authPage.classList.remove("logged-in");
      }
      
      showPanel("panel-login");
    });
  }

  /* ==========================================================
     6) Açılış — mevcut oturumu kontrol et
     ========================================================== */
  function restoreSession() {
    /* Yetkisiz erişim denemesi sonrası yönlendirme geldiyse uyar */
    if (/[?&]reason=yetki/.test(window.location.search)) {
      YKS.Toast.show("Bu sayfa için yönetici oturumu gerekli.", "warn", 4200);
      /* Adres çubuğunu temizle */
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    /* E-posta doğrulama bağlantısından dönüldüyse haber ver.
       Supabase jetonu adres çubuğunda taşır ve sb.js
       detectSessionInUrl ile oturumu kendisi kurar. */
    if (/access_token|type=signup|type=recovery/.test(window.location.hash)) {
      YKS.Toast.show("E-posta adresin doğrulandı. Hoş geldin!", "ok", 4200);
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    if (!YKS.Auth.isLoggedIn()) {
      showPanel("panel-login");
      return;
    }

    var user = YKS.Auth.currentUser();
    if (!user) {
      /* Oturum var ama profil yok — hesap silinmiş olabilir */
      YKS.Auth.logout().then(function () { showPanel("panel-login"); });
      return;
    }

    if (user.role === "admin") {
      window.location.href = "admin.html";
      return;
    }

    renderMember(user);
    showPanel("panel-member");
  }

  /* ==========================================================
     7) Başlat
     ========================================================== */
  /* DOMContentLoaded yerine hazır kapısı: oturum ve profiller
     yüklendikten sonra çalışır (bkz. script.js 4b bölümü). */
  YKS.hazir(function () {
    bindSidePanels();
    bindNetTabs();
    refreshSideLists();
    bindPasswordToggles();
    bindLoginForm();
    bindNotifications();
    bindMemberActions();
    restoreSession();
  });

})(window, document);
