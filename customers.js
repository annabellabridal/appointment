/**
 * customers.js
 * Müşteri listesi, profil (geçmiş randevular, toplam ödeme) ve CRUD.
 */

const Customers = (() => {
  const { el, modal, toast, confirmDialog, formatMoney, escapeHtml, initials } = Utils;

  let containerRef = null;

  async function render(container) {
    containerRef = container;
    const [customers, appointments] = await Promise.all([
      DB.customers.all(),
      DB.appointments.all(),
    ]);

    container.innerHTML = "";
    container.appendChild(
      el("div", { class: "page-head" }, [
        el("h1", { text: "Müşteriler" }),
        el("button", { class: "btn btn-primary", onClick: () => openForm() }, ["＋ Yeni Müşteri"]),
      ])
    );

    if (customers.length === 0) {
      container.appendChild(el("p", { class: "empty", text: "Henüz müşteri eklenmemiş." }));
      return;
    }

    const totalsByCustomer = {};
    appointments.forEach((a) => {
      if (!a.customerId) return;
      totalsByCustomer[a.customerId] = totalsByCustomer[a.customerId] || { count: 0, paid: 0 };
      totalsByCustomer[a.customerId].count += 1;
      totalsByCustomer[a.customerId].paid += Number(a.paid) || 0;
    });

    const grid = el("div", { class: "cust-grid" });
    customers
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"))
      .forEach((c) => {
        const t = totalsByCustomer[c.id] || { count: 0, paid: 0 };
        grid.appendChild(
          el("div", { class: "cust-card", onClick: () => openProfile(c.id) }, [
            el("div", { class: "avatar", text: initials(c.name) }),
            el("div", { class: "cust-info" }, [
              el("div", { class: "cust-name", text: c.name || "(isimsiz)" }),
              el("div", { class: "cust-sub", text: c.company || c.phone || "" }),
            ]),
            el("div", { class: "cust-meta" }, [
              el("span", { class: "chip-count", text: `${t.count} randevu` }),
              el("span", { class: "chip-money", text: formatMoney(t.paid) }),
            ]),
          ])
        );
      });
    container.appendChild(grid);
  }

  async function openForm(existingId = null) {
    let c = { name: "", phone: "", email: "", company: "", address: "", website: "", social: "", notes: "" };
    if (existingId) {
      const found = await DB.customers.get(existingId);
      if (found) c = { ...c, ...found };
    }
    const form = el("form", { class: "form-grid" });
    const field = (label, control, full = false) =>
      el("label", { class: `field ${full ? "field-full" : ""}` }, [
        el("span", { class: "field-label", text: label }), control,
      ]);

    const name = el("input", { name: "name", value: c.name, required: true, placeholder: "Ad Soyad" });
    const phone = el("input", { name: "phone", type: "tel", value: c.phone, placeholder: "Telefon" });
    const email = el("input", { name: "email", type: "email", value: c.email, placeholder: "Mail" });
    const company = el("input", { name: "company", value: c.company, placeholder: "Firma" });
    const address = el("input", { name: "address", value: c.address, placeholder: "Adres" });
    const website = el("input", { name: "website", type: "url", value: c.website, placeholder: "https://..." });
    const social = el("input", { name: "social", value: c.social, placeholder: "Sosyal medya" });
    const notes = el("textarea", { name: "notes", rows: "3", placeholder: "Notlar..." });
    notes.value = c.notes || "";

    form.append(
      field("Ad Soyad", name, true),
      field("Telefon", phone),
      field("Mail", email),
      field("Firma", company),
      field("Adres", address, true),
      field("Web Sitesi", website),
      field("Sosyal Medya", social),
      field("Notlar", notes, true),
    );

    modal({
      title: existingId ? "Müşteriyi Düzenle" : "Yeni Müşteri",
      body: form,
      wide: true,
      actions: [
        { label: "Vazgeç", class: "btn-secondary", onClick: ({ close }) => close() },
        {
          label: "Kaydet", class: "btn-primary",
          onClick: async ({ close }) => {
            const data = {};
            new FormData(form).forEach((v, k) => (data[k] = v));
            if (!data.name) { toast("Ad Soyad zorunlu", "error"); return; }
            if (existingId) {
              data.id = existingId;
              data.createdAt = c.createdAt || new Date().toISOString();
              await DB.customers.put(data);
            } else {
              data.createdAt = new Date().toISOString();
              await DB.customers.add(data);
            }
            toast("Müşteri kaydedildi", "success");
            close();
            document.dispatchEvent(new CustomEvent("data:changed", { detail: { type: "customers" } }));
          },
        },
      ],
    });
  }

  async function openProfile(id) {
    const c = await DB.customers.get(id);
    if (!c) return;
    const appts = (await DB.appointments.byCustomer(id))
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

    const totalFee = appts.reduce((s, a) => s + (Number(a.fee) || 0), 0);
    const totalPaid = appts.reduce((s, a) => s + (Number(a.paid) || 0), 0);

    const wrap = el("div", { class: "detail" });
    wrap.appendChild(el("div", { class: "profile-head" }, [
      el("div", { class: "avatar avatar-lg", text: initials(c.name) }),
      el("div", {}, [
        el("h3", { text: c.name || "(isimsiz)" }),
        el("p", { class: "muted", text: c.company || "" }),
      ]),
    ]));

    const info = el("div", { class: "profile-info" });
    const row = (label, value, href) => {
      if (!value) return null;
      const v = href
        ? el("a", { href, target: "_blank", rel: "noopener", text: value })
        : el("span", { text: value });
      return el("div", { class: "detail-row" }, [
        el("span", { class: "detail-label", text: label }), v,
      ]);
    };
    info.append(
      row("Telefon", c.phone, c.phone ? `tel:${c.phone}` : null),
      row("Mail", c.email, c.email ? `mailto:${c.email}` : null),
      row("Adres", c.address),
      row("Web", c.website, c.website),
      row("Sosyal", c.social),
    );
    if (c.notes) info.appendChild(el("div", { class: "detail-notes", text: c.notes }));
    wrap.appendChild(info);

    // Toplamlar
    wrap.appendChild(el("div", { class: "mini-stats" }, [
      miniStat("Randevu", appts.length),
      miniStat("Toplam Ücret", formatMoney(totalFee)),
      miniStat("Toplam Ödeme", formatMoney(totalPaid)),
      miniStat("Kalan", formatMoney(totalFee - totalPaid)),
    ]));

    // Geçmiş randevular / yapılan işler
    wrap.appendChild(el("h4", { class: "section-title", text: "Randevu Geçmişi" }));
    if (appts.length === 0) {
      wrap.appendChild(el("p", { class: "empty", text: "Randevu yok." }));
    } else {
      const list = el("div", { class: "up-list" });
      appts.forEach((a) => {
        const s = Constants.statusMeta(a.status);
        list.appendChild(el("div", { class: "up-item", style: `--card-color:${s.color}`, onClick: () => Appointments.openDetail(a.id) }, [
          el("div", { class: "up-date" }, [
            el("span", { class: "up-day", text: Utils.formatDateShort(a.date) }),
            el("span", { class: "up-time", text: a.time || "" }),
          ]),
          el("div", { class: "up-info" }, [
            el("div", { class: "up-name", text: a.service || a.project || "Randevu" }),
            el("div", { class: "up-sub", text: formatMoney(a.fee) }),
          ]),
          el("span", { class: "badge", style: `background:${s.color}22;color:${s.color}`, text: s.label }),
        ]));
      });
      wrap.appendChild(list);
    }

    modal({
      title: "Müşteri Profili",
      body: wrap,
      wide: true,
      actions: [
        { label: "Sil", class: "btn-danger", onClick: async ({ close }) => {
          const ok = await confirmDialog("Bu müşteri silinsin mi? Randevular silinmez.", { title: "Müşteri Sil", danger: true });
          if (ok) { await DB.customers.remove(id); toast("Müşteri silindi", "success"); close();
            document.dispatchEvent(new CustomEvent("data:changed", { detail: { type: "customers" } })); }
        } },
        { label: "Düzenle", class: "btn-secondary", onClick: ({ close }) => { close(); openForm(id); } },
        { label: "Kapat", class: "btn-primary", onClick: ({ close }) => close() },
      ],
    });
  }

  function miniStat(label, value) {
    return el("div", { class: "mini-stat" }, [
      el("div", { class: "mini-stat-value", text: String(value) }),
      el("div", { class: "mini-stat-label", text: label }),
    ]);
  }

  return { render, openForm, openProfile };
})();

window.Customers = Customers;
