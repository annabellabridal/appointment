/**
 * settings.js
 * Ayarlar: tema, varsayılan hizmetler/ücretler, bildirim, otomatik yedekleme
 * ve JSON dışa/içe aktarma.
 */

const Settings = (() => {
  const { el, toast, download, confirmDialog } = Utils;

  async function render(container) {
    const [theme, services, defaultFee, notifEnabled, autoBackup] = await Promise.all([
      DB.settings.get("theme", "dark"),
      Appointments.defaultServices(),
      DB.settings.get("defaultFee", 0),
      DB.settings.get("notifications", true),
      DB.settings.get("autoBackup", false),
    ]);

    container.innerHTML = "";
    container.appendChild(el("div", { class: "page-head" }, [el("h1", { text: "Ayarlar" })]));

    // Görünüm
    const themeSelect = el("select", {}, [
      el("option", { value: "dark", text: "Koyu (Dark)" }),
      el("option", { value: "light", text: "Açık (Light)" }),
    ]);
    themeSelect.value = theme;
    themeSelect.addEventListener("change", async (e) => {
      await DB.settings.set("theme", e.target.value);
      App.applyTheme(e.target.value);
      toast("Tema güncellendi", "success");
    });

    container.appendChild(settingCard("Görünüm", [
      settingRow("Tema", themeSelect),
    ]));

    // Varsayılanlar
    const servicesInput = el("textarea", { rows: "3", placeholder: "Her satıra bir hizmet" });
    servicesInput.value = (services || []).join("\n");
    const feeInput = el("input", { type: "number", min: "0", step: "0.01", value: defaultFee });
    const saveDefaults = el("button", { class: "btn btn-primary btn-sm", text: "Kaydet", onClick: async () => {
      const list = servicesInput.value.split("\n").map((s) => s.trim()).filter(Boolean);
      await DB.settings.set("services", list);
      await DB.settings.set("defaultFee", Number(feeInput.value) || 0);
      toast("Varsayılanlar kaydedildi", "success");
    } });

    container.appendChild(settingCard("Varsayılanlar", [
      settingRow("Varsayılan Hizmetler", servicesInput),
      settingRow("Varsayılan Ücret (₺)", feeInput),
      el("div", { class: "setting-actions" }, [saveDefaults]),
    ]));

    // Bildirim
    const notifToggle = toggle(notifEnabled, async (on) => {
      if (on) {
        const perm = await Utils.requestNotificationPermission();
        if (perm !== "granted") { toast("Bildirim izni verilmedi", "error"); return false; }
      }
      await DB.settings.set("notifications", on);
      toast(on ? "Bildirimler açık" : "Bildirimler kapalı", "success");
      return true;
    });
    const autoBackupToggle = toggle(autoBackup, async (on) => {
      await DB.settings.set("autoBackup", on);
      toast(on ? "Otomatik yedekleme açık" : "Otomatik yedekleme kapalı", "success");
      return true;
    });

    container.appendChild(settingCard("Bildirim & Yedekleme", [
      settingRow("Yaklaşan randevu bildirimleri", notifToggle),
      settingRow("Otomatik yedekleme (her açılışta)", autoBackupToggle),
    ]));

    // Yedekleme
    const exportBtn = el("button", { class: "btn btn-primary", text: "⬇ JSON Dışa Aktar", onClick: exportData });
    const importInput = el("input", { type: "file", accept: "application/json,.json", style: "display:none" });
    const importBtn = el("button", { class: "btn btn-secondary", text: "⬆ JSON İçe Aktar", onClick: () => importInput.click() });
    importInput.addEventListener("change", (e) => importData(e.target.files[0], container));

    const clearBtn = el("button", { class: "btn btn-danger", text: "🗑 Tüm Verileri Sil", onClick: async () => {
      if (await confirmDialog("TÜM veriler kalıcı olarak silinsin mi? Bu işlem geri alınamaz.", { title: "Tüm Verileri Sil", danger: true })) {
        await Promise.all(Object.values(DB.STORES).map((s) => DB.clearStore(s)));
        toast("Tüm veriler silindi", "success");
        document.dispatchEvent(new CustomEvent("data:changed", { detail: { type: "all" } }));
        App.applyTheme("dark");
      }
    } });

    container.appendChild(settingCard("Veri Yönetimi", [
      el("p", { class: "muted", text: "Verileriniz Supabase hesabınızda (bulutta) saklanır. Tek dosya olarak da yedekleyebilirsiniz." }),
      el("div", { class: "setting-actions" }, [exportBtn, importBtn, importInput, clearBtn]),
    ]));

    container.appendChild(el("p", { class: "muted center", text: "Randevu & Müşteri Takip · Supabase + Vercel · v2.0" }));
  }

  async function exportData() {
    const data = await DB.exportAll();
    const stamp = Utils.todayStr();
    download(`randevu-yedek-${stamp}.json`, JSON.stringify(data, null, 2));
    toast("Yedek indirildi", "success");
  }

  async function importData(file, container) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const ok = await confirmDialog("Mevcut veriler bu yedekle değiştirilecek. Devam edilsin mi?", { title: "İçe Aktar", danger: true });
      if (!ok) return;
      await DB.importAll(data, { replace: true });
      toast("Veriler içe aktarıldı", "success");
      document.dispatchEvent(new CustomEvent("data:changed", { detail: { type: "all" } }));
      const theme = await DB.settings.get("theme", "dark");
      App.applyTheme(theme);
      render(container);
    } catch (err) {
      toast("Dosya okunamadı: " + err.message, "error");
    }
  }

  // yardımcılar
  function settingCard(title, rows) {
    return el("div", { class: "panel setting-card" }, [
      el("div", { class: "panel-head" }, [el("h2", { text: title })]),
      ...rows,
    ]);
  }
  function settingRow(label, control) {
    return el("div", { class: "setting-row" }, [
      el("span", { class: "setting-label", text: label }),
      control,
    ]);
  }
  function toggle(on, onChange) {
    const input = el("input", { type: "checkbox" });
    input.checked = !!on;
    const sw = el("label", { class: "switch" }, [input, el("span", { class: "slider" })]);
    input.addEventListener("change", async () => {
      const result = await onChange(input.checked);
      if (result === false) input.checked = !input.checked;
    });
    return sw;
  }

  return { render, exportData };
})();

window.Settings = Settings;
