// ============================================================
//   settings.js — Store Settings
// ============================================================

/**
 * Helper aman untuk mengambil value dari input ID
 */
function getInputValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value.trim() : fallback;
}

/**
 * Helper aman untuk mengisi value ke input ID
 */
function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

async function initSettings() {
  try {
    // Load Profil Toko
    setInputValue('set-store-name',    await DB.getSetting('store_name', 'Toko Saya'));
    setInputValue('set-store-address', await DB.getSetting('store_address', ''));
    setInputValue('set-store-phone',   await DB.getSetting('store_phone', ''));
    setInputValue('set-store-tagline', await DB.getSetting('store_tagline', ''));

    // Load Konfigurasi & Catatan Nota
    setInputValue('set-nota-prefix',          await DB.getSetting('nota_prefix', 'INV'));
    setInputValue('set-default-notes-struk',   await DB.getSetting('default_notes_struk', ''));
    setInputValue('set-default-notes-invoice', await DB.getSetting('default_notes_invoice', ''));

    // Update sidebar
    await updateSidebarStoreName();
  } catch (err) {
    console.error('Error initSettings:', err);
  }
}

function getDefaultSetting(key) {
  const defaults = { store_name: 'Toko Saya', nota_prefix: 'INV' };
  return defaults[key] || '';
}

// Simpan Semua Pengaturan (Unified)
async function saveSettings() {
  try {
    await DB.setSetting('store_name',    getInputValue('set-store-name', 'Toko Saya'));
    await DB.setSetting('store_address', getInputValue('set-store-address'));
    await DB.setSetting('store_phone',   getInputValue('set-store-phone'));
    await DB.setSetting('store_tagline', getInputValue('set-store-tagline'));
    await DB.setSetting('nota_prefix',   getInputValue('set-nota-prefix', 'INV') || 'INV');
    await DB.setSetting('default_notes_struk',   getInputValue('set-default-notes-struk'));
    await DB.setSetting('default_notes_invoice', getInputValue('set-default-notes-invoice'));

    Utils.toast('Pengaturan berhasil disimpan ✓', 'success');
    await updateSidebarStoreName();
  } catch (err) {
    console.error('Gagal menyimpan pengaturan:', err);
    Utils.toast('Gagal menyimpan pengaturan!', 'danger');
  }
}

// Simpan Khusus Profil Toko
async function saveProfileSettings() {
  try {
    await DB.setSetting('store_name',    getInputValue('set-store-name', 'Toko Saya'));
    await DB.setSetting('store_address', getInputValue('set-store-address'));
    await DB.setSetting('store_phone',   getInputValue('set-store-phone'));
    await DB.setSetting('store_tagline', getInputValue('set-store-tagline'));

    Utils.toast('Profil toko berhasil disimpan ✓', 'success');
    await updateSidebarStoreName();
  } catch (err) {
    console.error('Gagal menyimpan profil:', err);
    Utils.toast('Gagal menyimpan profil toko!', 'danger');
  }
}

// Simpan Khusus Awalan Nota
async function savePrefixSettings() {
  try {
    const prefix = getInputValue('set-nota-prefix', 'INV') || 'INV';
    await DB.setSetting('nota_prefix', prefix);

    Utils.toast('Awalan nota berhasil disimpan ✓', 'success');
  } catch (err) {
    console.error('Gagal menyimpan awalan nota:', err);
    Utils.toast('Gagal menyimpan awalan nota!', 'danger');
  }
}

// Simpan Khusus Catatan Nota
async function saveNotesSettings() {
  try {
    await DB.setSetting('default_notes_struk',   getInputValue('set-default-notes-struk'));
    await DB.setSetting('default_notes_invoice', getInputValue('set-default-notes-invoice'));

    Utils.toast('Catatan default berhasil disimpan ✓', 'success');
  } catch (err) {
    console.error('Gagal menyimpan catatan:', err);
    Utils.toast('Gagal menyimpan catatan default!', 'danger');
  }
}

async function updateSidebarStoreName() {
  try {
    const name = await DB.getSetting('store_name', 'Toko Saya');
    const el = document.getElementById('sidebar-store-name');
    if (el) el.textContent = name;
    
    const logoEl = document.getElementById('sidebar-store-logo');
    if (logoEl) logoEl.textContent = (name[0] || 'T').toUpperCase();
  } catch (err) {
    console.warn('Gagal update sidebar name:', err);
  }
}

async function exportAllData() {
  try {
    const [invoices, customers, products] = await Promise.all([
      DB.getInvoicesRich(), DB.dbGetAll('customers'), DB.dbGetAll('products')
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

    Utils.exportCSV(`nota_semua_${Utils.todayStr()}.csv`, rows,
      ['no_nota','date','time','customer','status','subtotal','discount','grand_total','notes','items']);

    setTimeout(() => Utils.toast('Data berhasil diekspor ke CSV', 'success'), 500);
  } catch (err) {
    console.error('Error export CSV:', err);
    Utils.toast('Gagal mengekspor data ke CSV', 'danger');
  }
}

async function clearAllData() {
  Utils.confirm('Reset Semua Data', 'PERHATIAN: Semua data nota, pelanggan, produk, pengeluaran, dan mutasi stok akan dihapus permanen!', async () => {
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
    const c1 = { name:'Budi Santoso', phone:'081234567890', address:'Jl. Merdeka No.10, Jakarta' };
    const c2 = { name:'Siti Rahayu', phone:'082345678901', address:'Jl. Sudirman No.5, Bandung' };
    const c3 = { name:'Ahmad Fauzi', phone:'083456789012', address:'Jl. Gatot Subroto No.8, Surabaya' };
    await DB.dbPut('customers', c1);
    await DB.dbPut('customers', c2);
    await DB.dbPut('customers', c3);

    const prods = [
      { name:'Kemeja Polos', category:'Pakaian', price:85000 },
      { name:'Kaos Oblong', category:'Pakaian', price:55000 },
      { name:'Celana Jeans', category:'Pakaian', price:175000 },
      { name:'Sepatu Casual', category:'Alas Kaki', price:285000 },
      { name:'Topi Baseball', category:'Aksesori', price:45000 },
      { name:'Tas Selempang', category:'Aksesori', price:135000 },
    ];
    for (const p of prods) await DB.dbPut('products', p);

    Utils.toast('Data contoh berhasil ditambahkan!', 'success');
    if (typeof updateDebtBadge === 'function') await updateDebtBadge();
  } catch (err) {
    console.error('Error generateSampleData:', err);
  }
}

async function resetWebTotal() {
  Utils.confirm('Reset Total Aplikasi', 'PERHATIAN: Tindakan ini akan menghapus semua produk, nota, piutang, mutasi stok, dan pengaturan toko secara permanen! Aplikasi akan dimuat ulang ke kondisi awal.', async () => {
    try {
      const stores = ['invoices','customers','products','expenses','stock_movements'];
      for (const s of stores) {
        const all = await DB.dbGetAll(s);
        for (const item of all) await DB.dbDelete(s, item.id);
      }
      const settings = await DB.dbGetAll('settings');
      for (const st of settings) await DB.dbDelete('settings', st.key);
      localStorage.clear();
      sessionStorage.clear();
      Utils.toast('Aplikasi berhasil direset total! Memuat ulang...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error('Reset error:', err);
      Utils.toast('Gagal mereset database. Silakan periksa koneksi Supabase.', 'danger');
    }
  }, true);
}

// Export ke Window Scope
window.initSettings         = initSettings;
window.saveSettings         = saveSettings;
window.saveProfileSettings  = saveProfileSettings;
window.savePrefixSettings   = savePrefixSettings;
window.saveNotesSettings    = saveNotesSettings;
window.exportAllData        = exportAllData;
window.clearAllData         = clearAllData;
window.generateSampleData   = generateSampleData;
window.updateSidebarStoreName = updateSidebarStoreName;
window.resetWebTotal        = resetWebTotal;
