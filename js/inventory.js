// ============================================================
//  inventory.js — Stock Movements (Barang Masuk & Keluar)
// ============================================================

async function initInventory() {
  await renderInventoryTable();

  // Attach search and filter event listeners
  document.getElementById('inv-stock-search').addEventListener('input', renderInventoryTable);
  document.getElementById('inv-stock-filter-type').addEventListener('change', renderInventoryTable);
  document.getElementById('inv-stock-filter-date-from').addEventListener('change', renderInventoryTable);
  document.getElementById('inv-stock-filter-date-to').addEventListener('change', renderInventoryTable);
}

async function renderInventoryTable() {
  const search   = (document.getElementById('inv-stock-search')?.value||'').toLowerCase();
  const type     = document.getElementById('inv-stock-filter-type')?.value||'';
  const dateFrom = document.getElementById('inv-stock-filter-date-from')?.value||'';
  const dateTo   = document.getElementById('inv-stock-filter-date-to')?.value||'';

  const [movements, products] = await Promise.all([
    DB.dbGetAll('stock_movements'),
    DB.dbGetAll('products')
  ]);

  const prodMap = {};
  products.forEach(p => prodMap[p.id] = p);

  // Map movements with rich product names
  let list = movements.map(m => ({
    ...m,
    product_name: prodMap[m.product_id]?.name || 'Produk Dihapus'
  }));

  // Apply filters
  if (search)   list = list.filter(m => m.product_name.toLowerCase().includes(search));
  if (type)     list = list.filter(m => m.type === type);
  if (dateFrom) list = list.filter(m => m.date >= dateFrom);
  if (dateTo)   list = list.filter(m => m.date <= dateTo);

  // Sort by date & time descending (latest first)
  list.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')));

  // Render Table
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">🔄</div>
      Tidak ada mutasi stok ditemukan
    </td></tr>`;
  } else {
    list.forEach(m => {
      let typeBadge = '';
      if (m.type === 'in') {
        typeBadge = '<span class="badge badge-success">📥 Masuk</span>';
      } else if (m.type === 'out') {
        typeBadge = '<span class="badge badge-danger">📤 Keluar</span>';
      } else if (m.type === 'out_sale') {
        typeBadge = '<span class="badge badge-warning">🛒 Penjualan</span>';
      }

      // Manual entries can be deleted
      const actionBtn = (m.type === 'in' || m.type === 'out')
        ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteStockMovement(${m.id})" title="Hapus Mutasi">🗑️</button>`
        : '—';

      tbody.innerHTML += `
        <tr>
          <td><strong>${Utils.fmtDate(m.date)}</strong><br><small style="color:var(--text-muted)">${m.time || ''}</small></td>
          <td><strong>${m.product_name}</strong></td>
          <td>${typeBadge}</td>
          <td><strong>${Utils.fmtNum(m.qty)}</strong></td>
          <td style="color:var(--text-secondary)">${m.notes || '—'}</td>
          <td>${actionBtn}</td>
        </tr>`;
    });
  }

  // Calculate Monthly Summary Stats and Low Stock Count
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  let totalIn = 0;

  movements.forEach(m => {
    if (m.date && m.date.startsWith(currentMonthPrefix)) {
      if (m.type === 'in') {
        totalIn += m.qty;
      }
    }
  });

  const lowStockCount = products.filter(p => p.type !== 'jasa' && (p.stock || 0) < 2000).length;

  if (document.getElementById('inv-total-in')) {
    document.getElementById('inv-total-in').textContent = Utils.fmtNum(totalIn);
  }
  if (document.getElementById('inv-total-low')) {
    document.getElementById('inv-total-low').textContent = Utils.fmtNum(lowStockCount);
  }
}

async function openStockForm(type = 'in') {
  document.getElementById('stock-type').value = type;
  document.getElementById('stock-modal-title').textContent = type === 'in' ? '📥 Tambah Barang Masuk' : '📤 Kurang Barang Keluar';
  document.getElementById('stock-qty').value = '1';
  document.getElementById('stock-date').value = Utils.todayStr();
  document.getElementById('stock-notes').value = '';

  // Populate products dropdown (filter out services/jasa since they do not track stock)
  const products = await DB.dbGetAll('products');
  const physicalProducts = products.filter(p => p.type !== 'jasa');
  physicalProducts.sort((a,b) => a.name.localeCompare(b.name));

  const select = document.getElementById('stock-product-id');
  select.innerHTML = '<option value="">— Pilih Produk —</option>';
  physicalProducts.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.name} (Stok: ${Utils.fmtNum(p.stock||0)})</option>`;
  });

  Utils.openModal('stock-modal');
}

async function saveStockMovement() {
  const type = document.getElementById('stock-type').value;
  const productId = parseFloat(document.getElementById('stock-product-id').value);
  const qty = parseFloat(document.getElementById('stock-qty').value) || 0;
  const date = document.getElementById('stock-date').value;
  const notes = document.getElementById('stock-notes').value.trim();

  if (!productId) { Utils.toast('Pilih produk terlebih dahulu', 'danger'); return; }
  if (qty <= 0) { Utils.toast('Jumlah qty harus lebih dari 0', 'danger'); return; }
  if (!date) { Utils.toast('Pilih tanggal transaksi', 'danger'); return; }
  if (!notes) { Utils.toast('Masukkan catatan alasan mutasi stok', 'danger'); return; }

  // Adjust stock levels
  const changeQty = type === 'in' ? qty : -qty;
  
  // Verify outgoing stock availability
  if (type === 'out') {
    const prod = await DB.dbGet('products', productId);
    if (prod && (prod.stock || 0) < qty) {
      Utils.toast(`Stok tidak mencukupi. Stok saat ini hanya ${Utils.fmtNum(prod.stock || 0)}`, 'danger');
      return;
    }
  }

  const payload = {
    product_id: productId,
    date,
    time: Utils.timeStr(),
    type,
    qty,
    notes,
  };

  await DB.dbPut('stock_movements', payload);
  await DB.updateProductStock(productId, changeQty);

  Utils.closeModal('stock-modal');
  Utils.toast(type === 'in' ? 'Stok masuk berhasil dicatat!' : 'Stok keluar berhasil dicatat!', 'success');

  // Redraw tables
  await renderInventoryTable();
  if (typeof renderProductsTable === 'function') await renderProductsTable();
}

async function deleteStockMovement(id) {
  Utils.confirm('Hapus Mutasi Stok', 'Apakah Anda yakin ingin membatalkan mutasi stok ini? Stok produk akan dikembalikan.', async () => {
    const m = await DB.dbGet('stock_movements', id);
    if (!m) return;

    // Reverse the stock change
    const reverseQty = m.type === 'in' ? -m.qty : m.qty;

    // Verify product exists and reversing won't yield negative stock for outgoing restoration
    if (reverseQty < 0) {
      const prod = await DB.dbGet('products', m.product_id);
      if (prod && (prod.stock || 0) < Math.abs(reverseQty)) {
        Utils.toast(`Stok tidak dapat dikembalikan karena stok saat ini kurang dari qty mutasi`, 'danger');
        return;
      }
    }

    await DB.updateProductStock(m.product_id, reverseQty);
    await DB.dbDelete('stock_movements', id);

    Utils.toast('Mutasi stok berhasil dibatalkan', 'warning');
    await renderInventoryTable();
    if (typeof renderProductsTable === 'function') await renderProductsTable();
  });
}

async function exportInventoryCSV() {
  const [movements, products] = await Promise.all([
    DB.dbGetAll('stock_movements'),
    DB.dbGetAll('products')
  ]);

  const prodMap = {};
  products.forEach(p => prodMap[p.id] = p);

  const rows = movements.map(m => {
    let typeLabel = '';
    if (m.type === 'in') typeLabel = 'Masuk';
    else if (m.type === 'out') typeLabel = 'Keluar';
    else if (m.type === 'out_sale') typeLabel = 'Penjualan';

    return {
      tanggal: m.date,
      waktu: m.time || '',
      produk: prodMap[m.product_id]?.name || 'Produk Dihapus',
      tipe: typeLabel,
      qty: m.qty,
      catatan: m.notes || ''
    };
  });

  // Sort descending
  rows.sort((a, b) => new Date(b.tanggal + ' ' + (b.waktu || '00:00')) - new Date(a.tanggal + ' ' + (a.waktu || '00:00')));

  Utils.exportCSV(`mutasi_stok_${Utils.todayStr()}.csv`, rows, ['tanggal', 'waktu', 'produk', 'tipe', 'qty', 'catatan']);
  Utils.toast('Mutasi stok berhasil diekspor!', 'success');
}

// Publish inventory functions
window.initInventory       = initInventory;
window.renderInventoryTable = renderInventoryTable;
window.openStockForm       = openStockForm;
window.saveStockMovement   = saveStockMovement;
window.deleteStockMovement = deleteStockMovement;
window.exportInventoryCSV   = exportInventoryCSV;
