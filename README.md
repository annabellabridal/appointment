# Randevu & Müşteri Takip

Randevu, müşteri, gelir ve yapılacaklar takibi için tek sayfalık (vanilla JS)
PWA. Veriler **Supabase** (PostgreSQL) üzerinde saklanır ve **Vercel**'de
yayınlanır. Her kullanıcı yalnızca kendi verilerini görür (Supabase Auth + RLS).

## Mimari

- **Frontend:** derleme gerektirmeyen statik dosyalar (`index.html` + `*.js` + `style.css`).
- **Backend:** Supabase — PostgreSQL, Auth (e-posta/şifre), Row Level Security.
- **Veri katmanı:** `db.js` tüm CRUD işlemlerini Supabase istemcisi üzerinden yapar.
  Uygulamanın geri kalanı `DB.customers`, `DB.appointments`, `DB.todos`,
  `DB.files`, `DB.settings` API'sini kullanır (değişmedi).
- **Kimlik:** `auth.js` giriş kapısıdır; oturum yoksa uygulama açılmaz.

## Kurulum

### 1) Supabase projesi

1. https://supabase.com adresinde bir proje oluşturun.
2. **SQL Editor**'ü açın, [`supabase/schema.sql`](supabase/schema.sql) içeriğini
   yapıştırıp çalıştırın. Bu; tabloları, indeksleri ve RLS politikalarını kurar.
3. **Project Settings → API** bölümünden şunları kopyalayın:
   - `Project URL`
   - `anon` `public` API anahtarı
4. (İsteğe bağlı) **Authentication → Providers → Email** altında, davetsiz
   kayıtları kapatmak veya e-posta doğrulamasını açıp kapatmak isterseniz
   ayarları düzenleyin. Kendi kullanıcınızı **Authentication → Users → Add user**
   ile de oluşturabilirsiniz.

### 2) Yapılandırma

[`config.js`](config.js) içindeki değerleri Supabase'den aldıklarınızla değiştirin:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
};
```

`anon` anahtarı tarayıcıda görünür; bu güvenlidir çünkü tüm erişim RLS ile
kullanıcıya kısıtlanır.

### 3) Vercel'de yayınlama

1. https://vercel.com → **Add New → Project** → bu GitHub reposunu içe aktarın.
2. Framework Preset: **Other** (derleme yok). Build Command boş, Output Directory
   kök dizin. `vercel.json` gerekli başlıkları ayarlar.
3. **Deploy**. Yayınlanan URL'yi açın, kayıt olun/giriş yapın ve kullanmaya başlayın.

> Not: Supabase panelinde **Authentication → URL Configuration** altında
> Vercel alan adınızı **Site URL / Redirect URLs** listesine eklemeniz gerekebilir.

## Yerel geliştirme

Statik dosyalar olduğu için herhangi bir statik sunucu yeterli:

```bash
python3 -m http.server 5173
# http://localhost:5173
```

`config.js` doldurulmadan giriş ekranı bir yapılandırma uyarısı gösterir.

## Randevuları dışa aktarma (CSV / XLSX)

**Randevular** sayfasındaki **CSV** ve **XLSX** düğmeleri, o an ekranda görünen
(filtrelenmiş) randevuları indirir. Sütunlar: tarih, saat, müşteri, telefon,
firma, hizmet, proje, tahmini ücret, tahsil edilen, ödeme durumu, durum,
öncelik, notlar.

- CSV: UTF-8 (BOM'lu, Türkçe karakter uyumlu), tırnak/virgül/yeni satır kaçışlı.
- XLSX: harici kütüphane/CDN kullanılmadan, tarayıcıda gerçek bir `.xlsx`
  (OOXML) dosyası üretilir (`Utils.xlsxFromRows`). Çevrimdışı da çalışır.

## Yedekleme

Ayarlar sayfasından tüm verileri JSON olarak dışa/içe aktarabilirsiniz
(`DB.exportAll` / `DB.importAll`).
