// ============================================================
//   db.js — Local & Supabase Hybrid Storage (Auto-Sync)
// ============================================================

const DB = {
  // --- SETTINGS (FIXED: Smart Sync PC & Mobile) ---
  async getSetting(key, defaultValue = '') {
    const localVal = localStorage.getItem('set_' + key);

    // 1. Jika di LocalStorage ada isinya (dan bukan string kosong), pakai lokal
    if (localVal !== null && localVal !== undefined && localVal.trim() !== '') {
      return localVal;
    }

    // 2. Jika di LocalStorage kosong, tarik data dari Supabase (Sync antar HP & PC)
    try {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== undefined && data.value !== null && String(data.value).trim() !== '') {
          localStorage.setItem('set_' + key, String(data.value));
          return String(data.value);
        }
      }
    } catch (err) {
      console.warn('Gagal sync setting Supabase:', err);
    }

    return defaultValue;
  },

  async setSetting(key, value) {
    const valStr = String(value ?? '').trim();

    // 1. Simpan ke LocalStorage HP/PC
    localStorage.setItem('set_' + key, valStr);

    // 2. Wajib push ke Supabase supaya HP & PC datanya sama
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        await supabase
          .from('settings')
          .upsert({ key: key, value: valStr }, { onConflict: 'key' });
      } catch (err) {
        console.warn('Supabase upsert setting warning:', err);
      }
    }

    return true;
  },

  // --- HELPER GENERIC STORAGE ---
  async dbGetAll(storeName) {
    try {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase.from(storeName).select('*');
        if (!error && data) {
          localStorage.setItem('db_' + storeName, JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn(`Gagal fetch ${storeName} Supabase:`, e);
    }

    const localData = localStorage.getItem('db_' + storeName);
    return localData ? JSON.parse(localData) : [];
  },

  async dbPut(storeName, item) {
    const all = await this.dbGetAll(storeName);
    if (!item.id) item.id = Date.now().toString();

    const idx = all.findIndex(x => x.id === item.id);
    if (idx >= 0) all[idx] = item;
    else all.push(item);

    localStorage.setItem('db_' + storeName, JSON.stringify(all));

    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        await supabase.from(storeName).upsert(item);
      } catch (e) {
        console.warn(`Gagal push ${storeName} Supabase:`, e);
      }
    }
    return item;
  },

  async dbDelete(storeName, id) {
    let all = await this.dbGetAll(storeName);
    all = all.filter(x => x.id !== id);
    localStorage.setItem('db_' + storeName, JSON.stringify(all));

    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        await supabase.from(storeName).delete().eq('id', id);
      } catch (e) {
        console.warn(`Gagal delete ${storeName} Supabase:`, e);
      }
    }
    return true;
  },

  async getInvoicesRich() {
    return await this.dbGetAll('invoices');
  }
};

window.DB = DB;
