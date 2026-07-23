/**
 * records.js
 * Randevu listesi sayfası: arama + filtreleme (tarih, durum, hizmet,
 * müşteri, ödeme durumu).
 */

const Records = (() => {
  const { el, debounce, formatMoney, icon, toast } = Utils;

  const EXPORT_COLUMNS = [
    ["Tarih", (a) => a.date || ""],
    ["Saat", (a) => a.time || ""],
    ["Müşteri", (a) => a.customerName || ""],
    ["Telefon", (a) => a.phone || ""],
    ["Firma", (a) => a.company || ""],
    ["Hizmet", (a) => a.service || ""],
    ["Proje", (a) => a.project || ""],
    ["Tahmini Ücret", (a) => Number(a.fee) || 0],
    ["Tahsil Edilen", (a) => Number(a.paid) || 0],
    ["Ödeme Durumu", (a) => Constants.paymentMeta(a.payment).label],
    ["Durum", (a) => Constants.statusMeta(a.status).label],
    ["Öncelik", (a) => Constants.priorityMeta(a.priority).label],
    ["Notlar", (a) => a.notes || ""],
  ];

  const filters = {
    q: "",
    date: "",
    status: "",
    service: "",
    customerId: "",
    payment: "",
  };

  let containerRef = null;
  let appointments = [];
  let customers = [];

  async function render(container, preset = {}) {
    containerRef = container;
    Object.assign(filters, preset);
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

    container.appendChild(
      el("div", { class: "page-head" }, [
        el("h1", { text: "Randevular" }),
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
          el("button", { class: "btn btn-primary", onClick: () => Appointments.openForm() }, [
            el("span", { class: "btn-ico", html: icon("plus", 16) }), "Yeni Randevu",
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
    const services = [...new Set(appointments.map((a) => a.service).filter(Boolean))];

    const q = el("input", { type: "search", placeholder: "Ara: müşteri, telefon, firma, hizmet, not...", value: filters.q, class: "filter-search" });
    q.addEventListener("input", debounce((e) => { filters.q = e.target.value; draw(); }, 200));

    const date = el("input", { type: "date", value: filters.date });
    date.addEventListener("change", (e) => { filters.date = e.target.value; draw(); });

    const status = select(filters.status, [{ value: "", label: "Tüm Durumlar" }, ...Constants.STATUSES], (v) => { filters.status = v; draw(); });
    const payment = select(filters.payment, [{ value: "", label: "Tüm Ödemeler" }, ...Constants.PAYMENT], (v) => { filters.payment = v; draw(); });
    const service = select(filters.service, [{ value: "", label: "Tüm Hizmetler" }, ...services.map((s) => ({ value: s, label: s }))], (v) => { filters.service = v; draw(); });
    const customer = select(String(filters.customerId), [{ value: "", label: "Tüm Müşteriler" }, ...customers.map((c) => ({ value: String(c.id), label: c.name }))], (v) => { filters.customerId = v; draw(); });

    const clear = el("button", { class: "btn btn-secondary btn-sm", text: "Temizle", onClick: () => {
      Object.keys(filters).forEach((k) => (filters[k] = ""));
      draw();
    } });

    return el("div", { class: "filter-bar" }, [
      q,
      el("div", { class: "filter-row" }, [date, status, payment, service, customer, clear]),
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
      if (filters.payment && a.payment !== filters.payment) return false;
      if (filters.service && a.service !== filters.service) return false;
      if (filters.customerId && String(a.customerId) !== String(filters.customerId)) return false;
      if (q) {
        const hay = [a.customerName, a.phone, a.company, a.service, a.notes, a.project]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function rowItem(a) {
    const s = Constants.statusMeta(a.status);
    const pay = Constants.paymentMeta(a.payment);
    return el("div", { class: "record-row", style: `--card-color:${s.color}`, onClick: () => Appointments.openDetail(a.id) }, [
      el("div", { class: "record-date" }, [
        el("span", { class: "record-day", text: Utils.formatDateShort(a.date) }),
        el("span", { class: "record-time", text: a.time || "" }),
      ]),
      el("div", { class: "record-main" }, [
        el("div", { class: "record-name", text: a.customerName || "(isimsiz)" }),
        el("div", { class: "record-sub", text: [a.service, a.company].filter(Boolean).join(" · ") }),
      ]),
      el("div", { class: "record-money", text: formatMoney(a.fee) }),
      el("div", { class: "record-badges" }, [
        el("span", { class: "badge", style: `background:${s.color}22;color:${s.color}`, text: s.label }),
        el("span", { class: "badge", style: `background:${pay.color}22;color:${pay.color}`, text: pay.label }),
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
