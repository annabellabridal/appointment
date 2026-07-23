/**
 * reminders.js
 * Yaklaşan randevular için tarayıcı bildirimi.
 * Örn: "30 dakika sonra Ahmet Bey ile toplantınız var."
 */

const Reminders = (() => {
  const LEAD_MINUTES = 30;
  const CHECK_INTERVAL = 60000;
  const notified = new Set();

  let timer = null;
  let notificationsEnabled = null;

  async function start() {
    notificationsEnabled = await DB.settings.get("notifications", true);
    if (notificationsEnabled && "Notification" in window && Notification.permission === "default") {
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
    if (notificationsEnabled === null) {
      notificationsEnabled = await DB.settings.get("notifications", true);
    }
    if (!notificationsEnabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const appointments = await DB.appointments.today();

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
