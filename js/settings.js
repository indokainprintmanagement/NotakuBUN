// Di dalam objek DB di js/db.js

  async getSetting(key, defaultValue = '') {
    try {
      // 1. Coba ambil dari Supabase jika terhubung
      if (typeof supabase !== 'undefined' && supabase) {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== undefined) {
          // Cache ke LocalStorage
          localStorage.setItem('set_' + key, data.value);
          return data.value;
        }
      }
    } catch (err) {
      console.warn(`Gagal ambil setting ${key} dari Supabase, pakai local:`, err);
    }

    // 2. Fallback ke LocalStorage jika Supabase gagal/tidak ada
    const localVal = localStorage.getItem('set_' + key);
    return localVal !== null ? localVal : defaultValue;
  },

  async setSetting(key, value) {
    // Simpan SELALU ke LocalStorage lebih dulu agar UI tidak crash
    localStorage.setItem('set_' + key, value);

    // Coba sync ke Supabase
    if (typeof supabase !== 'undefined' && supabase) {
      try {
        const { error } = await supabase
          .from('settings')
          .upsert({ key: key, value: String(value) }, { onConflict: 'key' });

        if (error) {
          console.warn(`Supabase upsert setting warning (${key}):`, error.message);
        }
      } catch (err) {
        console.warn(`Gagal sync setting ${key} ke Supabase:`, err);
      }
    }

    return true;
  }
