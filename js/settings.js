// ============================================================
//  settings.js — Store Settings
// ============================================================

async function initSettings() {
  const keys = ['store_name','store_address','store_phone','store_tagline','nota_prefix'];
  for (const key of keys) {
    const el = document.getElementById('set-'+key.replace('store_','').replace('nota_','nota-'));
    if (el) el.value = await DB.getSetting(key, getDefaultSetting(key));
  }
  // special mappings
  document.getElementById('set-store-name').value    = await DB.getSetting('store_name','Toko Saya');
  document.getElementById('set-store-address').value = await DB.getSetting('store_address','');
  document.getElementById('set-store-phone').value   = await DB.getSetting('store_phone','');
  document.getElementById('set-store-tagline').value = await DB.getSetting('store_tagline','');
  document.getElementById('set-nota-prefix').value   = await DB.getSetting('nota_prefix','INV');
  document.getElementById('set-default-notes-struk').value   = await DB.getSetting('default_notes_struk','');
  document.getElementById('set-default-notes-invoice').value = await DB.getSetting('default_notes_invoice','');

  // Update sidebar store name
  updateSidebarStoreName();
}

function getDefaultSetting(key) {
  const defaults = { store_name:'Toko Saya', nota_prefix:'INV' };
  return defaults[key]||'';
}

async function saveSettings() {
  await DB.setSetting('store_name',    document.getElementById('set-store-name').value.trim());
  await DB.setSetting('store_address', document.getElementById('set-store-address').value.trim());
  await DB.setSetting('store_phone',   document.getElementById('set-store-phone').value.trim());
  await DB.setSetting('store_tagline', document.getElementById('set-store-tagline').value.trim());
  await DB.setSetting('nota_prefix',   document.getElementById('set-nota-prefix').value.trim()||'INV');
  await DB.setSetting('default_notes_struk',   document.getElementById('set-default-notes-struk').value.trim());
  await DB.setSetting('default_notes_invoice', document.getElementById('set-default-notes-invoice').value.trim());

  Utils.toast('Pengaturan berhasil disimpan ✓', 'success');
  updateSidebarStoreName();
}

async function updateSidebarStoreName() {
  const name = await DB.getSetting('store_name','Toko Saya');
  const el = document.getElementById('sidebar-store-name');
  if (el) el.textContent = name;
  const logoEl = document.getElementById('sidebar-store-logo');
  if (logoEl) logoEl.textContent = (name[0]||'T').toUpperCase();
}

async function exportAllData() {
  const [invoices, customers, products] = await Promise.all([
    DB.getInvoicesRich(), DB.dbGetAll('customers'), DB.dbGetAll('products')
  ]);

  // Export invoices
  const rows = invoices.map(i => ({
    no_nota: i.no_nota, date: i.date, time: i.time||'',
    customer: i.customer_name, status: i.status,
    subtotal: i.subtotal||0, discount: i.discount||0, grand_total: i.grand_total||0,
    notes: i.notes||'',
    items: JSON.stringify(i.items||[]),
  }));
  Utils.exportCSV(`nota_semua_${Utils.todayStr()}.csv`, rows,
    ['no_nota','date','time','customer','status','subtotal','discount','grand_total','notes','items']);

  setTimeout(() => Utils.toast('Data berhasil diekspor ke CSV', 'success'), 500);
}

async function clearAllData() {
  Utils.confirm('Reset Semua Data', 'PERHATIAN: Semua data nota, pelanggan, dan produk akan dihapus permanen!', async () => {
    const stores = ['invoices','customers','products'];
    for (const s of stores) {
      const all = await DB.dbGetAll(s);
      for (const item of all) await DB.dbDelete(s, item.id);
    }
    Utils.toast('Semua data telah dihapus', 'warning');
    navigateTo('dashboard');
  }, true);
}

async function generateSampleData() {
  // Sample customers
  const c1 = { name:'Budi Santoso', phone:'081234567890', address:'Jl. Merdeka No.10, Jakarta' };
  const c2 = { name:'Siti Rahayu', phone:'082345678901', address:'Jl. Sudirman No.5, Bandung' };
  const c3 = { name:'Ahmad Fauzi', phone:'083456789012', address:'Jl. Gatot Subroto No.8, Surabaya' };
  await DB.dbPut('customers', c1);
  await DB.dbPut('customers', c2);
  await DB.dbPut('customers', c3);

  // Sample products
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
  await updateDebtBadge();
}

async function resetWebTotal() {
  Utils.confirm('Reset Total Aplikasi', 'PERHATIAN: Tindakan ini akan menghapus semua produk, nota, piutang, mutasi stok, dan pengaturan toko secara permanen! Aplikasi akan dimuat ulang ke kondisi awal.', async () => {
    if (window.DB && typeof window.DB.closeDB === 'function') {
      window.DB.closeDB();
    }
    
    const req = indexedDB.deleteDatabase('InvoiceAppDB');
    req.onsuccess = () => {
      localStorage.clear();
      sessionStorage.clear();
      Utils.toast('Aplikasi berhasil direset total! Memuat ulang...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    };
    req.onerror = () => {
      Utils.toast('Gagal menghapus database. Silakan muat ulang halaman.', 'danger');
    };
    req.onblocked = () => {
      localStorage.clear();
      sessionStorage.clear();
      Utils.toast('Membersihkan penyimpanan lokal... Memuat ulang.', 'warning');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };
  }, true);
}

window.initSettings        = initSettings;
window.saveSettings        = saveSettings;
window.exportAllData       = exportAllData;
window.clearAllData        = clearAllData;
window.generateSampleData  = generateSampleData;
window.updateSidebarStoreName = updateSidebarStoreName;
window.resetWebTotal       = resetWebTotal;
