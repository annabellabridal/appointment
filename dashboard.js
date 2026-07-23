/**
 * dashboard.js
 * Ana ekran: özet kartları, yaklaşan randevular, son müşteriler.
 */

const Dashboard = (() => {
  const { el, formatMoney, formatDate } = Utils;

  async function render(container) {
    const today = Utils.todayStr();
    const now = new Date();
    const monthStart = today.slice(0, 7) + "-01";
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const monthEnd = Utils.toDateStr(nextMonth);

    const [todayAppts, rangeAppts, allAppts, customers] = await Promise.all([
      DB.appointments.today(),
      DB.appointments.byDateRange(today, monthEnd),
      DB.appointments.all(),
      DB.customers.all(),
    ]);

    const todays = todayAppts;
    const upcoming = rangeAppts
      .filter((a) => a.status !== "iptal" && a.status !== "tamamlandi" && appointmentDateTime(a) >= now)
      .sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b))
      .slice(0, 6);
    const pending = allAppts.filter((a) => a.status === "bekliyor");
    const done = allAppts.filter((a) => a.status === "tamamlandi");

    const ym = today.slice(0, 7);
    const monthRevenue = rangeAppts
      .filter((a) => a.status !== "iptal")
      .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);

    const recentCustomers = [...customers]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 5);

    container.innerHTML = "";

    // Başlık + Yeni Randevu
    container.appendChild(
      el("div", { class: "page-head" }, [
        el("div", {}, [
          el("h1", { text: "Panel" }),
          el("p", { class: "muted", text: formatDate(today) }),
        ]),
        el("button", { class: "btn btn-primary btn-lg", onClick: () => Appointments.openForm() }, [
          el("span", { text: "＋ Yeni Randevu" }),
        ]),
      ])
    );

    // İstatistik kartları
    const stats = el("div", { class: "stat-grid" });
    stats.append(
      statCard("Bugünkü Randevu", todays.length, "calendar"),
      statCard("Bekleyen İşler", pending.length, "clock"),
      statCard("Tamamlanan İşler", done.length, "check"),
      statCard("Bu Ayki Tahmini Gelir", formatMoney(monthRevenue), "wallet"),
    );
    container.appendChild(stats);

    // İki kolon: yaklaşan randevular + son müşteriler
    const cols = el("div", { class: "dash-cols" });

    const upBox = el("div", { class: "panel" }, [
      el("div", { class: "panel-head" }, [el("h2", { text: "Yaklaşan Randevular" })]),
    ]);
    if (upcoming.length === 0) {
      upBox.appendChild(el("p", { class: "empty", text: "Yaklaşan randevu yok." }));
    } else {
      const list = el("div", { class: "up-list" });
      upcoming.forEach((a) => {
        const s = Constants.statusMeta(a.status);
        const item = el("div", { class: "up-item", style: `--card-color:${s.color}`, onClick: () => Appointments.openDetail(a.id) }, [
          el("div", { class: "up-date" }, [
            el("span", { class: "up-day", text: Utils.formatDateShort(a.date) }),
            el("span", { class: "up-time", text: a.time || "" }),
          ]),
          el("div", { class: "up-info" }, [
            el("div", { class: "up-name", text: a.customerName || "(isimsiz)" }),
            el("div", { class: "up-sub", text: a.service || "" }),
          ]),
          el("span", { class: "badge", style: `background:${s.color}22;color:${s.color}`, text: s.label }),
        ]);
        list.appendChild(item);
      });
      upBox.appendChild(list);
    }

    const custBox = el("div", { class: "panel" }, [
      el("div", { class: "panel-head" }, [el("h2", { text: "Son Eklenen Müşteriler" })]),
    ]);
    if (recentCustomers.length === 0) {
      custBox.appendChild(el("p", { class: "empty", text: "Henüz müşteri yok." }));
    } else {
      const list = el("div", { class: "up-list" });
      recentCustomers.forEach((c) => {
        list.appendChild(
          el("div", { class: "up-item", onClick: () => Customers.openProfile(c.id) }, [
            el("div", { class: "avatar", text: Utils.initials(c.name) }),
            el("div", { class: "up-info" }, [
              el("div", { class: "up-name", text: c.name || "(isimsiz)" }),
              el("div", { class: "up-sub", text: c.company || c.phone || "" }),
            ]),
          ])
        );
      });
      custBox.appendChild(list);
    }

    cols.append(upBox, custBox);
    container.appendChild(cols);
  }

  function statCard(label, value, iconName) {
    return el("div", { class: "stat-card" }, [
      el("div", { class: "stat-icon", html: Utils.icon(iconName, 20) }),
      el("div", {}, [
        el("div", { class: "stat-value", text: String(value) }),
        el("div", { class: "stat-label", text: label }),
      ]),
    ]);
  }

  function appointmentDateTime(a) {
    return new Date(`${a.date}T${a.time || "00:00"}`);
  }

  return { render };
})();

window.Dashboard = Dashboard;
