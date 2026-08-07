// ============================================================
//  utils.js — Shared Utility Functions
// ============================================================

// Format rupiah dengan desimal (misal: Rp 15.500,50)
const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0';
  const num = parseFloat(n);
  // Tampilkan desimal hanya jika ada
  const hasDecimal = num % 1 !== 0;
  return 'Rp ' + num.toLocaleString('id-ID', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const num = parseFloat(n);
  const hasDecimal = num % 1 !== 0;
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
};

const fmtDateLong = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
};

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const timeStr  = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
};

function toast(msg, type = 'success', duration = 3000) {
  const icons = { success:'✅', danger:'❌', warning:'⚠️', info:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function confirm(title, msg, cb, danger = true) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-icon').textContent  = danger ? '🗑️' : '❓';
  const overlay = document.getElementById('confirm-overlay');
  overlay.classList.add('active');
  const okBtn = document.getElementById('confirm-ok');
  okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  const handler = () => { overlay.classList.remove('active'); cb(); okBtn.removeEventListener('click', handler); };
  okBtn.addEventListener('click', handler);
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('active');
}

function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Parsing harga: mendukung desimal dengan koma (15.500,50) atau titik (15500.50)
function parseAmount(str) {
  if (typeof str === 'number') return str;
  let s = String(str).trim();
  // Format ID: titik = pemisah ribuan, koma = desimal → "15.500,50" → 15500.50
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Jika tidak ada koma, hilangkan titik pemisah ribuan (> 3 digit setelah titik terakhir = ribuan)
    const dotIdx = s.lastIndexOf('.');
    if (dotIdx !== -1 && s.length - dotIdx - 1 === 3) {
      // Kemungkinan pemisah ribuan, bukan desimal → hapus titik
      s = s.replace(/\./g, '');
    }
    // else: titik terakhir adalah desimal → biarkan
  }
  s = s.replace(/[^\d.]/g, '');
  return parseFloat(s) || 0;
}

function formatDecimalInput(value) {
  if (value === null || value === undefined) return '';
  let clean = String(value).replace(/[^\d,]/g, '');
  const commaIdx = clean.indexOf(',');
  if (commaIdx !== -1) {
    clean = clean.substring(0, commaIdx + 1) + clean.substring(commaIdx + 1).replace(/,/g, '');
  }
  const parts = clean.split(',');
  let integerPart = parts[0];
  let decimalPart = parts.length > 1 ? parts[1] : null;
  if (integerPart === '' && decimalPart !== null) {
    integerPart = '0';
  }
  if (integerPart) {
    if (integerPart.length > 1 && integerPart.startsWith('0')) {
      integerPart = integerPart.replace(/^0+/, '') || '0';
    }
    const num = parseInt(integerPart.replace(/\./g, ''), 10);
    if (!isNaN(num)) {
      integerPart = num.toLocaleString('id-ID');
    }
  }
  if (decimalPart !== null) {
    return integerPart + ',' + decimalPart.substring(0, 2);
  }
  return integerPart;
}

function formatAmountInput(input) {
  input.value = formatDecimalInput(input.value);
}

function generateId() { return Date.now() + '_' + Math.random().toString(36).slice(2); }

// Export CSV
function exportCSV(filename, rows, headers) {
  const escape = v => `"${String(v||'').replace(/"/g,'""')}"`;
  const lines  = [headers.map(escape).join(','), ...rows.map(r => headers.map(h => escape(r[h]||'')).join(','))];
  const blob   = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.Utils = { fmt, fmtNum, fmtDate, fmtDateLong, todayStr, timeStr, toast, confirm, closeConfirm, openModal, closeModal, parseAmount, formatDecimalInput, formatAmountInput, generateId, exportCSV };
