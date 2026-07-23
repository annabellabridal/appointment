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

  // Monokrom (tek renk) line ikon seti -----------------------------------
  const ICON_PATHS = {
    wave: '<path d="M2 16L8 6l8 12 6-10"/>',
    home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9v11h5v-6h4v6h5V9"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    users: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.5"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.5a4 4 0 0 1 0 7"/>',
    wallet: '<path d="M3 6h15v3H3zM3 6v13h18V9"/><path d="M16 13h5v-3"/><path d="M16.5 13.5h.01"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 20v-6M13 20V9M18 20v-9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    download: '<path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/><path d="M12 4v11M7 10l5 5 5-5"/>',
    upload: '<path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/><path d="M12 20V9M7 14l5-5 5 5"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="M15 17l5-5-5-5M20 12H9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cash: '<rect x="2" y="6" width="20" height="12"/><circle cx="12" cy="12" r="2.5"/>',
  };

  function icon(name, size = 18) {
    const p = ICON_PATHS[name];
    if (!p) return "";
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${p}</svg>`;
  }

  // Dışa aktarma (CSV / XLSX) --------------------------------------------
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // rows: dizi dizisi (ilk satır başlıklar). CSV metni üretir.
  function csvFromRows(rows, sep = ",") {
    const esc = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return "\uFEFF" + rows.map((r) => r.map(esc).join(sep)).join("\r\n");
  }

  // Bağımsız (kütüphanesiz) minimal XLSX üretimi -------------------------
  function _crc32(buf) {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (~crc) >>> 0;
  }

  function _zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
    const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

    files.forEach((f) => {
      const nameBytes = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = _crc32(data);
      const local = [].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0)
      );
      parts.push(new Uint8Array(local), nameBytes, data);
      central.push({ crc, size: data.length, nameBytes, offset });
      offset += local.length + nameBytes.length + data.length;
    });

    const cdParts = [];
    let cdSize = 0;
    central.forEach((c) => {
      const hdr = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(c.crc), u32(c.size), u32(c.size),
        u16(c.nameBytes.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(c.offset)
      );
      cdParts.push(new Uint8Array(hdr), c.nameBytes);
      cdSize += hdr.length + c.nameBytes.length;
    });

    const end = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0),
      u16(central.length), u16(central.length),
      u32(cdSize), u32(offset), u16(0)
    ));

    return new Blob([...parts, ...cdParts, end], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  function _colRef(n) {
    let s = "";
    n += 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // rows: dizi dizisi (ilk satır başlıklar). Gerçek .xlsx Blob'u döndürür.
  function xlsxFromRows(rows, sheetName = "Sayfa1") {
    const xmlEsc = (s) => String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const sheetRows = rows.map((row, ri) => {
      const cells = row.map((val, ci) => {
        const ref = _colRef(ci) + (ri + 1);
        const isNum = typeof val === "number" && Number.isFinite(val);
        if (isNum) return `<c r="${ref}"><v>${val}</v></c>`;
        const text = val === null || val === undefined ? "" : String(val);
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(text)}</t></is></c>`;
      }).join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    }).join("");

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

    return _zip([
      { name: "[Content_Types].xml", data: contentTypes },
      { name: "_rels/.rels", data: rootRels },
      { name: "xl/workbook.xml", data: workbook },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
      { name: "xl/worksheets/sheet1.xml", data: sheetXml },
    ]);
  }

  function initials(name) {
    if (!name) return "?";
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  return {
    $, $$, el, escapeHtml,
    MONTHS_TR, DAYS_TR, pad,
    todayStr, toDateStr, parseDate, formatDate, formatDateShort,
    weekdayIndex, startOfWeek, addDays, sameDay,
    formatMoney, initials,
    toast, modal, confirmDialog,
    requestNotificationPermission, notify,
    fileToDataURL, humanSize, download, downloadBlob, debounce, uid,
    barChart, lineChart,
    icon, csvFromRows, xlsxFromRows,
  };
})();

window.Utils = Utils;
