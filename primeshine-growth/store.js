const OS_KEY = 'primeshine_os_v1';
const JOBS_LEGACY_KEY = 'primeshine_jobs_v1';
const UNLOCK_KEY = 'primeshine_os_unlock';

function osId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultOs() {
  return {
    clients: [],
    expenses: [],
    leads: [],
    settings: { pinHash: '', reviewUrl: '', ownerName: 'Charles' },
  };
}

function loadLegacyJobs() {
  try {
    const raw = localStorage.getItem(JOBS_LEGACY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function normalizeJob(job) {
  return {
    paid: false,
    paidAmount: 0,
    paidMethod: '',
    reviewAsked: false,
    reviewReceived: false,
    monthlyOffered: false,
    clientId: null,
    source: '',
    ...job,
  };
}

function loadOs() {
  let os = defaultOs();
  try {
    const raw = localStorage.getItem(OS_KEY);
    if (raw) os = { ...defaultOs(), ...JSON.parse(raw) };
  } catch (e) {}
  if (!Array.isArray(os.clients)) os.clients = [];
  if (!Array.isArray(os.expenses)) os.expenses = [];
  if (!Array.isArray(os.leads)) os.leads = [];
  os.settings = { pinHash: '', reviewUrl: '', ownerName: 'Charles', ...(os.settings || {}) };
  return os;
}

const os = loadOs();
const jobs = loadLegacyJobs().map(normalizeJob);
const listeners = [];

function persistJobs() {
  try { localStorage.setItem(JOBS_LEGACY_KEY, JSON.stringify(jobs)); } catch (e) {}
}

function persistOs() {
  try { localStorage.setItem(OS_KEY, JSON.stringify(os)); } catch (e) {}
}

function emit() {
  persistJobs();
  persistOs();
  syncPlanMoney();
  listeners.forEach((fn) => { try { fn(); } catch (e) {} });
}

function weekBounds(iso) {
  const { y, m, d } = (function parse(isoDate) {
    const [yy, mm, dd] = isoDate.split('-').map(Number);
    return { y: yy, m: mm, d: dd };
  })(iso);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  const start = new Date(dt);
  start.setDate(dt.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

function collectedRevenue() {
  return jobs.filter((j) => j.paid).reduce((sum, j) => sum + (Number(j.paidAmount || j.price) || 0), 0);
}

function doneJobCount() {
  return jobs.filter((j) => j.done).length;
}

function reviewCount() {
  return jobs.filter((j) => j.reviewReceived).length;
}

function expenseTotal() {
  return os.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

function syncPlanMoney() {
  if (typeof state === 'undefined') return;
  state.revenue = collectedRevenue();
  state.jobs = doneJobCount();
  state.reviews = reviewCount();
  if (typeof saveState === 'function') saveState();
  if (typeof updateDashboard === 'function') {
    try { updateDashboard(); } catch (e) {}
  }
}

function upsertClient({ name, phone, address, source }) {
  const cleanName = (name || '').trim();
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanName && !cleanPhone) return null;
  let client = os.clients.find((c) => {
    const p = (c.phone || '').replace(/\D/g, '');
    if (cleanPhone && p && p === cleanPhone) return true;
    return cleanName && c.name.toLowerCase() === cleanName.toLowerCase();
  });
  if (!client) {
    client = { id: osId('cli'), name: cleanName || 'Client', phone: phone || '', address: address || '', source: source || '', notes: '', createdAt: new Date().toISOString() };
    os.clients.push(client);
  } else {
    if (cleanName) client.name = cleanName;
    if (phone) client.phone = phone;
    if (address) client.address = address;
    if (source && !client.source) client.source = source;
  }
  persistOs();
  return client;
}

function clientJobs(clientId, name, phone) {
  const p = (phone || '').replace(/\D/g, '');
  return jobs.filter((j) => j.clientId === clientId || (name && j.name === name) || (p && (j.phone || '').replace(/\D/g, '') === p))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function hashPin(pin) {
  const text = `primeshine-pin:${pin}`;
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return btoa(text);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

window.PrimeStore = {
  jobs,
  os,
  onChange(fn) { listeners.push(fn); },
  persist: emit,
  upsertClient,
  clientJobs,
  collectedRevenue,
  doneJobCount,
  reviewCount,
  expenseTotal,
  hashPin,
  weekBounds,
  todayIso() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  },
  addExpense(expense) {
    os.expenses.push({ id: osId('exp'), date: this.todayIso(), category: 'other', amount: 0, notes: '', ...expense });
    emit();
  },
  deleteExpense(id) {
    os.expenses = os.expenses.filter((e) => e.id !== id);
    emit();
  },
  addLead(lead) {
    os.leads.push({ id: osId('lead'), name: '', phone: '', source: 'other', status: 'lead', notes: '', createdAt: new Date().toISOString(), ...lead });
    emit();
    return os.leads[os.leads.length - 1];
  },
  updateLead(id, patch) {
    const lead = os.leads.find((l) => l.id === id);
    if (!lead) return;
    Object.assign(lead, patch);
    emit();
  },
  deleteLead(id) {
    os.leads = os.leads.filter((l) => l.id !== id);
    emit();
  },
  collectJob(id, { amount, method }) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    job.done = true;
    job.paid = true;
    job.paidAmount = Number(amount) || Number(job.price) || 0;
    job.paidMethod = method || 'cash';
    emit();
  },
  markReview(id, received) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    job.reviewAsked = true;
    job.reviewReceived = !!received;
    emit();
  },
  pipeline() {
    const today = this.todayIso();
    return {
      leads: os.leads.filter((l) => l.status === 'lead'),
      booked: jobs.filter((j) => !j.done && j.date >= today),
      overdue: jobs.filter((j) => !j.done && j.date < today),
      unpaid: jobs.filter((j) => j.done && !j.paid),
      paid: jobs.filter((j) => j.paid),
      needReview: jobs.filter((j) => j.done && !j.reviewReceived),
      monthlyDue: jobs.filter((j) => j.kind === 'monthly' && !j.done && j.date >= today).slice(0, 12),
    };
  },
  weekMoney() {
    const today = this.todayIso();
    const { start, end } = weekBounds(today);
    const inWeek = jobs.filter((j) => j.paid && j.date >= start && j.date <= end)
      .reduce((sum, j) => sum + (Number(j.paidAmount || j.price) || 0), 0);
    const outWeek = os.expenses.filter((e) => e.date >= start && e.date <= end)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { start, end, inWeek, outWeek, net: inWeek - outWeek };
  },
  async setPin(pin) {
    os.settings.pinHash = pin ? await hashPin(pin) : '';
    persistOs();
  },
  async checkPin(pin) {
    if (!os.settings.pinHash) return true;
    return (await hashPin(pin)) === os.settings.pinHash;
  },
  hasPin() { return !!os.settings.pinHash; },
  isUnlocked() {
    if (!os.settings.pinHash) return true;
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  },
  unlock() { sessionStorage.setItem(UNLOCK_KEY, '1'); },
  lock() { sessionStorage.removeItem(UNLOCK_KEY); },
  exportCsv() {
    const jobRows = [['Date', 'Name', 'Phone', 'Service', 'Kind', 'Price', 'Done', 'Paid', 'Paid amount', 'Method', 'Review']];
    jobs.forEach((j) => jobRows.push([j.date, j.name, j.phone, j.service, j.kind, j.price, j.done, j.paid, j.paidAmount || '', j.paidMethod || '', j.reviewReceived]));
    const clientRows = [['Name', 'Phone', 'Address', 'Source', 'Notes']];
    os.clients.forEach((c) => clientRows.push([c.name, c.phone, c.address || '', c.source || '', c.notes || '']));
    const moneyRows = [['Type', 'Date', 'Label', 'Amount', 'Notes']];
    jobs.filter((j) => j.paid).forEach((j) => moneyRows.push(['income', j.date, j.name, j.paidAmount || j.price, j.paidMethod]));
    os.expenses.forEach((e) => moneyRows.push(['expense', e.date, e.category, e.amount, e.notes]));
    return {
      jobs: toCsv(jobRows),
      clients: toCsv(clientRows),
      money: toCsv(moneyRows),
    };
  },
  exportJson() {
    return JSON.stringify({ os, jobs, exportedAt: new Date().toISOString() }, null, 2);
  },
};
