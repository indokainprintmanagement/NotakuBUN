// ============================================================
//   settings.js — Fixed Save Profile & Store Name Sync
// ============================================================

function getInputValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el && el.value ? el.value.trim() : fallback;
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.value = (val !== null && val !== undefined) ? val : '';
    el.removeAttribute('disabled'); // Buka proteksi disabled jika ada
    el.removeAttribute('readonly');
  }
}

async function initSettings() {
  try {
    if (typeof DB === 'undefined' || typeof DB.getSetting !== 'function') return;

    setInputValue('set-store-name',    await DB.getSetting('store_name', 'Toko Saya'));
    setInputValue('set-store-address', await DB.getSetting('store_address', ''));
    setInputValue('set-store-phone',   await DB.getSetting('store_phone', ''));
    setInputValue('set-store-tagline', await DB.getSetting('store_tagline', ''));

    setInputValue('set-nota-prefix',          await DB.getSetting('nota_prefix', 'INV'));
    setInputValue('set-default-notes-struk',   await DB.getSetting('default_notes_struk', ''));
    setInputValue('set-default-notes-invoice', await DB.getSetting('default_notes_invoice', ''));

    await updateSidebarStoreName();
  } catch (err) {
    console.error('Error initSettings:', err);
  }
}

async function saveSettings() {
  try {
    if (typeof DB === 'undefined' || typeof DB.setSetting !== 'function') {
      console.error('DB.setSetting tidak tersedia!');
      return;
    }

    const storeName = getInputValue('set-store-name', 'Toko Saya');
    const storeAddr = getInputValue('set-store-address');
    const storePhone = getInputValue('set-store-phone');
    const storeTagline = getInputValue('set-store-tagline');

    // Paksa simpan semua bidang profil ke DB
    await Promise.all([
      DB.setSetting('store_name', storeName),
      DB.setSetting('store_address', storeAddr),
      DB.setSetting('store_phone', storePhone),
      DB.setSetting('store_tagline', storeTagline),
      DB.setSetting('nota_prefix', getInputValue('set-nota-prefix', 'INV') || 'INV'),
      DB.setSetting('default_notes_struk', getInputValue('set-default-notes-struk')),
      DB.setSetting('default_notes_invoice', getInputValue('set-default-notes-invoice'))
    ]);

    await updateSidebarStoreName();

    if (window.Utils && typeof window.Utils.toast === 'function') {
      Utils.toast('Pengaturan berhasil disimpan ✓', 'success');
    }
  } catch (err) {
    console.error('Gagal menyimpan pengaturan:', err);
    if (window.Utils && typeof window.Utils.toast === 'function') {
      Utils.toast('Gagal menyimpan pengaturan!', 'danger');
    }
  }
}

async function updateSidebarStoreName() {
  try {
    if (typeof DB === 'undefined' || typeof DB.getSetting !== 'function') return;
    const name = await DB.getSetting('store_name', 'Toko Saya');
    
    // Update teks sidebar di kiri bawah
    const el = document.getElementById('sidebar-store-name');
    if (el) el.textContent = name;

    const logoEl = document.getElementById('sidebar-store-logo');
    if (logoEl) logoEl.textContent = (name && name.length > 0 ? name[0] : 'T').toUpperCase();
  } catch (err) {
    console.warn('Gagal update sidebar name:', err);
  }
}

async function exportAllData() {
  try {
    const [invoices, customers, products] = await Promise.all([
      typeof DB.getInvoicesRich === 'function' ? DB.getInvoicesRich() : [],
      typeof DB.dbGetAll === 'function' ? DB.dbGetAll('customers') : [],
      typeof DB.dbGetAll === 'function' ? DB.dbGetAll('products') : []
    ]);

    const rows = invoices.map(i => ({
      no_nota: i.no_nota,
      date: i.date,
      time: i.time || '',
      customer: i.customer_name,
      status: i.status,
      subtotal: i.subtotal || 0,
      discount: i.discount || 0,
      grand_total: i.grand_total || 0,
      notes: i.notes || '',
      items: JSON.stringify(i.items || []),
    }));

    if (window.Utils && typeof window.Utils.exportCSV === 'function') {
      Utils.exportCSV(`nota_semua_${Utils.todayStr ? Utils.todayStr() : 'data'}.csv`, rows,
        ['no_nota','date','time','customer','status','subtotal','discount','grand_total','notes','items']);
      setTimeout(() => Utils.toast('Data berhasil diekspor ke CSV', 'success'), 500);
    }
  } catch (err) {
    console.error('Error export CSV:', err);
  }
}

async function clearAllData() {
  if (!window.Utils || typeof window.Utils.confirm !== 'function') return;
  Utils.confirm('Reset Semua Data', 'PERHATIAN: Semua data akan dihapus permanen!', async () => {
    try {
      const stores = ['invoices','customers','products','expenses','stock_movements'];
      for (const s of stores) {
        if (typeof DB.dbGetAll === 'function' && typeof DB.dbDelete === 'function') {
          const all = await DB.dbGetAll(s);
          for (const item of all) await DB.dbDelete(s, item.id);
        }
      }
      Utils.toast('Semua data telah dihapus', 'warning');
      if (typeof navigateTo === 'function') navigateTo('dashboard');
    } catch (err) {
      console.error('Error clearAllData:', err);
    }
  }, true);
}

async function generateSampleData() {
  try {
    const c1 = { name:'Budi Santoso', phone:'081234567890', address:'Jl. Merdeka No.10' };
    const c2 = { name:'Siti Rahayu', phone:'082345678901', address:'Jl. Sudirman No.5' };
    if (typeof DB.dbPut === 'function') {
      await DB.dbPut('customers', c1);
      await DB.dbPut('customers', c2);

      const prods = [
        { name:'Kemeja Polos', category:'Pakaian', price:85000 },
        { name:'Kaos Oblong', category:'Pakaian', price:55000 }
      ];
      for (const p of prods) await DB.dbPut('products', p);
    }

    if (window.Utils && typeof window.Utils.toast === 'function') {
      Utils.toast('Data contoh berhasil ditambahkan!', 'success');
    }
  } catch (err) {
    console.error('Error generateSampleData:', err);
  }
}

async function resetWebTotal() {
  if (!window.Utils || typeof window.Utils.confirm !== 'function') return;
  Utils.confirm('Reset Total Aplikasi', 'PERHATIAN: Semua data aplikasi akan direset!', async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      Utils.toast('Aplikasi direset! Memuat ulang...', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.error('Reset error:', err);
    }
  }, true);
}

// Bind Global Functions
window.initSettings = initSettings;
window.saveSettings = saveSettings;
window.saveProfileSettings = saveSettings;
window.savePrefixSettings = saveSettings;
window.saveNotesSettings = saveSettings;
window.exportAllData = exportAllData;
window.clearAllData = clearAllData;
window.generateSampleData = generateSampleData;
window.updateSidebarStoreName = updateSidebarStoreName;
window.resetWebTotal = resetWebTotal;
