async getSetting(key, defaultValue = '') {
    try {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== undefined) {
          localStorage.setItem('set_' + key, data.value);
          return data.value;
        }
      }
    } catch (err) {
      console.warn('Gagal getSetting Supabase:', err);
    }
    const localVal = localStorage.getItem('set_' + key);
    return localVal !== null ? localVal : defaultValue;
  },

  async setSetting(key, value) {
    const valStr = String(value ?? '');
    localStorage.setItem('set_' + key, valStr);

    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
      try {
        await supabase
          .from('settings')
          .upsert({ key: key, value: valStr }, { onConflict: 'key' });
      } catch (err) {
        console.warn('Gagal setSetting Supabase:', err);
      }
    }
    return true;
  },
