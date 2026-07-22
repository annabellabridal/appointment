/**
 * reminders.js
 * Yaklaşan randevular için tarayıcı bildirimi.
 * Örn: "30 dakika sonra Ahmet Bey ile toplantınız var."
 */

const Reminders = (() => {
  const LEAD_MINUTES = 30;      // kaç dakika önce hatırlatılsın
  const CHECK_INTERVAL = 60000; // her dakika kontrol et
  const notified = new Set();

  let timer = null;

  async function start() {
    const enabled = await DB.settings.get("notifications", true);
    if (enabled && "Notification" in window && Notification.permission === "default") {
      await Utils.requestNotificationPermission();
    }
    stop();
    check();
    timer = setInterval(check, CHECK_INTERVAL);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function check() {
    const enabled = await DB.settings.get("notifications", true);
    if (!enabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const appointments = await DB.appointments.all();

    appointments.forEach((a) => {
      if (a.status === "iptal" || a.status === "tamamlandi") return;
      if (!a.date || !a.time) return;
      const when = new Date(`${a.date}T${a.time}`);
      const diffMin = (when - now) / 60000;
      if (diffMin > 0 && diffMin <= LEAD_MINUTES && !notified.has(a.id)) {
        notified.add(a.id);
        const mins = Math.round(diffMin);
        Utils.notify("Yaklaşan Randevu", {
          body: `${mins} dakika sonra ${a.customerName || "randevunuz"} ile ${a.service || "randevunuz"} var.`,
          tag: `appt-${a.id}`,
        });
      }
    });
  }

  return { start, stop };
})();

window.Reminders = Reminders;
