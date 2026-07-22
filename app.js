/**
 * app.js
 * Uygulama kabuğu: yönlendirme (router), tema, global arama,
 * hatırlatma bildirimleri, otomatik yedekleme ve PWA kaydı.
 */

const App = (() => {
  const { el, $, debounce } = Utils;

  const ROUTES = {
    dashboard: { label: "Panel", icon: "🏠", render: (c) => Dashboard.render(c) },
    calendar: { label: "Takvim", icon: "📅", render: (c) => Calendar.render(c) },
    records: { label: "Randevular", icon: "📋", render: (c) => Records.render(c) },
    customers: { label: "Müşteriler", icon: "👥", render: (c) => Customers.render(c) },
    income: { label: "Gelir", icon: "💰", render: (c) => Income.render(c) },
    todos: { label: "Yapılacaklar", icon: "✔️", render: (c) => Todos.render(c) },
    stats: { label: "İstatistik", icon: "📊", render: (c) => Stats.render(c) },
    settings: { label: "Ayarlar", icon: "⚙️", render: (c) => Settings.render(c) },
  };

  let current = "dashboard";
  let contentEl = null;

  async function init() {
    await DB.open();

    // Tema
    const theme = await DB.settings.get("theme", "dark");
    applyTheme(theme);

    buildShell();
    navigate(getRouteFromHash() || "dashboard");

    // Veri değişince aktif sayfayı tazele
    document.addEventListener("data:changed", () => refresh());

    window.addEventListener("hashchange", () => {
      const r = getRouteFromHash();
      if (r && r !== current) navigate(r);
    });

    // Hatırlatmalar
    Reminders.start();

    // Otomatik yedekleme
    maybeAutoBackup();

    // PWA service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  function buildShell() {
    const app = $("#app");
    app.innerHTML = "";

    // Sidebar
    const nav = el("nav", { class: "sidebar" });
    nav.appendChild(el("div", { class: "brand" }, [
      el("span", { class: "brand-logo", text: "📆" }),
      el("span", { class: "brand-name", text: "Randevu Takip" }),
    ]));
    const navList = el("div", { class: "nav-list" });
    Object.entries(ROUTES).forEach(([key, r]) => {
      navList.appendChild(el("a", {
        class: "nav-item", href: `#${key}`, "data-route": key,
        onClick: (e) => { e.preventDefault(); navigate(key); },
      }, [el("span", { class: "nav-icon", text: r.icon }), el("span", { text: r.label })]));
    });
    nav.appendChild(navList);
    nav.appendChild(el("button", {
      class: "btn btn-primary nav-new", text: "＋ Yeni Randevu",
      onClick: () => Appointments.openForm(),
    }));

    // Topbar
    const topbar = el("header", { class: "topbar" });
    const menuBtn = el("button", { class: "icon-btn menu-btn", html: "☰", title: "Menü",
      onClick: () => document.body.classList.toggle("nav-open") });
    const search = el("input", { type: "search", class: "global-search", placeholder: "Ara: müşteri, telefon, firma, hizmet, not..." });
    search.addEventListener("input", debounce((e) => globalSearch(e.target.value), 250));
    const themeBtn = el("button", { class: "icon-btn", id: "theme-btn", title: "Tema değiştir", onClick: toggleTheme });
    topbar.append(menuBtn, search, themeBtn);

    // Layout
    const main = el("main", { class: "main" });
    const content = el("div", { class: "content", id: "content" });
    main.append(topbar, content);
    contentEl = content;

    // overlay for mobile nav
    const overlay = el("div", { class: "nav-overlay", onClick: () => document.body.classList.remove("nav-open") });

    app.append(nav, main, overlay);
    updateThemeButton();
  }

  function navigate(route) {
    if (!ROUTES[route]) route = "dashboard";
    current = route;
    if (location.hash !== `#${route}`) location.hash = `#${route}`;
    Utils.$$(".nav-item").forEach((n) =>
      n.classList.toggle("active", n.getAttribute("data-route") === route));
    document.body.classList.remove("nav-open");
    refresh();
  }

  function refresh() {
    if (!contentEl) return;
    contentEl.classList.remove("fade-in");
    void contentEl.offsetWidth;
    contentEl.classList.add("fade-in");
    ROUTES[current].render(contentEl);
  }

  function getRouteFromHash() {
    const h = location.hash.replace("#", "");
    return ROUTES[h] ? h : null;
  }

  // Tema ---------------------------------------------------------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    updateThemeButton();
  }
  async function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = cur === "light" ? "dark" : "light";
    applyTheme(next);
    await DB.settings.set("theme", next);
  }
  function updateThemeButton() {
    const btn = $("#theme-btn");
    if (!btn) return;
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    btn.innerHTML = isLight ? "🌙" : "☀️";
  }

  // Global arama -------------------------------------------------------------
  async function globalSearch(q) {
    q = (q || "").trim().toLowerCase();
    if (q.length < 2) return;
    const [appointments, customers] = await Promise.all([DB.appointments.all(), DB.customers.all()]);

    const matchAppts = appointments.filter((a) =>
      [a.customerName, a.phone, a.company, a.service, a.notes, a.project]
        .filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 20);
    const matchCust = customers.filter((c) =>
      [c.name, c.phone, c.company, c.email, c.notes]
        .filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 20);

    const wrap = el("div", { class: "search-results" });
    if (matchCust.length) {
      wrap.appendChild(el("h4", { class: "section-title", text: `Müşteriler (${matchCust.length})` }));
      matchCust.forEach((c) => wrap.appendChild(el("div", { class: "search-item", onClick: () => { closeAll(); Customers.openProfile(c.id); } }, [
        el("span", { class: "search-name", text: c.name }),
        el("span", { class: "search-sub", text: c.company || c.phone || "" }),
      ])));
    }
    if (matchAppts.length) {
      wrap.appendChild(el("h4", { class: "section-title", text: `Randevular (${matchAppts.length})` }));
      matchAppts.forEach((a) => wrap.appendChild(el("div", { class: "search-item", onClick: () => { closeAll(); Appointments.openDetail(a.id); } }, [
        el("span", { class: "search-name", text: `${a.customerName || "(isimsiz)"} · ${a.service || ""}` }),
        el("span", { class: "search-sub", text: `${Utils.formatDateShort(a.date)} ${a.time || ""}` }),
      ])));
    }
    if (!matchAppts.length && !matchCust.length) {
      wrap.appendChild(el("p", { class: "empty", text: "Sonuç bulunamadı." }));
    }

    closeAll();
    lastSearchModal = Utils.modal({ title: `"${q}" için sonuçlar`, body: wrap, wide: true });
  }
  let lastSearchModal = null;
  function closeAll() {
    if (lastSearchModal) { lastSearchModal.close(); lastSearchModal = null; }
  }

  // Otomatik yedekleme -------------------------------------------------------
  async function maybeAutoBackup() {
    const on = await DB.settings.get("autoBackup", false);
    if (!on) return;
    const today = Utils.todayStr();
    const last = await DB.settings.get("lastAutoBackup", "");
    if (last === today) return;
    await Settings.exportData();
    await DB.settings.set("lastAutoBackup", today);
  }

  return { init, navigate, refresh, applyTheme };
})();

window.App = App;

document.addEventListener("DOMContentLoaded", () => App.init());
