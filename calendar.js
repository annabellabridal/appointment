/**
 * calendar.js
 * Takvim: günlük / haftalık / aylık görünüm, renkli kartlar,
 * sürükle-bırak ile tarih değiştirme.
 */

const Calendar = (() => {
  const { el, addDays, startOfWeek, toDateStr, parseDate, sameDay, MONTHS_TR, DAYS_TR } = Utils;

  const state = {
    view: "month", // day | week | month
    cursor: new Date(),
  };

  let containerRef = null;
  let appointmentsCache = [];

  async function render(container) {
    containerRef = container;
    await loadAppointments();
    draw();
  }

  async function loadAppointments() {
    const d = state.cursor;
    let from, to;
    if (state.view === "month") {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const startIdx = Utils.weekdayIndex(first);
      from = Utils.toDateStr(addDays(first, -startIdx - 1));
      to = Utils.toDateStr(addDays(first, 42 + 1));
    } else if (state.view === "week") {
      const s = startOfWeek(d);
      from = Utils.toDateStr(addDays(s, -1));
      to = Utils.toDateStr(addDays(s, 8));
    } else {
      from = Utils.toDateStr(addDays(d, -1));
      to = Utils.toDateStr(addDays(d, 1));
    }
    appointmentsCache = await DB.appointments.byDateRange(from, to);
  }

  function draw() {
    const container = containerRef;
    container.innerHTML = "";

    container.appendChild(
      el("div", { class: "page-head" }, [
        el("div", {}, [el("h1", { text: "Takvim" }), el("p", { class: "muted", text: title() })]),
        el("button", { class: "btn btn-primary", onClick: () => Appointments.openForm({}) }, ["＋ Yeni Randevu"]),
      ])
    );

    // Kontrol çubuğu
    const controls = el("div", { class: "cal-controls" }, [
      el("div", { class: "cal-nav" }, [
        el("button", { class: "icon-btn", html: "‹", title: "Önceki", onClick: () => shift(-1) }),
        el("button", { class: "btn btn-secondary btn-sm", text: "Bugün", onClick: () => { state.cursor = new Date(); loadAppointments().then(draw); } }),
        el("button", { class: "icon-btn", html: "›", title: "Sonraki", onClick: () => shift(1) }),
      ]),
      el("div", { class: "seg" }, [
        segBtn("Günlük", "day"),
        segBtn("Haftalık", "week"),
        segBtn("Aylık", "month"),
      ]),
    ]);
    container.appendChild(controls);

    const body = el("div", { class: "cal-body" });
    if (state.view === "month") drawMonth(body);
    else if (state.view === "week") drawWeek(body);
    else drawDay(body);
    container.appendChild(body);

    container.appendChild(legend());
  }

  function segBtn(label, view) {
    return el("button", {
      class: `seg-btn ${state.view === view ? "active" : ""}`,
      text: label,
      onClick: () => { state.view = view; loadAppointments().then(draw); },
    });
  }

  function title() {
    const d = state.cursor;
    if (state.view === "month") return `${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
    if (state.view === "week") {
      const s = startOfWeek(d);
      const e = addDays(s, 6);
      return `${s.getDate()} ${MONTHS_TR[s.getMonth()]} - ${e.getDate()} ${MONTHS_TR[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}, ${DAYS_TR[Utils.weekdayIndex(d)]}`;
  }

  function shift(dir) {
    const d = state.cursor;
    if (state.view === "month") state.cursor = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    else if (state.view === "week") state.cursor = addDays(d, 7 * dir);
    else state.cursor = addDays(d, dir);
    loadAppointments().then(draw);
  }

  function apptsOn(dateStr) {
    return appointmentsCache
      .filter((a) => a.date === dateStr)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }

  function drawMonth(body) {
    const grid = el("div", { class: "month-grid" });
    DAYS_TR.forEach((d) => grid.appendChild(el("div", { class: "month-dow", text: d })));

    const first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
    const startIdx = Utils.weekdayIndex(first);
    const start = addDays(first, -startIdx);

    for (let i = 0; i < 42; i++) {
      const day = addDays(start, i);
      const dateStr = toDateStr(day);
      const inMonth = day.getMonth() === state.cursor.getMonth();
      const isToday = sameDay(day, new Date());
      const cell = el("div", {
        class: `month-cell ${inMonth ? "" : "muted-cell"} ${isToday ? "today" : ""}`,
        "data-date": dateStr,
      });
      cell.appendChild(el("div", { class: "month-cell-head" }, [
        el("span", { class: "month-daynum", text: String(day.getDate()) }),
      ]));
      const list = el("div", { class: "month-appts" });
      apptsOn(dateStr).forEach((a) => list.appendChild(miniCard(a)));
      cell.appendChild(list);
      cell.addEventListener("dblclick", () => Appointments.openForm({ date: dateStr }));
      makeDroppable(cell, dateStr);
      grid.appendChild(cell);
    }
    body.appendChild(grid);
  }

  function drawWeek(body) {
    const s = startOfWeek(state.cursor);
    const grid = el("div", { class: "week-grid" });
    for (let i = 0; i < 7; i++) {
      const day = addDays(s, i);
      const dateStr = toDateStr(day);
      const isToday = sameDay(day, new Date());
      const col = el("div", { class: `week-col ${isToday ? "today" : ""}`, "data-date": dateStr });
      col.appendChild(el("div", { class: "week-col-head" }, [
        el("span", { class: "week-dow", text: DAYS_TR[i] }),
        el("span", { class: "week-daynum", text: String(day.getDate()) }),
      ]));
      const list = el("div", { class: "week-appts" });
      apptsOn(dateStr).forEach((a) => list.appendChild(Appointments.card(a)));
      col.appendChild(list);
      col.addEventListener("dblclick", () => Appointments.openForm({ date: dateStr }));
      makeDroppable(col, dateStr);
      grid.appendChild(col);
    }
    body.appendChild(grid);
  }

  function drawDay(body) {
    const dateStr = toDateStr(state.cursor);
    const wrap = el("div", { class: "day-view", "data-date": dateStr });
    const list = apptsOn(dateStr);
    if (list.length === 0) {
      wrap.appendChild(el("p", { class: "empty", text: "Bu gün için randevu yok. Eklemek için çift tıklayın." }));
    } else {
      list.forEach((a) => wrap.appendChild(Appointments.card(a)));
    }
    wrap.addEventListener("dblclick", (e) => {
      if (e.target === wrap) Appointments.openForm({ date: dateStr });
    });
    makeDroppable(wrap, dateStr);
    body.appendChild(wrap);
  }

  function miniCard(a) {
    const s = Constants.statusMeta(a.status);
    const label = a.time
      ? `${a.time} · ${a.customerName || "(isimsiz)"}`
      : a.customerName || "(isimsiz)";
    const node = el("div", {
      class: "mini-card",
      draggable: "true",
      "data-id": a.id,
      style: `--card-color:${s.color}`,
      title: label,
    }, [
      el("span", { class: "mini-name", text: label }),
    ]);
    node.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(a.id));
      e.dataTransfer.effectAllowed = "move";
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => node.classList.remove("dragging"));
    node.addEventListener("click", (e) => { e.stopPropagation(); Appointments.openDetail(a.id); });
    return node;
  }

  function makeDroppable(node, dateStr) {
    node.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      node.classList.add("drop-target");
    });
    node.addEventListener("dragleave", () => node.classList.remove("drop-target"));
    node.addEventListener("drop", async (e) => {
      e.preventDefault();
      node.classList.remove("drop-target");
      const id = Number(e.dataTransfer.getData("text/plain"));
      if (!id) return;
      const appt = await DB.appointments.get(id);
      if (!appt || appt.date === dateStr) return;
      appt.date = dateStr;
      appt.updatedAt = new Date().toISOString();
      await DB.appointments.put(appt);
      Utils.toast(`Randevu ${Utils.formatDateShort(dateStr)} tarihine taşındı`, "success");
      await loadAppointments();
      draw();
    });
  }

  function legend() {
    const box = el("div", { class: "legend" });
    Constants.STATUSES.forEach((s) => {
      box.appendChild(el("span", { class: "legend-item" }, [
        el("span", { class: "legend-dot", style: `background:${s.color}` }),
        el("span", { text: s.label }),
      ]));
    });
    return box;
  }

  return { render };
})();

window.Calendar = Calendar;
