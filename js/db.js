// ============================================================
//  db.js — Supabase Client SDK Integration
// ============================================================

const SUPABASE_URL = 'PASTE_SUPABASE_URL_KAMU_DI_SINI';
const SUPABASE_KEY = 'PASTE_SUPABASE_ANON_KEY_KAMU_DI_SINI';

// Inisialisasi Supabase Client
const db = (typeof supabase !== 'undefined' && supabase.createClient)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// Expose client ke window agar bisa diakses langsung jika diperlukan
window.db = db;

// Dummy / No-op function for openDB to maintain backwards compatibility
async function openDB() {
  return db;
}

// ---- Generic CRUD Supabase ----

// GET ALL: await db.from('nama_tabel').select('*')
async function dbGetAll(storeName) {
  if (!db) {
    console.error('Supabase Client belum dikonfigurasi. Harap isi SUPABASE_URL & SUPABASE_KEY di js/db.js.');
    return [];
  }
  const { data, error } = await db.from(storeName).select('*');
  if (error) {
    console.error(`Supabase error [getAll ${storeName}]:`, error);
    return [];
  }
  return data || [];
}

// GET BY ID: await db.from('nama_tabel').select('*').eq('id', id).single()
async function dbGet(storeName, id) {
  if (!db) return null;
  const keyField = storeName === 'settings' ? 'key' : 'id';
  const { data, error } = await db.from(storeName).select('*').eq(keyField, id).maybeSingle();
  if (error) {
    console.error(`Supabase error [get ${storeName} ${id}]:`, error);
    return null;
  }
  return data;
}

// PUT / INSERT / UPDATE: await db.from('nama_tabel').insert(...) / .update(...) / .upsert(...)
async function dbPut(storeName, record) {
  if (!db) return record;
  const payload = { ...record };
  payload.updated_at = new Date().toISOString();
  if (!payload.created_at) payload.created_at = payload.updated_at;

  if (storeName === 'settings') {
    const { data, error } = await db.from('settings').upsert({ key: payload.key, value: payload.value, updated_at: payload.updated_at }).select();
    if (error) {
      console.error(`Supabase error [put settings]:`, error);
      throw error;
    }
    return data ? data[0] : payload;
  }

  // Check if updating existing record or inserting new record
  if (payload.id) {
    const { data, error } = await db.from(storeName).upsert(payload).select();
    if (error) {
      console.error(`Supabase error [upsert ${storeName}]:`, error);
      throw error;
    }
    return data && data.length > 0 ? data[0] : payload;
  } else {
    delete payload.id; // Let Supabase auto-generate ID
    const { data, error } = await db.from(storeName).insert(payload).select();
    if (error) {
      console.error(`Supabase error [insert ${storeName}]:`, error);
      throw error;
    }
    return data && data.length > 0 ? data[0] : payload;
  }
}

// DELETE: await db.from('nama_tabel').delete().eq('id', id)
async function dbDelete(storeName, id) {
  if (!db) return;
  const keyField = storeName === 'settings' ? 'key' : 'id';
  const { data, error } = await db.from(storeName).delete().eq(keyField, id);
  if (error) {
    console.error(`Supabase error [delete ${storeName} ${id}]:`, error);
    throw error;
  }
  return data;
}

// GET BY INDEX / EQUAL FILTER
async function dbGetByIndex(storeName, indexName, value) {
  if (!db) return [];
  const { data, error } = await db.from(storeName).select('*').eq(indexName, value);
  if (error) {
    console.error(`Supabase error [getByIndex ${storeName} ${indexName}=${value}]:`, error);
    return [];
  }
  return data || [];
}

// ---- Settings helpers ----
async function getSetting(key, defaultVal = null) {
  if (!db) return defaultVal;
  const { data, error } = await db.from('settings').select('value').eq('key', key).maybeSingle();
  if (error || !data) return defaultVal;
  return data.value;
}

async function setSetting(key, value) {
  if (!db) return;
  const { data, error } = await db.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }).select();
  if (error) {
    console.error(`Supabase error [setSetting ${key}]:`, error);
  }
  return data;
}

// ---- Invoice: auto-generate next no_nota ----
async function getNextNoNota(prefix = 'INV') {
  const today  = new Date();
  const yy     = today.getFullYear();
  const mm     = String(today.getMonth()+1).padStart(2,'0');
  const all    = await dbGetAll('invoices');
  const thisMonth = all.filter(i => i.no_nota && i.no_nota.startsWith(`${prefix}-${yy}${mm}`));
  const nums   = thisMonth.map(i => {
    const parts = i.no_nota.split('-');
    return parseInt(parts[parts.length-1]) || 0;
  });
  const next   = nums.length ? Math.max(...nums)+1 : 1;
  return `${prefix}-${yy}${mm}-${String(next).padStart(4,'0')}`;
}

// ---- Invoice: getAll with customer name joined ----
async function getInvoicesRich() {
  const [invoices, customers] = await Promise.all([dbGetAll('invoices'), dbGetAll('customers')]);
  const custMap = {};
  customers.forEach(c => custMap[c.id] = c);
  return invoices.map(inv => ({
    ...inv,
    customer: custMap[inv.customer_id] || null,
    customer_name: custMap[inv.customer_id]?.name || inv.customer_name_manual || '—',
  })).sort((a,b) => new Date(b.date+' '+(b.time||'00:00')) - new Date(a.date+' '+(a.time||'00:00')));
}

// ---- Customers: total piutang ----
async function getCustomersWithDebt() {
  const [customers, invoices] = await Promise.all([dbGetAll('customers'), dbGetAll('invoices')]);
  return customers.map(c => {
    const debts = invoices.filter(i => i.customer_id === c.id && i.status === 'kredit');
    const totalDebt = debts.reduce((s,i) => s + (i.grand_total||0), 0);
    return { ...c, total_debt: totalDebt, debt_count: debts.length };
  });
}

async function updateProductStock(productId, changeQty) {
  const p = await dbGet('products', productId);
  if (!p) return;
  p.stock = (p.stock || 0) + changeQty;
  await dbPut('products', p);
}

function closeDB() {
  // No-op for Supabase
}

window.DB = {
  openDB, dbGetAll, dbGet, dbPut, dbDelete, dbGetByIndex,
  getSetting, setSetting, getNextNoNota, getInvoicesRich, getCustomersWithDebt, updateProductStock, closeDB,
};
