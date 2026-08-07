// ============================================================
//   db.js — Local & Supabase Hybrid Storage (Strict Server-Sync)
// ============================================================

const DB = {
  // --- SETTINGS ---
  async getSetting(key, defaultValue = '') {
    // 1. Prioritas Utama: Ambil dari Supabase (agar HP & PC selalu sama)
    try {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== null && data.value !== undefined && String(data.value).trim() !== '') {
          const valStr = String(data.value);
          localStorage.setItem('set_' + key, valStr);
          return valStr;
        }
      }
    } catch (err) {
      console.warn('Gagal fetch setting Supabase:', err);
    }

    // 2. Cache Lokal (Fallback)
    const localVal = localStorage.getItem('set_' + key);
    if (localVal !== null && localVal !== undefined && localVal.trim() !== '') {
      return localVal;
    }

    return defaultValue;
  },

  async setSetting(key, value) {
    const valStr = String(value ?? '').trim();

    // Simpan ke LocalStorage lokal
    localStorage.setItem('set_' + key, valStr);

    // Kirim ke Supabase
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        // Coba Upsert
        const { error } = await supabase
          .from('settings')
          .upsert({ key: key, value: valStr }, { onConflict: 'key' });

        if (error) {
          console.error(`Upsert gagal (${key}), mencoba manual Insert/Update...`, error.message);
          
          // Fallback manual jika upsert ditolak
          const { data } = await supabase.from('settings').select('key').eq('key', key).maybeSingle();
          if (data) {
            await supabase.from('settings').update({ value: valStr }).eq('key', key);
          } else {
            await supabase.from('settings').insert({ key: key, value: valStr });
          }
        }
      } catch (err) {
        console.error('Error push setting ke Supabase:', err);
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
