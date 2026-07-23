/**
 * appointments.js
 * Randevu oluşturma/düzenleme formu, randevu kartları ve CRUD.
 */

// Uygulama genelinde kullanılan sabitler
const Constants = {
  // Monokrom palet: gri tonları (siyah / antrasit / açık gri)
  STATUSES: [
    { value: "toplanti", label: "Toplantı", color: "#8a8a8a" },
    { value: "bekliyor", label: "Bekliyor", color: "#b5b5b5" },
    { value: "tamamlandi", label: "Tamamlandı", color: "#f0f0f0" },
    { value: "iptal", label: "İptal", color: "#5a5a5a" },
  ],
  SERVICE_TYPES: [
    { value: "Randevu", label: "Randevu" },
    { value: "Prova Randevusu", label: "Prova Randevusu" },
  ],
  PRIORITIES: [
    { value: "dusuk", label: "Düşük", color: "#6a6a6a" },
    { value: "orta", label: "Orta", color: "#9a9a9a" },
    { value: "yuksek", label: "Yüksek", color: "#e8e8e8" },
  ],
  PAYMENT: [
    { value: "odenmedi", label: "Ödenmedi", color: "#6a6a6a" },
    { value: "kismi", label: "Kısmi", color: "#a5a5a5" },
    { value: "odendi", label: "Ödendi", color: "#f0f0f0" },
  ],
  statusMeta(v) {
    return this.STATUSES.find((s) => s.value === v) || this.STATUSES[0];
  },
  priorityMeta(v) {
    return this.PRIORITIES.find((s) => s.value === v) || this.PRIORITIES[1];
  },
  paymentMeta(v) {
    return this.PAYMENT.find((s) => s.value === v) || this.PAYMENT[0];
  },
};
window.Constants = Constants;

const Appointments = (() => {
  const { el, $, escapeHtml, toast, modal, fileToDataURL, humanSize, confirmDialog } = Utils;
  const pickerCleanups = new Set();
  const pickerMonths = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const pickerDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  function padTime(value) {
    return String(value).padStart(2, "0");
  }

  function pickerIcon(type) {
    if (type === "date") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  }

  function createPickerShell({ name, value, type, label }) {
    const input = el("input", { type: "hidden", name, value });
    const icon = el("span", { class: "modern-picker-icon", html: pickerIcon(type) });
    const primary = el("span", { class: "modern-picker-value" });
    const secondary = el("span", { class: "modern-picker-meta" });
    const text = el("span", { class: "modern-picker-text" }, [primary, secondary]);
    const chevron = el("span", { class: "modern-picker-chevron", html: "&#8964;" });
    const trigger = el("button", {
      type: "button",
      class: "modern-picker-trigger",
      "aria-label": label,
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
    }, [icon, text, chevron]);
    const root = el("div", { class: "modern-picker" }, [input, trigger]);
    const panel = el("div", { class: `picker-popover picker-popover-${type}`, role: "dialog", "aria-label": label });
    document.body.appendChild(panel);

    let isOpen = false;

    function positionPanel() {
      if (!isOpen) return;
      const rect = trigger.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(panel.offsetWidth, window.innerWidth - margin * 2);
      let left = Math.min(rect.left, window.innerWidth - width - margin);
      left = Math.max(margin, left);
      let top = rect.bottom + 8;
      if (top + panel.offsetHeight > window.innerHeight - margin && rect.top > panel.offsetHeight + margin) {
        top = rect.top - panel.offsetHeight - 8;
      }
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(margin, top)}px`;
    }

    function open() {
      document.dispatchEvent(new CustomEvent("modern-picker:open", { detail: root }));
      isOpen = true;
      root.classList.add("is-open");
      panel.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      requestAnimationFrame(positionPanel);
    }

    function close() {
      isOpen = false;
      root.classList.remove("is-open");
      panel.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    function toggle() {
      if (isOpen) close();
      else open();
    }

    function onPointerDown(event) {
      if (!root.contains(event.target) && !panel.contains(event.target)) close();
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && isOpen) {
        close();
        trigger.focus();
      }
    }

    function onOtherPicker(event) {
      if (event.detail !== root) close();
    }

    trigger.addEventListener("click", toggle);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("modern-picker:open", onOtherPicker);
    window.addEventListener("resize", positionPanel);
    document.addEventListener("scroll", positionPanel, true);

    function destroy() {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("modern-picker:open", onOtherPicker);
      window.removeEventListener("resize", positionPanel);
      document.removeEventListener("scroll", positionPanel, true);
      panel.remove();
      pickerCleanups.delete(destroy);
    }

    pickerCleanups.add(destroy);
    return { root, input, trigger, panel, primary, secondary, close, open, positionPanel, isOpen: () => isOpen };
  }

  function createDatePicker(value) {
    const picker = createPickerShell({ name: "date", value, type: "date", label: "Tarih seç" });
    let selected = Utils.parseDate(value) || new Date();
    let viewDate = new Date(selected.getFullYear(), selected.getMonth(), 1);

    function updateTrigger() {
      picker.primary.textContent = Utils.formatDateShort(picker.input.value);
      picker.secondary.textContent = Utils.formatDate(picker.input.value);
    }

    function choose(date) {
      selected = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      viewDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
      picker.input.value = Utils.toDateStr(selected);
      picker.input.dispatchEvent(new Event("change", { bubbles: true }));
      updateTrigger();
      render();
      picker.close();
    }

    function render() {
      const today = new Date();
      const headerTitle = el("div", { class: "picker-month-title", text: `${pickerMonths[viewDate.getMonth()]} ${viewDate.getFullYear()}` });
      const previous = el("button", { type: "button", class: "picker-nav-btn", "aria-label": "Önceki ay", html: "&#8592;" });
      const next = el("button", { type: "button", class: "picker-nav-btn", "aria-label": "Sonraki ay", html: "&#8594;" });
      previous.addEventListener("click", () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        render();
      });
      next.addEventListener("click", () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        render();
      });

      const weekdays = el("div", { class: "picker-weekdays" }, pickerDays.map((day) => el("span", { text: day })));
      const grid = el("div", { class: "picker-date-grid" });
      const firstDay = (viewDate.getDay() + 6) % 7;
      const gridStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - firstDay);

      for (let index = 0; index < 42; index += 1) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const isMuted = date.getMonth() !== viewDate.getMonth();
        const isSelected = Utils.sameDay(date, selected);
        const isToday = Utils.sameDay(date, today);
        const day = el("button", {
          type: "button",
          class: `picker-day${isMuted ? " is-muted" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`,
          text: String(date.getDate()),
          "aria-label": Utils.formatDate(Utils.toDateStr(date)),
          "aria-pressed": isSelected ? "true" : "false",
        });
        day.addEventListener("click", () => choose(date));
        grid.appendChild(day);
      }

      const todayButton = el("button", { type: "button", class: "picker-today-btn", text: "Bugünü seç" });
      todayButton.addEventListener("click", () => choose(new Date()));
      picker.panel.replaceChildren(
        el("div", { class: "picker-date-head" }, [
          el("div", {}, [el("span", { class: "picker-eyebrow", text: "Tarih" }), headerTitle]),
          el("div", { class: "picker-nav" }, [previous, next]),
        ]),
        weekdays,
        grid,
        el("div", { class: "picker-footer" }, [todayButton])
      );
      requestAnimationFrame(picker.positionPanel);
    }

    updateTrigger();
    render();
    return picker.root;
  }

  function createTimePicker(value) {
    const normalized = /^\d{2}:\d{2}$/.test(value) ? value : "09:00";
    const picker = createPickerShell({ name: "time", value: normalized, type: "time", label: "Saat seç" });
    let [selectedHour, selectedMinute] = normalized.split(":").map(Number);
    const preview = el("div", { class: "picker-time-preview" });
    const hourColumn = el("div", { class: "picker-time-list", role: "listbox", "aria-label": "Saat" });
    const minuteColumn = el("div", { class: "picker-time-list", role: "listbox", "aria-label": "Dakika" });

    function updateTrigger() {
      picker.primary.textContent = `${padTime(selectedHour)}:${padTime(selectedMinute)}`;
      picker.secondary.textContent = selectedHour < 12 ? "Sabah" : selectedHour < 18 ? "Öğleden sonra" : "Akşam";
      preview.textContent = `${padTime(selectedHour)}:${padTime(selectedMinute)}`;
    }

    function updateSelection() {
      hourColumn.querySelectorAll("button").forEach((button) => {
        const active = Number(button.dataset.value) === selectedHour;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      minuteColumn.querySelectorAll("button").forEach((button) => {
        const active = Number(button.dataset.value) === selectedMinute;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      picker.input.value = `${padTime(selectedHour)}:${padTime(selectedMinute)}`;
      picker.input.dispatchEvent(new Event("change", { bubbles: true }));
      updateTrigger();
    }

    for (let hour = 0; hour < 24; hour += 1) {
      const button = el("button", { type: "button", class: "picker-time-option", text: padTime(hour), "data-value": String(hour), role: "option" });
      button.addEventListener("click", () => {
        selectedHour = hour;
        updateSelection();
      });
      hourColumn.appendChild(button);
    }

    for (let minute = 0; minute < 60; minute += 1) {
      const button = el("button", { type: "button", class: "picker-time-option", text: padTime(minute), "data-value": String(minute), role: "option" });
      button.addEventListener("click", () => {
        selectedMinute = minute;
        updateSelection();
      });
      minuteColumn.appendChild(button);
    }

    const confirm = el("button", { type: "button", class: "picker-time-confirm", text: "Saati kullan" });
    confirm.addEventListener("click", picker.close);
    picker.panel.append(
      el("div", { class: "picker-time-head" }, [
        el("div", {}, [el("span", { class: "picker-eyebrow", text: "Saat" }), el("div", { class: "picker-time-title", text: "Randevu zamanı" })]),
        preview,
      ]),
      el("div", { class: "picker-time-labels" }, [el("span", { text: "Saat" }), el("span", { text: "Dakika" })]),
      el("div", { class: "picker-time-columns" }, [hourColumn, minuteColumn]),
      el("div", { class: "picker-footer" }, [confirm])
    );

    picker.trigger.addEventListener("click", () => {
      if (!picker.isOpen()) return;
      requestAnimationFrame(() => {
        hourColumn.querySelector(".is-selected")?.scrollIntoView({ block: "center" });
        minuteColumn.querySelector(".is-selected")?.scrollIntoView({ block: "center" });
      });
    });
    updateSelection();
    return picker.root;
  }

  async function openForm(existingId = null, prefill = {}) {
    const [customers] = await Promise.all([
      DB.customers.all(),
    ]);

    let appt = {
      date: prefill.date || Utils.todayStr(),
      time: prefill.time || "",
      customerName: "",
      phone: "",
      email: "",
      address: "",
      service: prefill.service || "Randevu",
      status: "bekliyor",
      notes: "",
    };

    if (existingId) {
      const found = await DB.appointments.get(existingId);
      if (found) appt = { ...appt, ...found };
    }

    const form = el("form", { class: "form-grid", id: "appt-form" });

    const field = (label, control, full = false) =>
      el("label", { class: `field ${full ? "field-full" : ""}` }, [
        el("span", { class: "field-label", text: label }),
        control,
      ]);

    const dateInput = createDatePicker(appt.date);
    const timeInput = createTimePicker(appt.time || "09:00");

    const dateTimeRow = el("div", { class: "field-full date-time-row" }, [
      el("div", { class: "field date-col" }, [
        el("span", { class: "field-label", text: "Düğün Tarihi" }),
        dateInput,
      ]),
      el("div", { class: "field time-col", id: "time-field" }, [
        el("span", { class: "field-label", text: "Saat" }),
        timeInput,
      ]),
    ]);

    const nameInput = el("input", { type: "text", name: "customerName", value: appt.customerName, placeholder: "Müşteri adı" });
    const phoneInput = el("input", { type: "tel", name: "phone", value: appt.phone, placeholder: "05xx xxx xx xx" });
    const emailInput = el("input", { type: "email", name: "email", value: appt.email, placeholder: "ornek@mail.com" });
    const addressInput = el("input", { type: "text", name: "address", value: appt.address, placeholder: "Adres" });

    const serviceSelect = el("select", { name: "service" },
      Constants.SERVICE_TYPES.map((s) => el("option", { value: s.value, text: s.label })));
    serviceSelect.value = appt.service;

    const statusSelect = el("select", { name: "status" },
      Constants.STATUSES.map((s) => el("option", { value: s.value, text: s.label })));
    statusSelect.value = appt.status;

    const notesInput = el("textarea", { name: "notes", rows: "3", placeholder: "Notlar..." });
    notesInput.value = appt.notes || "";

    const fileListBox = el("div", { class: "file-chips" });
    const pendingFiles = [];
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    async function addPickedFiles(list) {
      for (const f of list) {
        if (f.size > MAX_FILE_SIZE) {
          toast(`${f.name} dosyası çok büyük (maks 5MB).`, "error");
          continue;
        }
        pendingFiles.push({ file: f, name: f.name, type: f.type, size: f.size });
      }
      renderPending();
    }

    let existingFiles = [];
    if (existingId) existingFiles = await DB.files.byAppointment(existingId);

    function renderPending() {
      fileListBox.innerHTML = "";
      existingFiles.forEach((f) => {
        fileListBox.appendChild(fileChip(f.name, f.size, () => removeExisting(f.id)));
      });
      pendingFiles.forEach((f, i) => {
        fileListBox.appendChild(fileChip(f.name, f.size, () => { pendingFiles.splice(i, 1); renderPending(); }));
      });
    }
    async function removeExisting(id) {
      const file = existingFiles.find((f) => f.id === id);
      if (file?.storagePath) await DB.files.deleteStorage(file.storagePath);
      await DB.files.remove(id);
      existingFiles = existingFiles.filter((f) => f.id !== id);
      renderPending();
    }
    function fileChip(name, size, onRemove) {
      return el("span", { class: "file-chip" }, [
        el("span", { text: `${name} · ${humanSize(size)}` }),
        el("button", { type: "button", class: "chip-x", html: "&times;", onClick: onRemove }),
      ]);
    }
    renderPending();

    const fileInput = el("input", { type: "file", name: "files", multiple: true,
      accept: ".pdf,.jpg,.jpeg,.png,.docx,image/*,application/pdf",
      onChange: (e) => addPickedFiles(e.target.files) });

    form.append(
      dateTimeRow,
      field("Müşteri Adı", nameInput),
      field("Telefon", phoneInput),
      field("E-posta", emailInput),
      field("Adres", addressInput, true),
      field("Hizmet Türü", serviceSelect),
      field("Durum", statusSelect),
      field("Notlar", notesInput, true),
      field("Dosya Ekle", fileInput, true),
      el("div", { class: "field-full" }, [fileListBox]),
    );

    const m = modal({
      title: existingId ? "Randevuyu Düzenle" : "Yeni Randevu",
      body: form,
      wide: true,
      onClose: () => {
        [...pickerCleanups].forEach((cleanup) => cleanup());
      },
      actions: [
        { label: "Vazgeç", class: "btn-secondary", onClick: ({ close }) => close() },
        {
          label: "Kaydet",
          class: "btn-primary",
          onClick: async ({ close }) => {
            const data = collect(form);
            if (!data.date) { toast("Tarih zorunlu", "error"); return; }
            if (!data.customerName) { toast("Müşteri adı girin", "error"); return; }

            data.updatedAt = new Date().toISOString();

            let apptId = existingId;
            if (existingId) {
              data.id = existingId;
              data.createdAt = appt.createdAt || data.updatedAt;
              await DB.appointments.put(data);
            } else {
              data.createdAt = data.updatedAt;
              apptId = await DB.appointments.add(data);
            }

            for (const f of pendingFiles) {
              const { path, url } = await DB.files.upload(f.file);
              await DB.files.add({
                name: f.name,
                type: f.type,
                size: f.size,
                storagePath: path,
                url,
                appointmentId: apptId,
              });
            }

            toast("Randevu kaydedildi", "success");
            close();
            document.dispatchEvent(new CustomEvent("data:changed", { detail: { type: "appointments" } }));
          },
        },
      ],
    });

    return m;
  }

  function collect(form) {
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (k === "files" || k === "photos") return;
      data[k] = v;
    });
    return data;
  }

  async function ensureCustomer(data, customers) {
    // Aynı isim+telefon varsa onu kullan, yoksa yeni oluştur
    const existing = customers.find(
      (c) => c.name === data.customerName && (c.phone || "") === (data.phone || "")
    );
    if (existing) return existing.id;
    if (!data.customerName) return "";
    return DB.customers.add({
      name: data.customerName,
      phone: data.phone || "",
      email: data.email || "",
      company: data.company || "",
      address: data.address || "",
      website: "",
      social: "",
      notes: "",
      createdAt: new Date().toISOString(),
    });
  }

  async function remove(id) {
    const ok = await confirmDialog("Bu randevu silinsin mi?", { title: "Randevu Sil", danger: true });
    if (!ok) return false;
    const files = await DB.files.byAppointment(id);
    await Promise.all(files.map(async (f) => {
      if (f.storagePath) await DB.files.deleteStorage(f.storagePath);
      await DB.files.remove(f.id);
    }));
    await DB.appointments.remove(id);
    toast("Randevu silindi", "success");
    document.dispatchEvent(new CustomEvent("data:changed", { detail: { type: "appointments" } }));
    return true;
  }

  // Randevu kartı (liste/takvim için)
  function card(appt, { compact = false } = {}) {
    const s = Constants.statusMeta(appt.status);
    const node = el("div", {
      class: `appt-card ${compact ? "compact" : ""}`,
      "data-id": appt.id,
      draggable: "true",
      style: `--card-color:${s.color}`,
    });
    node.appendChild(el("div", { class: "appt-card-bar" }));
    const body = el("div", { class: "appt-card-body" });
    body.appendChild(el("div", { class: "appt-title", text: appt.customerName || "(isimsiz)" }));
    if (!compact) {
      if (appt.service) body.appendChild(el("div", { class: "appt-sub", text: appt.service }));
      body.appendChild(el("span", { class: "badge", style: `background:${s.color}22;color:${s.color}`, text: s.label }));
    }
    node.appendChild(body);

    node.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(appt.id));
      e.dataTransfer.effectAllowed = "move";
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => node.classList.remove("dragging"));

    node.addEventListener("click", () => openDetail(appt.id));
    return node;
  }

  async function openDetail(id) {
    const appt = await DB.appointments.get(id);
    if (!appt) return;
    const s = Constants.statusMeta(appt.status);
    const files = await DB.files.byAppointment(id);

    const wrap = el("div", { class: "detail" });
    const row = (label, value) =>
      value ? el("div", { class: "detail-row" }, [
        el("span", { class: "detail-label", text: label }),
        el("span", { class: "detail-value", text: value }),
      ]) : null;

    wrap.append(
      el("div", { class: "detail-badges" }, [
        el("span", { class: "badge", style: `background:${s.color}22;color:${s.color}`, text: s.label }),
        appt.service ? el("span", { class: "badge", text: appt.service }) : null,
      ]),
      row("Tarih", Utils.formatDate(appt.date)),
      appt.time ? row("Saat", appt.time) : null,
      row("Müşteri", appt.customerName),
      row("Telefon", appt.phone),
      row("E-posta", appt.email),
      row("Adres", appt.address),
      row("Hizmet Türü", appt.service),
      appt.notes ? el("div", { class: "detail-notes", text: appt.notes }) : null
    );

    if (files.length) {
      const fl = el("div", { class: "detail-files" });
      fl.appendChild(el("div", { class: "detail-label", text: "Dosyalar" }));
      files.forEach((f) => {
        const fileUrl = f.url || f.dataUrl;
        const isImg = (f.type || "").startsWith("image/");
        if (isImg) {
          fl.appendChild(el("a", { href: fileUrl, target: "_blank", rel: "noopener" }, [
            el("img", { src: fileUrl, class: "thumb", alt: f.name }),
          ]));
        } else {
          fl.appendChild(el("a", { class: "file-chip", href: fileUrl, download: f.name, text: `${f.name} · ${humanSize(f.size)}` }));
        }
      });
      wrap.appendChild(fl);
    }

    modal({
      title: "Randevu Detayı",
      body: wrap,
      wide: true,
      actions: [
        { label: "Sil", class: "btn-danger", onClick: async ({ close }) => { if (await remove(id)) close(); } },
        { label: "Düzenle", class: "btn-secondary", onClick: ({ close }) => { close(); openForm(id); } },
        { label: "Kapat", class: "btn-primary", onClick: ({ close }) => close() },
      ],
    });
  }

  return { openForm, openDetail, remove, card };
})();

window.Appointments = Appointments;
