// ============================================================
//   db.js — Universal Auto-Sync (Fix HP Private / Blank)
// ============================================================

const DB = {
  // --- DUMMY OPEN DB AGAR APP.JS TIDAK ERROR ---
  async openDB() {
    return true;
  },

  // --- SETTINGS ---
  async getSetting(key, defaultValue = '') {
    // Cek LocalStorage
    const localVal = localStorage.getItem('set_' + key);
    if (localVal !== null && localVal !== undefined && localVal.trim() !== '') {
      return localVal;
    }

    // Jika HP belum ada data, ambil dari Supabase
    try {
      if (window.supabase && typeof window.supabase.from === 'function') {
        const { data, error } = await window.supabase
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
    } catch (e) {
      console.warn('Supabase fetch bypassed:', e);
    }

    return defaultValue;
  },

  async setSetting(key, value) {
    const valStr = String(value ?? '').trim();
    localStorage.setItem('set_' + key, valStr);

    try {
      if (window.supabase && typeof window.supabase.from === 'function') {
        const { error } = await window.supabase
          .from('settings')
          .upsert({ key: key, value: valStr }, { onConflict: 'key' });

        if (error) {
          await window.supabase.from('settings').insert({ key: key, value: valStr });
        }
      }
    } catch (e) {
      console.warn('Supabase save bypassed:', e);
    }
    return true;
  },

  // --- GENERIC DATA (Invoices, Customers, Products, etc) ---
  async dbGetAll(storeName) {
    try {
      if (window.supabase && typeof window.supabase.from === 'function') {
        const { data, error } = await window.supabase.from(storeName).select('*');
        if (!error && data) {
          localStorage.setItem('db_' + storeName, JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn(`Fetch ${storeName} error:`, e);
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

    try {
      if (window.supabase && typeof window.supabase.from === 'function') {
        await window.supabase.from(storeName).upsert(item);
      }
    } catch (e) {
      console.warn(`Put ${storeName} error:`, e);
    }
    return item;
  },

  async dbDelete(storeName, id) {
    let all = await this.dbGetAll(storeName);
    all = all.filter(x => x.id !== id);
    localStorage.setItem('db_' + storeName, JSON.stringify(all));

    try {
      if (window.supabase && typeof window.supabase.from === 'function') {
        await window.supabase.from(storeName).delete().eq('id', id);
      }
    } catch (e) {
      console.warn(`Delete ${storeName} error:`, e);
    }
    return true;
  },

  async getInvoicesRich() {
    return await this.dbGetAll('invoices');
  }
};

window.DB = DB;
