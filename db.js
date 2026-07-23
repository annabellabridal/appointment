/**
 * db.js
 * Supabase (PostgreSQL) veri katmanı.
 *
 * Eski sürüm IndexedDB kullanıyordu; bu sürüm aynı genel API'yi (DB.customers,
 * DB.appointments, DB.todos, DB.files, DB.settings, exportAll/importAll ...)
 * korur, böylece özellik modüllerinde değişiklik gerekmez. Fark: veriler
 * bulutta Supabase'de saklanır ve giriş yapan kullanıcıya (RLS) bağlıdır.
 *
 * Tablolar `data jsonb` sütununda kaydın tamamını tutar; okurken satır
 * { id, ...data } biçimine dönüştürülür, böylece esnek şema korunur.
 */

const DB = (() => {
  const STORES = {
    customers: "customers",
    appointments: "appointments",
    todos: "todos",
    files: "files",
    settings: "settings",
  };

  // Hangi jsonb kaydından hangi ilişkisel sütun türetilecek.
  const RELATIONAL_COLUMNS = {
    appointments: { customer_id: "customerId" },
    files: { appointment_id: "appointmentId" },
  };

  // getAllByIndex(indexName) -> gerçek sütun adı eşlemesi.
  const INDEX_TO_COLUMN = {
    customerId: "customer_id",
    appointmentId: "appointment_id",
  };

  let client = null;

  function sb() {
    if (client) return client;
    const cfg = window.APP_CONFIG || {};
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      throw new Error(
        "Supabase yapılandırması eksik. config.js içindeki SUPABASE_URL ve SUPABASE_ANON_KEY değerlerini doldurun."
      );
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return client;
  }

  function check(error) {
    if (error) throw new Error(error.message || String(error));
  }

  // Satır <-> nesne dönüşümü ---------------------------------------------------

  function rowToObj(row) {
    if (!row) return row;
    const data = row.data || {};
    return { ...data, id: row.id };
  }

  function objToRow(table, obj) {
    const { id, ...rest } = obj || {};
    const row = { data: rest };
    if (id !== undefined && id !== null && id !== "") row.id = id;
    const rel = RELATIONAL_COLUMNS[table];
    if (rel) {
      for (const [col, field] of Object.entries(rel)) {
        const v = rest[field];
        row[col] = v === undefined || v === "" ? null : v;
      }
    }
    return row;
  }

  // Genel yardımcılar ----------------------------------------------------------

  async function add(table, obj) {
    const { data, error } = await sb()
      .from(table)
      .insert(objToRow(table, obj))
      .select("id")
      .single();
    check(error);
    return data.id;
  }

  async function put(table, obj) {
    const { data, error } = await sb()
      .from(table)
      .upsert(objToRow(table, obj))
      .select("id")
      .single();
    check(error);
    return data.id;
  }

  async function get(table, key) {
    const { data, error } = await sb()
      .from(table)
      .select("id, data")
      .eq("id", key)
      .maybeSingle();
    check(error);
    return rowToObj(data);
  }

  async function getAll(table) {
    const { data, error } = await sb()
      .from(table)
      .select("id, data")
      .order("id", { ascending: true });
    check(error);
    return (data || []).map(rowToObj);
  }

  async function remove(table, key) {
    const { error } = await sb().from(table).delete().eq("id", key);
    check(error);
  }

  async function clear(table) {
    if (table === STORES.settings) {
      const { error } = await sb().from(table).delete().not("key", "is", null);
      check(error);
      return;
    }
    const { error } = await sb().from(table).delete().gte("id", 0);
    check(error);
  }

  async function getAllByIndex(table, indexName, value) {
    const column = INDEX_TO_COLUMN[indexName] || indexName;
    const { data, error } = await sb()
      .from(table)
      .select("id, data")
      .eq(column, value)
      .order("id", { ascending: true });
    check(error);
    return (data || []).map(rowToObj);
  }

  // Alan bazlı API -------------------------------------------------------------

  const customers = {
    all: () => getAll(STORES.customers),
    get: (id) => get(STORES.customers, id),
    add: (c) => add(STORES.customers, c),
    put: (c) => put(STORES.customers, c),
    remove: (id) => remove(STORES.customers, id),
    search: async (query) => {
      const q = `%${query}%`;
      const { data, error } = await sb()
        .from(STORES.customers)
        .select("id, data")
        .or(`data->>name.ilike.${q},data->>phone.ilike.${q},data->>company.ilike.${q},data->>email.ilike.${q}`)
        .order("id", { ascending: true });
      check(error);
      return (data || []).map(rowToObj);
    },
  };

  const appointments = {
    all: () => getAll(STORES.appointments),
    get: (id) => get(STORES.appointments, id),
    add: (a) => add(STORES.appointments, a),
    put: (a) => put(STORES.appointments, a),
    remove: (id) => remove(STORES.appointments, id),
    byCustomer: (customerId) =>
      getAllByIndex(STORES.appointments, "customerId", customerId),
    today: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await sb()
        .from(STORES.appointments)
        .select("id, data")
        .eq("data->>date", today)
        .order("id", { ascending: true });
      check(error);
      return (data || []).map(rowToObj);
    },
    byDateRange: async (from, to) => {
      const { data, error } = await sb()
        .from(STORES.appointments)
        .select("id, data")
        .gte("data->>date", from)
        .lte("data->>date", to)
        .order("id", { ascending: true });
      check(error);
      return (data || []).map(rowToObj);
    },
    search: async (query) => {
      const q = `%${query}%`;
      const { data, error } = await sb()
        .from(STORES.appointments)
        .select("id, data")
        .or(`data->>customerName.ilike.${q},data->>phone.ilike.${q},data->>company.ilike.${q},data->>service.ilike.${q},data->>notes.ilike.${q},data->>project.ilike.${q}`)
        .order("id", { ascending: true });
      check(error);
      return (data || []).map(rowToObj);
    },
    getRange: async (from, count) => {
      const { data, error } = await sb()
        .from(STORES.appointments)
        .select("id, data", { count: "exact" })
        .range(from, from + count - 1)
        .order("id", { ascending: true });
      check(error);
      return { items: (data || []).map(rowToObj), total: data?.length ?? 0 };
    },
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
    upload: uploadFile,
    deleteStorage: deleteFile,
  };

  const settings = {
    get: async (key, fallback) => {
      const { data, error } = await sb()
        .from(STORES.settings)
        .select("value")
        .eq("key", key)
        .maybeSingle();
      check(error);
      return data && data.value !== null && data.value !== undefined
        ? data.value
        : fallback;
    },
    set: async (key, value) => {
      const uid = await currentUserId();
      const row = { key, value };
      if (uid) row.user_id = uid;
      const { error } = await sb()
        .from(STORES.settings)
        .upsert(row, { onConflict: "user_id,key" });
      check(error);
    },
    all: async () => {
      const { data, error } = await sb()
        .from(STORES.settings)
        .select("key, value");
      check(error);
      return data || [];
    },
  };

  async function currentUserId() {
    const { data } = await sb().auth.getUser();
    return data && data.user ? data.user.id : null;
  }

  // Açılış / oturum ------------------------------------------------------------

  async function open() {
    // Supabase istemcisini hazırlar; oturum yoksa hata vermez (auth katmanı
    // giriş ekranını gösterir). Bağlantı testi olarak istemciyi kurar.
    sb();
    return true;
  }

  // Yedekleme ------------------------------------------------------------------

  const DB_VERSION = 2;

  const BUCKET = "appointment-files";

  async function ensureBucket() {
    const { data: buckets } = await sb().storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (!exists) {
      await sb().storage.createBucket(BUCKET, { public: true });
    }
  }

  async function uploadFile(file) {
    await ensureBucket();
    const path = `${await currentUserId()}/${Date.now()}_${file.name}`;
    const { error } = await sb().storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    check(error);
    const { data: urlData } = sb().storage.from(BUCKET).getPublicUrl(path);
    return { path, url: urlData.publicUrl };
  }

  async function deleteFile(path) {
    if (!path) return;
    await sb().storage.from(BUCKET).remove([path]);
  }

  async function exportAll() {
    const [c, a, t, f, s] = await Promise.all([
      getAll(STORES.customers),
      getAll(STORES.appointments),
      getAll(STORES.todos),
      getAll(STORES.files),
      settings.all(),
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

    let backup = null;
    if (replace) {
      backup = await exportAll();
      await Promise.all([
        clear(STORES.customers),
        clear(STORES.appointments),
        clear(STORES.todos),
        clear(STORES.files),
        clear(STORES.settings),
      ]);
    }

    try {
      const jobs = [];
      (data.customers || []).forEach((x) => jobs.push(put(STORES.customers, x)));
      (data.appointments || []).forEach((x) => jobs.push(put(STORES.appointments, x)));
      (data.todos || []).forEach((x) => jobs.push(put(STORES.todos, x)));
      (data.files || []).forEach((x) => jobs.push(put(STORES.files, x)));
      (data.settings || []).forEach((x) => jobs.push(settings.set(x.key, x.value)));

      const results = await Promise.allSettled(jobs);
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        const errMsg = failures.map((f) => f.reason?.message || f.reason).join("; ");
        if (backup) await restoreFromBackup(backup);
        throw new Error(`İçe aktarma başarısız (${failures.length} kayıt): ${errMsg}`);
      }
    } catch (err) {
      if (backup && !err.message.includes("İçe aktarma başarısız")) {
        await restoreFromBackup(backup);
      }
      throw err;
    }
  }

  async function restoreFromBackup(backup) {
    await Promise.all([
      clear(STORES.customers),
      clear(STORES.appointments),
      clear(STORES.todos),
      clear(STORES.files),
      clear(STORES.settings),
    ]);
    const jobs = [];
    (backup.customers || []).forEach((x) => jobs.push(put(STORES.customers, x)));
    (backup.appointments || []).forEach((x) => jobs.push(put(STORES.appointments, x)));
    (backup.todos || []).forEach((x) => jobs.push(put(STORES.todos, x)));
    (backup.files || []).forEach((x) => jobs.push(put(STORES.files, x)));
    (backup.settings || []).forEach((x) => jobs.push(settings.set(x.key, x.value)));
    await Promise.all(jobs);
  }

  return {
    STORES,
    open,
    client: sb,
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
