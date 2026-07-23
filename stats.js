/**
 * stats.js
 * İstatistikler: aylık randevu sayısı, aylık gelir, en çok alınan hizmet,
 * en aktif müşteri. Grafikler utils.js içindeki canvas çizerleriyle.
 */

const Stats = (() => {
  const { el, formatMoney, barChart, lineChart, MONTHS_TR } = Utils;

  async function render(container) {
    const appointments = await DB.appointments.all();
    container.innerHTML = "";
    container.appendChild(el("div", { class: "page-head" }, [el("h1", { text: "İstatistikler" })]));

    if (appointments.length === 0) {
      container.appendChild(el("p", { class: "empty", text: "Grafik oluşturmak için yeterli veri yok." }));
      return;
    }

    // Son 6 ay
    const months = lastMonths(6);
    const countByMonth = months.map((m) => appointments.filter((a) => (a.date || "").slice(0, 7) === m.key).length);
    const revenueByMonth = months.map((m) =>
      appointments
        .filter((a) => (a.date || "").slice(0, 7) === m.key && a.status !== "iptal")
        .reduce((s, a) => s + (Number(a.fee) || 0), 0)
    );

    // En çok hizmet
    const serviceCount = {};
    appointments.forEach((a) => { if (a.service) serviceCount[a.service] = (serviceCount[a.service] || 0) + 1; });
    const topServices = Object.entries(serviceCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // En aktif müşteri
    const custCount = {};
    appointments.forEach((a) => { if (a.customerName) custCount[a.customerName] = (custCount[a.customerName] || 0) + 1; });
    const topCustomers = Object.entries(custCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const grid = el("div", { class: "stats-grid" });

    grid.appendChild(chartCard("Aylık Randevu Sayısı", (canvas) =>
      barChart(canvas, months.map((m) => m.label), countByMonth)));

    grid.appendChild(chartCard("Aylık Gelir (₺)", (canvas) =>
      lineChart(canvas, months.map((m) => m.label), revenueByMonth, { color: "#cfcfcf" })));

    grid.appendChild(chartCard("En Çok Alınan Hizmet", (canvas) =>
      barChart(canvas, topServices.map((s) => shorten(s[0])), topServices.map((s) => s[1]), { color: "#cfcfcf" }),
      topServices.length === 0));

    grid.appendChild(chartCard("En Aktif Müşteri", (canvas) =>
      barChart(canvas, topCustomers.map((s) => shorten(s[0])), topCustomers.map((s) => s[1]), { color: "#cfcfcf" }),
      topCustomers.length === 0));

    container.appendChild(grid);

    // canvasları çiz (DOM'a eklendikten sonra)
    requestAnimationFrame(() => {
      pending.forEach(({ canvas, drawFn }) => drawFn(canvas));
      pending.length = 0;
    });
  }

  const pending = [];

  function chartCard(title, drawFn, empty = false) {
    const box = el("div", { class: "panel chart-card" }, [
      el("div", { class: "panel-head" }, [el("h2", { text: title })]),
    ]);
    if (empty) {
      box.appendChild(el("p", { class: "empty", text: "Veri yok." }));
    } else {
      const canvas = el("canvas", { class: "chart-canvas" });
      box.appendChild(canvas);
      pending.push({ canvas, drawFn });
    }
    return box;
  }

  function lastMonths(n) {
    const arr = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({
        key: `${d.getFullYear()}-${Utils.pad(d.getMonth() + 1)}`,
        label: MONTHS_TR[d.getMonth()].slice(0, 3),
      });
    }
    return arr;
  }

  function shorten(s) {
    return s.length > 8 ? s.slice(0, 7) + "…" : s;
  }

  return { render };
})();

window.Stats = Stats;
