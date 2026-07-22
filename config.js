/**
 * config.js
 * Supabase bağlantı ayarları. Bu değerler istemci tarafında (tarayıcıda)
 * kullanılır ve herkese açıktır — güvenlik Row Level Security (RLS) ile
 * sağlanır, bu yüzden anon key'i buraya koymak güvenlidir.
 *
 * Değerleri Supabase panelinden alın:
 *   Project Settings → API → Project URL  ve  Project API keys → anon public
 */
window.APP_CONFIG = {
  SUPABASE_URL: "__SUPABASE_URL__",
  SUPABASE_ANON_KEY: "__SUPABASE_ANON_KEY__",
};
