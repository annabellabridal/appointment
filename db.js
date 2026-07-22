/**
 * db.js
 * IndexedDB veri katmanı. Tüm CRUD işlemleri Promise tabanlıdır.
 * Store'lar: customers, appointments, todos, files, settings
 */

const DB = (() => {
  const DB_NAME = "randevu_takip";
  const DB_VERSION = 1;
  const STORES = {
    customers: "customers",
    appointments: "appointments",
    todos: "todos",
    files: "files",
    settings: "settings",
  };

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains(STORES.customers)) {
          const s = db.createObjectStore(STORES.customers, {
            keyPath: "id",
            autoIncrement: true,
          });
          s.createIndex("name", "name", { unique: false });
          s.createIndex("phone", "phone", { unique: false });
          s.createIndex("company", "company", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.appointments)) {
          const s = db.createObjectStore(STORES.appointments, {
            keyPath: "id",
            autoIncrement: true,
          });
          s.createIndex("date", "date", { unique: false });
          s.createIndex("customerId", "customerId", { unique: false });
          s.createIndex("status", "status", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.todos)) {
          db.createObjectStore(STORES.todos, {
            keyPath: "id",
            autoIncrement: true,
          });
        }

        if (!db.objectStoreNames.contains(STORES.files)) {
          const s = db.createObjectStore(STORES.files, {
            keyPath: "id",
            autoIncrement: true,
          });
          s.createIndex("appointmentId", "appointmentId", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: "key" });
        }
      };

      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      let result;
      try {
        result = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      t.oncomplete = () => resolve(result && result.__value !== undefined ? result.__value : result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  function reqToValue(request, holder) {
    request.onsuccess = () => {
      holder.__value = request.result;
    };
  }

  // Generic helpers -----------------------------------------------------------

  async function add(storeName, obj) {
    const holder = {};
    await tx(storeName, "readwrite", (store) => {
      reqToValue(store.add(obj), holder);
      return holder;
    });
    return holder.__value; // new key
  }

  async function put(storeName, obj) {
    const holder = {};
    await tx(storeName, "readwrite", (store) => {
      reqToValue(store.put(obj), holder);
      return holder;
    });
    return holder.__value;
  }

  async function get(storeName, key) {
    const holder = {};
    await tx(storeName, "readonly", (store) => {
      reqToValue(store.get(key), holder);
      return holder;
    });
    return holder.__value;
  }

  async function getAll(storeName) {
    const holder = {};
    await tx(storeName, "readonly", (store) => {
      reqToValue(store.getAll(), holder);
      return holder;
    });
    return holder.__value || [];
  }

  async function remove(storeName, key) {
    await tx(storeName, "readwrite", (store) => {
      store.delete(key);
      return {};
    });
  }

  async function clear(storeName) {
    await tx(storeName, "readwrite", (store) => {
      store.clear();
      return {};
    });
  }

  async function getAllByIndex(storeName, indexName, value) {
    const holder = {};
    await tx(storeName, "readonly", (store) => {
      const idx = store.index(indexName);
      reqToValue(idx.getAll(value), holder);
      return holder;
    });
    return holder.__value || [];
  }

  // Domain-specific -----------------------------------------------------------

  const customers = {
    all: () => getAll(STORES.customers),
    get: (id) => get(STORES.customers, id),
    add: (c) => add(STORES.customers, c),
    put: (c) => put(STORES.customers, c),
    remove: (id) => remove(STORES.customers, id),
  };

  const appointments = {
    all: () => getAll(STORES.appointments),
    get: (id) => get(STORES.appointments, id),
    add: (a) => add(STORES.appointments, a),
    put: (a) => put(STORES.appointments, a),
    remove: (id) => remove(STORES.appointments, id),
    byCustomer: (customerId) =>
      getAllByIndex(STORES.appointments, "customerId", customerId),
  };

  const todos = {
    all: () => getAll(STORES.todos),
    add: (t) => add(STORES.todos, t),
    put: (t) => put(STORES.todos, t),
    remove: (id) => remove(STORES.todos, id),
  };

  const files = {
    all: () => getAll(STORES.files),
    get: (id) => get(STORES.files, id),
    add: (f) => add(STORES.files, f),
    remove: (id) => remove(STORES.files, id),
    byAppointment: (appointmentId) =>
      getAllByIndex(STORES.files, "appointmentId", appointmentId),
  };

  const settings = {
    get: async (key, fallback) => {
      const row = await get(STORES.settings, key);
      return row ? row.value : fallback;
    },
    set: (key, value) => put(STORES.settings, { key, value }),
    all: () => getAll(STORES.settings),
  };

  // Backup --------------------------------------------------------------------

  async function exportAll() {
    const [c, a, t, f, s] = await Promise.all([
      getAll(STORES.customers),
      getAll(STORES.appointments),
      getAll(STORES.todos),
      getAll(STORES.files),
      getAll(STORES.settings),
    ]);
    return {
      meta: { app: "randevu-takip", version: DB_VERSION, exportedAt: new Date().toISOString() },
      customers: c,
      appointments: a,
      todos: t,
      files: f,
      settings: s,
    };
  }

  async function importAll(data, { replace = true } = {}) {
    if (!data || typeof data !== "object") throw new Error("Geçersiz yedek dosyası");
    if (replace) {
      await Promise.all([
        clear(STORES.customers),
        clear(STORES.appointments),
        clear(STORES.todos),
        clear(STORES.files),
        clear(STORES.settings),
      ]);
    }
    const jobs = [];
    (data.customers || []).forEach((x) => jobs.push(put(STORES.customers, x)));
    (data.appointments || []).forEach((x) => jobs.push(put(STORES.appointments, x)));
    (data.todos || []).forEach((x) => jobs.push(put(STORES.todos, x)));
    (data.files || []).forEach((x) => jobs.push(put(STORES.files, x)));
    (data.settings || []).forEach((x) => jobs.push(put(STORES.settings, x)));
    await Promise.all(jobs);
  }

  return {
    STORES,
    open,
    customers,
    appointments,
    todos,
    files,
    settings,
    exportAll,
    importAll,
    clearStore: clear,
  };
})();

window.DB = DB;
