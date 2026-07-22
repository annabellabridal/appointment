/**
 * auth.js
 * Supabase Auth ile basit e-posta/şifre giriş kapısı.
 * Uygulama kabuğu (App.init) yalnızca geçerli bir oturum varsa açılır.
 */

const Auth = (() => {
  const { el, $ } = Utils;

  function sb() {
    return DB.client();
  }

  async function getSession() {
    const { data } = await sb().auth.getSession();
    return data ? data.session : null;
  }

  async function currentUser() {
    const s = await getSession();
    return s ? s.user : null;
  }

  async function signOut() {
    try {
      await sb().auth.signOut();
    } finally {
      location.reload();
    }
  }

  /**
   * Geçerli oturum varsa hemen döner. Yoksa giriş ekranını çizer ve
   * kullanıcı başarıyla giriş yapınca resolve olur.
   */
  function ensure() {
    return new Promise(async (resolve) => {
      let missingConfig = false;
      try {
        sb();
      } catch (err) {
        missingConfig = true;
      }

      if (!missingConfig) {
        const session = await getSession();
        if (session) return resolve(session);
      }

      renderLogin(resolve, missingConfig);

      if (!missingConfig) {
        sb().auth.onAuthStateChange((_event, session) => {
          if (session) resolve(session);
        });
      }
    });
  }

  function renderLogin(resolve, missingConfig) {
    const app = $("#app");
    app.innerHTML = "";

    let mode = "signin"; // veya "signup"

    const emailInput = el("input", {
      type: "email", class: "auth-input", placeholder: "E-posta", autocomplete: "username",
    });
    const passInput = el("input", {
      type: "password", class: "auth-input", placeholder: "Şifre", autocomplete: "current-password",
    });
    const message = el("div", { class: "auth-message" });
    const submitBtn = el("button", { class: "btn btn-primary auth-submit", type: "submit", text: "Giriş Yap" });
    const toggleBtn = el("button", {
      type: "button", class: "auth-toggle",
      text: "Hesabın yok mu? Kayıt ol",
    });

    function setMode(next) {
      mode = next;
      const signin = mode === "signin";
      submitBtn.textContent = signin ? "Giriş Yap" : "Kayıt Ol";
      toggleBtn.textContent = signin
        ? "Hesabın yok mu? Kayıt ol"
        : "Zaten hesabın var mı? Giriş yap";
      passInput.setAttribute("autocomplete", signin ? "current-password" : "new-password");
      message.textContent = "";
      message.className = "auth-message";
    }
    toggleBtn.addEventListener("click", () => setMode(mode === "signin" ? "signup" : "signin"));

    function showError(text) {
      message.textContent = text;
      message.className = "auth-message auth-error";
    }
    function showInfo(text) {
      message.textContent = text;
      message.className = "auth-message auth-info";
    }

    const form = el("form", { class: "auth-form" }, [
      el("div", { class: "auth-brand" }, [
        el("span", { class: "auth-logo", html: Utils.icon("wave", 30) }),
        el("h1", { text: "Randevu & Müşteri Takip" }),
      ]),
      emailInput,
      passInput,
      submitBtn,
      message,
      toggleBtn,
    ]);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (missingConfig) {
        showError("Supabase yapılandırması eksik. config.js dosyasını doldurun.");
        return;
      }
      const email = emailInput.value.trim();
      const password = passInput.value;
      if (!email || !password) {
        showError("E-posta ve şifre gerekli.");
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Lütfen bekleyin…";
      try {
        if (mode === "signin") {
          const { error } = await sb().auth.signInWithPassword({ email, password });
          if (error) throw error;
          // onAuthStateChange resolve edecek.
        } else {
          const { data, error } = await sb().auth.signUp({ email, password });
          if (error) throw error;
          if (data.session) {
            // Otomatik oturum açıldı.
          } else {
            showInfo("Kayıt alındı. E-postanı doğrulayıp giriş yap.");
            setMode("signin");
          }
        }
      } catch (err) {
        showError(translateError(err.message || String(err)));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "signin" ? "Giriş Yap" : "Kayıt Ol";
      }
    });

    const screen = el("div", { class: "auth-screen" }, [form]);
    app.appendChild(screen);

    if (missingConfig) {
      showError("Supabase yapılandırması eksik. config.js dosyasını doldurun.");
    }
  }

  function translateError(msg) {
    if (/invalid login credentials/i.test(msg)) return "E-posta veya şifre hatalı.";
    if (/already registered/i.test(msg)) return "Bu e-posta zaten kayıtlı.";
    if (/password should be at least/i.test(msg)) return "Şifre en az 6 karakter olmalı.";
    return msg;
  }

  return { ensure, signOut, currentUser, getSession };
})();

window.Auth = Auth;
