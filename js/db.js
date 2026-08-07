// ============================================================
//  db.js — IndexedDB Wrapper
// ============================================================

const DB_NAME    = 'InvoiceAppDB';
const DB_VERSION = 3;

let _db = null;

const STORES = {
  invoices:  { keyPath: 'id', indexes: [['no_nota','no_nota',{unique:true}],['date','date',{}],['status','status',{}],['customer_id','customer_id',{}]] },
  customers: { keyPath: 'id', indexes: [['name','name',{}]] },
  products:  { keyPath: 'id', indexes: [['name','name',{}]] },
  settings:  { keyPath: 'key' },
  stock_movements: { keyPath: 'id', indexes: [['product_id', 'product_id', {}], ['date', 'date', {}], ['type', 'type', {}]] },
  expenses:  { keyPath: 'id', indexes: [['date', 'date', {}]] },
};

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      for (const [storeName, config] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: config.keyPath, autoIncrement: true });
          (config.indexes || []).forEach(([name, keyPath, opts]) => store.createIndex(name, keyPath, opts));
        }
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// ---- Generic CRUD ----
async function dbGetAll(storeName) {
  const store = await getStore(storeName);
  return promisify(store.getAll());
}

async function dbGet(storeName, id) {
  const store = await getStore(storeName);
  return promisify(store.get(id));
}

async function dbPut(storeName, record) {
  const store = await getStore(storeName, 'readwrite');
  if (!record.id) record.id = Date.now() + Math.random();
  record.updated_at = new Date().toISOString();
  if (!record.created_at) record.created_at = record.updated_at;
  return promisify(store.put(record));
}

async function dbDelete(storeName, id) {
  const store = await getStore(storeName, 'readwrite');
  return promisify(store.delete(id));
}

async function dbGetByIndex(storeName, indexName, value) {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return promisify(index.getAll(value));
}

// ---- Settings helpers ----
async function getSetting(key, defaultVal = null) {
  const db    = await openDB();
  const store = db.transaction('settings', 'readonly').objectStore('settings');
  const val   = await promisify(store.get(key));
  return val ? val.value : defaultVal;
}

async function setSetting(key, value) {
  const db    = await openDB();
  const store = db.transaction('settings', 'readwrite').objectStore('settings');
  return promisify(store.put({ key, value }));
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
  if (_db) {
    _db.close();
    _db = null;
  }
}

window.DB = {
  openDB, dbGetAll, dbGet, dbPut, dbDelete, dbGetByIndex,
  getSetting, setSetting, getNextNoNota, getInvoicesRich, getCustomersWithDebt, updateProductStock, closeDB,
};
