/* ============================================================
   YKS Takip Sistemi — profile.js
   ------------------------------------------------------------
   Kullanıcı profil ayarları:
     • Kişisel bilgiler düzenleme
     • Avatar ve banner yükleme
     • Hakkında bilgisi güncelleme
     • Şifre değiştirme
     • Canlı önizleme
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  var currentUser = null;
  var media = { avatar: null, banner: null };

  /* ==========================================================
     1) Kullanıcı bilgilerini yükle
     ========================================================== */
  function loadUser() {
    currentUser = YKS.Auth.currentUser();
    if (!currentUser) {
      window.location.replace("index.html");
      return;
    }

    /* Form alanlarını doldur */
    document.getElementById("p-username").value = currentUser.username;
    document.getElementById("p-fullname").value = currentUser.fullName;
    document.getElementById("p-age").value = currentUser.age;
    document.getElementById("p-field").value = currentUser.examField;
    document.getElementById("p-desc").value = currentUser.description || "";

    /* Mevcut görselleri yükle */
    media.avatar = currentUser.avatar || null;
    media.banner = currentUser.banner || null;

    if (currentUser.avatar) {
      document.getElementById("prev-avatar").src = currentUser.avatar;
      document.getElementById("up-avatar").classList.add("filled");
    }

    if (currentUser.banner) {
      document.getElementById("prev-banner").src = currentUser.banner;
      document.getElementById("up-banner").classList.add("filled");
    }

    updatePreview();
  }

  /* ==========================================================
     2) Canlı Önizleme
     ========================================================== */
  function updatePreview() {
    var fullName = document.getElementById("p-fullname").value.trim() || currentUser.fullName;
    var age = document.getElementById("p-age").value || currentUser.age;
    var examField = document.getElementById("p-field").value;
    var desc = document.getElementById("p-desc").value.trim() || "Açıklama eklenmemiş.";

    /* Banner */
    var banner = document.getElementById("preview-banner");
    banner.style.backgroundImage = media.banner 
      ? "url(" + media.banner + ")" 
      : (currentUser.banner ? "url(" + currentUser.banner + ")" : "");

    /* Avatar */
    var avatar = document.getElementById("preview-avatar");
    avatar.src = media.avatar || currentUser.avatar || U.fallbackAvatar(fullName, currentUser.username);

    /* Bilgiler */
    document.getElementById("preview-name").textContent = fullName;
    document.getElementById("preview-handle").textContent = "@" + currentUser.username;
    document.getElementById("preview-bio").textContent = desc;

    /* Etiketler */
    var roleClass = currentUser.role === "admin" ? "badge-admin" : "badge-uye";
    var roleIcon = currentUser.role === "admin" ? "fa-shield-halved" : "fa-user";
    var meta = document.getElementById("preview-meta");
    meta.innerHTML =
      '<span class="badge-x ' + roleClass + '">' +
        '<i class="fa-solid ' + roleIcon + '"></i>' +
        U.escape(U.labelOf(YKS.Config.roles, currentUser.role)) +
      "</span>" +
      '<span class="badge-x"><i class="fa-solid fa-book"></i>' +
        U.escape(U.labelOf(YKS.Config.fields, examField)) + "</span>" +
      '<span class="badge-x"><i class="fa-solid fa-cake-candles"></i>' + 
        U.escape(age) + " yaş</span>";
  }

  /* ==========================================================
     3) Görsel Yükleme
     ========================================================== */
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
        updatePreview();
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
    updatePreview();
  }

  function bindUploads() {
    setupUpload("avatar", "file-avatar", "up-avatar", "prev-avatar", YKS.Config.media.avatar);
    setupUpload("banner", "file-banner", "up-banner", "prev-banner", YKS.Config.media.banner);

    U.qsa("[data-clear]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        clearUpload(btn.getAttribute("data-clear"));
      });
    });
  }

  /* ==========================================================
     4) Şifre göster/gizle
     ========================================================== */
  function bindPasswordToggles() {
    U.qsa("[data-toggle-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-toggle-password"));
        if (!input) return;
        var isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        btn.querySelector("i").className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
      });
    });
  }

  /* ==========================================================
     5) Form kaydetme
     ========================================================== */
  function bindForm() {
    var form = document.getElementById("profile-form");
    var saveBtn = document.getElementById("save-btn");

    /* Canlı önizleme için input değişikliklerini izle */
    U.qsa("#p-fullname, #p-age, #p-field, #p-desc").forEach(function (input) {
      input.addEventListener("input", U.debounce(updatePreview, 300));
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var fullName = document.getElementById("p-fullname").value.trim();
      var age = parseInt(document.getElementById("p-age").value, 10);
      var examField = document.getElementById("p-field").value;
      var description = document.getElementById("p-desc").value.trim();
      var password = document.getElementById("p-password").value;
      var passwordAgain = document.getElementById("p-password-again").value;

      /* Doğrulamalar */
      if (!fullName || fullName.length < 2) {
        return YKS.Toast.show("Ad Soyad en az 2 karakter olmalı.", "error");
      }
      if (isNaN(age) || age < 10 || age > 99) {
        return YKS.Toast.show("Yaş 10 ile 99 arasında olmalı.", "error");
      }

      /* Şifre değişikliği varsa kontrol et */
      if (password || passwordAgain) {
        if (password.length < 4) {
          return YKS.Toast.show("Şifre en az 4 karakter olmalı.", "error");
        }
        if (password !== passwordAgain) {
          return YKS.Toast.show("Şifreler birbiriyle uyuşmuyor.", "error");
        }
      }

      /* Güncelleme paketi */
      var patch = {
        fullName: fullName,
        age: age,
        examField: examField,
        description: description,
        avatar: media.avatar,
        banner: media.banner
      };

      if (password) {
        patch.password = password;
      }

      saveBtn.disabled = true;
      var result = YKS.Users.update(currentUser.id, patch);
      saveBtn.disabled = false;

      if (!result.ok) {
        return YKS.Toast.show(result.error, "error");
      }

      YKS.Toast.show("Profil güncellendi!", "ok");

      /* Şifre alanlarını temizle */
      document.getElementById("p-password").value = "";
      document.getElementById("p-password-again").value = "";

      /* Kullanıcı bilgisini yeniden yükle */
      setTimeout(function () {
        currentUser = YKS.Auth.currentUser();
        loadUser();
      }, 300);
    });
  }

  /* ==========================================================
     6) Navigasyon
     ========================================================== */
  function bindNavigation() {
    document.getElementById("back-btn").addEventListener("click", function () {
      var user = YKS.Auth.currentUser();
      if (user && user.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }
    });

    document.getElementById("cancel-btn").addEventListener("click", function () {
      if (confirm("Değişiklikler kaydedilmedi. Çıkmak istediğine emin misin?")) {
        var user = YKS.Auth.currentUser();
        if (user && user.role === "admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "index.html";
        }
      }
    });
  }

  /* ==========================================================
     7) Başlangıç
     ========================================================== */
  YKS.hazir(function () {
    loadUser();
    bindUploads();
    bindPasswordToggles();
    bindForm();
    bindNavigation();
  });

})(window, document);
