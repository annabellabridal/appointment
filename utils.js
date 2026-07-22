/**
 * utils.js
 * Ortak yardımcılar: DOM, tarih/saat, para birimi, bildirimler,
 * toast/modal ve bağımlılıksız basit canvas grafikleri.
 */

const Utils = (() => {
  // DOM ----------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v !== null && v !== undefined && v !== false) {
        node.setAttribute(k, v);
      }
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Tarih & Saat -------------------------------------------------------------
  const MONTHS_TR = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  const pad = (n) => String(n).padStart(2, "0");

  function todayStr() {
    return toDateStr(new Date());
  }

  function toDateStr(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseDate(str) {
    // "YYYY-MM-DD" -> local Date
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDate(str) {
    const d = parseDate(str);
    if (!d) return "";
    return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateShort(str) {
    const d = parseDate(str);
    if (!d) return "";
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  // ISO week day index Mon=0..Sun=6
  function weekdayIndex(d) {
    return (d.getDay() + 6) % 7;
  }

  function startOfWeek(d) {
    const s = new Date(d);
    s.setDate(d.getDate() - weekdayIndex(d));
    s.setHours(0, 0, 0, 0);
    return s;
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  // Para ---------------------------------------------------------------------
  function formatMoney(n, currency = "₺") {
    const num = Number(n || 0);
    return `${currency}${num.toLocaleString("tr-TR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  // Toast --------------------------------------------------------------------
  function toast(message, type = "info", timeout = 3000) {
    let wrap = $("#toast-wrap");
    if (!wrap) {
      wrap = el("div", { id: "toast-wrap", class: "toast-wrap" });
      document.body.appendChild(wrap);
    }
    const t = el("div", { class: `toast toast-${type}`, text: message });
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, timeout);
  }

  // Modal --------------------------------------------------------------------
  function modal({ title, body, actions = [], wide = false, onClose } = {}) {
    const overlay = el("div", { class: "modal-overlay" });
    const box = el("div", { class: `modal ${wide ? "modal-wide" : ""}` });

    const header = el("div", { class: "modal-header" }, [
      el("h3", { text: title || "" }),
      el("button", {
        class: "icon-btn",
        html: "&times;",
        title: "Kapat",
        onClick: close,
      }),
    ]);

    const content = el("div", { class: "modal-body" });
    if (typeof body === "string") content.innerHTML = body;
    else if (body) content.appendChild(body);

    const footer = el("div", { class: "modal-footer" });
    actions.forEach((a) => {
      const btn = el("button", {
        class: `btn ${a.class || "btn-secondary"}`,
        text: a.label,
        onClick: () => a.onClick && a.onClick({ close }),
      });
      footer.appendChild(btn);
    });

    box.appendChild(header);
    box.appendChild(content);
    if (actions.length) box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });

    function close() {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 200);
      if (onClose) onClose();
    }

    return { overlay, box, content, close };
  }

  function confirmDialog(message, { title = "Onay", danger = false } = {}) {
    return new Promise((resolve) => {
      modal({
        title,
        body: `<p>${escapeHtml(message)}</p>`,
        actions: [
          { label: "Vazgeç", class: "btn-secondary", onClick: ({ close }) => { close(); resolve(false); } },
          {
            label: "Evet",
            class: danger ? "btn-danger" : "btn-primary",
            onClick: ({ close }) => { close(); resolve(true); },
          },
        ],
      });
    });
  }

  // Bildirimler --------------------------------------------------------------
  async function requestNotificationPermission() {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }

  function notify(title, options = {}) {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }

  // Dosya --------------------------------------------------------------------
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function humanSize(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function download(filename, text, mime = "application/json") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Basit Grafikler (canvas, bağımlılıksız) ----------------------------------
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function setupCanvas(canvas) {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 300;
    const h = rect.height || canvas.clientHeight || 180;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    return { ctx, w, h };
  }

  function barChart(canvas, labels, values, { color } = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const accent = color || cssVar("--accent") || "#3b82f6";
    const textColor = cssVar("--text-muted") || "#9aa4b2";
    const pad = { top: 16, right: 12, bottom: 28, left: 12 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const max = Math.max(1, ...values);
    const n = values.length;
    const gap = 8;
    const barW = Math.max(6, (chartW - gap * (n - 1)) / n);

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";

    values.forEach((v, i) => {
      const x = pad.left + i * (barW + gap);
      const barH = (v / max) * chartH;
      const y = pad.top + chartH - barH;
      const r = Math.min(6, barW / 2);
      ctx.fillStyle = accent;
      roundRect(ctx, x, y, barW, barH, r);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.fillText(labels[i], x + barW / 2, h - 10);
      if (v > 0) {
        ctx.fillStyle = cssVar("--text") || "#e5e7eb";
        ctx.fillText(String(v), x + barW / 2, y - 4);
      }
    });
  }

  function lineChart(canvas, labels, values, { color } = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const accent = color || cssVar("--accent") || "#3b82f6";
    const textColor = cssVar("--text-muted") || "#9aa4b2";
    const pad = { top: 16, right: 12, bottom: 28, left: 12 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const max = Math.max(1, ...values);
    const n = values.length;
    const stepX = n > 1 ? chartW / (n - 1) : 0;

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";

    const points = values.map((v, i) => ({
      x: pad.left + i * stepX,
      y: pad.top + chartH - (v / max) * chartH,
    }));

    // area
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    grad.addColorStop(0, accent + "55");
    grad.addColorStop(1, accent + "00");
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineTo(pad.left + (n - 1) * stepX, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // dots + labels
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.fillText(labels[i], p.x, h - 10);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h <= 0) return;
    r = Math.min(r, h);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, 0);
    ctx.arcTo(x, y + h, x, y, 0);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return {
    $, $$, el, escapeHtml,
    MONTHS_TR, DAYS_TR, pad,
    todayStr, toDateStr, parseDate, formatDate, formatDateShort,
    weekdayIndex, startOfWeek, addDays, sameDay,
    formatMoney,
    toast, modal, confirmDialog,
    requestNotificationPermission, notify,
    fileToDataURL, humanSize, download, debounce, uid,
    barChart, lineChart,
  };
})();

window.Utils = Utils;
