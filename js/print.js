// ============================================================
//  print.js — Cetak Struk & Invoice A4
// ============================================================

async function getInvoiceForPrint(idOrNota, byNota = false) {
  let inv;
  if (byNota) {
    const all = await DB.dbGetAll('invoices');
    inv = all.find(i => i.no_nota === idOrNota);
  } else {
    inv = await DB.dbGet('invoices', idOrNota);
  }
  if (!inv) return null;

  // Get customer
  if (inv.customer_id) {
    inv.customer = await DB.dbGet('customers', inv.customer_id);
  }

  // Get store info
  inv.store = {
    name:    await DB.getSetting('store_name','Toko Saya'),
    address: await DB.getSetting('store_address',''),
    phone:   await DB.getSetting('store_phone',''),
    tagline: await DB.getSetting('store_tagline',''),
  };

  return inv;
}

// ---- CETAK STRUK 80mm ----
async function printStruk(id, byNota = false) {
  const inv = await getInvoiceForPrint(id, byNota);
  if (!inv) { Utils.toast('Nota tidak ditemukan', 'danger'); return; }

  const { fmt, fmtNum, fmtDateLong } = Utils;
  const defStrukNotes = await DB.getSetting('default_notes_struk', '');
  const displayNotes = inv.notes ? inv.notes : defStrukNotes;
  const custName = inv.customer?.name || inv.customer_name_manual || '—';
  const custPhone = inv.customer?.phone || '';

  const itemsHtml = (inv.items||[]).map(item => `
    <tr>
      <td colspan="2" style="padding:1px 0;font-size:12px">${item.name}</td>
    </tr>
    <tr>
      <td style="padding:1px 0 3px 4px;font-size:11px;color:#555">${item.qty} x ${fmtNum(item.price||0)}</td>
      <td style="text-align:right;font-weight:600;font-size:12px">${fmtNum(item.subtotal||0)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Struk - ${inv.no_nota}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Courier Prime', 'Courier New', monospace;
      width: 80mm;
      margin: 0 auto;
      padding: 6mm 5mm;
      font-size: 13px;
      color: #111;
      background: white;
    }
    .center { text-align: center; }
    .bold   { font-weight: 700; }
    .divider-dash { border: none; border-top: 1px dashed #999; margin: 5px 0; }
    .divider-solid{ border: none; border-top: 1px solid #111; margin: 5px 0; }
    .store-name { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
    .store-sub  { font-size: 11px; color: #555; }
    table { width: 100%; border-collapse: collapse; }
    .row-info { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .row-info span:last-child { font-weight: 600; }
    .total-section { margin: 4px 0; }
    .total-row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .grand-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin: 4px 0; }
    .status-box {
      text-align: center; padding: 3px 0;
      border: 2px solid;
      border-radius: 4px;
      font-weight: 700; font-size: 12px;
      margin: 5px 0;
    }
    .status-lunas  { border-color: #15803d; color: #15803d; }
    .status-kredit { border-color: #b91c1c; color: #b91c1c; }
    .footer { text-align: center; font-size: 10px; color: #888; margin-top: 6px; }
    @media print { body { width: 72mm; } @page { margin: 0; size: 80mm auto; } }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:6px">
    <div class="store-name">${inv.store.name}</div>
    ${inv.store.address ? `<div class="store-sub">${inv.store.address}</div>` : ''}
    ${inv.store.phone   ? `<div class="store-sub">Telp: ${inv.store.phone}</div>` : ''}
    ${inv.store.tagline ? `<div class="store-sub">${inv.store.tagline}</div>` : ''}
  </div>
  <hr class="divider-solid">
  <div class="row-info"><span>No. Nota</span><span>${inv.no_nota}</span></div>
  <div class="row-info"><span>Tanggal</span><span>${Utils.fmtDate(inv.date)} ${inv.time||''}</span></div>
  ${custName !== '—' ? `<div class="row-info"><span>Pelanggan</span><span>${custName}</span></div>` : ''}
  ${custPhone ? `<div class="row-info"><span>No. HP</span><span>${custPhone}</span></div>` : ''}
  <hr class="divider-dash">
  <table>${itemsHtml}</table>
  <hr class="divider-dash">
  <div class="total-section">
    <div class="total-row"><span>Subtotal</span><span>${fmtNum(inv.subtotal||0)}</span></div>
    ${(inv.discount||0) > 0 ? `<div class="total-row"><span>Diskon</span><span>- ${fmtNum(inv.discount)}</span></div>` : ''}
  </div>
  <hr class="divider-solid">
  <div class="grand-row"><span>TOTAL</span><span>Rp ${fmtNum(inv.grand_total||0)}</span></div>
  <hr class="divider-solid">
  <div class="status-box status-${inv.status}">
    ${inv.status === 'lunas' ? `✓ LUNAS (${inv.payment_method || 'CASH'})` : '⏳ KREDIT / HUTANG'}
  </div>
  ${displayNotes ? `<div style="font-size:11px;color:#555;margin-top:4px">Catatan: ${displayNotes.replace(/\n/g, '<br>')}</div>` : ''}
  <div class="footer">
    <div>Terima kasih atas kepercayaan Anda</div>
    <div>${inv.store.name} • ${new Date().toLocaleString('id-ID')}</div>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=380,height=600');
  win.document.write(html);
  win.document.close();
}

// ---- CETAK INVOICE A4 ----
async function printInvoiceA4(id, byNota = false) {
  const inv = await getInvoiceForPrint(id, byNota);
  if (!inv) { Utils.toast('Nota tidak ditemukan', 'danger'); return; }

  const { fmt, fmtNum } = Utils;
  const defInvoiceNotes = await DB.getSetting('default_notes_invoice', '');
  const displayNotes = inv.notes ? inv.notes : defInvoiceNotes;
  const custName  = inv.customer?.name || inv.customer_name_manual || '—';
  const custPhone = inv.customer?.phone || '';
  const custAddr  = inv.customer?.address || '';

  const itemsHtml = (inv.items||[]).map((item, i) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0">${i+1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:500">${item.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center">${item.qty}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right">Rp ${fmtNum(item.price||0)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">Rp ${fmtNum(item.subtotal||0)}</td>
    </tr>`).join('');

  const statusColor  = inv.status==='lunas' ? '#15803d' : '#b91c1c';
  const statusLabel  = inv.status==='lunas' ? 'LUNAS' : 'KREDIT / BELUM BAYAR';
  const statusBg     = inv.status==='lunas' ? '#dcfce7' : '#fee2e2';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.no_nota}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; background:#f5f5f5; color:#111; }
    .page {
      width: 210mm; min-height: 297mm;
      margin: 0 auto; background: white;
      padding: 14mm 16mm;
      box-shadow: 0 2px 16px rgba(0,0,0,0.12);
    }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .store-name { font-size:24px; font-weight:800; color:#1a1a2e; letter-spacing:-0.5px; }
    .store-info { font-size:12px; color:#666; margin-top:4px; line-height:1.6; }
    .invoice-badge {
      text-align:right;
    }
    .invoice-label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; }
    .invoice-no { font-size:22px; font-weight:800; color:#4f46e5; margin: 4px 0; }
    .status-pill {
      display:inline-block; padding:4px 12px; border-radius:99px;
      font-size:12px; font-weight:700;
      background:${statusBg}; color:${statusColor};
      border: 1px solid ${statusColor}33;
    }
    .divider { border: none; border-top: 2px solid #1a1a2e; margin: 16px 0; }
    .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
    .meta-box { padding:14px; background:#f8f8fc; border-radius:8px; }
    .meta-label { font-size:10px; color:#888; text-transform:uppercase; letter-spacing:0.8px; font-weight:600; margin-bottom:6px; }
    .meta-value { font-size:13px; font-weight:500; line-height:1.5; }
    table { width:100%; border-collapse:collapse; margin-bottom:0; }
    thead th {
      background:#1a1a2e; color:white;
      padding:10px 14px; font-size:11px; font-weight:600;
      text-align:left; text-transform:uppercase; letter-spacing:0.5px;
    }
    thead th:nth-child(3),thead th:nth-child(4),thead th:nth-child(5) { text-align:right; }
    tbody tr:nth-child(even) { background:#fafafa; }
    .totals { display:flex; justify-content:flex-end; margin-top:12px; }
    .totals-box { min-width:260px; }
    .tot-row { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; border-bottom:1px solid #eee; }
    .tot-row.grand { font-size:16px; font-weight:800; color:#4f46e5; border-bottom:none; padding:10px 0 4px; }
    .footer-note { margin-top:24px; padding:14px; background:#f8f8fc; border-radius:8px; font-size:12px; color:#555; }
    .footer-sig { margin-top:40px; display:flex; justify-content:space-between; font-size:12px; }
    .sig-box { text-align:center; }
    .sig-line { border-top:1px solid #aaa; padding-top:6px; margin-top:40px; width:140px; }
    .print-footer { margin-top:20px; text-align:center; font-size:10px; color:#bbb; }
    @media print {
      body { background:white; }
      .page { box-shadow:none; margin:0; padding:10mm 14mm; }
      @page { size:A4; margin:0; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="store-name">${inv.store.name}</div>
      <div class="store-info">
        ${inv.store.address ? inv.store.address + '<br>' : ''}
        ${inv.store.phone ? 'Telp: ' + inv.store.phone : ''}
        ${inv.store.tagline ? '<br><em>' + inv.store.tagline + '</em>' : ''}
      </div>
    </div>
    <div class="invoice-badge">
      <div class="invoice-label">Invoice / Nota</div>
      <div class="invoice-no">#${inv.no_nota}</div>
      <div class="status-pill">${statusLabel} ${inv.payment_method ? `(${inv.payment_method})` : ''}</div>
    </div>
  </div>

  <hr class="divider">

  <!-- Meta Info -->
  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-label">Kepada</div>
      <div class="meta-value">
        <strong>${custName}</strong>
        ${custPhone ? '<br>📞 '+custPhone : ''}
        ${custAddr  ? '<br>📍 '+custAddr  : ''}
      </div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Detail Invoice</div>
      <div class="meta-value">
        <strong>Tanggal:</strong> ${Utils.fmtDateLong(inv.date)}<br>
        ${inv.time ? '<strong>Waktu:</strong> ' + inv.time + '<br>' : ''}
        <strong>No. Nota:</strong> ${inv.no_nota}
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th style="width:45%">Nama Barang / Jasa</th>
        <th style="width:10%;text-align:center">Qty</th>
        <th style="width:20%;text-align:right">Harga Satuan</th>
        <th style="width:20%;text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-box">
      <div class="tot-row"><span>Subtotal</span><span>Rp ${fmtNum(inv.subtotal||0)}</span></div>
      ${(inv.discount||0)>0 ? `<div class="tot-row"><span>Diskon</span><span>- Rp ${fmtNum(inv.discount)}</span></div>` : ''}
      <div class="tot-row grand"><span>TOTAL</span><span>Rp ${fmtNum(inv.grand_total||0)}</span></div>
    </div>
  </div>

  ${displayNotes ? `<div class="footer-note"><strong>Catatan:</strong><br>${displayNotes.replace(/\n/g, '<br>')}</div>` : ''}

  <!-- Signature -->
  <div class="footer-sig">
    <div class="sig-box">
      <div>Pelanggan,</div>
      <div class="sig-line">${custName}</div>
    </div>
    <div class="sig-box">
      <div>Hormat Kami,</div>
      <div class="sig-line">${inv.store.name}</div>
    </div>
  </div>

  <div class="print-footer">
    Dokumen ini dicetak pada ${new Date().toLocaleString('id-ID')} • ${inv.store.name}
  </div>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=850,height=1000');
  win.document.write(html);
  win.document.close();
}

window.printStruk      = printStruk;
window.printInvoiceA4  = printInvoiceA4;
