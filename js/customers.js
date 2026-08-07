// ============================================================
//  customers.js — Customer Management
// ============================================================

async function initCustomers() {
  await renderCustomersTable();
  document.getElementById('cust-search').addEventListener('input', renderCustomersTable);
}

async function renderCustomersTable() {
  const q = (document.getElementById('cust-search')?.value||'').toLowerCase();
  let customers = await DB.getCustomersWithDebt();
  if (q) customers = customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.address||'').toLowerCase().includes(q));
  customers.sort((a,b) => a.name.localeCompare(b.name));

  const tbody = document.getElementById('customers-tbody');
  tbody.innerHTML = '';

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">👥</div>
      Belum ada pelanggan
    </td></tr>`;
    return;
  }

  customers.forEach(c => {
    tbody.innerHTML += `
      <tr data-id="${c.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#ec4899);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">
              ${(c.name||'?')[0].toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600">${c.name}</div>
              ${c.address?`<div style="font-size:11px;color:var(--text-muted)">${c.address}</div>`:''}
            </div>
          </div>
        </td>
        <td>${c.phone||'—'}</td>
        <td>${c.debt_count > 0
          ? `<span class="badge badge-danger">${c.debt_count} nota kredit</span>`
          : `<span class="badge badge-success">Tidak ada hutang</span>`}
        </td>
        <td>
          ${c.total_debt > 0
            ? `<strong style="color:var(--danger)">${Utils.fmt(c.total_debt)}</strong>`
            : `<span style="color:var(--text-muted)">—</span>`}
        </td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="openCustomerForm(${c.id})">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="viewCustomerInvoices(${c.id})" title="Lihat Nota">📋</button>
            <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
  });
}

let editingCustomerId = null;

async function openCustomerForm(id = null) {
  editingCustomerId = id;
  document.getElementById('cust-modal-title').textContent = id ? '✏️ Edit Pelanggan' : '+ Tambah Pelanggan';

  if (id) {
    const c = await DB.dbGet('customers', id);
    document.getElementById('cust-name').value    = c.name||'';
    document.getElementById('cust-phone').value   = c.phone||'';
    document.getElementById('cust-address').value = c.address||'';
    document.getElementById('cust-notes').value   = c.notes||'';
  } else {
    document.getElementById('cust-name').value    = '';
    document.getElementById('cust-phone').value   = '';
    document.getElementById('cust-address').value = '';
    document.getElementById('cust-notes').value   = '';
  }
  Utils.openModal('customer-modal');
}

async function saveCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) { Utils.toast('Nama pelanggan tidak boleh kosong', 'danger'); return; }

  const payload = {
    id: editingCustomerId||undefined,
    name,
    phone:   document.getElementById('cust-phone').value.trim(),
    address: document.getElementById('cust-address').value.trim(),
    notes:   document.getElementById('cust-notes').value.trim(),
  };
  await DB.dbPut('customers', payload);
  Utils.closeModal('customer-modal');
  Utils.toast(editingCustomerId ? 'Pelanggan diperbarui' : 'Pelanggan berhasil ditambahkan', 'success');
  await renderCustomersTable();
}

async function deleteCustomer(id) {
  Utils.confirm('Hapus Pelanggan', 'Data pelanggan ini akan dihapus. Nota yang sudah dibuat tidak terpengaruh.', async () => {
    await DB.dbDelete('customers', id);
    Utils.toast('Pelanggan dihapus', 'warning');
    await renderCustomersTable();
  });
}

async function viewCustomerInvoices(id) {
  const c = await DB.dbGet('customers', id);
  const invoices = await DB.getInvoicesRich();
  const custInv  = invoices.filter(i => i.customer_id === id);

  let html = `<h3 style="margin-bottom:12px">📋 Nota ${c.name}</h3>`;
  if (!custInv.length) {
    html += `<p style="color:var(--text-muted)">Belum ada nota untuk pelanggan ini.</p>`;
  } else {
    html += `<div class="table-wrapper"><table><thead><tr>
      <th>No. Nota</th><th>Tanggal</th><th>Total</th><th>Status</th>
    </tr></thead><tbody>`;
    custInv.forEach(inv => {
      html += `<tr class="${inv.status==='kredit'?'kredit-row':''}">
        <td><strong>${inv.no_nota}</strong></td>
        <td>${Utils.fmtDate(inv.date)}</td>
        <td><strong>${Utils.fmt(inv.grand_total)}</strong></td>
        <td>${inv.status==='lunas'?'<span class="payment-badge lunas">✓ Lunas</span>':'<span class="payment-badge kredit">⏳ Kredit</span>'}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    const totalDebt = custInv.filter(i=>i.status==='kredit').reduce((s,i)=>s+(i.grand_total||0),0);
    if (totalDebt) html += `<div style="margin-top:12px;color:var(--danger);font-weight:700">Total Piutang: ${Utils.fmt(totalDebt)}</div>`;
  }
  document.getElementById('customer-detail-body').innerHTML = html;
  Utils.openModal('customer-detail-modal');
}

async function exportCustomers() {
  const customers = await DB.getCustomersWithDebt();
  Utils.exportCSV('pelanggan.csv', customers, ['name','phone','address','total_debt','debt_count']);
}

window.initCustomers       = initCustomers;
window.openCustomerForm    = openCustomerForm;
window.saveCustomer        = saveCustomer;
window.deleteCustomer      = deleteCustomer;
window.viewCustomerInvoices= viewCustomerInvoices;
window.exportCustomers     = exportCustomers;
