// ============================================================
//  expenses.js — Daily Business Expenses Management
// ============================================================

async function initExpenses() {
  await renderExpensesTable();

  // Attach search and filter event listeners
  document.getElementById('exp-search').addEventListener('input', renderExpensesTable);
  document.getElementById('exp-filter-date-from').addEventListener('change', renderExpensesTable);
  document.getElementById('exp-filter-date-to').addEventListener('change', renderExpensesTable);
}

async function renderExpensesTable() {
  const search   = (document.getElementById('exp-search')?.value||'').toLowerCase();
  const dateFrom = document.getElementById('exp-filter-date-from')?.value||'';
  const dateTo   = document.getElementById('exp-filter-date-to')?.value||'';

  const expenses = await DB.dbGetAll('expenses');

  let list = expenses.map(e => ({ ...e }));

  // Apply filters
  if (search)   list = list.filter(e => e.category.toLowerCase().includes(search) || (e.notes && e.notes.toLowerCase().includes(search)));
  if (dateFrom) list = list.filter(e => e.date >= dateFrom);
  if (dateTo)   list = list.filter(e => e.date <= dateTo);

  // Sort by date & time descending (latest first)
  list.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')));

  // Render Table
  const tbody = document.getElementById('expenses-tbody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">💸</div>
      Belum ada catatan pengeluaran harian
    </td></tr>`;
  } else {
    list.forEach(e => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${Utils.fmtDate(e.date)}</strong><br><small style="color:var(--text-muted)">${e.time || ''}</small></td>
          <td><strong>${e.category}</strong></td>
          <td><strong style="color:var(--danger)">${Utils.fmt(e.amount)}</strong></td>
          <td style="color:var(--text-secondary)">${e.notes || '—'}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="openExpenseForm(${e.id})" title="Edit Pengeluaran">✏️</button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteExpense(${e.id})" title="Hapus Pengeluaran">🗑️</button>
            </div>
          </td>
        </tr>`;
    });
  }

  // Calculate Monthly Summary Total
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  let totalMonth = 0;

  expenses.forEach(e => {
    if (e.date && e.date.startsWith(currentMonthPrefix)) {
      totalMonth += (e.amount || 0);
    }
  });

  document.getElementById('exp-total-month').textContent = Utils.fmt(totalMonth);
}

function openExpenseForm(id = null) {
  document.getElementById('exp-id').value = id || '';
  document.getElementById('exp-modal-title').textContent = id ? '✏️ Edit Pengeluaran' : '💸 Tambah Pengeluaran';
  
  if (id) {
    // Editing existing expense
    DB.dbGet('expenses', id).then(e => {
      if (!e) return;
      document.getElementById('exp-category').value = e.category || '';
      document.getElementById('exp-amount').value = Utils.fmtNum(e.amount || 0);
      document.getElementById('exp-date').value = e.date || Utils.todayStr();
      document.getElementById('exp-notes').value = e.notes || '';
      Utils.openModal('expense-modal');
    });
  } else {
    // New expense entry
    document.getElementById('exp-category').value = '';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-date').value = Utils.todayStr();
    document.getElementById('exp-notes').value = '';
    Utils.openModal('expense-modal');
  }
}

async function saveExpense() {
  const id = parseFloat(document.getElementById('exp-id').value) || null;
  const category = document.getElementById('exp-category').value.trim();
  const amount = Utils.parseAmount(document.getElementById('exp-amount').value || '0');
  const date = document.getElementById('exp-date').value;
  const notes = document.getElementById('exp-notes').value.trim();

  if (!category) { Utils.toast('Kategori atau deskripsi wajib diisi', 'danger'); return; }
  if (amount <= 0) { Utils.toast('Nominal pengeluaran harus lebih dari 0', 'danger'); return; }
  if (!date) { Utils.toast('Pilih tanggal pengeluaran', 'danger'); return; }

  const payload = {
    id: id || undefined,
    category,
    amount,
    date,
    time: id ? undefined : Utils.timeStr(), // keep original time if editing
    notes,
  };

  // If editing, preserve original creation time
  if (id) {
    const existing = await DB.dbGet('expenses', id);
    if (existing) {
      payload.time = existing.time;
    }
  }

  await DB.dbPut('expenses', payload);
  Utils.closeModal('expense-modal');
  Utils.toast(id ? 'Pengeluaran berhasil diperbarui!' : 'Pengeluaran harian berhasil dicatat!', 'success');

  // Redraw tables & stats
  await renderExpensesTable();
  if (typeof initDashboard === 'function') await initDashboard();
}

async function deleteExpense(id) {
  Utils.confirm('Hapus Pengeluaran', 'Apakah Anda yakin ingin menghapus catatan pengeluaran ini?', async () => {
    await DB.dbDelete('expenses', id);
    Utils.toast('Catatan pengeluaran berhasil dihapus', 'warning');
    
    await renderExpensesTable();
    if (typeof initDashboard === 'function') await initDashboard();
  });
}

async function exportExpensesCSV() {
  const expenses = await DB.dbGetAll('expenses');
  
  const rows = expenses.map(e => ({
    tanggal: e.date,
    waktu: e.time || '',
    kategori_deskripsi: e.category,
    jumlah_nominal: e.amount,
    catatan_keterangan: e.notes || ''
  }));

  // Sort descending
  rows.sort((a, b) => new Date(b.tanggal + ' ' + (b.waktu || '00:00')) - new Date(a.tanggal + ' ' + (a.waktu || '00:00')));

  Utils.exportCSV(`pengeluaran_harian_${Utils.todayStr()}.csv`, rows, ['tanggal', 'waktu', 'kategori_deskripsi', 'jumlah_nominal', 'catatan_keterangan']);
  Utils.toast('Pengeluaran harian berhasil diekspor!', 'success');
}

// Publish expenses functions to window
window.initExpenses       = initExpenses;
window.renderExpensesTable = renderExpensesTable;
window.openExpenseForm     = openExpenseForm;
window.saveExpense         = saveExpense;
window.deleteExpense       = deleteExpense;
window.exportExpensesCSV   = exportExpensesCSV;
