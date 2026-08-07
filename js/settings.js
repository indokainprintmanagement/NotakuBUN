// ============================================================
//   settings.js — Store Settings
// ============================================================

async function initSettings() {
  try {
    const setStoreName = document.getElementById('set-store-name');
    if (setStoreName) setStoreName.value = await DB.getSetting('store_name', 'Toko Saya');

    const setStoreAddr = document.getElementById('set-store-address');
    if (setStoreAddr) setStoreAddr.value = await DB.getSetting('store_address', '');

    const setStorePhone = document.getElementById('set-store-phone');
    if (setStorePhone) setStorePhone.value = await DB.getSetting('store_phone', '');

    const setStoreTagline = document.getElementById('set-store-tagline');
    if (setStoreTagline) setStoreTagline.value = await DB.getSetting('store_tagline', '');

    const setPrefix = document.getElementById('set-nota-prefix');
    if (setPrefix) setPrefix.value = await DB.getSetting('nota_prefix', 'INV');

    const setNotesStruk = document.getElementById('set-default-notes-struk');
    if (setNotesStruk) setNotesStruk.value = await DB.getSetting('default_notes_struk', '');

    const setNotesInv = document.getElementById('set-default-notes-invoice');
    if (setNotesInv) setNotesInv.value = await DB.getSetting('default_notes_invoice', '');

    await updateSidebarStoreName();
  } catch (err) {
    console.error('Error initSettings:', err);
  }
}

async function saveSettings() {
  try {
    const getValue = (id, fallback = '') => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : fallback;
    };

    await DB.setSetting('store_name', getValue('set-store-name', 'Toko Saya'));
    await DB.setSetting('store_address', getValue('set-store-address'));
    await DB.setSetting('store_phone', getValue('set-store-phone'));
    await DB.setSetting('store_tagline', getValue('set-store-tagline'));
    await DB.setSetting('nota_prefix', getValue('set-nota-prefix', 'INV') || 'INV');
    await DB.setSetting('default_notes_struk', getValue('set-default-notes-struk'));
    await DB.setSetting('default_notes_invoice', getValue('set-default-notes-invoice'));

    if (window.Utils && typeof window.Utils.toast === 'function') {
      Utils.toast('Pengaturan berhasil disimpan ✓', 'success');
    }
    await updateSidebarStoreName();
  } catch (err) {
    console.error('Gagal menyimpan pengaturan:', err);
    if (window.Utils && typeof window.Utils.toast === 'function') {
      Utils.toast('Gagal menyimpan pengaturan!', 'danger');
    }
  }
}

async function updateSidebarStoreName() {
  try {
    const name = await DB.getSetting('store_name', 'Toko Saya');
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
        const all = await DB.dbGetAll(s);
        for (const item of all) await DB.dbDelete(s, item.id);
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
    await DB.dbPut('customers', c1);
    await DB.dbPut('customers', c2);

    const prods = [
      { name:'Kemeja Polos', category:'Pakaian', price:85000 },
      { name:'Kaos Oblong', category:'Pakaian', price:55000 }
    ];
    for (const p of prods) await DB.dbPut('products', p);

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
