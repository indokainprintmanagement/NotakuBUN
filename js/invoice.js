// ============================================================
//  invoice.js — Create / Edit / Delete / List Invoices
// ============================================================

let invoiceItems   = [];
let editingInvoice = null;
let allProducts    = [];
let allCustomers   = [];

// ---- LOAD INVOICE LIST PAGE ----
async function initInvoiceList() {
  const { fmt, fmtDate } = Utils;
  allProducts  = await DB.dbGetAll('products');
  allCustomers = await DB.dbGetAll('customers');

  await renderInvoiceTable();

  // Filter events
  document.getElementById('inv-search').addEventListener('input', renderInvoiceTable);
  document.getElementById('inv-filter-status').addEventListener('change', renderInvoiceTable);
  document.getElementById('inv-filter-date-from').addEventListener('change', renderInvoiceTable);
  document.getElementById('inv-filter-date-to').addEventListener('change', renderInvoiceTable);
}

async function renderInvoiceTable() {
  const { fmt, fmtDate } = Utils;
  const search   = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const status   = document.getElementById('inv-filter-status')?.value||'';
  const dateFrom = document.getElementById('inv-filter-date-from')?.value||'';
  const dateTo   = document.getElementById('inv-filter-date-to')?.value||'';

  let invoices = await DB.getInvoicesRich();

  if (search)   invoices = invoices.filter(i => i.no_nota.toLowerCase().includes(search) || i.customer_name.toLowerCase().includes(search));
  if (status)   invoices = invoices.filter(i => i.status === status);
  if (dateFrom) invoices = invoices.filter(i => i.date >= dateFrom);
  if (dateTo)   invoices = invoices.filter(i => i.date <= dateTo);

  const tbody = document.getElementById('invoice-tbody');
  tbody.innerHTML = '';

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">📋</div>
      Tidak ada nota ditemukan
    </td></tr>`;
    return;
  }

  invoices.forEach(inv => {
    const statusBadge = inv.status === 'lunas'
      ? `<span class="payment-badge lunas">✓ Lunas</span>`
      : `<span class="payment-badge kredit">⏳ Kredit</span>`;
    tbody.innerHTML += `
      <tr class="${inv.status==='kredit'?'kredit-row':''}" data-id="${inv.id}">
        <td><strong style="color:var(--accent-light)">${inv.no_nota}</strong></td>
        <td>${inv.customer_name}</td>
        <td>${fmtDate(inv.date)}<br><small style="color:var(--text-muted)">${inv.time||''}</small></td>
        <td>${inv.items?.length||0} item</td>
        <td><strong>${fmt(inv.grand_total)}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="openEditInvoice(${inv.id})" title="Edit">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="printStruk(${inv.id})" title="Cetak Struk">🧾</button>
            <button class="btn btn-ghost btn-sm" onclick="printInvoiceA4(${inv.id})" title="Cetak Invoice A4">📄</button>
            ${inv.status==='kredit' ? `<button class="btn btn-success btn-sm" onclick="markLunas(${inv.id})" title="Tandai Lunas">✓</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteInvoice(${inv.id})" title="Hapus">🗑️</button>
          </div>
        </td>
      </tr>`;
  });

  // Update summary counts
  const totalAmt = invoices.reduce((s,i)=>s+(i.grand_total||0),0);
  const lunas    = invoices.filter(i=>i.status==='lunas');
  const kredit   = invoices.filter(i=>i.status==='kredit');
  if (document.getElementById('inv-summary')) {
    document.getElementById('inv-summary').innerHTML =
      `<span style="color:var(--text-secondary)">${invoices.length} nota</span>
       <span style="color:var(--success)"> · Lunas: ${lunas.length} (${fmt(lunas.reduce((s,i)=>s+(i.grand_total||0),0))})</span>
       <span style="color:var(--danger)"> · Kredit: ${kredit.length} (${fmt(kredit.reduce((s,i)=>s+(i.grand_total||0),0))})</span>
       <span style="margin-left:auto;font-weight:700"> Total: ${fmt(totalAmt)}</span>`;
  }
}

// ---- OPEN CREATE FORM ----
async function openCreateInvoice() {
  editingInvoice = null;
  invoiceItems   = [{ id: generateId(), name:'', qty:1, price:0, subtotal:0 }];
  allProducts    = await DB.dbGetAll('products');
  allCustomers   = await DB.dbGetAll('customers');

  const prefix    = await DB.getSetting('nota_prefix','INV');
  const autoNo    = await DB.getNextNoNota(prefix);
  const storeName = await DB.getSetting('store_name','Toko Saya');
  const defNotes  = await DB.getSetting('default_notes_invoice','');

  document.getElementById('inv-modal-title').textContent = '+ Buat Nota Baru';
  document.getElementById('inv-no-nota').value   = autoNo;
  document.getElementById('inv-date').value      = Utils.todayStr();
  document.getElementById('inv-time').value      = Utils.timeStr();
  document.getElementById('inv-customer-id').value = '';
  if (document.getElementById('inv-customer-manual-name')) {
    document.getElementById('inv-customer-manual-name').value = '';
    document.getElementById('inv-customer-manual-phone').value = '';
    document.getElementById('inv-customer-manual-address').value = '';
  }
  document.getElementById('inv-notes').value     = defNotes;
  document.getElementById('inv-discount').value  = '0';

  // Reset payment method defaults
  document.getElementById('inv-payment-method').value = 'CASH';
  document.getElementById('inv-bank-select').value = 'BCA';
  document.getElementById('inv-bank-custom').value = '';
  document.getElementById('inv-bank-custom').style.display = 'none';
  document.getElementById('bank-name-wrap').style.display = 'none';
  document.getElementById('payment-method-wrap').style.display = 'block';

  setInvoiceStatus('lunas');
  renderItemsTable();
  calcTotals();

  populateCustomerDropdown();
  validateInvoiceCustomer();
  Utils.openModal('invoice-modal');
}

// ---- OPEN EDIT FORM ----
async function openEditInvoice(id) {
  editingInvoice = await DB.dbGet('invoices', id);
  if (!editingInvoice) return;
  allProducts  = await DB.dbGetAll('products');
  allCustomers = await DB.dbGetAll('customers');

  invoiceItems = editingInvoice.items ? editingInvoice.items.map(i => ({...i, id: i.id||generateId()})) : [];
  if (invoiceItems.length === 0) invoiceItems.push({ id:generateId(), name:'', qty:1, price:0, subtotal:0 });

  document.getElementById('inv-modal-title').textContent = '✏️ Edit Nota';
  document.getElementById('inv-no-nota').value   = editingInvoice.no_nota;
  document.getElementById('inv-date').value      = editingInvoice.date;
  document.getElementById('inv-time').value      = editingInvoice.time||'';
  document.getElementById('inv-customer-id').value = editingInvoice.customer_id||'';
  if (document.getElementById('inv-customer-manual-name')) {
    document.getElementById('inv-customer-manual-name').value = '';
    document.getElementById('inv-customer-manual-phone').value = '';
    document.getElementById('inv-customer-manual-address').value = '';
  }
  document.getElementById('inv-notes').value     = editingInvoice.notes||'';
  document.getElementById('inv-discount').value  = editingInvoice.discount||'0';

  // Set payment method values
  if (editingInvoice.status === 'lunas') {
    document.getElementById('payment-method-wrap').style.display = 'block';
    const pm = editingInvoice.payment_method || 'CASH';
    if (pm.startsWith('TRANSFER - ')) {
      document.getElementById('inv-payment-method').value = 'TRANSFER';
      document.getElementById('bank-name-wrap').style.display = 'block';
      const bankName = pm.replace('TRANSFER - ', '');
      const bankOptions = ['BCA', 'MANDIRI', 'BNI', 'BRI'];
      if (bankOptions.includes(bankName)) {
        document.getElementById('inv-bank-select').value = bankName;
        document.getElementById('inv-bank-custom').value = '';
        document.getElementById('inv-bank-custom').style.display = 'none';
      } else {
        document.getElementById('inv-bank-select').value = 'CUSTOM';
        document.getElementById('inv-bank-custom').value = bankName;
        document.getElementById('inv-bank-custom').style.display = 'block';
      }
    } else {
      document.getElementById('inv-payment-method').value = pm;
      document.getElementById('bank-name-wrap').style.display = 'none';
    }
  } else {
    document.getElementById('payment-method-wrap').style.display = 'none';
    document.getElementById('bank-name-wrap').style.display = 'none';
  }

  setInvoiceStatus(editingInvoice.status||'lunas');
  renderItemsTable();
  calcTotals();
  populateCustomerDropdown();
  validateInvoiceCustomer();
  Utils.openModal('invoice-modal');
}

function populateCustomerDropdown() {
  const sel = document.getElementById('inv-customer-id');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Pilih Pelanggan —</option>';
  allCustomers.forEach(c => {
    sel.innerHTML += `<option value="${c.id}" ${c.id==cur?'selected':''}>${c.name}${c.phone?' ('+c.phone+')':''}</option>`;
  });
  sel.innerHTML += '<option value="manual">+ Input manual...</option>';
}

function onCustomerChange() {
  const val = document.getElementById('inv-customer-id').value;
  document.getElementById('inv-customer-manual-wrap').style.display = val==='manual' ? 'block' : 'none';
  validateInvoiceCustomer();
}

function validateInvoiceCustomer() {
  const custId = document.getElementById('inv-customer-id').value;
  let isValid = false;
  if (custId && custId !== 'manual') {
    isValid = true;
  } else if (custId === 'manual') {
    const manualName = document.getElementById('inv-customer-manual-name').value.trim();
    if (manualName) isValid = true;
  }
  
  const onlyBtn = document.getElementById('btn-save-invoice-only');
  const strukBtn = document.getElementById('btn-save-invoice-struk');
  const a4Btn = document.getElementById('btn-save-invoice-a4');
  
  if (onlyBtn) onlyBtn.disabled = !isValid;
  if (strukBtn) strukBtn.disabled = !isValid;
  if (a4Btn) a4Btn.disabled = !isValid;
}

function setInvoiceStatus(status) {
  document.querySelectorAll('.status-option').forEach(el => {
    el.classList.remove('selected-lunas','selected-kredit');
    if (el.dataset.status === status) el.classList.add('selected-'+status);
  });
  document.getElementById('inv-status').value = status;
  
  // Toggle payment method section display
  const pmWrap = document.getElementById('payment-method-wrap');
  if (pmWrap) {
    pmWrap.style.display = status === 'lunas' ? 'block' : 'none';
  }
  const bankWrap = document.getElementById('bank-name-wrap');
  if (bankWrap) {
    const pmVal = document.getElementById('inv-payment-method')?.value;
    bankWrap.style.display = (status === 'lunas' && pmVal === 'TRANSFER') ? 'block' : 'none';
  }
}

function onPaymentMethodChange() {
  const method = document.getElementById('inv-payment-method').value;
  document.getElementById('bank-name-wrap').style.display = method === 'TRANSFER' ? 'block' : 'none';
}

function onBankSelectChange() {
  const bank = document.getElementById('inv-bank-select').value;
  document.getElementById('inv-bank-custom').style.display = bank === 'CUSTOM' ? 'block' : 'none';
  if (bank === 'CUSTOM') {
    document.getElementById('inv-bank-custom').focus();
  }
}

// ---- ITEMS TABLE ----
function generateId() { return 'itm_'+Date.now()+'_'+Math.random().toString(36).slice(2); }

function checkItemQtyWarning(idx, inputEl) {
  const item = invoiceItems[idx];
  const p = allProducts.find(prod => prod.name === item.name);
  if (p && p.type !== 'jasa') {
    let originalQty = 0;
    if (editingInvoice && editingInvoice.items) {
      const origItem = editingInvoice.items.find(oi => oi.name === item.name);
      if (origItem) originalQty = origItem.qty;
    }
    const currentStock = (p.stock || 0) + originalQty;
    if (item.qty > currentStock) {
      inputEl.style.color = 'var(--danger)';
      inputEl.style.borderColor = 'var(--danger)';
      inputEl.style.fontWeight = 'bold';
      return;
    }
  }
  inputEl.style.color = '';
  inputEl.style.borderColor = '';
  inputEl.style.fontWeight = '';
}

function renderItemsTable() {
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';
  invoiceItems.forEach((item, idx) => {
    const p = allProducts.find(prod => prod.name === item.name);
    let originalQty = 0;
    if (editingInvoice && editingInvoice.items) {
      const origItem = editingInvoice.items.find(oi => oi.name === item.name);
      if (origItem) originalQty = origItem.qty;
    }
    const hasWarning = p && p.type !== 'jasa' && (item.qty > ((p.stock || 0) + originalQty));
    const inputStyle = hasWarning 
      ? 'color:var(--danger); border-color:var(--danger); font-weight:bold; text-align:center; padding: 9px 4px' 
      : 'text-align:center; padding: 9px 4px';

    tbody.innerHTML += `
      <tr data-idx="${idx}">
        <td style="width:40%">
          <div class="item-name-cell" style="position:relative">
            <input class="form-control" placeholder="Nama barang..." value="${item.name||''}"
              oninput="onItemNameInput(${idx}, this)" onblur="hideAutocomplete(${idx})"
              id="item-name-${idx}">
            <div class="autocomplete-list" id="autocomplete-${idx}" style="display:none"></div>
          </div>
        </td>
        <td style="width:15%">
          <input class="form-control" type="number" min="1" value="${item.qty||1}"
            oninput="onItemQtyChange(${idx}, this)" style="${inputStyle}" id="item-qty-${idx}">
        </td>
        <td style="width:22%">
          <input class="form-control" value="${item.price ? Utils.fmtNum(item.price) : ''}"
            placeholder="0" oninput="onItemPriceInput(${idx}, this)" id="item-price-${idx}">
        </td>
        <td style="width:20%;font-weight:600;color:var(--accent-light)">
          ${Utils.fmt(item.subtotal||0)}
        </td>
        <td style="width:6%">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="removeItem(${idx})" title="Hapus">✕</button>
        </td>
      </tr>`;
  });
}

function onItemNameInput(idx, input) {
  invoiceItems[idx].name = input.value;
  showAutocomplete(idx, input.value);
}

function showAutocomplete(idx, q) {
  const box = document.getElementById(`autocomplete-${idx}`);
  if (!q || q.length < 1) { box.style.display='none'; return; }
  const matches = allProducts.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0,6);
  if (!matches.length) { box.style.display='none'; return; }
  box.style.display='block';
  box.innerHTML = matches.map(p => `
    <div class="autocomplete-item" onmousedown="selectProduct(${idx}, ${p.id})">
      <span>${p.name}</span>
      <span class="autocomplete-price">${Utils.fmt(p.price)}</span>
    </div>`).join('');
}

function hideAutocomplete(idx) {
  setTimeout(() => {
    const box = document.getElementById(`autocomplete-${idx}`);
    if (box) box.style.display='none';
  }, 200);
}

function selectProduct(idx, productId) {
  const p = allProducts.find(p => p.id === productId);
  if (!p) return;
  invoiceItems[idx].name  = p.name;
  invoiceItems[idx].price = p.price;
  invoiceItems[idx].subtotal = (invoiceItems[idx].qty||1) * p.price;
  renderItemsTable();
  calcTotals();
  const qtyInput = document.getElementById(`item-qty-${idx}`);
  if (qtyInput) checkItemQtyWarning(idx, qtyInput);
}

function onItemQtyChange(idx, input) {
  invoiceItems[idx].qty = parseFloat(input.value)||1;
  invoiceItems[idx].subtotal = invoiceItems[idx].qty * (invoiceItems[idx].price||0);
  updateItemSubtotal(idx);
  calcTotals();
  checkItemQtyWarning(idx, input);
}

function onItemPriceInput(idx, input) {
  const formatted = Utils.formatDecimalInput(input.value);
  input.value = formatted;
  invoiceItems[idx].price = Utils.parseAmount(formatted);
  invoiceItems[idx].subtotal = (invoiceItems[idx].qty||1) * invoiceItems[idx].price;
  updateItemSubtotal(idx);
  calcTotals();
}

function updateItemSubtotal(idx) {
  const row = document.querySelector(`[data-idx="${idx}"] td:nth-child(4)`);
  if (row) row.textContent = Utils.fmt(invoiceItems[idx].subtotal||0);
  if (row) { row.style.fontWeight='600'; row.style.color='var(--accent-light)'; }
}

function removeItem(idx) {
  if (invoiceItems.length <= 1) { invoiceItems[idx] = { id:generateId(), name:'', qty:1, price:0, subtotal:0 }; renderItemsTable(); calcTotals(); return; }
  invoiceItems.splice(idx, 1);
  renderItemsTable();
  calcTotals();
}

function addItemRow() {
  invoiceItems.push({ id:generateId(), name:'', qty:1, price:0, subtotal:0 });
  renderItemsTable();
  // focus last name input
  setTimeout(() => {
    const inputs = document.querySelectorAll('#items-tbody input[placeholder="Nama barang..."]');
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 50);
}

function calcTotals() {
  const subtotal = invoiceItems.reduce((s,i) => s+(i.subtotal||0), 0);
  const discStr  = document.getElementById('inv-discount')?.value||'0';
  const discount = Utils.parseAmount(discStr);
  const grand    = Math.max(0, subtotal - discount);

  if (document.getElementById('tot-subtotal')) document.getElementById('tot-subtotal').textContent = Utils.fmt(subtotal);
  if (document.getElementById('tot-discount')) document.getElementById('tot-discount').textContent = '- '+Utils.fmt(discount);
  if (document.getElementById('tot-grand'))    document.getElementById('tot-grand').textContent    = Utils.fmt(grand);
  return { subtotal, discount, grand };
}

// ---- SAVE INVOICE ----
async function saveInvoice(andPrint = null) {
  const no_nota = document.getElementById('inv-no-nota').value.trim();
  if (!no_nota) { Utils.toast('No. nota tidak boleh kosong', 'danger'); return; }

  const custId  = document.getElementById('inv-customer-id').value;
  let linkedCustId = custId && custId !== 'manual' ? Number(custId) : null;
  let custName = '—';

  if (custId === 'manual') {
    const manualName = document.getElementById('inv-customer-manual-name').value.trim();
    const manualPhone = document.getElementById('inv-customer-manual-phone').value.trim();
    const manualAddress = document.getElementById('inv-customer-manual-address').value.trim();

    if (!manualName) {
      Utils.toast('Nama pelanggan manual wajib diisi', 'danger');
      return;
    }

    // Auto-create customer record in Supabase!
    const newCustRecord = {
      name: manualName,
      phone: manualPhone,
      address: manualAddress,
      notes: 'Terdaftar otomatis saat pembuatan Nota'
    };
    const savedCust = await DB.dbPut('customers', newCustRecord);
    const generatedCustId = (savedCust && typeof savedCust === 'object' && savedCust.id) ? savedCust.id : savedCust;
    
    // Refresh customers list if available
    if (typeof renderCustomersTable === 'function') {
      await renderCustomersTable();
    }

    linkedCustId = generatedCustId;
    custName = manualName;
  } else if (custId) {
    custName = allCustomers.find(c => String(c.id) === String(custId))?.name || '—';
  }

  const validItems = invoiceItems.filter(i => i.name.trim() && i.qty > 0);
  if (validItems.length === 0) { Utils.toast('Tambahkan minimal 1 item', 'danger'); return; }

  const { subtotal, discount, grand } = calcTotals();
  const status  = document.getElementById('inv-status').value;
  const dateVal = document.getElementById('inv-date').value;
  const timeVal = document.getElementById('inv-time').value;

  // Determine payment method if lunas
  let payment_method = '';
  if (status === 'lunas') {
    const methodVal = document.getElementById('inv-payment-method').value;
    if (methodVal === 'TRANSFER') {
      const bankSel = document.getElementById('inv-bank-select').value;
      if (bankSel === 'CUSTOM') {
        payment_method = 'TRANSFER - ' + (document.getElementById('inv-bank-custom').value.trim() || 'LAINNYA').toUpperCase();
      } else {
        payment_method = 'TRANSFER - ' + bankSel;
      }
    } else {
      payment_method = methodVal;
    }
  }

  // Check duplicate no_nota (exclude self)
  const all = await DB.dbGetAll('invoices');
  const dup = all.find(i => i.no_nota === no_nota && i.id !== (editingInvoice?.id));
  if (dup) { Utils.toast(`No. nota "${no_nota}" sudah digunakan`, 'danger'); return; }

  const payload = {
    ...(editingInvoice||{}),
    no_nota,
    date: dateVal,
    time: timeVal,
    customer_id: linkedCustId,
    customer_name_manual: '',
    notes: document.getElementById('inv-notes').value,
    items: validItems,
    subtotal,
    discount,
    grand_total: grand,
    status,
    payment_method,
  };

  // Reverse stock movements if editing an existing invoice
  if (editingInvoice) {
    await reverseInvoiceStockMovements(editingInvoice.no_nota);
  }

  await DB.dbPut('invoices', payload);

  // Record new stock movements for each item
  for (const item of validItems) {
    const p = allProducts.find(prod => prod.name === item.name);
    if (p && p.type !== 'jasa') {
      // Get latest product from database to get fresh stock (after reversal if editing)
      const latestProd = await DB.dbGet('products', p.id);
      if (latestProd) {
        const currentStock = latestProd.stock || 0;
        if (item.qty > currentStock) {
          // Quantity is forced! Auto-update stock first so final stock is 0
          const adjustment = item.qty - currentStock;
          await DB.dbPut('stock_movements', {
            product_id: latestProd.id,
            date: dateVal,
            time: timeVal || Utils.timeStr(),
            type: 'in',
            qty: adjustment,
            notes: `Penyesuaian Otomatis (Qty Dipaksa pada Nota #${no_nota})`,
          });
          await DB.updateProductStock(latestProd.id, adjustment);
        }
      }

      await DB.dbPut('stock_movements', {
        product_id: p.id,
        date: dateVal,
        time: timeVal || Utils.timeStr(),
        type: 'out_sale',
        qty: item.qty,
        notes: `Penjualan Nota #${no_nota}`,
        ref_invoice_id: no_nota,
      });
      await DB.updateProductStock(p.id, -item.qty);
    }
  }

  Utils.closeModal('invoice-modal');
  Utils.toast('Nota berhasil disimpan!', 'success');

  // Refresh list if visible
  if (document.getElementById('page-invoices')?.classList.contains('active')) await renderInvoiceTable();
  if (document.getElementById('page-products')?.classList.contains('active') && typeof renderProductsTable === 'function') await renderProductsTable();
  if (document.getElementById('page-dashboard')?.classList.contains('active')) await initDashboard();

  // Update debt badge
  updateDebtBadge();

  // Print if requested
  if (andPrint === 'struk')   printStruk(payload.no_nota, true);
  if (andPrint === 'invoice') printInvoiceA4(payload.no_nota, true);
}

async function reverseInvoiceStockMovements(no_nota) {
  const movements = await DB.dbGetAll('stock_movements');
  const invoiceMovements = movements.filter(m => m.ref_invoice_id === no_nota);
  for (const m of invoiceMovements) {
    await DB.updateProductStock(m.product_id, m.qty);
    await DB.dbDelete('stock_movements', m.id);
  }
}

// ---- DELETE ----
async function deleteInvoice(id) {
  Utils.confirm('Hapus Nota', 'Apakah Anda yakin ingin menghapus nota ini? Tindakan ini tidak bisa dibatalkan.', async () => {
    const inv = await DB.dbGet('invoices', id);
    if (inv) {
      await reverseInvoiceStockMovements(inv.no_nota);
    }
    await DB.dbDelete('invoices', id);
    Utils.toast('Nota berhasil dihapus', 'warning');
    await renderInvoiceTable();
    if (document.getElementById('page-products')?.classList.contains('active') && typeof renderProductsTable === 'function') await renderProductsTable();
    updateDebtBadge();
  });
}

// ---- MARK LUNAS ----
async function markLunas(id) {
  const inv = await DB.dbGet('invoices', id);
  if (!inv) return;
  inv.status = 'lunas';
  await DB.dbPut('invoices', inv);
  Utils.toast(`Nota ${inv.no_nota} ditandai Lunas ✓`, 'success');
  await renderInvoiceTable();
  updateDebtBadge();
}

// ---- UPDATE DEBT BADGE in sidebar ----
async function updateDebtBadge() {
  const all    = await DB.dbGetAll('invoices');
  const count  = all.filter(i => i.status==='kredit').length;
  const badge  = document.getElementById('debt-badge');
  if (!badge) return;
  badge.textContent = count||'';
  badge.style.display = count ? 'inline-flex' : 'none';
}

window.initInvoiceList   = initInvoiceList;
window.openCreateInvoice = openCreateInvoice;
window.openEditInvoice   = openEditInvoice;
window.saveInvoice       = saveInvoice;
window.deleteInvoice     = deleteInvoice;
window.markLunas         = markLunas;
window.addItemRow        = addItemRow;
window.removeItem        = removeItem;
window.onItemNameInput   = onItemNameInput;
window.onItemQtyChange   = onItemQtyChange;
window.onItemPriceInput  = onItemPriceInput;
window.selectProduct     = selectProduct;
window.hideAutocomplete  = hideAutocomplete;
window.setInvoiceStatus  = setInvoiceStatus;
window.onPaymentMethodChange = onPaymentMethodChange;
window.onBankSelectChange = onBankSelectChange;
window.calcTotals        = calcTotals;
window.onCustomerChange  = onCustomerChange;
window.validateInvoiceCustomer = validateInvoiceCustomer;
window.updateDebtBadge   = updateDebtBadge;

// ---- CUSTOMER SEARCH MODAL FOR NEW INVOICE MANUAL INPUT ----
let activeCustomersList = [];

async function openCustomerSearch() {
  document.getElementById('cust-search-query').value = '';
  activeCustomersList = await DB.dbGetAll('customers');
  activeCustomersList.sort((a, b) => a.name.localeCompare(b.name));
  
  renderCustomerSearchList();
  Utils.openModal('customer-search-modal');
}

function renderCustomerSearchList() {
  const q = document.getElementById('cust-search-query').value.toLowerCase().trim();
  const listEl = document.getElementById('cust-search-list');
  if (!listEl) return;
  
  let matches = activeCustomersList;
  if (q) {
    matches = matches.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  }
  
  listEl.innerHTML = '';
  if (matches.length === 0) {
    listEl.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted)">Tidak ada pelanggan ditemukan</div>`;
    return;
  }
  
  matches.forEach(c => {
    listEl.innerHTML += `
      <div style="padding:12px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:var(--transition)" 
           class="autocomplete-item" onclick="selectSearchedCustomer(${c.id})">
        <div>
          <strong style="color:var(--text-primary)">${c.name}</strong>
          ${c.phone ? `<br><small style="color:var(--text-secondary)">📞 ${c.phone}</small>` : ''}
        </div>
        <button class="btn btn-primary btn-sm" type="button" style="padding:2px 8px; font-size:11px">Pilih</button>
      </div>`;
  });
}

function selectSearchedCustomer(id) {
  const c = activeCustomersList.find(cust => cust.id === id);
  if (!c) return;
  
  document.getElementById('inv-customer-manual-name').value = c.name || '';
  document.getElementById('inv-customer-manual-phone').value = c.phone || '';
  document.getElementById('inv-customer-manual-address').value = c.address || '';
  
  const dropdown = document.getElementById('inv-customer-id');
  if (dropdown) {
    const optionExists = Array.from(dropdown.options).some(opt => String(opt.value) === String(id));
    if (optionExists) {
      dropdown.value = id;
      onCustomerChange();
    } else {
      dropdown.value = 'manual';
      onCustomerChange();
    }
  }
  
  Utils.closeModal('customer-search-modal');
  Utils.toast(`Pelanggan "${c.name}" berhasil di-autofill!`, 'success');
}

window.openCustomerSearch       = openCustomerSearch;
window.renderCustomerSearchList  = renderCustomerSearchList;
window.selectSearchedCustomer    = selectSearchedCustomer;
