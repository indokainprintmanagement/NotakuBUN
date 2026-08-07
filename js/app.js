// ============================================================
//  app.js — Router, Navigation & App Init
// ============================================================

const PAGES = {
  dashboard:  { title: 'Dashboard',         subtitle: 'Ringkasan bisnis hari ini',       icon: '📊', init: initDashboard },
  invoices:   { title: 'Daftar Nota',        subtitle: 'Semua transaksi & nota',          icon: '📋', init: initInvoiceList },
  products:   { title: 'Katalog Produk',     subtitle: 'Kelola produk & harga',           icon: '📦', init: initProducts },
  inventory:  { title: 'Mutasi Stok',        subtitle: 'Kelola barang masuk & keluar',    icon: '🚚', init: initInventory },
  expenses:   { title: 'Pengeluaran Harian', subtitle: 'Catat pengeluaran operasional',   icon: '💸', init: initExpenses },
  customers:  { title: 'Pelanggan',          subtitle: 'Data pelanggan tersimpan',        icon: '👥', init: initCustomers },
  debts:      { title: 'Laporan Piutang',    subtitle: 'Nota kredit & hutang pelanggan',  icon: '💳', init: initDebts },
  settings:   { title: 'Pengaturan',         subtitle: 'Profil toko & konfigurasi',       icon: '⚙️', init: initSettings },
};

let currentPage = null;

function navigateTo(pageId) {
  if (!PAGES[pageId]) return;
  currentPage = pageId;

  // Hide all pages
  document.querySelectorAll('.content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  // Show selected
  const page = document.getElementById('page-'+pageId);
  if (page) page.classList.add('active');
  const navItem = document.getElementById('nav-'+pageId);
  if (navItem) navItem.classList.add('active');

  // Update topbar
  const info = PAGES[pageId];
  document.getElementById('topbar-title').textContent    = info.title;
  document.getElementById('topbar-subtitle').textContent = info.subtitle;

  // Run init
  if (info.init) info.init();

  // Close mobile sidebar
  document.querySelector('.sidebar')?.classList.remove('open');
}

// Global keyboard shortcut: N = new invoice
document.addEventListener('keydown', e => {
  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    openCreateInvoice();
  }
});

async function initApp() {
  await DB.openDB();

  // Init sidebar store name
  await updateSidebarStoreName();

  // Update debt badge
  await updateDebtBadge();

  // Navigate to dashboard
  navigateTo('dashboard');
}

// Mobile sidebar toggle
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

window.navigateTo   = navigateTo;
window.toggleSidebar= toggleSidebar;

// Boot
document.addEventListener('DOMContentLoaded', initApp);
