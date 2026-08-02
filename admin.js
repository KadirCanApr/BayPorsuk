/* ============================================================
   YKS Takip Sistemi — admin.js
   ------------------------------------------------------------
   Admin paneli mantığı:
     • Bölüm (view) geçişleri ve mobil menü
     • Hesap oluşturma / düzenleme formu
     • Görsel yükleme ve önizleme
     • Kullanıcı listesi: arama, filtre, silme
     • Mesajlaşma sorgusu: bir üyenin yazışma dökümü
     • Yedek alma / geri yükleme / tüm kayıtları silme
     • Oturum bilgisi ve çıkış
   Yetki kontrolü admin.html içinde, sayfa çizilmeden önce yapılır.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* Form düzenleme modundaysa hangi kullanıcıyı düzenliyoruz */
  var editingId = null;

  /* Yüklenen görsellerin veri-URL'leri */
  var media = { avatar: null, banner: null };

  /* Silme onayı bekleyen işlem */
  var pendingConfirm = null;

  /* ==========================================================
     1) Bölüm geçişleri
     ========================================================== */
  function showView(id) {
    U.qsa(".view").forEach(function (v) { v.classList.toggle("active", v.id === id); });
    U.qsa(".nav-item[data-view]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === id);
    });
    closeMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindNav() {
    U.qsa(".nav-item[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () { showView(btn.getAttribute("data-view")); });
    });
    /* Sayfa içi kısayol butonları */
    U.qsa("[data-goto]").forEach(function (btn) {
      btn.addEventListener("click", function () { showView(btn.getAttribute("data-goto")); });
    });
  }

  /* ---------- Mobil menü ---------- */
  function openMenu() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("menu-backdrop").classList.add("show");
  }
  function closeMenu() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("menu-backdrop").classList.remove("show");
  }
  function bindMenu() {
    document.getElementById("menu-toggle").addEventListener("click", openMenu);
    document.getElementById("menu-backdrop").addEventListener("click", closeMenu);
  }

  /* ==========================================================
     2) Kenar çubuğu: oturum bilgisi ve kilitli bölümler
     ========================================================== */
  function renderSession() {
    var s = YKS.Auth.session();
    if (!s) return;
    var user = YKS.Auth.currentUser();
    document.getElementById("session-name").textContent =
      user ? user.fullName : "Kurucu oturumu";
    document.getElementById("session-type").textContent =
      s.type === "gate" ? "Yönetim kodu ile giriş" : "@" + s.username;
  }

  /** Yol haritasındaki modülleri kilitli menü öğesi olarak listeler */
  function renderLockedNav() {
    var nav = document.getElementById("locked-nav");

    /* Bekleyen modül kalmadıysa "Yakında" başlığı boşta kalmasın */
    var grup = nav.closest(".side-group");
    if (grup) grup.style.display = YKS.Roadmap.length ? "" : "none";

    nav.innerHTML = YKS.Roadmap.slice(0, 6).map(function (m) {
      return '<button type="button" class="nav-item locked" disabled>' +
        '<i class="fa-solid ' + m.icon + '"></i> ' + U.escape(m.title) +
        '<span class="soon-tag">yakında</span></button>';
    }).join("");
  }

  /* ==========================================================
     3) Genel bakış
     ========================================================== */
  function renderStats() {
    var s = YKS.Users.stats();
    var cards = [
      { k: "Toplam hesap", v: s.total },
      { k: "Üye", v: s.members },
      { k: "Admin", v: s.admins },
      { k: "Sayısal", v: s.sayisal },
      { k: "Eşit Ağırlık", v: s.esit },
      { k: "Sözel", v: s.sozel }
    ];
    document.getElementById("stat-grid").innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><div class="k">' + c.k + '</div><div class="v">' + c.v + "</div></div>";
    }).join("");
  }

  function renderRecent() {
    var box = document.getElementById("recent-users");
    var list = YKS.Users.all().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 4);

    if (!list.length) {
      box.innerHTML =
        '<div class="empty-x"><i class="fa-solid fa-user-plus"></i>' +
        "<h3>Henüz hesap yok</h3>" +
        "<p>İlk hesabı oluştur, giriş ekranı böylece kullanılabilir olsun.</p>" +
        '<button type="button" class="btn-x btn-primary-x" data-goto="view-olustur">' +
        '<i class="fa-solid fa-user-plus"></i> Hesap oluştur</button></div>';
      /* Yeni eklenen butonu bağla */
      U.qsa("[data-goto]", box).forEach(function (btn) {
        btn.addEventListener("click", function () { showView(btn.getAttribute("data-goto")); });
      });
      return;
    }

    box.innerHTML = '<div class="user-grid">' + list.map(userCardHTML).join("") + "</div>";
    bindUserCardActions(box);
  }

  function renderRoadmap() {
    var grid = document.getElementById("roadmap-grid");

    /* Yol haritası boşsa kartın tamamı gizlenir */
    var kart = grid.closest(".card-x");
    if (kart) kart.style.display = YKS.Roadmap.length ? "" : "none";

    grid.innerHTML = YKS.Roadmap.map(function (m) {
      return '<div class="roadmap-card">' +
        '<i class="fa-solid ' + m.icon + '"></i>' +
        "<h4>" + U.escape(m.title) + "</h4>" +
        "<p>" + U.escape(m.note) + "</p></div>";
    }).join("");
  }

  /* ==========================================================
     4) Kullanıcı kartı
     ========================================================== */
  function userCardHTML(u) {
    var roleClass = u.role === "admin" ? "badge-admin" : "badge-uye";
    var roleIcon = u.role === "admin" ? "fa-shield-halved" : "fa-user";
    var avatar = u.avatar || U.fallbackAvatar(u.fullName, u.username);
    var bannerStyle = u.banner ? ' style="background-image:url(' + u.banner + ')"' : "";

    return '<article class="user-card" data-id="' + u.id + '">' +
      '<div class="user-banner"' + bannerStyle + "></div>" +
      '<div class="user-top">' +
        '<img class="user-avatar" src="' + avatar + '" alt="' + U.escape(u.fullName) + '" />' +
        '<div class="user-name">' +
          "<strong>" + U.escape(u.fullName) + "</strong>" +
          "<span>@" + U.escape(u.username) + " · " + U.escape(u.age) + " yaş</span>" +
        "</div>" +
      "</div>" +
      '<div class="user-body">' +
        '<div class="user-tags">' +
          '<span class="badge-x ' + roleClass + '"><i class="fa-solid ' + roleIcon + '"></i>' +
            U.escape(U.labelOf(YKS.Config.roles, u.role)) + "</span>" +
          '<span class="badge-x"><i class="fa-solid fa-book"></i>' +
            U.escape(U.labelOf(YKS.Config.fields, u.examField)) + "</span>" +
        "</div>" +
        '<p class="user-desc">' + U.escape(u.description || "Açıklama eklenmemiş.") + "</p>" +
        '<div class="user-actions">' +
          '<button type="button" class="btn-x btn-ghost-x" data-edit="' + u.id + '">' +
            '<i class="fa-solid fa-pen"></i> Düzenle</button>' +
          '<button type="button" class="btn-x btn-danger-x" data-del="' + u.id + '">' +
            '<i class="fa-solid fa-trash"></i> Sil</button>' +
        "</div>" +
      "</div></article>";
  }

  function bindUserCardActions(root) {
    U.qsa("[data-edit]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { startEdit(btn.getAttribute("data-edit")); });
    });
    U.qsa("[data-del]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { askDeleteUser(btn.getAttribute("data-del")); });
    });
  }

  /* ==========================================================
     5) Kullanıcı listesi + filtreler
     ========================================================== */
  function renderUserList() {
    var q = U.normalizeUsername(document.getElementById("search-input").value);
    var role = document.getElementById("filter-role").value;
    var field = document.getElementById("filter-field").value;

    var all = YKS.Users.all();
    var list = all.filter(function (u) {
      var haystack = U.normalizeUsername(u.username + u.fullName);
      if (q && haystack.indexOf(q) === -1) return false;
      if (role && u.role !== role) return false;
      if (field && u.examField !== field) return false;
      return true;
    }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    document.getElementById("user-count-label").textContent =
      all.length + " hesap kayıtlı · " + list.length + " tanesi listeleniyor";

    var box = document.getElementById("user-list");

    if (!all.length) {
      box.innerHTML =
        '<div class="empty-x"><i class="fa-solid fa-users"></i>' +
        "<h3>Kayıtlı hesap yok</h3>" +
        "<p>Hesap oluştur bölümünden ilk kullanıcıyı ekle.</p></div>";
      return;
    }
    if (!list.length) {
      box.innerHTML =
        '<div class="empty-x"><i class="fa-solid fa-magnifying-glass"></i>' +
        "<h3>Eşleşme yok</h3>" +
        "<p>Arama veya filtreleri değiştirip tekrar dene.</p></div>";
      return;
    }

    box.innerHTML = '<div class="user-grid">' + list.map(userCardHTML).join("") + "</div>";
    bindUserCardActions(box);
  }

  function bindFilters() {
    document.getElementById("search-input")
      .addEventListener("input", U.debounce(renderUserList, 180));
    document.getElementById("filter-role").addEventListener("change", renderUserList);
    document.getElementById("filter-field").addEventListener("change", renderUserList);
  }

  /* ==========================================================
     6) Görsel yükleme
     ========================================================== */
  function bindUploads() {
    setupUpload("avatar", "file-avatar", "up-avatar", "prev-avatar", YKS.Config.media.avatar);
    setupUpload("banner", "file-banner", "up-banner", "prev-banner", YKS.Config.media.banner);

    /* Kaldır butonları */
    U.qsa("[data-clear]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var kind = btn.getAttribute("data-clear");
        clearUpload(kind);
      });
    });
  }

  function setupUpload(kind, inputId, boxId, previewId, preset) {
    var input = document.getElementById(inputId);
    var box = document.getElementById(boxId);
    var preview = document.getElementById(previewId);

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;

      YKS.Media.toDataURL(file, preset).then(function (dataUrl) {
        media[kind] = dataUrl;
        preview.src = dataUrl;
        box.classList.add("filled");
      }).catch(function (err) {
        input.value = "";
        YKS.Toast.show(err.message || "Görsel yüklenemedi.", "error");
      });
    });
  }

  function clearUpload(kind) {
    media[kind] = null;
    var box = document.getElementById(kind === "avatar" ? "up-avatar" : "up-banner");
    var input = document.getElementById(kind === "avatar" ? "file-avatar" : "file-banner");
    var preview = document.getElementById(kind === "avatar" ? "prev-avatar" : "prev-banner");
    box.classList.remove("filled");
    preview.removeAttribute("src");
    input.value = "";
  }

  /* ==========================================================
     7) Hesap formu — oluşturma ve düzenleme
     ========================================================== */
  function readForm() {
    return {
      username: document.getElementById("f-username").value,
      password: document.getElementById("f-password").value,
      fullName: document.getElementById("f-fullname").value,
      age: document.getElementById("f-age").value,
      description: document.getElementById("f-desc").value,
      role: document.getElementById("f-role").value,
      examField: document.getElementById("f-field").value,
      avatar: media.avatar,
      banner: media.banner
    };
  }

  function resetForm() {
    editingId = null;
    document.getElementById("account-form").reset();
    clearUpload("avatar");
    clearUpload("banner");

    document.getElementById("form-title").textContent = "Hesap oluştur";
    document.getElementById("form-subtitle").textContent =
      "Bilgileri doldur ve kaydet. Hesaplar yalnızca buradan açılır.";
    document.getElementById("password-hint").textContent =
      "Şifre kayıtta hash'lenerek saklanır.";
    document.getElementById("save-btn").innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i> Kaydet';
    document.getElementById("cancel-edit-btn").style.display = "none";
    document.getElementById("f-username").disabled = false;
  }

  /** Düzenleme moduna geçer ve formu doldurur */
  function startEdit(id) {
    var u = YKS.Users.byId(id);
    if (!u) return YKS.Toast.show("Kullanıcı bulunamadı.", "error");

    editingId = id;
    document.getElementById("f-username").value = u.username;
    document.getElementById("f-username").disabled = true; /* kullanıcı adı sabit kalır */
    document.getElementById("f-password").value = "";
    document.getElementById("f-fullname").value = u.fullName;
    document.getElementById("f-age").value = u.age;
    document.getElementById("f-desc").value = u.description || "";
    document.getElementById("f-role").value = u.role;
    document.getElementById("f-field").value = u.examField;

    /* Mevcut görselleri önizlemeye taşı */
    media.avatar = u.avatar || null;
    media.banner = u.banner || null;
    if (u.avatar) {
      document.getElementById("prev-avatar").src = u.avatar;
      document.getElementById("up-avatar").classList.add("filled");
    } else { clearUpload("avatar"); }
    if (u.banner) {
      document.getElementById("prev-banner").src = u.banner;
      document.getElementById("up-banner").classList.add("filled");
    } else { clearUpload("banner"); }

    document.getElementById("form-title").textContent = "Hesabı düzenle";
    document.getElementById("form-subtitle").textContent = "@" + u.username + " kaydını güncelliyorsun.";
    document.getElementById("password-hint").textContent =
      "Boş bırakırsan mevcut şifre değişmez.";
    document.getElementById("save-btn").innerHTML =
      '<i class="fa-solid fa-floppy-disk"></i> Değişiklikleri kaydet';
    document.getElementById("cancel-edit-btn").style.display = "inline-flex";

    showView("view-olustur");
  }

  function bindForm() {
    var form = document.getElementById("account-form");
    var saveBtn = document.getElementById("save-btn");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = readForm();
      saveBtn.disabled = true;

      var result;
      if (editingId) {
        /* --- Güncelleme --- */
        var patch = {
          fullName: input.fullName.trim(),
          age: parseInt(input.age, 10),
          description: input.description.trim(),
          role: input.role,
          examField: input.examField,
          avatar: media.avatar,
          banner: media.banner
        };
        if (input.password) patch.password = input.password;

        if (!patch.fullName || patch.fullName.length < 2) {
          saveBtn.disabled = false;
          return YKS.Toast.show("Ad Soyad alanı boş bırakılamaz.", "error");
        }
        if (isNaN(patch.age) || patch.age < 10 || patch.age > 99) {
          saveBtn.disabled = false;
          return YKS.Toast.show("Yaş 10 ile 99 arasında olmalı.", "error");
        }

        /* Güncelleme artık sunucuya gidiyor — async */
        YKS.Users.update(editingId, patch).then(function (result) {
          saveBtn.disabled = false;
          if (!result.ok) return YKS.Toast.show(result.error, "error");

          YKS.Toast.show("Hesap güncellendi.", "ok");
          resetForm();
          refreshAll();
          showView("view-kullanicilar");
        });
        return;
      }

      /* --- Yeni kayıt ---
         Admin artık elle hesap açamıyor: şifreyi Supabase Auth
         belirliyor ve kullanıcının kendi e-postasını doğrulaması
         gerekiyor. Buradan hesap açmak kimliği doğrulanmamış bir
         kullanıcı üretirdi. */
      saveBtn.disabled = false;
      YKS.Toast.show(
        "Hesaplar artık kayıt sayfasından açılıyor; kişi kendi e-postasını doğrulamalı.",
        "warn", 5000);
    });

    document.getElementById("reset-btn").addEventListener("click", function () {
      resetForm();
      YKS.Toast.show("Form temizlendi.", "info", 1800);
    });

    document.getElementById("cancel-edit-btn").addEventListener("click", function () {
      resetForm();
      showView("view-kullanicilar");
    });

    /* Şifre göster/gizle */
    U.qsa("[data-toggle-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var el = document.getElementById(btn.getAttribute("data-toggle-password"));
        var hidden = el.type === "password";
        el.type = hidden ? "text" : "password";
        btn.querySelector("i").className = hidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
      });
    });
  }

  /* ==========================================================
     8) Onay penceresi
     ========================================================== */
  function askConfirm(title, text, okLabel, onOk, icon) {
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-text").textContent = text;
    document.getElementById("confirm-ok").innerHTML =
      '<i class="fa-solid ' + (icon || "fa-trash") + '"></i> ' + okLabel;
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
  }

  function askDeleteUser(id) {
    var u = YKS.Users.byId(id);
    if (!u) return;

    /* Kendi oturumunu silmeyi engelle */
    var session = YKS.Auth.session();
    if (session && session.userId === id) {
      return YKS.Toast.show("Kendi hesabını silemezsin.", "warn");
    }

    askConfirm(
      "Hesabı sil",
      "@" + u.username + " ve bu hesaba bağlı tüm veriler silinecek.",
      "Hesabı sil",
      function () {
        /* Silme sunucuya gidiyor; bağlı kayıtları veritabanındaki
           "on delete cascade" kuralları temizliyor. */
        YKS.Users.remove(id).then(function (r) {
          if (!r.ok) return YKS.Toast.show(r.error, "error");
          YKS.Toast.show("Hesap silindi.", "ok");
          refreshAll();
        });
        return;
      }
    );
  }

  /* ==========================================================
     9) Veri yönetimi: yedek al / yükle / temizle
     ========================================================== */
  function bindDataTools() {
    /* --- Yedeği indir --- */
    document.getElementById("export-btn").addEventListener("click", function () {
      var payload = {
        app: YKS.Config.appName,
        version: YKS.Config.version,
        exportedAt: new Date().toISOString(),
        users: YKS.Users.all(),
        announcements: YKS.Announcements.all(),
        friendships: YKS.Friends.all(),
        messages: YKS.Messages._raw()
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "yks-takip-yedek-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      YKS.Toast.show("Yedek indirildi.", "ok");
    });

    /* --- Yedek yükle --- */
    document.getElementById("import-input").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.users)) throw new Error("format");

          /* Eski yedeklerde yalnızca "users" olabilir; bu alanlar
             yoksa mevcut kayıtlara dokunulmaz */
          var extras = [];
          if (Array.isArray(data.friendships)) extras.push(data.friendships.length + " arkadaşlık bağı");
          if (Array.isArray(data.messages)) extras.push(data.messages.length + " mesaj");

          askConfirm(
            "Yedeği yükle",
            data.users.length + " hesap" + (extras.length ? ", " + extras.join(", ") : "") +
              " içeri aktarılacak ve mevcut kayıtların yerini alacak.",
            "Yedeği yükle",
            function () {
              /* HESAPLAR İÇERİ AKTARILAMAZ.
                 Kimlik doğrulama artık Supabase'de: bir hesabın var
                 olması auth.users'ta bir kayıt ve doğrulanmış bir
                 e-posta demek. Yedekteki eski hesaplar yalnızca profil
                 bilgisi taşıyor, şifre yok — bunları yazmak giriş
                 yapılamayan hayalet profiller üretirdi.

                 Henüz taşınmamış modüller (duyuru, arkadaşlık, mesaj)
                 2. aşamaya kadar localStorage'da olduğu için onlar
                 yüklenmeye devam ediyor. */
              if (Array.isArray(data.announcements)) YKS.Announcements.saveAll(data.announcements);
              if (Array.isArray(data.friendships)) YKS.Friends.saveAll(data.friendships);
              if (Array.isArray(data.messages)) YKS.Messages.saveAll(data.messages);

              YKS.Toast.show(
                "Yedek yüklendi. Hesaplar aktarılmadı — herkes kayıt sayfasından " +
                "yeniden üye olmalı.", "warn", 6000);
              refreshAll();
            },
            "fa-upload"
          );
        } catch (err) {
          YKS.Toast.show("Dosya okunamadı. Geçerli bir yedek dosyası seç.", "error");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });

    /* --- Tüm kayıtları sil --- */
    document.getElementById("wipe-btn").addEventListener("click", function () {
      askConfirm(
        "Tüm kayıtları sil",
        "Bütün hesaplar, arkadaşlık bağları ve yazışmalar kalıcı olarak silinecek. " +
          "Önce yedek almak isteyebilirsin.",
        "Hepsini sil",
        function () {
          /* Hesaplar artık Supabase'de ve tek tek silinmeli
             (RLS yalnızca admine izin verir). Toplu silme burada
             yapılmıyor: yanlışlıkla herkesin hesabını uçurmak
             tek tıkla mümkün olmamalı. */
          YKS.Toast.show(
            "Hesaplar buradan toplu silinemez — Kullanıcılar bölümünden tek tek sil.",
            "warn", 5000);
          YKS.Friends.saveAll([]);
          YKS.Messages.saveAll([]);

          messageQuery.userId = null;
          resetForm();
          YKS.Toast.show("Tüm kayıtlar silindi.", "ok");
          refreshAll();
        }
      );
    });
  }

  /* ==========================================================
     11) Mesajlaşma Sorgula
     ----------------------------------------------------------
     Denetim ekranı: bir üye seçilir, o kişinin bütün yazışmaları
     karşı tarafa göre gruplanmış olarak dökülür. Ekran yalnızca
     okur; buradan mesaj gönderilmez.
     ========================================================== */
  var messageQuery = { userId: null, search: "", sort: "messages", global: "" };

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function moment(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear() +
      " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /** Kullanıcı kimliği → mesaj sayısı ve son yazışma anı */
  function messageIndex() {
    var index = {};

    YKS.Messages._raw().forEach(function (m) {
      [m.fromId, m.toId].forEach(function (id) {
        if (!index[id]) index[id] = { count: 0, lastAt: 0 };
        index[id].count++;
        if (m.createdAt > index[id].lastAt) index[id].lastAt = m.createdAt;
      });
    });

    return index;
  }

  function renderMessageStats() {
    var stats = YKS.Messages.stats();
    var friendships = YKS.Friends.all().filter(function (f) { return f.status === "accepted"; }).length;
    var pending = YKS.Friends.all().filter(function (f) { return f.status === "pending"; }).length;

    var cards = [
      { k: "Toplam mesaj", v: stats.total },
      { k: "Sohbet", v: stats.threads },
      { k: "Okunmamış", v: stats.unread },
      { k: "Arkadaşlık", v: friendships },
      { k: "Bekleyen istek", v: pending }
    ];

    document.getElementById("msg-global-stats").innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><div class="k">' + c.k + '</div><div class="v">' + c.v + "</div></div>";
    }).join("");
  }

  function renderUserPicker() {
    var host = document.getElementById("msg-user-picker");
    var index = messageIndex();
    var list = YKS.Users.all();

    if (messageQuery.search) {
      var q = messageQuery.search;
      list = list.filter(function (u) {
        return (u.fullName + " " + u.username).toLocaleLowerCase("tr").indexOf(q) !== -1;
      });
    }

    list = list.slice().sort(function (a, b) {
      var ia = index[a.id] || { count: 0, lastAt: 0 };
      var ib = index[b.id] || { count: 0, lastAt: 0 };

      if (messageQuery.sort === "name") return a.fullName.localeCompare(b.fullName, "tr");
      if (messageQuery.sort === "recent") return ib.lastAt - ia.lastAt;
      return ib.count - ia.count;
    });

    if (!list.length) {
      host.innerHTML = '<div class="empty-x" style="grid-column:1/-1">' +
        '<i class="fa-solid fa-user-slash"></i><h3>Kişi bulunamadı</h3>' +
        "<p>Aramaya uyan bir hesap yok.</p></div>";
      return;
    }

    host.innerHTML = list.map(function (u) {
      var info = index[u.id] || { count: 0, lastAt: 0 };
      var avatar = u.avatar || U.fallbackAvatar(u.fullName, u.username);

      return '<button type="button" class="msg-person' +
          (u.id === messageQuery.userId ? " active" : "") + '" data-msg-user="' + u.id + '">' +
        '<img src="' + avatar + '" alt="" />' +
        '<div class="msg-person-main">' +
          "<strong>" + U.escape(u.fullName) + "</strong>" +
          "<span>@" + U.escape(u.username) + "</span>" +
        "</div>" +
        '<span class="msg-person-count">' + info.count + "</span>" +
      "</button>";
    }).join("");
  }

  function renderMessageQuery() {
    var host = document.getElementById("msg-result");
    var exportBtn = document.getElementById("msg-export-btn");

    if (!messageQuery.userId) {
      exportBtn.style.display = "none";
      host.innerHTML = '<div class="card-x"><div class="empty-x">' +
        '<i class="fa-solid fa-comments"></i>' +
        "<h3>Sorgulanacak kişiyi seç</h3>" +
        "<p>Yukarıdaki listeden bir üyeye tıkla; tüm yazışmaları burada açılsın.</p>" +
        "</div></div>";
      return;
    }

    var result = YKS.Messages.historyOf(messageQuery.userId);
    if (!result.ok) {
      exportBtn.style.display = "none";
      host.innerHTML = '<div class="card-x"><div class="empty-x">' +
        '<i class="fa-solid fa-lock"></i><h3>Sorgu yapılamadı</h3>' +
        "<p>" + U.escape(result.error) + "</p></div></div>";
      return;
    }

    var user = result.user;
    var stats = result.stats;
    var avatar = user.avatar || U.fallbackAvatar(user.fullName, user.username);

    exportBtn.style.display = stats.total ? "inline-flex" : "none";

    var html = '<div class="card-x">' +
      '<div class="msg-subject">' +
        '<img src="' + avatar + '" alt="" />' +
        '<div class="msg-subject-id">' +
          "<strong>" + U.escape(user.fullName) + "</strong>" +
          "<span>@" + U.escape(user.username) +
            (user.role === "admin" ? " · yönetici" : "") + "</span>" +
        "</div>" +
      "</div>" +

      '<div class="stat-grid" style="margin-top:18px">' +
        '<div class="stat-card"><div class="k">Toplam mesaj</div><div class="v">' + stats.total + "</div></div>" +
        '<div class="stat-card"><div class="k">Gönderdiği</div><div class="v">' + stats.sent + "</div></div>" +
        '<div class="stat-card"><div class="k">Aldığı</div><div class="v">' + stats.received + "</div></div>" +
        '<div class="stat-card"><div class="k">Sohbet</div><div class="v">' + stats.threads + "</div></div>" +
      "</div>" +

      (stats.total
        ? '<p class="muted" style="font-size:13px;margin:14px 0 0">' +
            "İlk mesaj: " + moment(stats.firstAt) + " · Son mesaj: " + moment(stats.lastAt) +
          "</p>"
        : "") +
    "</div>";

    if (!result.threads.length) {
      html += '<div class="card-x"><div class="empty-x">' +
        '<i class="fa-solid fa-inbox"></i><h3>Yazışma yok</h3>' +
        "<p>Bu üyenin gönderilmiş ya da alınmış mesajı bulunmuyor.</p></div></div>";
      host.innerHTML = html;
      return;
    }

    html += '<div class="card-x">' +
      '<div class="card-title"><i class="fa-solid fa-list-ul"></i> Sohbetler</div>' +
      result.threads.map(function (t) { return threadHtml(t, user); }).join("") +
    "</div>";

    host.innerHTML = html;
  }

  function threadHtml(thread, subject) {
    var peerAvatar = thread.peer
      ? (thread.peer.avatar || U.fallbackAvatar(thread.peer.fullName, thread.peer.username))
      : U.fallbackAvatar("Silinmiş", "?");

    var lines = thread.messages.map(function (m) {
      var bySubject = m.fromId === subject.id;
      var who = bySubject ? subject.fullName : thread.peerName;

      return '<div class="msg-line ' + (bySubject ? "by-subject" : "by-peer") + '">' +
        '<span class="ml-when">' + moment(m.createdAt) + "</span>" +
        '<div class="ml-main">' +
          '<span class="ml-who">' + U.escape(who) + "</span>" +
          '<div class="ml-text">' + U.escape(m.text) + "</div>" +
        "</div>" +
        (!m.readAt ? '<span class="ml-unread" title="Alıcı henüz okumadı">okunmadı</span>' : "") +
      "</div>";
    }).join("");

    return '<div class="msg-thread" data-thread="' + thread.peerId + '">' +
      '<button type="button" class="msg-thread-head" data-thread-toggle>' +
        '<i class="fa-solid fa-chevron-right th-caret"></i>' +
        '<img src="' + peerAvatar + '" alt="" />' +
        '<div class="th-main">' +
          "<strong>" + U.escape(thread.peerName) + "</strong>" +
          "<span>@" + U.escape(thread.peerUsername) + "</span>" +
        "</div>" +
        '<span class="th-count">' + thread.count + " mesaj · " + moment(thread.lastAt) + "</span>" +
      "</button>" +
      '<div class="msg-thread-body">' + lines + "</div>" +
    "</div>";
  }

  /** Genel metin araması — hangi mesajda, kimler arasında geçmiş */
  function renderGlobalSearch() {
    var host = document.getElementById("msg-global-result");

    if (!messageQuery.global) {
      host.innerHTML = "";
      return;
    }

    var result = YKS.Messages.search(messageQuery.global);
    if (!result.ok) {
      host.innerHTML = '<p class="muted" style="font-size:13px;margin-top:12px">' +
        U.escape(result.error) + "</p>";
      return;
    }

    if (!result.matches.length) {
      host.innerHTML = '<p class="muted" style="font-size:13px;margin-top:12px">' +
        "Eşleşen mesaj yok.</p>";
      return;
    }

    var shown = result.matches.slice(0, 40);

    host.innerHTML = '<p class="muted" style="font-size:12.5px;margin:14px 0 0">' +
        result.matches.length + " eşleşme" +
        (result.matches.length > shown.length ? " · ilk " + shown.length + " tanesi gösteriliyor" : "") +
      "</p>" +
      shown.map(function (m) {
        var from = YKS.Users.byId(m.fromId);
        var to = YKS.Users.byId(m.toId);

        return '<div class="msg-hit">' +
          '<div class="hit-head">' +
            "<b>" + U.escape(from ? from.fullName : "Silinmiş hesap") + "</b> → " +
            "<b>" + U.escape(to ? to.fullName : "Silinmiş hesap") + "</b> · " + moment(m.createdAt) +
          "</div>" +
          "<div>" + highlight(m.text, messageQuery.global) + "</div>" +
        "</div>";
      }).join("");
  }

  /** Aranan kelimeyi kaçırılmış metin içinde işaretler */
  function highlight(text, query) {
    var safe = U.escape(text);
    var needle = U.escape(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!needle) return safe;

    try {
      return safe.replace(new RegExp(needle, "gi"), function (hit) {
        return "<mark>" + hit + "</mark>";
      });
    } catch (e) {
      return safe;
    }
  }

  /** Sorgulanan kişinin yazışmalarını düz metin olarak indirir */
  function exportTranscript() {
    var result = YKS.Messages.historyOf(messageQuery.userId);
    if (!result.ok) return YKS.Toast.show(result.error, "error");

    var user = result.user;
    var lines = [
      YKS.Config.appName + " — Mesajlaşma dökümü",
      "Kişi: " + user.fullName + " (@" + user.username + ")",
      "Döküm tarihi: " + moment(Date.now()),
      "Toplam: " + result.stats.total + " mesaj · " + result.stats.threads + " sohbet",
      ""
    ];

    result.threads.forEach(function (t) {
      lines.push("=========================================");
      lines.push(t.peerName + " (@" + t.peerUsername + ") — " + t.count + " mesaj");
      lines.push("=========================================");

      t.messages.forEach(function (m) {
        var who = m.fromId === user.id ? user.fullName : t.peerName;
        lines.push("[" + moment(m.createdAt) + "] " + who + ": " + m.text);
      });

      lines.push("");
    });

    var blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "mesaj-dokumu-" + user.username + "-" +
      new Date().toISOString().slice(0, 10) + ".txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    YKS.Toast.show("Döküm indirildi.", "ok");
  }

  function renderMessagesView() {
    renderMessageStats();
    renderUserPicker();
    renderMessageQuery();
    renderGlobalSearch();
  }

  function bindMessageTools() {
    document.getElementById("msg-user-search").addEventListener("input", U.debounce(function (e) {
      messageQuery.search = e.target.value.trim().toLocaleLowerCase("tr");
      renderUserPicker();
    }, 200));

    document.getElementById("msg-user-sort").addEventListener("change", function (e) {
      messageQuery.sort = e.target.value;
      renderUserPicker();
    });

    document.getElementById("msg-user-picker").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-msg-user]");
      if (!btn) return;

      messageQuery.userId = btn.getAttribute("data-msg-user");
      renderUserPicker();
      renderMessageQuery();
    });

    /* Sohbet dökümünü aç / kapat */
    document.getElementById("msg-result").addEventListener("click", function (e) {
      var head = e.target.closest("[data-thread-toggle]");
      if (!head) return;
      head.parentNode.classList.toggle("open");
    });

    document.getElementById("msg-global-search").addEventListener("input", U.debounce(function (e) {
      messageQuery.global = e.target.value.trim();
      renderGlobalSearch();
    }, 250));

    document.getElementById("msg-export-btn").addEventListener("click", exportTranscript);
  }

  /* ==========================================================
     12) Çıkış
     ========================================================== */
  function bindLogout() {
    document.getElementById("logout-btn").addEventListener("click", function () {
      /* Oturum silinince admin yetkisi de gider */
      YKS.Auth.logout();
      window.location.replace("index.html");
    });
  }

  /* ==========================================================
     13) Yenileme ve başlangıç
     ========================================================== */
  function refreshAll() {
    renderStats();
    renderRecent();
    renderUserList();
    renderMessagesView();
  }

  /* Hazır kapısı: oturum ve profiller yüklendikten sonra çalışır.
     Yetki kontrolü de burada yapılmalı — daha önce yapılırsa profiller
     henüz gelmediği için isAdmin() her zaman false döner. */
  YKS.hazir(function () {
    if (!YKS.Auth.isAdmin()) {
      window.location.replace("index.html?reason=yetki");
      return;
    }

    bindNav();
    bindMenu();
    bindForm();
    bindUploads();
    bindFilters();
    bindConfirm();
    bindDataTools();
    bindMessageTools();
    bindLogout();

    renderSession();
    renderLockedNav();
    renderRoadmap();
    refreshAll();

    /* Başka sekmede çıkış yapılırsa bu sekmeyi de kapat */
    if (YKS.SB) {
      YKS.SB.auth.onAuthStateChange(function (olay) {
        if (olay === "SIGNED_OUT") window.location.replace("index.html?reason=yetki");
      });
    }
  });

})(window, document);
