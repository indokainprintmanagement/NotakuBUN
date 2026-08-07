// ============================================================
//  debts.js — Laporan Piutang / Kredit
// ============================================================

async function initDebts() {
  await renderDebtsTable();
  document.getElementById('debt-search').addEventListener('input', renderDebtsTable);
  document.getElementById('debt-filter-customer').addEventListener('change', renderDebtsTable);
}

async function renderDebtsTable() {
  const q       = (document.getElementById('debt-search')?.value||'').toLowerCase();
  const custId  = document.getElementById('debt-filter-customer')?.value||'';

  // Populate customer filter
  const customers = await DB.dbGetAll('customers');
  const sel = document.getElementById('debt-filter-customer');
  if (sel && sel.options.length <= 1) {
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }

  let invoices = await DB.getInvoicesRich();
  invoices = invoices.filter(i => i.status === 'kredit');

  if (q)      invoices = invoices.filter(i => i.no_nota.toLowerCase().includes(q) || i.customer_name.toLowerCase().includes(q));
  if (custId) invoices = invoices.filter(i => String(i.customer_id) === String(custId));

  // Summary
  const totalDebt   = invoices.reduce((s,i) => s+(i.grand_total||0), 0);
  const totalCount  = invoices.length;
  const custCount   = [...new Set(invoices.filter(i=>i.customer_id).map(i=>i.customer_id))].length;

  document.getElementById('debt-total-amt').textContent   = Utils.fmt(totalDebt);
  document.getElementById('debt-total-count').textContent = `${totalCount} nota`;
  document.getElementById('debt-cust-count').textContent  = `${custCount} pelanggan`;

  const tbody = document.getElementById('debts-tbody');
  tbody.innerHTML = '';

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:50px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">🎉</div>
      <div style="font-size:16px;font-weight:600;color:var(--success);margin-bottom:4px">Tidak ada piutang!</div>
      <div>Semua nota sudah lunas</div>
    </td></tr>`;
    return;
  }

  invoices.forEach(inv => {
    const age = Math.floor((new Date() - new Date(inv.date)) / 86400000);
    const ageBadge = age > 30
      ? `<span class="badge badge-danger">${age} hari</span>`
      : age > 7
        ? `<span class="badge badge-warning">${age} hari</span>`
        : `<span class="badge badge-muted">${age} hari</span>`;

    tbody.innerHTML += `
      <tr class="kredit-row" data-id="${inv.id}">
        <td><strong style="color:var(--accent-light)">${inv.no_nota}</strong></td>
        <td>
          <div style="font-weight:600">${inv.customer_name}</div>
          ${inv.customer?.phone ? `<div style="font-size:11px;color:var(--text-muted)">${inv.customer.phone}</div>` : ''}
        </td>
        <td>${Utils.fmtDate(inv.date)}</td>
        <td><strong style="color:var(--danger)">${Utils.fmt(inv.grand_total)}</strong></td>
        <td>${ageBadge}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-success btn-sm" onclick="markLunas(${inv.id})">✓ Lunas</button>
            <button class="btn btn-ghost btn-sm" onclick="printStruk(${inv.id})">🧾</button>
            <button class="btn btn-ghost btn-sm" onclick="openEditInvoice(${inv.id})">✏️</button>
          </div>
        </td>
      </tr>`;
  });
}

async function exportDebts() {
  let invoices = await DB.getInvoicesRich();
  invoices = invoices.filter(i => i.status === 'kredit');
  const rows = invoices.map(i => ({
    no_nota: i.no_nota,
    customer: i.customer_name,
    date: i.date,
    grand_total: i.grand_total,
    notes: i.notes||'',
  }));
  Utils.exportCSV('piutang.csv', rows, ['no_nota','customer','date','grand_total','notes']);
}

window.initDebts    = initDebts;
window.exportDebts  = exportDebts;
