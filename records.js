/**
 * records.js
 * Randevu listesi sayfası: arama + filtreleme (tarih, durum, hizmet,
 * müşteri, ödeme durumu).
 */

const Records = (() => {
  const { el, debounce, formatMoney } = Utils;

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
    container.appendChild(
      el("div", { class: "page-head" }, [
        el("h1", { text: "Randevular" }),
        el("button", { class: "btn btn-primary", onClick: () => Appointments.openForm() }, ["＋ Yeni Randevu"]),
      ])
    );

    container.appendChild(filterBar());

    const filtered = applyFilters();
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

  return { render };
})();

window.Records = Records;
