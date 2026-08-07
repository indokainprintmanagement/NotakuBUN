// ============================================================
//  dashboard.js — Dashboard Page Logic
// ============================================================

let revenueChart = null;
let cachedInvoices = [];
let cachedExpenses = [];

async function initDashboard() {
  const { dbGetAll } = DB;
  const { fmt, fmtDate } = Utils;

  const [invoices, customers, expenses, products] = await Promise.all([
    DB.getInvoicesRich(), dbGetAll('customers'), dbGetAll('expenses'), dbGetAll('products')
  ]);

  cachedInvoices = invoices;
  cachedExpenses = expenses;

  // --- Low Stock Running Text ---
  const lowStockProducts = products.filter(p => p.type !== 'jasa' && (p.stock || 0) < 2000);
  const bannerWrap = document.getElementById('low-stock-banner-wrap');
  const marquee = document.getElementById('low-stock-marquee');
  if (bannerWrap && marquee) {
    if (lowStockProducts.length > 0) {
      bannerWrap.style.display = 'flex';
      const itemsText = lowStockProducts.map(p => `${p.name} (Stok: ${Utils.fmtNum(p.stock || 0)})`).join('  ·  ');
      marquee.textContent = `Ada ${lowStockProducts.length} produk dengan stok di bawah 2000! Segera restock produk berikut: ${itemsText}   ·   `;
    } else {
      bannerWrap.style.display = 'none';
    }
  }

  const today = Utils.todayStr();

  // --- Stats ---
  const todayInvoices = invoices.filter(i => i.date === today);
  const todayInvoiceTotal = todayInvoices.reduce((s,i) => s+(i.grand_total||0), 0);
  const todayExpenses = expenses.filter(e => e.date === today);
  const todayExpenseTotal = todayExpenses.reduce((s,e) => s+(e.amount||0), 0);
  const todayNetTotal = todayInvoiceTotal - todayExpenseTotal;

  const piutangAll    = invoices.filter(i => i.status === 'kredit');
  const piutangTotal  = piutangAll.reduce((s,i) => s+(i.grand_total||0), 0);
  
  const monthStart    = today.slice(0,7);
  const monthInv      = invoices.filter(i => i.date && i.date.startsWith(monthStart));
  const monthInvoiceTotal = monthInv.reduce((s,i) => s+(i.grand_total||0), 0);
  
  const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(monthStart));
  const expensesTotal = monthExpenses.reduce((s,e) => s+(e.amount||0), 0);
  const monthNetTotal = monthInvoiceTotal - expensesTotal;

  document.getElementById('stat-today').textContent      = fmt(todayNetTotal);
  document.getElementById('stat-today-count').textContent= `${todayInvoices.length} transaksi hari ini`;
  document.getElementById('stat-piutang').textContent    = fmt(piutangTotal);
  document.getElementById('stat-piutang-count').textContent = `${piutangAll.length} nota belum lunas`;
  document.getElementById('stat-month').textContent      = fmt(monthNetTotal);
  document.getElementById('stat-month-count').textContent= `${monthInv.length} transaksi bulan ini`;
  document.getElementById('stat-expenses').textContent   = fmt(expensesTotal);
  document.getElementById('stat-expenses-net').textContent = `Total pengeluaran terdaftar`;

  // --- 7-day chart ---
  const days = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    days.push(d.toISOString().split('T')[0]);
  }
  const dayLabels  = days.map(d => fmtDate(d).slice(0,6));
  const dayTotals  = days.map(d => {
    return invoices.filter(i=>i.date===d).reduce((s,i)=>s+(i.grand_total||0),0);
  });

  const ctx = document.getElementById('revenueChart').getContext('2d');
  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        label: 'Omzet',
        data: dayTotals,
        backgroundColor: 'rgba(139,92,246,0.5)',
        borderColor: '#8b5cf6',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(139,92,246,0.8)',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ' ' + Utils.fmt(ctx.raw) }
        }
      },
      scales: {
        x: { grid: { color:'rgba(255,255,255,0.04)' }, ticks: { color:'#8b949e', font:{size:11} } },
        y: { grid: { color:'rgba(255,255,255,0.04)' }, ticks: { color:'#8b949e', font:{size:11},
          callback: v => v>=1000000 ? 'Rp'+(v/1000000).toFixed(1)+'jt' : v>=1000 ? 'Rp'+(v/1000).toFixed(0)+'rb' : 'Rp'+v } }
      }
    }
  });

  // --- Today's transactions table ---
  switchDashboardTodayTable('invoices');

  // --- Recent kredit list ---
  const kreditTbody = document.getElementById('dash-kredit-tbody');
  kreditTbody.innerHTML = '';
  const recentKredit = piutangAll.slice(0,5);
  if (recentKredit.length === 0) {
    kreditTbody.innerHTML = `<tr><td colspan="4" style="padding:20px;color:var(--text-muted);text-align:center">Tidak ada piutang 🎉</td></tr>`;
  } else {
    recentKredit.forEach(inv => {
      kreditTbody.innerHTML += `
        <tr class="kredit-row">
          <td><strong>${inv.no_nota}</strong></td>
          <td>${inv.customer_name}</td>
          <td>${fmtDate(inv.date)}</td>
          <td><strong style="color:var(--danger)">${fmt(inv.grand_total)}</strong></td>
        </tr>`;
    });
  }
}

window.initDashboard = initDashboard;

function switchDashboardChart(type) {
  const btnRev = document.getElementById('btn-chart-revenue');
  const btnExp = document.getElementById('btn-chart-expenses');
  const chartTitle = document.getElementById('chart-card-title');

  if (!btnRev || !btnExp || !revenueChart) return;

  const days = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    days.push(d.toISOString().split('T')[0]);
  }
  const dayLabels = days.map(d => Utils.fmtDate(d).slice(0,6));

  let data = [];
  let color = 'rgba(139,92,246,0.5)';
  let borderColor = '#8b5cf6';
  let label = '';

  if (type === 'revenue') {
    btnRev.classList.add('active');
    btnExp.classList.remove('active');
    chartTitle.textContent = '📊 Omzet 7 Hari Terakhir';
    label = 'Omzet';
    data = days.map(d => {
      return cachedInvoices.filter(i=>i.date===d).reduce((s,i)=>s+(i.grand_total||0),0);
    });
  } else {
    btnExp.classList.add('active');
    btnRev.classList.remove('active');
    chartTitle.textContent = '📊 Pengeluaran 7 Hari Terakhir';
    label = 'Pengeluaran';
    color = 'rgba(239,68,68,0.5)';
    borderColor = '#ef4444';
    data = days.map(d => {
      return cachedExpenses.filter(e=>e.date===d).reduce((s,e)=>s+(e.amount||0),0);
    });
  }

  revenueChart.data.labels = dayLabels;
  revenueChart.data.datasets[0].label = label;
  revenueChart.data.datasets[0].data = data;
  revenueChart.data.datasets[0].backgroundColor = color;
  revenueChart.data.datasets[0].borderColor = borderColor;
  revenueChart.update();
}
window.switchDashboardChart = switchDashboardChart;

function switchDashboardTodayTable(type) {
  const btnInv = document.getElementById('btn-dash-today-invoices');
  const btnExp = document.getElementById('btn-dash-today-expenses');
  const cardTitle = document.getElementById('dash-today-card-title');
  const thead = document.getElementById('dash-today-thead');
  const tbody = document.getElementById('dash-today-tbody');
  const actionBtn = document.getElementById('btn-dash-today-action');

  if (!btnInv || !btnExp || !thead || !tbody) return;

  const today = Utils.todayStr();
  const { fmt, fmtDate } = Utils;

  if (type === 'invoices') {
    btnInv.classList.add('active');
    btnExp.classList.remove('active');
    cardTitle.textContent = '🗓️ Transaksi Hari Ini';
    
    if (actionBtn) {
      actionBtn.textContent = '✚ Buat Nota';
      actionBtn.setAttribute('onclick', "openCreateInvoice()");
      actionBtn.className = "btn btn-primary btn-sm";
    }

    thead.innerHTML = `
      <tr>
        <th>No. Nota</th>
        <th>Pelanggan</th>
        <th>Waktu</th>
        <th>Total</th>
        <th>Status</th>
      </tr>`;

    const todayInvoices = cachedInvoices.filter(i => i.date === today);
    tbody.innerHTML = '';
    if (todayInvoices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px;color:var(--text-muted);text-align:center">Belum ada transaksi hari ini</td></tr>`;
    } else {
      todayInvoices.forEach(inv => {
        const statusBadge = inv.status === 'lunas'
          ? `<span class="payment-badge lunas">✓ Lunas</span>`
          : `<span class="payment-badge kredit">⏳ Kredit</span>`;
        tbody.innerHTML += `
          <tr class="${inv.status==='kredit'?'kredit-row':''}">
            <td><strong>${inv.no_nota}</strong></td>
            <td>${inv.customer_name}</td>
            <td>${inv.time||'—'}</td>
            <td><strong>${fmt(inv.grand_total)}</strong></td>
            <td>${statusBadge}</td>
          </tr>`;
      });
    }
  } else {
    btnExp.classList.add('active');
    btnInv.classList.remove('active');
    cardTitle.textContent = '🗓️ Pengeluaran Hari Ini';
    
    if (actionBtn) {
      actionBtn.textContent = '💸 Catat Pengeluaran';
      actionBtn.setAttribute('onclick', "openExpenseForm()");
      actionBtn.className = "btn btn-danger btn-sm";
    }

    thead.innerHTML = `
      <tr>
        <th>Waktu</th>
        <th>Kategori / Deskripsi</th>
        <th>Jumlah</th>
        <th>Catatan</th>
      </tr>`;

    const todayExpenses = cachedExpenses.filter(e => e.date === today);
    tbody.innerHTML = '';
    if (todayExpenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding:24px;color:var(--text-muted);text-align:center">Belum ada pengeluaran hari ini</td></tr>`;
    } else {
      todayExpenses.forEach(exp => {
        tbody.innerHTML += `
          <tr>
            <td>${exp.time||'—'}</td>
            <td><strong>${exp.category}</strong></td>
            <td><strong style="color:var(--danger)">${fmt(exp.amount)}</strong></td>
            <td style="color:var(--text-secondary)">${exp.notes||'—'}</td>
          </tr>`;
      });
    }
  }
}
window.switchDashboardTodayTable = switchDashboardTodayTable;

async function exportExcelRekap() {
  Utils.toast('Membuat rekap Excel...', 'info');

  const [invoices, customers, products, movements, expenses] = await Promise.all([
    DB.getInvoicesRich(),
    DB.dbGetAll('customers'),
    DB.dbGetAll('products'),
    DB.dbGetAll('stock_movements'),
    DB.dbGetAll('expenses')
  ]);

  const today = Utils.todayStr();
  const currentMonth = today.slice(0, 7);
  const monthStart = today.slice(0, 7);

  // Stats
  const totalOmzet = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
  const totalLunas = invoices.filter(i => i.status === 'lunas').reduce((s, i) => s + (i.grand_total || 0), 0);
  const totalPiutang = invoices.filter(i => i.status === 'kredit').reduce((s, i) => s + (i.grand_total || 0), 0);
  
  const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(monthStart));
  const expensesTotal = monthExpenses.reduce((s,e) => s+(e.amount||0), 0);
  const netTotal      = totalOmzet - expensesTotal;

  // Helper to escape XML strings safely
  const escapeXML = (str) => {
    if (typeof str !== 'string') return str === null || str === undefined ? '' : String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };

  // Helper to construct a row
  const makeRow = (cells) => {
    return `    <Row>\n` + cells.map(c => {
      const type = typeof c === 'number' ? 'Number' : 'String';
      const escaped = type === 'String' ? escapeXML(c) : c;
      return `     <Cell><Data ss:Type="${type}">${escaped}</Data></Cell>`;
    }).join('\n') + `\n    </Row>\n`;
  };

  // 1. RINGKASAN SHEET
  let ringkasanXml = `  <Worksheet ss:Name="Ringkasan">\n   <Table>\n`;
  ringkasanXml += makeRow(['REKAP BISNIS NOTAKU', '', '']);
  ringkasanXml += makeRow(['Tanggal Ekspor', today, '']);
  ringkasanXml += makeRow([]);
  ringkasanXml += makeRow(['METRIK UTAMA', 'NILAI', 'DESKRIPSI']);
  ringkasanXml += makeRow(['Total Omzet Bisnis', totalOmzet, 'Total seluruh nilai penjualan']);
  ringkasanXml += makeRow(['Omzet Lunas', totalLunas, 'Total pembayaran cash/transfer diterima']);
  ringkasanXml += makeRow(['Total Piutang (Kredit)', totalPiutang, 'Total tagihan belum terbayar']);
  ringkasanXml += makeRow(['Pengeluaran Bulan Ini', expensesTotal, 'Total pengeluaran tercatat bulan ini']);
  ringkasanXml += makeRow(['Omzet Bersih Kumulatif', netTotal, 'Omzet Bisnis dikurangi Pengeluaran Bulan Ini']);
  ringkasanXml += makeRow(['Jumlah Pelanggan', customers.length, 'Total pelanggan terdaftar']);
  ringkasanXml += makeRow(['Jumlah Jenis Produk', products.length, 'Total item di katalog']);
  ringkasanXml += `   </Table>\n  </Worksheet>\n`;

  // 2. DAFTAR PELANGGAN
  let pelangganXml = `  <Worksheet ss:Name="Daftar Pelanggan">\n   <Table>\n`;
  pelangganXml += makeRow(['ID Pelanggan', 'Nama Pelanggan', 'No. HP / Telepon', 'Alamat Lengkap', 'Catatan']);
  customers.forEach(c => {
    pelangganXml += makeRow([c.id, c.name, c.phone || '—', c.address || '—', c.notes || '—']);
  });
  pelangganXml += `   </Table>\n  </Worksheet>\n`;

  // 3. DAFTAR NOTA
  let notaXml = `  <Worksheet ss:Name="Daftar Nota">\n   <Table>\n`;
  notaXml += makeRow(['No. Nota', 'Pelanggan', 'Tanggal', 'Waktu', 'Subtotal', 'Diskon', 'Grand Total', 'Status']);
  invoices.forEach(i => {
    notaXml += makeRow([i.no_nota, i.customer_name, i.date, i.time || '—', i.subtotal || 0, i.discount || 0, i.grand_total || 0, i.status === 'lunas' ? 'LUNAS' : 'KREDIT']);
  });
  notaXml += `   </Table>\n  </Worksheet>\n`;

  // 4. KATALOG PRODUK
  let produkXml = `  <Worksheet ss:Name="Katalog Produk">\n   <Table>\n`;
  produkXml += makeRow(['Nama Produk', 'SKU', 'Kategori', 'Tipe', 'Harga Satuan', 'Stok Aktual', 'Deskripsi']);
  products.forEach(p => {
    produkXml += makeRow([p.name, p.sku || '—', p.category || 'Umum', p.type === 'jasa' ? 'Jasa' : 'Barang', p.price || 0, p.type === 'jasa' ? '—' : (p.stock || 0), p.description || '—']);
  });
  produkXml += `   </Table>\n  </Worksheet>\n`;

  // 5. MUTASI STOK
  let mutasiXml = `  <Worksheet ss:Name="Mutasi Stok">\n   <Table>\n`;
  mutasiXml += makeRow(['Tanggal', 'Waktu', 'Nama Produk', 'Tipe Mutasi', 'Jumlah Qty', 'Catatan / Keterangan']);
  const prodMap = {};
  products.forEach(p => prodMap[p.id] = p);
  movements.forEach(m => {
    let typeBadge = '';
    if (m.type === 'in') typeBadge = 'Masuk (Restock)';
    else if (m.type === 'out') typeBadge = 'Keluar (Manual)';
    else if (m.type === 'out_sale') typeBadge = 'Penjualan Nota';

    mutasiXml += makeRow([m.date, m.time || '', prodMap[m.product_id]?.name || 'Produk Dihapus', typeBadge, m.qty || 0, m.notes || '—']);
  });
  mutasiXml += `   </Table>\n  </Worksheet>\n`;

  // 6. LAPORAN PIUTANG & LUNAS
  let piutangXml = `  <Worksheet ss:Name="Laporan Piutang &amp; Lunas">\n   <Table>\n`;
  piutangXml += makeRow(['No. Nota', 'Pelanggan', 'Tanggal', 'Total Tagihan', 'Status Pembayaran']);
  invoices.forEach(i => {
    piutangXml += makeRow([i.no_nota, i.customer_name, i.date, i.grand_total || 0, i.status === 'lunas' ? 'LUNAS (Terbayar)' : 'KREDIT (Piutang)']);
  });
  piutangXml += `   </Table>\n  </Worksheet>\n`;

  // 7. PENGELUARAN HARIAN
  let pengeluaranXml = `  <Worksheet ss:Name="Pengeluaran Harian">\n   <Table>\n`;
  pengeluaranXml += makeRow(['Tanggal', 'Deskripsi / Kategori', 'Jumlah Nominal', 'Catatan Tambahan']);
  expenses.forEach(e => {
    pengeluaranXml += makeRow([e.date, e.category || '—', e.amount || 0, e.notes || '—']);
  });
  pengeluaranXml += `   </Table>\n  </Worksheet>\n`;

  // Combine into Workbook XML
  const workbookXml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n` +
    ` xmlns:o="urn:schemas-microsoft-com:office:office"\n` +
    ` xmlns:x="urn:schemas-microsoft-com:office:excel"\n` +
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n` +
    ` xmlns:html="http://www.w3.org/TR/REC-html40">\n` +
    ` <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">\n` +
    `  <Author>NotaKu</Author>\n` +
    `  <Created>${new Date().toISOString()}</Created>\n` +
    ` </DocumentProperties>\n` +
    ringkasanXml +
    pelangganXml +
    notaXml +
    produkXml +
    mutasiXml +
    piutangXml +
    pengeluaranXml +
    `</Workbook>\n`;

  const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rekap_bisnis_bulanan_${currentMonth}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  Utils.toast('Rekap Excel berhasil diunduh! Tab-tab terpisah rapi tanpa konversi kolom.', 'success');
}

window.exportExcelRekap = exportExcelRekap;

async function showPaymentDetails(period) {
  const { fmt } = Utils;
  const invoices = await DB.getInvoicesRich();
  const today = Utils.todayStr();
  const currentMonth = today.slice(0, 7);
  
  let filtered = [];
  let title = '';
  
  if (period === 'today') {
    filtered = invoices.filter(i => i.date === today);
    title = '💵 Detail Pembayaran (Hari Ini)';
  } else {
    filtered = invoices.filter(i => i.date && i.date.startsWith(currentMonth));
    title = '📈 Detail Pembayaran (Bulan Ini)';
  }
  
  // Group by payment method
  const breakdown = {};
  let total = 0;
  
  filtered.forEach(inv => {
    let method = 'KREDIT';
    if (inv.status === 'lunas') {
      method = inv.payment_method || 'CASH';
    }
    breakdown[method] = (breakdown[method] || 0) + (inv.grand_total || 0);
    total += (inv.grand_total || 0);
  });
  
  document.getElementById('payment-detail-title').textContent = title;
  
  const body = document.getElementById('payment-detail-body');
  if (!body) return;
  body.innerHTML = '';
  
  let html = `<div style="display:flex; flex-direction:column; gap:12px">`;
  
  const sortedMethods = Object.keys(breakdown).sort((a,b) => {
    if (a === 'KREDIT') return 1;
    if (b === 'KREDIT') return -1;
    return b.localeCompare(a);
  });
  
  sortedMethods.forEach(method => {
    const amount = breakdown[method];
    const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
    
    let methodColor = 'var(--accent-light)';
    let icon = '💳';
    if (method === 'CASH') {
      methodColor = 'var(--success)';
      icon = '💵';
    } else if (method === 'QRIS') {
      methodColor = 'var(--info)';
      icon = '📱';
    } else if (method.startsWith('TRANSFER')) {
      methodColor = 'var(--warning)';
      icon = '🏦';
    } else if (method === 'KREDIT') {
      methodColor = 'var(--danger)';
      icon = '⏳';
    }
    
    html += `
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:12px; border-radius:var(--radius-sm)">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px">
          <span style="font-weight:600; color:${methodColor}">${icon} ${method}</span>
          <span style="font-weight:700">${fmt(amount)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px">
          <div class="progress-bar" style="flex:1; height:6px">
            <div class="progress-fill" style="width:${percentage}%; background:${methodColor}"></div>
          </div>
          <span style="font-size:11px; color:var(--text-secondary); width:35px; text-align:right">${percentage}%</span>
        </div>
      </div>
    `;
  });
  
  html += `
    <hr class="divider">
    <div style="display:flex; justify-content:space-between; font-weight:700; font-size:15px; padding:4px">
      <span>TOTAL OMZET</span>
      <span style="color:var(--accent-light)">${fmt(total)}</span>
    </div>
  </div>`;
  
  body.innerHTML = html;
  Utils.openModal('payment-detail-modal');
}
window.showPaymentDetails = showPaymentDetails;
