// ============================================================
//   db.js — Local & Supabase Storage Integration
// ============================================================

const DB = {
  // --- SETTINGS (FIXED: Local First & Fast Load) ---
  async getSetting(key, defaultValue = '') {
    // Priority 1: Ambil dari LocalStorage langsung (instant & pasti tersimpan)
    const localVal = localStorage.getItem('set_' + key);
    if (localVal !== null && localVal !== undefined && localVal !== '') {
      return localVal;
    }

    // Priority 2: Jika lokal kosong, coba ambil dari Supabase
    try {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== undefined && data.value !== null) {
          localStorage.setItem('set_' + key, data.value);
          return data.value;
        }
      }
    } catch (err) {
      console.warn('Gagal ambil setting Supabase:', err);
    }

    return defaultValue;
  },

  async setSetting(key, value) {
    const valStr = String(value ?? '');
    
    // SELALU simpan ke LocalStorage agar langsung permanen di browser
    localStorage.setItem('set_' + key, valStr);

    // Kirim backup ke Supabase tanpa mengganggu antarmuka
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        await supabase
          .from('settings')
          .upsert({ key: key, value: valStr }, { onConflict: 'key' });
      } catch (err) {
        console.warn('Supabase sync warning:', err);
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
