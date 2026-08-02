/* ============================================================
   YKS Takip Sistemi — register.js
   ------------------------------------------------------------
   Üye kayıt ve başvuru sistemi:
     • Kullanıcı bilgilerini toplar (Gmail, Hotmail, Yandex zorunlu)
     • Şifre doğrulama
     • Başvuru oluşturma
     • Admin onayı bekleme
   ============================================================ */

(function (window, document) {
  "use strict";

  var YKS = window.YKS;
  var U = YKS.Utils;

  /* Panel yönetimi */
  function showPanel(id) {
    var panels = ["panel-register", "panel-success"];
    panels.forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.classList.toggle("active", p === id);
    });
  }

  /* Hata/Bilgi mesajı göster */
  function showAlert(message, isSuccess) {
    var box = document.getElementById("register-alert");
    var text = document.getElementById("register-alert-text");
    text.textContent = message;
    box.classList.remove("alert-success");
    if (isSuccess) box.classList.add("alert-success");
    box.classList.add("show");
  }

  function hideAlert() {
    document.getElementById("register-alert").classList.remove("show");
  }

  /* Şifre göster/gizle */
  function bindPasswordToggles() {
    U.qsa("[data-toggle-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-toggle-password"));
        if (!input) return;
        var isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        btn.querySelector("i").className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
        btn.setAttribute("aria-label", isHidden ? "Şifreyi gizle" : "Şifreyi göster");
      });
    });
  }

  /* Kayıt formunu işle */
  function bindRegisterForm() {
    var form = document.getElementById("register-form");
    var btn = document.getElementById("register-submit");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideAlert();

      /* Form verilerini topla */
      var input = {
        username: document.getElementById("reg-username").value.trim(),
        email: document.getElementById("reg-email").value.trim(),
        fullName: document.getElementById("reg-fullname").value.trim(),
        age: document.getElementById("reg-age").value,
        examField: document.getElementById("reg-field").value,
        password: document.getElementById("reg-password").value,
        passwordAgain: document.getElementById("reg-password-again").value,
        description: document.getElementById("reg-description").value.trim(),
        inviteCode: (document.getElementById("reg-invite") || {}).value || ""
      };

      /* Temel kontroller */
      if (!input.username || !input.email || !input.fullName || 
          !input.age || !input.password || !input.passwordAgain) {
        showAlert("Lütfen tüm zorunlu alanları doldur.");
        return;
      }

      /* Şifre eşleşme kontrolü */
      if (input.password !== input.passwordAgain) {
        showAlert("Şifreler birbiriyle uyuşmuyor.");
        document.getElementById("reg-password-again").value = "";
        return;
      }

      /* Kullanıcı adı çakışması — sunucu da engelliyor ama burada
         söylersek kullanıcı formu baştan doldurmak zorunda kalmaz.
         (Profiller yalnızca giriş yapmışlara görünür olduğu için bu
         kontrol boş listede çalışır; asıl doğrulama sunucuda.) */
      if (YKS.Users.usernameAlinmis(input.username)) {
        showAlert("Bu kullanıcı adı zaten alınmış.");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kayıt yapılıyor…';

      YKS.Auth.signUp(input).then(function (result) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kayıt ol';

        if (!result.ok) {
          showAlert(result.error);
          return;
        }

        /* Doğrulama KAPALIYSA kullanıcı zaten giriş yapmış durumda;
           başarı ekranında bekletmenin anlamı yok, doğrudan içeri al. */
        if (!result.dogrulamaGerekli) {
          YKS.Toast.show("Hoş geldin " +
            (result.user ? result.user.fullName : "") + "!", "ok", 3000);
          setTimeout(function () { window.location.href = "index.html"; }, 700);
          return;
        }

        /* Doğrulama açıksa maildeki bağlantı bekleniyor */
        var kutu = document.getElementById("success-detail");
        if (kutu) {
          kutu.textContent = result.email + " adresine bir doğrulama bağlantısı " +
            "gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsin.";
        }

        YKS.Toast.show("Kayıt alındı — e-postanı doğrula.", "ok", 4000);
        showPanel("panel-success");
      });
    });
  }

  /* Başlangıç — hazır kapısı (bkz. script.js 4b bölümü) */
  YKS.hazir(function () {
    bindPasswordToggles();
    bindRegisterForm();
  });

})(window, document);
