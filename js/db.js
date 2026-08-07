// ============================================================
//   db.js — Local & Supabase Hybrid Storage (Strict Server-Sync)
// ============================================================

const DB = {
  // --- SETTINGS (Strict Supabase First -> Sync to Local) ---
  async getSetting(key, defaultValue = '') {
    // 1. Coba tarik data utama langsung dari Supabase
    try {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== null && data.value !== undefined) {
          const valStr = String(data.value);
          localStorage.setItem('set_' + key, valStr);
          return valStr;
        }
      }
    } catch (err) {
      console.warn('Gagal fetch setting Supabase, fallback ke LocalStorage:', err);
    }

    // 2. Fallback ke LocalStorage jika offline / gagal koneksi
    const localVal = localStorage.getItem('set_' + key);
    if (localVal !== null && localVal !== undefined && localVal !== '') {
      return localVal;
    }

    return defaultValue;
  },

  async setSetting(key, value) {
    const valStr = String(value ?? '').trim();

    // 1. Simpan ke LocalStorage lokal
    localStorage.setItem('set_' + key, valStr);

    // 2. Paksa simpan ke Supabase (Upsert / Insert On Conflict)
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        const { error } = await supabase
          .from('settings')
          .upsert({ key: key, value: valStr }, { onConflict: 'key' });

        if (error) {
          console.error(`Gagal simpan setting '${key}' ke Supabase:`, error.message);
          // Jika upsert gagal, coba mekanisme update
          await supabase.from('settings').update({ value: valStr }).eq('key', key);
        }
      } catch (err) {
        console.error('Error saat push setting ke Supabase:', err);
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
