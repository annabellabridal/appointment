/**
 * records.js
 * Randevu listesi sayfası: arama + filtreleme (tarih, durum, hizmet,
 * müşteri, ödeme durumu).
 */

const Records = (() => {
  const { el, debounce, formatMoney, icon, toast } = Utils;
  const MONTHS = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  const EXPORT_COLUMNS = [
    ["Randevu Tarihi", (a) => a.date || ""],
    ["Saat", (a) => a.time || ""],
    ["Düğün Tarihi", (a) => a.weddingDate || ""],
    ["Müşteri", (a) => a.customerName || ""],
    ["Telefon", (a) => a.phone || ""],
    ["E-posta", (a) => a.email || ""],
    ["Adres", (a) => a.address || ""],
    ["Hizmet Türü", (a) => a.service || ""],
    ["Durum", (a) => Constants.statusMeta(a.status).label],
    ["Notlar", (a) => a.notes || ""],
  ];

  const filters = {
    q: "",
    dateFrom: "",
    dateTo: "",
    status: "",
    service: "",
    customerId: "",
  };

  let containerRef = null;
  let appointments = [];
  let customers = [];
  let currentServiceFilter = "";

  async function render(container, preset = {}) {
    containerRef = container;
    Object.keys(filters).forEach((k) => (filters[k] = ""));
    Object.assign(filters, preset);
    currentServiceFilter = preset.service || "";
    [appointments, customers] = await Promise.all([
      DB.appointments.all(),
      DB.customers.all(),
    ]);
    draw();
  }

  function draw() {
    const container = containerRef;
    container.innerHTML = "";
    const filtered = applyFilters();
    const isProva = filters.service === "Prova Randevusu";
    const pageTitle = isProva ? "Prova Randevuları" : "Randevular";
    const btnLabel = isProva ? "Yeni Prova" : "Yeni Randevu";
    const btnService = isProva ? "Prova Randevusu" : "Randevu";

    container.appendChild(
      el("div", { class: "page-head" }, [
        el("h1", { text: pageTitle }),
        el("div", { class: "page-actions" }, [
          el("button", {
            class: "btn btn-secondary btn-sm", title: "CSV olarak indir",
            disabled: filtered.length === 0 ? "" : null,
            onClick: () => exportCsv(),
          }, [el("span", { class: "btn-ico", html: icon("download", 16) }), "CSV"]),
          el("button", {
            class: "btn btn-secondary btn-sm", title: "Excel (XLSX) olarak indir",
            disabled: filtered.length === 0 ? "" : null,
            onClick: () => exportXlsx(),
          }, [el("span", { class: "btn-ico", html: icon("download", 16) }), "XLSX"]),
          el("button", { class: "btn btn-primary", onClick: () => Appointments.openForm(null, { service: btnService }) }, [
            el("span", { class: "btn-ico", html: icon("plus", 16) }), btnLabel,
          ]),
        ]),
      ])
    );

    container.appendChild(filterBar());

    const listWrap = el("div", { class: "records-list" });

    if (filtered.length === 0) {
      listWrap.appendChild(el("p", { class: "empty", text: "Kayıt bulunamadı." }));
    } else {
      filtered
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
        .forEach((a) => listWrap.appendChild(rowItem(a)));
    }
    container.appendChild(listWrap);
  }

  function filterBar() {
    const q = el("input", { type: "search", placeholder: "Ara: müşteri, telefon, hizmet, not...", value: filters.q, class: "filter-search" });
    q.addEventListener("input", debounce((e) => { filters.q = e.target.value; draw(); }, 200));

    const dateRange = createDateRangeFilter();

    const status = select(filters.status, [{ value: "", label: "Tüm Durumlar" }, ...Constants.STATUSES], (v) => { filters.status = v; draw(); });
    const customer = select(String(filters.customerId), [{ value: "", label: "Tüm Müşteriler" }, ...customers.map((c) => ({ value: String(c.id), label: c.name }))], (v) => { filters.customerId = v; draw(); });

    const clear = el("button", { class: "btn btn-secondary btn-sm", text: "Temizle", onClick: () => {
      Object.keys(filters).forEach((k) => (filters[k] = ""));
      if (currentServiceFilter) filters.service = currentServiceFilter;
      draw();
    } });

    return el("div", { class: "filter-bar" }, [
      q,
      el("div", { class: "filter-row" }, [dateRange, status, customer, clear]),
    ]);
  }

  function createDateRangeFilter() {
    let isOpen = false;
    let from = filters.dateFrom || "";
    let to = filters.dateTo || "";
    let selectingEnd = Boolean(from && !to);
    let viewDate = Utils.parseDate(from || to) || new Date();
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);

    const primary = el("span", { class: "modern-picker-value" });
    const secondary = el("span", { class: "modern-picker-meta" });
    const trigger = el("button", {
      type: "button",
      class: "modern-picker-trigger filter-date-trigger",
      "aria-label": "Tarih aralığı seç",
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
    }, [
      el("span", { class: "modern-picker-icon", html: icon("calendar", 20) }),
      el("span", { class: "modern-picker-text" }, [primary, secondary]),
      el("span", { class: "modern-picker-chevron", html: "&#8964;" }),
    ]);
    const panel = el("div", { class: "picker-popover picker-popover-date filter-date-popover", role: "dialog", "aria-label": "Tarih aralığı" });
    const root = el("div", { class: "modern-picker filter-date-range" }, [trigger, panel]);

    function rangeLabel() {
      if (from && to && from === to) return [Utils.formatDateShort(from), "Tek gün"];
      if (from && to) return [`${Utils.formatDateShort(from)} - ${Utils.formatDateShort(to)}`, "Tarih aralığı"];
      if (from) return [`${Utils.formatDateShort(from)} sonrası`, "Başlangıç seçildi"];
      if (to) return [`${Utils.formatDateShort(to)} öncesi`, "Bitiş seçildi"];
      return ["Tarih aralığı", "Randevu tarihine göre filtrele"];
    }

    function syncTrigger() {
      const [main, meta] = rangeLabel();
      primary.textContent = main;
      secondary.textContent = meta;
    }

    function applyRange(nextFrom = from, nextTo = to) {
      filters.dateFrom = nextFrom || "";
      filters.dateTo = nextTo || "";
      close();
      draw();
    }

    function choose(date) {
      const value = Utils.toDateStr(date);
      if (!from || (from && to) || !selectingEnd) {
        from = value;
        to = "";
        selectingEnd = true;
      } else if (value < from) {
        to = from;
        from = value;
        selectingEnd = false;
      } else {
        to = value;
        selectingEnd = false;
      }
      syncTrigger();
      renderCalendar();
    }

    function renderCalendar() {
      const today = new Date();
      const previous = el("button", { type: "button", class: "picker-nav-btn", "aria-label": "Önceki ay", html: "&#8592;" });
      const next = el("button", { type: "button", class: "picker-nav-btn", "aria-label": "Sonraki ay", html: "&#8594;" });
      previous.addEventListener("click", () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        renderCalendar();
      });
      next.addEventListener("click", () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        renderCalendar();
      });

      const grid = el("div", { class: "picker-date-grid" });
      const firstDay = (viewDate.getDay() + 6) % 7;
      const gridStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - firstDay);
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const value = Utils.toDateStr(date);
        const isMuted = date.getMonth() !== viewDate.getMonth();
        const isEndpoint = value === from || value === to;
        const isInRange = from && to && value > from && value < to;
        const day = el("button", {
          type: "button",
          class: `picker-day${isMuted ? " is-muted" : ""}${isEndpoint ? " is-selected" : ""}${isInRange ? " is-in-range" : ""}${Utils.sameDay(date, today) ? " is-today" : ""}`,
          text: String(date.getDate()),
          "aria-label": Utils.formatDate(value),
          "aria-pressed": isEndpoint ? "true" : "false",
        });
        day.addEventListener("click", () => choose(date));
        grid.appendChild(day);
      }

      const clear = el("button", { type: "button", class: "picker-clear-btn", text: "Temizle" });
      clear.addEventListener("click", () => applyRange("", ""));
      const todayButton = el("button", { type: "button", class: "picker-today-btn", text: "Bugün" });
      todayButton.addEventListener("click", () => {
        const value = Utils.toDateStr(new Date());
        applyRange(value, value);
      });
      const apply = el("button", { type: "button", class: "picker-time-confirm", text: "Uygula" });
      apply.addEventListener("click", () => applyRange(from, to || from));

      panel.replaceChildren(
        el("div", { class: "picker-date-head" }, [
          el("div", {}, [
            el("span", { class: "picker-eyebrow", text: selectingEnd ? "Bitiş" : "Başlangıç" }),
            el("div", { class: "picker-month-title", text: `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}` }),
          ]),
          el("div", { class: "picker-nav" }, [previous, next]),
        ]),
        el("div", { class: "picker-range-summary" }, [
          el("span", { text: from ? Utils.formatDateShort(from) : "Başlangıç" }),
          el("span", { text: to ? Utils.formatDateShort(to) : "Bitiş" }),
        ]),
        el("div", { class: "picker-weekdays" }, DAYS.map((day) => el("span", { text: day }))),
        grid,
        el("div", { class: "picker-footer picker-footer-split" }, [clear, todayButton, apply])
      );
    }

    function close() {
      isOpen = false;
      root.classList.remove("is-open");
      panel.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onOutside);
    }

    function onOutside(event) {
      if (!root.contains(event.target)) close();
    }

    trigger.addEventListener("click", () => {
      isOpen = !isOpen;
      root.classList.toggle("is-open", isOpen);
      panel.classList.toggle("is-open", isOpen);
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        document.addEventListener("pointerdown", onOutside);
      } else {
        document.removeEventListener("pointerdown", onOutside);
      }
    });

    syncTrigger();
    renderCalendar();
    return root;
  }

  function select(value, options, onChange) {
    const s = el("select", {}, options.map((o) => el("option", { value: o.value, text: o.label })));
    s.value = value || "";
    s.addEventListener("change", (e) => onChange(e.target.value));
    return s;
  }

  function applyFilters() {
    const q = filters.q.trim().toLowerCase();
    return appointments.filter((a) => {
      if (filters.dateFrom && (!a.date || a.date < filters.dateFrom)) return false;
      if (filters.dateTo && (!a.date || a.date > filters.dateTo)) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.service && a.service !== filters.service) return false;
      if (filters.customerId && String(a.customerId) !== String(filters.customerId)) return false;
      if (q) {
        const hay = [a.customerName, a.phone, a.email, a.service, a.notes, a.address, a.weddingDate]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function rowItem(a) {
    const s = Constants.statusMeta(a.status);
    const statusSelect = select(a.status, Constants.STATUSES, (v) => updateStatus(a, v));
    statusSelect.className = "record-status-select";
    statusSelect.addEventListener("click", (event) => event.stopPropagation());

    const meta = [
      a.service,
      a.weddingDate ? `Düğün: ${Utils.formatDateShort(a.weddingDate)}` : "",
      a.address,
    ].filter(Boolean);

    return el("div", { class: "record-row", style: `--card-color:${s.color}`, onClick: () => Appointments.openDetail(a.id) }, [
      el("div", { class: "record-date" }, [
        el("span", { class: "record-day", text: Utils.formatDateShort(a.date) }),
        a.time ? el("span", { class: "record-time", text: a.time }) : null,
      ].filter(Boolean)),
      el("div", { class: "record-main" }, [
        el("div", { class: "record-name", text: a.customerName || "(isimsiz)" }),
        el("div", { class: "record-sub", text: [a.phone, a.email].filter(Boolean).join(" · ") || "İletişim bilgisi yok" }),
      ]),
      meta.length ? el("div", { class: "record-meta" }, meta.map((item) => el("span", { class: "record-meta-chip", text: item }))) : null,
      el("div", { class: "record-badges" }, [
        statusSelect,
      ]),
    ]);
  }

  async function updateStatus(appt, status) {
    if (!status || status === appt.status) return;
    const updated = { ...appt, status, updatedAt: new Date().toISOString() };
    try {
      await DB.appointments.put(updated);
      appointments = appointments.map((item) => item.id === appt.id ? updated : item);
      toast("Durum güncellendi", "success");
      draw();
      document.dispatchEvent(new CustomEvent("data:changed", { detail: { type: "appointments" } }));
    } catch (error) {
      console.error(error);
      toast("Durum güncellenemedi", "error");
      draw();
    }
  }

  function sortedFiltered() {
    return applyFilters().sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }

  function buildRows() {
    const rows = [EXPORT_COLUMNS.map((c) => c[0])];
    sortedFiltered().forEach((a) => rows.push(EXPORT_COLUMNS.map((c) => c[1](a))));
    return rows;
  }

  function fileStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function exportCsv() {
    const rows = buildRows();
    if (rows.length <= 1) return toast("Dışa aktarılacak randevu yok.", "info");
    Utils.download(`randevular-${fileStamp()}.csv`, Utils.csvFromRows(rows), "text/csv;charset=utf-8");
    toast(`${rows.length - 1} randevu CSV olarak indirildi.`, "success");
  }

  function exportXlsx() {
    const rows = buildRows();
    if (rows.length <= 1) return toast("Dışa aktarılacak randevu yok.", "info");
    try {
      Utils.downloadBlob(`randevular-${fileStamp()}.xlsx`, Utils.xlsxFromRows(rows, "Randevular"));
      toast(`${rows.length - 1} randevu XLSX olarak indirildi.`, "success");
    } catch (e) {
      console.error(e);
      toast("XLSX oluşturulamadı.", "error");
    }
  }

  return { render };
})();

window.Records = Records;
