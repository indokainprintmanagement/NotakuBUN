// ============================================================
//  products.js — Product Catalog Management
// ============================================================

async function initProducts() {
  await renderProductsTable();
  document.getElementById('prod-search').addEventListener('input', renderProductsTable);
  document.getElementById('prod-filter-limit')?.addEventListener('change', renderProductsTable);
  if (document.getElementById('prod-viewer-search')) {
    document.getElementById('prod-viewer-search').addEventListener('input', renderStockViewerTable);
  }
  switchProductTab('catalog');
}

async function renderProductsTable() {
  const q = (document.getElementById('prod-search')?.value||'').toLowerCase();
  const filterLimit = document.getElementById('prod-filter-limit')?.value || '';
  let products = await DB.dbGetAll('products');
  if (q) products = products.filter(p => p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q));
  if (filterLimit === 'low') {
    products = products.filter(p => p.type !== 'jasa' && (p.stock || 0) < 2000);
  }
  products.sort((a,b) => a.name.localeCompare(b.name));

  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">📦</div>
      Belum ada produk. <a href="#" onclick="openProductForm()" style="color:var(--accent-light)">Tambah sekarang</a>
    </td></tr>`;
    return;
  }

  products.forEach(p => {
    const isJasa = p.type === 'jasa';
    const stock = p.stock || 0;
    const stockStr = isJasa ? '<span style="color:var(--text-muted)">— (Jasa)</span>' : Utils.fmtNum(stock);
    const stockColor = isJasa ? 'var(--text-secondary)' : (stock <= 0 ? 'var(--danger)' : stock <= 5 ? 'var(--warning)' : 'var(--success)');
    tbody.innerHTML += `
      <tr data-id="${p.id}">
        <td><strong>${p.name}</strong>${p.sku?`<br><small style="color:var(--text-muted)">SKU: ${p.sku}</small>`:''}</td>
        <td><span class="badge badge-info">${p.category||'Umum'}</span></td>
        <td><strong style="color:var(--accent-light)">${Utils.fmt(p.price)}</strong></td>
        <td><strong style="color:${stockColor}">${stockStr}</strong></td>
        <td style="color:var(--text-secondary)">${p.description||'—'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="openProductForm(${p.id})">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
  });
}

let editingProductId = null;

async function openProductForm(id = null) {
  editingProductId = id;
  const modal = document.getElementById('product-modal');
  document.getElementById('prod-modal-title').textContent = id ? '✏️ Edit Produk' : '+ Tambah Produk';
  const stockLabel = document.querySelector('#prod-start-stock-group .form-label');

  if (id) {
    const p = await DB.dbGet('products', id);
    document.getElementById('prod-name').value        = p.name||'';
    document.getElementById('prod-category').value    = p.category||'';
    document.getElementById('prod-sku').value         = p.sku||'';
    if (document.getElementById('prod-type')) {
      document.getElementById('prod-type').value      = p.type||'barang';
    }
    document.getElementById('prod-price').value       = p.price ? Utils.fmtNum(p.price) : '';
    document.getElementById('prod-description').value = p.description||'';
    if (document.getElementById('prod-start-stock-group')) {
      document.getElementById('prod-start-stock-group').style.display = 'block';
      document.getElementById('prod-start-stock').value = p.stock || 0;
      if (stockLabel) stockLabel.textContent = 'Stok Saat Ini / Terakhir';
    }
  } else {
    document.getElementById('prod-name').value        = '';
    document.getElementById('prod-category').value    = '';
    document.getElementById('prod-sku').value         = '';
    if (document.getElementById('prod-type')) {
      document.getElementById('prod-type').value      = 'barang';
    }
    document.getElementById('prod-price').value       = '';
    document.getElementById('prod-description').value = '';
    if (document.getElementById('prod-start-stock-group')) {
      document.getElementById('prod-start-stock-group').style.display = 'block';
      document.getElementById('prod-start-stock').value = '0';
      if (stockLabel) stockLabel.textContent = 'Stok Awal';
    }
  }
  
  if (typeof onProductTypeChange === 'function') {
    onProductTypeChange();
  }
  
  Utils.openModal('product-modal');
}

async function saveProduct() {
  const name  = document.getElementById('prod-name').value.trim();
  const price = Utils.parseAmount(document.getElementById('prod-price').value || '0');
  const type  = document.getElementById('prod-type')?.value || 'barang';
  if (!name)  { Utils.toast('Nama produk tidak boleh kosong', 'danger'); return; }
  if (!price) { Utils.toast('Harga tidak boleh 0', 'danger'); return; }

  const isNew = !editingProductId;
  let startStock = 0;

  const payload = {
    id: editingProductId||undefined,
    name,
    category: document.getElementById('prod-category').value.trim()||'Umum',
    sku:      document.getElementById('prod-sku').value.trim(),
    type,
    price,
    description: document.getElementById('prod-description').value.trim(),
  };

  const inputStock = type === 'jasa' ? 0 : (parseFloat(document.getElementById('prod-start-stock')?.value || '0') || 0);

  if (isNew) {
    startStock = inputStock;
    payload.stock = inputStock;
  } else {
    const existing = await DB.dbGet('products', editingProductId);
    if (existing) {
      const oldStock = existing.stock || 0;
      payload.stock = type === 'jasa' ? 0 : inputStock;

      const diff = inputStock - oldStock;
      if (diff !== 0 && type !== 'jasa') {
        await DB.dbPut('stock_movements', {
          product_id: editingProductId,
          date: Utils.todayStr(),
          time: Utils.timeStr(),
          type: diff > 0 ? 'in' : 'out',
          qty: Math.abs(diff),
          notes: `Penyesuaian Stok (Edit Produk: ${oldStock} -> ${inputStock})`,
        });
      }
    }
  }

  const savedId = await DB.dbPut('products', payload);

  // Jika produk baru bertipe barang dan memiliki stok awal, catat mutasi masuk!
  if (isNew && startStock > 0 && type !== 'jasa') {
    await DB.dbPut('stock_movements', {
      product_id: savedId,
      date: Utils.todayStr(),
      time: Utils.timeStr(),
      type: 'in',
      qty: startStock,
      notes: 'Stok Awal Produk Baru',
    });
  }

  Utils.closeModal('product-modal');
  Utils.toast(editingProductId ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan', 'success');
  await renderProductsTable();
  await renderStockViewerTable();
}

async function deleteProduct(id) {
  Utils.confirm('Hapus Produk', 'Produk ini akan dihapus dari katalog. Data nota tidak terpengaruh.', async () => {
    await DB.dbDelete('products', id);
    Utils.toast('Produk dihapus', 'warning');
    await renderProductsTable();
    await renderStockViewerTable();
  });
}

async function importProductsCSV() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.csv';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    let imported = 0;
    for (let i=1; i<lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g,'').trim());
      if (!cols[0]) continue;
      await DB.dbPut('products', {
        name: cols[0], category: cols[1]||'Umum',
        price: Utils.parseAmount(cols[2])||0, sku: cols[3]||'', description: cols[4]||''
      });
      imported++;
    }
    Utils.toast(`${imported} produk berhasil diimpor`, 'success');
    await renderProductsTable();
  };
  input.click();
}

async function exportProducts() {
  const products = await DB.dbGetAll('products');
  Utils.exportCSV('produk.csv', products, ['name','category','price','sku','description']);
}

async function switchProductTab(tab) {
  const catalogBtn = document.getElementById('btn-tab-catalog');
  const viewerBtn = document.getElementById('btn-tab-viewer');
  const catalogCont = document.getElementById('prod-catalog-container');
  const viewerCont = document.getElementById('prod-viewer-container');

  if (tab === 'catalog') {
    if (catalogBtn) catalogBtn.classList.add('active');
    if (viewerBtn) viewerBtn.classList.remove('active');
    if (catalogCont) catalogCont.style.display = 'block';
    if (viewerCont) viewerCont.style.display = 'none';
    await renderProductsTable();
  } else {
    if (viewerBtn) viewerBtn.classList.add('active');
    if (catalogBtn) catalogBtn.classList.remove('active');
    if (catalogCont) catalogCont.style.display = 'none';
    if (viewerCont) viewerCont.style.display = 'block';
    await renderStockViewerTable();
  }
}

async function renderStockViewerTable() {
  const q = (document.getElementById('prod-viewer-search')?.value||'').toLowerCase();
  
  const [products, movements, invoices] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock_movements'),
    DB.dbGetAll('invoices')
  ]);

  // Aggregate incoming stock (type === 'in')
  const incomingMap = {};
  movements.forEach(m => {
    if (m.type === 'in') {
      incomingMap[m.product_id] = (incomingMap[m.product_id] || 0) + m.qty;
    }
  });

  // Aggregate sold stock and revenue from invoices
  const soldMap = {};
  const revenueMap = {};

  invoices.forEach(inv => {
    if (inv.items) {
      inv.items.forEach(item => {
        // Find product match by name
        const p = products.find(prod => prod.name === item.name);
        if (p) {
          soldMap[p.id] = (soldMap[p.id] || 0) + item.qty;
          revenueMap[p.id] = (revenueMap[p.id] || 0) + (item.qty * item.price);
        }
      });
    }
  });

  let list = products.map(p => ({
    ...p,
    total_in: incomingMap[p.id] || 0,
    total_sold: soldMap[p.id] || 0,
    omset: revenueMap[p.id] || 0
  }));

  if (q) {
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q));
  }

  list.sort((a,b) => a.name.localeCompare(b.name));

  const tbody = document.getElementById('prod-viewer-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">📊</div>
      Tidak ada data produk ditemukan
    </td></tr>`;
    return;
  }

  list.forEach(p => {
    const isJasa = p.type === 'jasa';
    const stock = p.stock || 0;
    
    const stockStr = isJasa ? '<span style="color:var(--text-muted)">— (Jasa)</span>' : Utils.fmtNum(stock);
    const stockColor = isJasa ? 'var(--text-secondary)' : (stock <= 0 ? 'var(--danger)' : stock <= 5 ? 'var(--warning)' : 'var(--success)');
    const totalInStr = isJasa ? '<span style="color:var(--text-muted)">— (Jasa)</span>' : Utils.fmtNum(p.total_in);
    
    tbody.innerHTML += `
      <tr>
        <td><strong>${p.name}</strong>${p.sku?`<br><small style="color:var(--text-muted)">SKU: ${p.sku}</small>`:''}</td>
        <td><span class="badge badge-info">${p.category||'Umum'}</span></td>
        <td><strong style="color:${stockColor}">${stockStr}</strong></td>
        <td><strong style="color:var(--success)">${totalInStr}</strong></td>
        <td><strong style="color:var(--warning)">${Utils.fmtNum(p.total_sold)}</strong></td>
        <td><strong style="color:var(--accent-light)">${Utils.fmt(p.omset)}</strong></td>
      </tr>`;
  });
}

async function exportStockViewerCSV() {
  const [products, movements, invoices] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock_movements'),
    DB.dbGetAll('invoices')
  ]);

  const incomingMap = {};
  movements.forEach(m => {
    if (m.type === 'in') {
      incomingMap[m.product_id] = (incomingMap[m.product_id] || 0) + m.qty;
    }
  });

  const soldMap = {};
  const revenueMap = {};

  invoices.forEach(inv => {
    if (inv.items) {
      inv.items.forEach(item => {
        const p = products.find(prod => prod.name === item.name);
        if (p) {
          soldMap[p.id] = (soldMap[p.id] || 0) + item.qty;
          revenueMap[p.id] = (revenueMap[p.id] || 0) + (item.qty * item.price);
        }
      });
    }
  });

  const rows = products.map(p => ({
    nama_produk: p.name,
    sku: p.sku || '',
    kategori: p.category || 'Umum',
    stok_sekarang: p.stock || 0,
    total_masuk: incomingMap[p.id] || 0,
    total_terjual: soldMap[p.id] || 0,
    omset: revenueMap[p.id] || 0
  }));

  rows.sort((a,b) => a.nama_produk.localeCompare(b.nama_produk));

  Utils.exportCSV(`laporan_stok_viewer_${Utils.todayStr()}.csv`, rows, 
    ['nama_produk', 'sku', 'kategori', 'stok_sekarang', 'total_masuk', 'total_terjual', 'omset']);
  
  Utils.toast('Stok Viewer berhasil diekspor!', 'success');
}

window.initProducts      = initProducts;
window.openProductForm   = openProductForm;
window.saveProduct       = saveProduct;
window.deleteProduct     = deleteProduct;
window.importProductsCSV = importProductsCSV;
window.exportProducts    = exportProducts;
window.switchProductTab  = switchProductTab;
window.renderStockViewerTable = renderStockViewerTable;
window.exportStockViewerCSV   = exportStockViewerCSV;

function onProductTypeChange() {
  const type = document.getElementById('prod-type')?.value;
  const stockGroup = document.getElementById('prod-start-stock-group');
  if (stockGroup) {
    stockGroup.style.display = (type === 'jasa') ? 'none' : 'block';
  }
}

function navigateToLowStock() {
  navigateTo('products');
  switchProductTab('catalog');
  const filterEl = document.getElementById('prod-filter-limit');
  if (filterEl) {
    filterEl.value = 'low';
  }
  renderProductsTable();
}

window.onProductTypeChange = onProductTypeChange;
window.navigateToLowStock  = navigateToLowStock;
