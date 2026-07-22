/**
 * income.js
 * Gelir takibi: her iş için teklif/anlaşılan ücret, tahsil edilen, kalan.
 */

const Income = (() => {
  const { el, formatMoney } = Utils;

  async function render(container) {
    const appointments = (await DB.appointments.all())
      .filter((a) => a.status !== "iptal");

    const totalFee = appointments.reduce((s, a) => s + (Number(a.fee) || 0), 0);
    const totalPaid = appointments.reduce((s, a) => s + (Number(a.paid) || 0), 0);
    const totalRemaining = totalFee - totalPaid;

    container.innerHTML = "";
    container.appendChild(el("div", { class: "page-head" }, [el("h1", { text: "Gelir Takibi" })]));

    container.appendChild(el("div", { class: "stat-grid" }, [
      statCard("Toplam Anlaşılan", formatMoney(totalFee), "📊", "var(--accent)"),
      statCard("Tahsil Edilen", formatMoney(totalPaid), "💵", "#22c55e"),
      statCard("Kalan Ödeme", formatMoney(totalRemaining), "⏳", "#f59e0b"),
    ]));

    if (appointments.length === 0) {
      container.appendChild(el("p", { class: "empty", text: "Gelir kaydı yok." }));
      return;
    }

    const table = el("div", { class: "income-table" });
    table.appendChild(el("div", { class: "income-row income-head" }, [
      el("span", { text: "İş / Müşteri" }),
      el("span", { text: "Teklif" }),
      el("span", { text: "Tahsil" }),
      el("span", { text: "Kalan" }),
    ]));

    appointments
      .sort((a, b) => `${b.date}`.localeCompare(`${a.date}`))
      .forEach((a) => {
        const remaining = (Number(a.fee) || 0) - (Number(a.paid) || 0);
        table.appendChild(el("div", { class: "income-row", onClick: () => Appointments.openDetail(a.id) }, [
          el("div", { class: "income-name" }, [
            el("div", { text: a.customerName || "(isimsiz)" }),
            el("div", { class: "record-sub", text: [a.project || a.service, Utils.formatDateShort(a.date)].filter(Boolean).join(" · ") }),
          ]),
          el("span", { text: formatMoney(a.fee) }),
          el("span", { class: "text-green", text: formatMoney(a.paid) }),
          el("span", { class: remaining > 0 ? "text-orange" : "text-green", text: formatMoney(remaining) }),
        ]));
      });
    container.appendChild(table);
  }

  function statCard(label, value, icon, color) {
    return el("div", { class: "stat-card", style: `--stat-color:${color}` }, [
      el("div", { class: "stat-icon", text: icon }),
      el("div", {}, [
        el("div", { class: "stat-value", text: String(value) }),
        el("div", { class: "stat-label", text: label }),
      ]),
    ]);
  }

  return { render };
})();

window.Income = Income;
