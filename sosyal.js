/* ============================================================
   Bay Porsuk — sosyal.js
   ------------------------------------------------------------
   Baykuş Social modülü:
     • Metin + tek görselden oluşan gönderiler
     • Tümü / Arkadaşlarım akış süzgeci
     • Beğeni, yorum, kendi gönderini düzenleme ve silme
     • Kazandığın rozeti tek tıkla paylaşma

   Veri katmanı script.js içindeki YKS.Posts'tadır; gönderiler
   kullanıcı kaydında değil ortak "yks.posts.v1" anahtarında durur.

   TASARIM NOTU — tazeleme:
   mesajlar.js sohbeti saniyede bir yoklar. Akışta bunu yapmıyoruz;
   yoklama sırasında açık bir yorum kutusuna yazılanı silerdi.
   Bunun yerine başka sekmede değişiklik olursa "storage" olayı,
   sekmeye geri dönülünce de "focus" olayı tazeliyor.
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* ==========================================================
     0) SABİTLER
     ========================================================== */
  var LIMITS = YKS.Config.post;

  /* Uzun gönderiler katlanır, "devamını oku" ile açılır */
  var CLAMP_LIMIT = 400;

  /* ==========================================================
     1) DURUM
     ========================================================== */
  var currentUser = null;
  var isAdmin = false;

  var scope = "all";           /* okuyucu süzgeci: all | friends */
  var visibility = "public";   /* yazarın kararı: public | friends */
  var searchQuery = "";
  var selectedImage = null;    /* yazma kutusundaki görselin veri-URL'i */
  var editingId = null;
  var deleteId = null;

  /* Yorum kutusu açık olan gönderiler — çizim sonrası korunur */
  var openComments = {};

  /* Katlaması açılmış gönderiler */
  var expanded = {};

  /* ==========================================================
     2) YARDIMCILAR
     ========================================================== */

  /** 1753900000000 → "3 saat önce" */
  function zamanOnce(ts) {
    var fark = Date.now() - Number(ts || 0);
    if (fark < 0) fark = 0;

    var dk = Math.floor(fark / 60000);
    if (dk < 1) return "az önce";
    if (dk < 60) return dk + " dk önce";

    var sa = Math.floor(dk / 60);
    if (sa < 24) return sa + " saat önce";

    var gun = Math.floor(sa / 24);
    if (gun < 7) return gun + " gün önce";

    return new Date(ts).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "long", year: "numeric"
    });
  }

  /**
   * Gönderi sahibini çözer.
   * Hesap silinmişse gönderi de silinir (YKS.Posts.purgeUser), ama
   * elle bozulmuş veriye karşı yine de bir yedek karşılık dönüyoruz.
   */
  function yazarOf(userId) {
    var u = YKS.Users.byId(userId);
    if (u) return u;
    return { id: userId, fullName: "Silinmiş kullanıcı", username: "silinmis",
             avatar: null, role: "uye" };
  }

  function avatarOf(user) {
    return user.avatar || U.fallbackAvatar(user.fullName, user.username);
  }

  function rolRozeti(user) {
    if (user.role !== "admin") return "";
    return '<span class="badge-x badge-admin post-role">' +
      '<i class="fa-solid fa-shield-halved"></i>Admin</span>';
  }

  /* Görünürlük seçenekleri — yazma kutusu ve kart rozeti aynı yerden */
  var VISIBILITY = {
    public: {
      label: "Herkes", icon: "fa-globe", kisa: "Herkese açık",
      hint: "Akıştaki herkes görebilir."
    },
    friends: {
      label: "Arkadaşlarım", icon: "fa-user-group", kisa: "Arkadaşlara özel",
      hint: "Yalnızca arkadaş listendekiler görebilir."
    }
  };

  function visInfo(value) {
    return VISIBILITY[value] || VISIBILITY.public;
  }

  /* ==========================================================
     3) KULLANICI
     ========================================================== */
  function loadUser() {
    var session = YKS.Auth.session();
    if (!session) {
      window.location.replace("index.html");
      return false;
    }

    isAdmin = YKS.Auth.isAdmin();
    currentUser = YKS.Auth.currentUser();

    /* Yönetim koduyla açılan kurucu oturumunun kişisel kaydı yok;
       gönderi bir yazara bağlı olduğu için modül çalışamaz. */
    if (!currentUser) {
      renderAccountRequired(session.type === "gate");
      return false;
    }

    return true;
  }

  function renderAccountRequired(isGate) {
    var container = document.querySelector(".sosyal-container");
    if (!container) return;

    container.innerHTML =
      '<div class="empty-exams">' +
        '<i class="fa-solid fa-user-lock"></i>' +
        "<h3>Bu modül kişisel bir hesap istiyor</h3>" +
        "<p>" + (isGate
          ? "Şu an yönetim kodu ile açılmış kurucu oturumundasın. Gönderiler bir kullanıcı hesabına bağlı paylaşılır; kendi hesabınla giriş yaparsan bu bölüm açılır."
          : "Oturumun bulunamadı. Tekrar giriş yapman gerekiyor.") + "</p>" +
        '<a class="btn-x btn-primary-x" href="' + (isGate ? "admin.html" : "index.html") + '">' +
          '<i class="fa-solid fa-arrow-left"></i> ' + (isGate ? "Panele dön" : "Giriş ekranı") +
        "</a>" +
      "</div>";
  }

  /* ==========================================================
     4) YAZMA KUTUSU
     ========================================================== */
  function initComposer() {
    var me = document.getElementById("composer-avatar");
    me.src = avatarOf(currentUser);
    me.alt = currentUser.fullName + " profil fotoğrafı";

    var text = document.getElementById("composer-text");
    text.setAttribute("maxlength", LIMITS.textMax);
    text.addEventListener("input", updateComposerState);

    document.getElementById("composer-submit").addEventListener("click", submitPost);
    document.getElementById("composer-image").addEventListener("change", pickImage);
    document.getElementById("composer-image-clear").addEventListener("click", clearImage);
    document.getElementById("composer-badge").addEventListener("click", openBadgePicker);

    U.qsa("[data-vis]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setVisibility(btn.getAttribute("data-vis"));
      });
    });

    /* Ctrl+Enter ile paylaş */
    text.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        submitPost();
      }
    });

    updateComposerState();
  }

  /** Görünürlük seçimini uygular ve düğmeleri işaretler */
  function setVisibility(value) {
    visibility = VISIBILITY[value] ? value : "public";

    U.qsa("[data-vis]").forEach(function (btn) {
      var secili = btn.getAttribute("data-vis") === visibility;
      btn.classList.toggle("active", secili);
      btn.setAttribute("aria-checked", secili ? "true" : "false");
    });

    document.getElementById("composer-vis-hint").textContent = visInfo(visibility).hint;
  }

  function updateComposerState() {
    var text = document.getElementById("composer-text");
    var uzunluk = text.value.trim().length;

    document.getElementById("composer-count").textContent =
      text.value.length + " / " + LIMITS.textMax;

    /* Görsel varsa metin zorunlu değil */
    document.getElementById("composer-submit").disabled = !uzunluk && !selectedImage;

    var btn = document.getElementById("composer-submit");
    btn.innerHTML = editingId
      ? '<i class="fa-solid fa-floppy-disk"></i> Güncelle'
      : '<i class="fa-solid fa-paper-plane"></i> Paylaş';

    document.getElementById("composer-cancel").style.display =
      editingId ? "inline-flex" : "none";

    /* Düzenlemede görsel değiştirilmiyor — yalnızca metin */
    document.getElementById("composer-tools").style.display =
      editingId ? "none" : "flex";
  }

  function pickImage(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    YKS.Media.toDataURL(file, YKS.Config.media.post)
      .then(function (dataUrl) {
        selectedImage = dataUrl;

        var kb = Math.round(dataUrl.length / 1024);
        var box = document.getElementById("composer-preview");
        box.querySelector("img").src = dataUrl;
        box.querySelector(".preview-size").textContent = "~" + kb + " KB";
        box.style.display = "block";

        updateComposerState();
      })
      .catch(function (err) {
        YKS.Toast.show(err.message || "Görsel yüklenemedi.", "error");
      })
      .then(function () {
        /* Aynı dosya tekrar seçilebilsin */
        e.target.value = "";
      });
  }

  function clearImage() {
    selectedImage = null;
    document.getElementById("composer-preview").style.display = "none";
    document.getElementById("composer-image").value = "";
    updateComposerState();
  }

  function resetComposer() {
    editingId = null;
    document.getElementById("composer-text").value = "";
    setVisibility("public");
    clearImage();
    updateComposerState();
  }

  function submitPost() {
    var text = document.getElementById("composer-text").value;

    var result = editingId
      ? YKS.Posts.update(editingId, currentUser.id, text, visibility)
      : YKS.Posts.create(currentUser.id, {
          text: text, image: selectedImage, visibility: visibility
        });

    if (!result.ok) return YKS.Toast.show(result.error, "error");

    YKS.Toast.show(editingId ? "Gönderi güncellendi." : "Gönderin paylaşıldı.", "ok");
    resetComposer();
    render();
  }

  function startEdit(id) {
    var post = YKS.Posts.byId(id);
    if (!post) return YKS.Toast.show("Gönderi bulunamadı.", "error");

    editingId = id;
    document.getElementById("composer-text").value = post.text || "";
    setVisibility(post.visibility || "public");
    updateComposerState();

    document.getElementById("composer").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("composer-text").focus();
  }

  /* ==========================================================
     4b) ROZET PAYLAŞIMI
     ========================================================== */
  function openBadgePicker() {
    var box = document.getElementById("badge-picker-list");

    /* Rozet motoru rozetler.js ile gelir; yüklenmemişse buton çalışmaz */
    if (!YKS.Rozetler) {
      return YKS.Toast.show("Rozet modülü yüklenmedi.", "error");
    }

    var kazanilan = YKS.Rozetler.evaluate(currentUser).list
      .filter(function (r) { return r.earned; });

    if (!kazanilan.length) {
      box.innerHTML =
        '<p class="muted mb-0">Henüz rozetin yok. Çalışmaya başla, ilki kendiliğinden gelsin.</p>';
    } else {
      box.innerHTML = kazanilan.map(function (r) {
        return '<button type="button" class="badge-pick tier-' + r.def.tier + '" ' +
            'data-badge="' + U.escape(r.def.title) + '">' +
          '<span class="pick-medal"><i class="fa-solid ' + r.def.icon + '"></i></span>' +
          '<span class="pick-text">' +
            '<span class="pick-title">' + U.escape(r.def.title) + "</span>" +
            '<span class="pick-desc">' + U.escape(r.def.desc) + "</span>" +
          "</span>" +
        "</button>";
      }).join("");

      U.qsa("[data-badge]", box).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var ad = btn.getAttribute("data-badge");
          var text = document.getElementById("composer-text");
          var mevcut = text.value.trim();

          text.value = (mevcut ? mevcut + "\n\n" : "") +
            "🏅 " + ad + " rozetini kazandım!";

          bootstrap.Modal.getOrCreateInstance(document.getElementById("badge-modal")).hide();
          updateComposerState();
          text.focus();
        });
      });
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById("badge-modal")).show();
  }

  /* ==========================================================
     5) AKIŞ ÇİZİMİ
     ========================================================== */
  function visiblePosts() {
    var list = YKS.Posts.feed(currentUser.id, scope);

    if (searchQuery) {
      var q = searchQuery.toLocaleLowerCase("tr");
      list = list.filter(function (p) {
        var u = yazarOf(p.authorId);
        var haystack = [p.text || "", u.fullName, u.username]
          .join(" ").toLocaleLowerCase("tr");
        return haystack.indexOf(q) !== -1;
      });
    }

    return list;
  }

  function commentHTML(post, c) {
    var u = yazarOf(c.authorId);
    var silebilir = c.authorId === currentUser.id ||
                    post.authorId === currentUser.id ||
                    isAdmin;

    return '<div class="post-comment">' +
      '<img class="comment-avatar" src="' + avatarOf(u) + '" alt="" />' +
      '<div class="comment-body">' +
        '<div class="comment-head">' +
          '<span class="comment-name">' + U.escape(u.fullName) + "</span>" +
          '<span class="comment-time">' + zamanOnce(c.createdAt) + "</span>" +
          (silebilir
            ? '<button type="button" class="comment-del" data-delcomment="' + c.id +
              '" data-post="' + post.id + '" title="Yorumu sil" aria-label="Yorumu sil">' +
              '<i class="fa-solid fa-xmark"></i></button>'
            : "") +
        "</div>" +
        '<div class="comment-text">' + U.escape(c.text) + "</div>" +
      "</div>" +
    "</div>";
  }

  function postHTML(post) {
    var u = yazarOf(post.authorId);
    var likes = post.likes || [];
    var comments = post.comments || [];

    var begendim = likes.indexOf(currentUser.id) !== -1;
    var benimki = post.authorId === currentUser.id;
    var yorumAcik = !!openComments[post.id];
    var vis = post.visibility === "friends" ? "friends" : "public";

    var uzun = (post.text || "").length > CLAMP_LIMIT;
    var acik = !!expanded[post.id];

    var actions = "";
    if (benimki || isAdmin) {
      actions = '<div class="post-menu">' +
        (benimki
          ? '<button type="button" class="post-icon" data-edit="' + post.id + '" ' +
            'title="Düzenle" aria-label="Gönderiyi düzenle"><i class="fa-solid fa-pen"></i></button>'
          : "") +
        '<button type="button" class="post-icon danger" data-delete="' + post.id + '" ' +
          'title="Sil" aria-label="Gönderiyi sil"><i class="fa-solid fa-trash"></i></button>' +
      "</div>";
    }

    return '<article class="post-card" data-id="' + post.id + '">' +
      '<div class="post-head">' +
        '<img class="post-avatar" src="' + avatarOf(u) + '" alt="" />' +
        '<div class="post-id">' +
          '<div class="post-name">' + U.escape(u.fullName) + rolRozeti(u) + "</div>" +
          '<div class="post-meta">@' + U.escape(u.username) +
            ' · <span title="' + U.escape(U.formatDate(post.createdAt)) + '">' +
            zamanOnce(post.createdAt) + "</span>" +
            (post.editedAt ? " · düzenlendi" : "") +
            ' · <span class="post-vis' + (vis === "friends" ? " limited" : "") +
              '" title="' + visInfo(vis).hint + '">' +
              '<i class="fa-solid ' + visInfo(vis).icon + '"></i>' +
              visInfo(vis).kisa +
            "</span>" +
          "</div>" +
        "</div>" +
        actions +
      "</div>" +

      (post.text
        ? '<div class="post-text' + (uzun && !acik ? " clamped" : "") + '">' +
            U.escape(post.text) + "</div>" +
          (uzun
            ? '<button type="button" class="post-more" data-more="' + post.id + '">' +
              (acik ? "Daha az göster" : "Devamını oku") + "</button>"
            : "")
        : "") +

      (post.image
        ? '<div class="post-image"><img src="' + post.image + '" alt="Gönderi görseli" loading="lazy" /></div>'
        : "") +

      '<div class="post-actions">' +
        '<button type="button" class="post-act' + (begendim ? " liked" : "") +
            '" data-like="' + post.id + '">' +
          '<i class="fa-' + (begendim ? "solid" : "regular") + ' fa-heart"></i>' +
          "<span>" + (likes.length || "Beğen") + "</span>" +
        "</button>" +
        '<button type="button" class="post-act' + (yorumAcik ? " active" : "") +
            '" data-comments="' + post.id + '">' +
          '<i class="fa-regular fa-comment"></i>' +
          "<span>" + (comments.length || "Yorum") + "</span>" +
        "</button>" +
      "</div>" +

      (yorumAcik
        ? '<div class="post-comments">' +
            (comments.length
              ? comments.map(function (c) { return commentHTML(post, c); }).join("")
              : '<p class="comment-empty">İlk yorumu sen yaz.</p>') +
            '<div class="comment-form">' +
              '<img class="comment-avatar" src="' + avatarOf(currentUser) + '" alt="" />' +
              '<input class="input comment-input" type="text" data-cinput="' + post.id + '" ' +
                'maxlength="' + LIMITS.commentMax + '" placeholder="Yorumunu yaz…" />' +
              '<button type="button" class="btn-x btn-primary-x comment-send" ' +
                'data-csend="' + post.id + '"><i class="fa-solid fa-paper-plane"></i></button>' +
            "</div>" +
          "</div>"
        : "") +
    "</article>";
  }

  function renderFeed() {
    var box = document.getElementById("sosyal-feed");
    var list = visiblePosts();

    var sayac = document.getElementById("sosyal-count");
    if (sayac) {
      sayac.textContent = list.length
        ? list.length + " gönderi"
        : "Gönderi yok";
    }

    if (!list.length) {
      var bos = searchQuery
        ? { icon: "fa-magnifying-glass", baslik: "Eşleşme yok",
            metin: "Aramanı değiştirip tekrar dene." }
        : scope === "friends"
          ? { icon: "fa-user-group", baslik: "Arkadaş akışın boş",
              metin: "Arkadaşların henüz bir şey paylaşmamış. Sen başlat ya da yeni arkadaş ekle." }
          : { icon: "fa-feather-pointed", baslik: "Baykuş Social bomboş",
              metin: "İlk gönderiyi sen paylaş. Bugün ne çalıştığını yaz, bir rozetini göster." };

      box.innerHTML =
        '<div class="empty-exams">' +
          '<i class="fa-solid ' + bos.icon + '"></i>' +
          "<h3>" + bos.baslik + "</h3>" +
          "<p>" + bos.metin + "</p>" +
        "</div>";
      return;
    }

    box.innerHTML = list.map(postHTML).join("");
    bindPostActions(box);
  }

  function renderScopeTabs() {
    U.qsa("[data-scope]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-scope") === scope);
    });
  }

  function renderStats() {
    var box = document.getElementById("sosyal-stats");
    if (!box) return;

    /* Görebildiğin akışın özeti — arkadaşa özel gönderiler sayıma
       girmez, yoksa göremediğin bir gönderinin varlığı sızardı. */
    var s = YKS.Posts.statsFor(currentUser.id);
    var benim = YKS.Posts.byAuthor(currentUser.id).length;
    var arkadas = YKS.Friends.friendsOf(currentUser.id).length;

    function card(icon, label, value, note) {
      return '<div class="sosyal-stat">' +
        '<div class="label"><i class="fa-solid ' + icon + '"></i>' + label + "</div>" +
        '<div class="value">' + value + "</div>" +
        '<div class="note">' + note + "</div>" +
      "</div>";
    }

    box.innerHTML =
      card("fa-feather-pointed", "Toplam gönderi", s.total,
        s.withImage + " tanesi görselli") +
      card("fa-user-pen", "Senin gönderin", benim,
        benim ? "Paylaşmaya devam" : "Henüz paylaşmadın") +
      card("fa-heart", "Toplam beğeni", s.likes,
        s.comments + " yorum yazıldı") +
      card("fa-user-group", "Arkadaşın", arkadas,
        arkadas ? "Akışlarını görebilirsin" : "Arkadaş ekleyerek başla");
  }

  function render() {
    renderStats();
    renderScopeTabs();
    renderFeed();
  }

  /* ==========================================================
     6) ETKİLEŞİMLER
     ========================================================== */
  function bindPostActions(root) {
    U.qsa("[data-like]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = YKS.Posts.toggleLike(btn.getAttribute("data-like"), currentUser.id);
        if (!r.ok) return YKS.Toast.show(r.error, "error");
        renderFeed();
      });
    });

    U.qsa("[data-comments]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-comments");
        openComments[id] = !openComments[id];
        renderFeed();

        if (openComments[id]) {
          var input = document.querySelector('[data-cinput="' + id + '"]');
          if (input) input.focus();
        }
      });
    });

    U.qsa("[data-more]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-more");
        expanded[id] = !expanded[id];
        renderFeed();
      });
    });

    U.qsa("[data-edit]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { startEdit(btn.getAttribute("data-edit")); });
    });

    U.qsa("[data-delete]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { openDelete(btn.getAttribute("data-delete")); });
    });

    U.qsa("[data-delcomment]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = YKS.Posts.removeComment(
          btn.getAttribute("data-post"), btn.getAttribute("data-delcomment"), currentUser.id
        );
        if (!r.ok) return YKS.Toast.show(r.error, "error");
        renderFeed();
      });
    });

    /* Yorum gönderme — butonla ya da Enter ile */
    U.qsa("[data-csend]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { sendComment(btn.getAttribute("data-csend")); });
    });

    U.qsa("[data-cinput]", root).forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          sendComment(input.getAttribute("data-cinput"));
        }
      });
    });
  }

  function sendComment(postId) {
    var input = document.querySelector('[data-cinput="' + postId + '"]');
    if (!input) return;

    var r = YKS.Posts.comment(postId, currentUser.id, input.value);
    if (!r.ok) return YKS.Toast.show(r.error, "error");

    input.value = "";
    renderFeed();

    var yeni = document.querySelector('[data-cinput="' + postId + '"]');
    if (yeni) yeni.focus();
  }

  function openDelete(id) {
    var post = YKS.Posts.byId(id);
    if (!post) return;

    deleteId = id;
    var ozet = (post.text || "").trim();
    document.getElementById("delete-post-preview").textContent =
      ozet ? (ozet.length > 90 ? ozet.slice(0, 89) + "…" : ozet) : "(yalnızca görsel)";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("delete-modal")).show();
  }

  function confirmDelete() {
    if (!deleteId) return;

    var r = YKS.Posts.remove(deleteId, currentUser.id);
    if (!r.ok) return YKS.Toast.show(r.error, "error");

    YKS.Toast.show("Gönderi silindi.", "ok");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("delete-modal")).hide();

    /* Silinen gönderi düzenleniyorsa kutu boşalsın */
    if (editingId === deleteId) resetComposer();
    deleteId = null;
    render();
  }

  /* ==========================================================
     7) OLAY BAĞLARI
     ========================================================== */
  function bindShell() {
    document.getElementById("back-btn").addEventListener("click", function () {
      window.location.href = isAdmin ? "admin.html" : "index.html";
    });

    U.qsa("[data-scope]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        scope = btn.getAttribute("data-scope");
        render();
      });
    });

    var search = document.getElementById("sosyal-search");
    search.addEventListener("input", U.debounce(function () {
      searchQuery = search.value.trim();
      renderFeed();
    }, 180));

    document.getElementById("composer-cancel").addEventListener("click", resetComposer);
    document.getElementById("delete-ok").addEventListener("click", confirmDelete);

    document.getElementById("delete-modal").addEventListener("hidden.bs.modal", function () {
      deleteId = null;
    });

    /* Başka sekmede gönderi eklenirse burada da görünsün.
       Yazarken sayfayı altından çekmemek için yalnızca dışarıdan
       gelen değişiklikte ve sekmeye dönüşte tazeliyoruz. */
    window.addEventListener("storage", function (e) {
      if (e.key === YKS.Config.keys.posts) render();
    });

    window.addEventListener("focus", function () {
      currentUser = YKS.Auth.currentUser() || currentUser;
      render();
    });
  }

  /* ==========================================================
     8) BAŞLANGIÇ
     ========================================================== */
  YKS.hazir(function () {
    if (!loadUser()) return;

    bindShell();
    initComposer();
    render();
  });

})(window, document);
