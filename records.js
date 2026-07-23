/**
 * records.js
 * Randevu listesi sayfası: arama + filtreleme (tarih, durum, hizmet,
 * müşteri, ödeme durumu).
 */

const Records = (() => {
  const { el, debounce, formatMoney, icon, toast } = Utils;

  const EXPORT_COLUMNS = [
    ["Tarih", (a) => a.date || ""],
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
    date: "",
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

    const date = el("input", { type: "date", value: filters.date });
    date.addEventListener("change", (e) => { filters.date = e.target.value; draw(); });

    const status = select(filters.status, [{ value: "", label: "Tüm Durumlar" }, ...Constants.STATUSES], (v) => { filters.status = v; draw(); });
    const customer = select(String(filters.customerId), [{ value: "", label: "Tüm Müşteriler" }, ...customers.map((c) => ({ value: String(c.id), label: c.name }))], (v) => { filters.customerId = v; draw(); });

    const clear = el("button", { class: "btn btn-secondary btn-sm", text: "Temizle", onClick: () => {
      Object.keys(filters).forEach((k) => (filters[k] = ""));
      if (currentServiceFilter) filters.service = currentServiceFilter;
      draw();
    } });

    return el("div", { class: "filter-bar" }, [
      q,
      el("div", { class: "filter-row" }, [date, status, customer, clear]),
    ]);
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
      if (filters.date && a.date !== filters.date) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.service && a.service !== filters.service) return false;
      if (filters.customerId && String(a.customerId) !== String(filters.customerId)) return false;
      if (q) {
        const hay = [a.customerName, a.phone, a.email, a.service, a.notes, a.address]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function rowItem(a) {
    const s = Constants.statusMeta(a.status);
    return el("div", { class: "record-row", style: `--card-color:${s.color}`, onClick: () => Appointments.openDetail(a.id) }, [
      el("div", { class: "record-date" }, [
        el("span", { class: "record-day", text: Utils.formatDateShort(a.date) }),
        a.time ? el("span", { class: "record-time", text: a.time }) : null,
      ].filter(Boolean)),
      el("div", { class: "record-main" }, [
        el("div", { class: "record-name", text: a.customerName || "(isimsiz)" }),
        el("div", { class: "record-sub", text: [a.phone, a.email].filter(Boolean).join(" · ") }),
      ]),
      el("div", { class: "record-badges" }, [
        el("span", { class: "badge", style: `background:${s.color}22;color:${s.color}`, text: s.label }),
      ]),
    ]);
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
