// ============================================================
//   db.js — Public Sync (No Private Lock)
// ============================================================

const DB = {
  async getSetting(key, defaultValue = '') {
    try {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== null && data.value !== undefined && String(data.value).trim() !== '') {
          const val = String(data.value);
          localStorage.setItem('set_' + key, val);
          return val;
        }
      }
    } catch (e) {
      console.warn('Supabase fetch bypassed:', e);
    }

    const localVal = localStorage.getItem('set_' + key);
    return (localVal !== null && localVal !== undefined && localVal.trim() !== '') ? localVal : defaultValue;
  },

  async setSetting(key, value) {
    const valStr = String(value ?? '').trim();
    localStorage.setItem('set_' + key, valStr);

    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        const { error } = await supabase
          .from('settings')
          .upsert({ key: key, value: valStr }, { onConflict: 'key' });

        if (error) {
          await supabase.from('settings').insert({ key: key, value: valStr });
        }
      } catch (e) {
        console.warn('Supabase save bypassed:', e);
      }
    }
    return true;
  },

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

    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        await supabase.from(storeName).upsert(item);
      } catch (e) {
        console.warn(`Put ${storeName} error:`, e);
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
        console.warn(`Delete ${storeName} error:`, e);
      }
    }
    return true;
  },

  async getInvoicesRich() {
    return await this.dbGetAll('invoices');
  }
};

window.DB = DB;
