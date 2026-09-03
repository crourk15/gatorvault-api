const JOBS_KEY = 'primeshine_jobs_v1';

const JOB_SERVICES = [
  { id: 'exterior', label: 'Exterior Only', price: 60 },
  { id: 'interior', label: 'Interior Only', price: 80 },
  { id: 'full', label: 'Full Detail', price: 140 },
  { id: 'monthly', label: 'Monthly maintenance', price: 55 },
  { id: 'custom', label: 'Custom / quote', price: 0 },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toIsoDate(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function todayIso() {
  const n = new Date();
  return toIsoDate(n.getFullYear(), n.getMonth(), n.getDate());
}

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function addMonthsIso(iso, count) {
  const { y, m, d } = parseIso(iso);
  const dt = new Date(y, m - 1 + count, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  return toIsoDate(dt.getFullYear(), dt.getMonth(), Math.min(d, last));
}

function loadJobs() {
  if (window.PrimeStore && Array.isArray(PrimeStore.jobs)) return PrimeStore.jobs;
  try {
    const saved = localStorage.getItem(JOBS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveJobs() {
  if (window.PrimeStore && typeof PrimeStore.persist === 'function') {
    PrimeStore.persist();
    return;
  }
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  } catch (e) {}
}

function newId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultPrice(serviceId) {
  return (JOB_SERVICES.find((s) => s.id === serviceId) || {}).price || 0;
}

function serviceLabel(serviceId) {
  return (JOB_SERVICES.find((s) => s.id === serviceId) || {}).label || serviceId;
}

function kindLabel(kind) {
  if (kind === 'monthly') return 'Monthly';
  if (kind === 'new') return 'New client';
  return 'One-time';
}

let jobs = loadJobs();
let calCursor = new Date();
calCursor.setDate(1);
let selectedIso = todayIso();

function jobsOn(iso) {
  return jobs
    .filter((j) => j.date === iso)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

function monthJobs(year, monthIndex) {
  const prefix = `${year}-${pad2(monthIndex + 1)}-`;
  return jobs.filter((j) => j.date.startsWith(prefix));
}

function upcomingJobs(days) {
  const start = todayIso();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  const end = toIsoDate(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return jobs
    .filter((j) => !j.done && j.date >= start && j.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
}

function overdueJobs() {
  const start = todayIso();
  return jobs
    .filter((j) => !j.done && j.date < start)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function refreshIcons() {
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function renderCalHeader() {
  const label = calCursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const el = document.getElementById('cal-month-label');
  if (el) el.textContent = label;
}

function renderCalGrid() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayIso();
  let html = '';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => {
    html += `<div class="text-center text-[10px] uppercase tracking-wide text-slate-500 py-1">${d}</div>`;
  });
  for (let i = 0; i < firstDow; i += 1) {
    html += '<div></div>';
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toIsoDate(year, month, day);
    const dayJobs = jobsOn(iso);
    const isToday = iso === today;
    const isSelected = iso === selectedIso;
    let cls = 'cal-day min-h-[52px] rounded-lg p-1 text-left border border-transparent';
    if (isSelected) cls += ' cal-day-selected';
    else if (isToday) cls += ' cal-day-today';
    else cls += ' bg-navy-800/60 hover:border-white/20';
    const dots = dayJobs.slice(0, 3).map((j) => {
      const color = j.kind === 'monthly' ? 'bg-green-400' : j.kind === 'new' ? 'bg-gold-400' : 'bg-sky-400';
      return `<span class="inline-block w-1.5 h-1.5 rounded-full ${color}"></span>`;
    }).join('');
    html += `<button type="button" class="${cls}" data-cal-date="${iso}">
      <span class="text-xs font-semibold ${isToday ? 'text-sky-400' : 'text-white'}">${day}</span>
      <div class="flex gap-0.5 mt-1 flex-wrap">${dots}</div>
      ${dayJobs.length > 3 ? `<span class="text-[10px] text-slate-500">+${dayJobs.length - 3}</span>` : ''}
    </button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('[data-cal-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedIso = btn.getAttribute('data-cal-date');
      renderCalGrid();
      renderDayPanel();
    });
  });
}

function jobCard(job) {
  const doneCls = job.done ? 'opacity-60' : '';
  const kindCls = job.kind === 'monthly' ? 'bg-green-500/20 text-green-400' : job.kind === 'new' ? 'bg-gold-500/20 text-gold-400' : 'bg-sky-500/20 text-sky-400';
  return `<article class="bg-navy-800/80 border border-white/10 rounded-lg p-3 ${doneCls}" data-job-id="${job.id}">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-white font-semibold truncate">${escapeHtml(job.name)}</p>
        <p class="text-xs text-slate-400">${job.time ? escapeHtml(job.time) + ' · ' : ''}${escapeHtml(serviceLabel(job.service))} · $${Number(job.price) || 0}</p>
        ${job.phone ? `<p class="text-xs text-slate-500 mt-0.5">${escapeHtml(job.phone)}</p>` : ''}
        ${job.notes ? `<p class="text-xs text-slate-400 mt-1">${escapeHtml(job.notes)}</p>` : ''}
      </div>
      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${kindCls} shrink-0">${kindLabel(job.kind)}</span>
    </div>
    <div class="flex flex-wrap gap-2 mt-3">
      <button type="button" class="job-done text-xs font-semibold px-3 py-2 rounded-lg bg-navy-700 text-white min-h-[40px]" data-job-id="${job.id}">${job.done ? 'Undo done' : 'Mark done'}</button>
      <button type="button" class="job-ics text-xs font-semibold px-3 py-2 rounded-lg bg-sky-500/20 text-sky-400 min-h-[40px]" data-job-id="${job.id}">Add to phone calendar</button>
      <button type="button" class="job-del text-xs font-semibold px-3 py-2 rounded-lg bg-red-900/30 text-red-400 min-h-[40px]" data-job-id="${job.id}">Delete</button>
    </div>
  </article>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDayPanel() {
  const list = document.getElementById('cal-day-jobs');
  const label = document.getElementById('cal-day-label');
  const dateInput = document.getElementById('job-date');
  if (label) {
    const { y, m, d } = parseIso(selectedIso);
    const pretty = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    label.textContent = pretty;
  }
  if (dateInput) dateInput.value = selectedIso;
  if (!list) return;
  const dayJobs = jobsOn(selectedIso);
  list.innerHTML = dayJobs.length
    ? dayJobs.map(jobCard).join('')
    : '<p class="text-sm text-slate-500">No jobs on this day yet. Add one below.</p>';
  bindJobButtons(list);
  renderLists();
  renderCalStats();
}

function renderLists() {
  const up = document.getElementById('cal-upcoming');
  const over = document.getElementById('cal-overdue');
  if (up) {
    const rows = upcomingJobs(21);
    up.innerHTML = rows.length
      ? rows.map((j) => `<li class="text-sm text-slate-300 py-1.5 border-b border-white/5"><span class="text-gold-400 font-semibold">${j.date.slice(5)}</span> · ${escapeHtml(j.name)} · ${escapeHtml(serviceLabel(j.service))} · ${kindLabel(j.kind)}</li>`).join('')
      : '<li class="text-sm text-slate-500">Nothing on the books in the next 3 weeks.</li>';
  }
  if (over) {
    const rows = overdueJobs();
    over.innerHTML = rows.length
      ? rows.map((j) => `<li class="text-sm text-red-300 py-1.5 border-b border-white/5">${j.date} · ${escapeHtml(j.name)} · ${kindLabel(j.kind)}</li>`).join('')
      : '<li class="text-sm text-slate-500">No overdue jobs.</li>';
  }
}

function renderCalStats() {
  const month = monthJobs(calCursor.getFullYear(), calCursor.getMonth());
  const booked = document.getElementById('cal-stat-booked');
  const monthly = document.getElementById('cal-stat-monthly');
  const news = document.getElementById('cal-stat-new');
  const money = document.getElementById('cal-stat-money');
  if (booked) booked.textContent = String(month.length);
  if (monthly) monthly.textContent = String(month.filter((j) => j.kind === 'monthly').length);
  if (news) news.textContent = String(month.filter((j) => j.kind === 'new').length);
  if (money) {
    const sum = month.reduce((acc, j) => acc + (Number(j.price) || 0), 0);
    money.textContent = `$${sum}`;
  }
}

function bindJobButtons(root) {
  root.querySelectorAll('.job-done').forEach((btn) => {
    btn.addEventListener('click', () => toggleDone(btn.getAttribute('data-job-id')));
  });
  root.querySelectorAll('.job-del').forEach((btn) => {
    btn.addEventListener('click', () => deleteJob(btn.getAttribute('data-job-id')));
  });
  root.querySelectorAll('.job-ics').forEach((btn) => {
    btn.addEventListener('click', () => downloadIcs(btn.getAttribute('data-job-id')));
  });
}

function toggleDone(id) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  job.done = !job.done;
  if (job.done) {
    document.dispatchEvent(new CustomEvent('primeshine:job-done', { detail: { id: job.id } }));
  }
  if (job.done && job.kind === 'monthly') {
    const next = addMonthsIso(job.date, 1);
    const exists = jobs.some((j) => j.seriesId && j.seriesId === job.seriesId && j.date === next);
    if (!exists) {
      jobs.push({
        ...job,
        id: newId(),
        date: next,
        done: false,
        seriesId: job.seriesId || job.id,
      });
      job.seriesId = job.seriesId || job.id;
    }
  }
  saveJobs();
  renderCalGrid();
  renderDayPanel();
}

function deleteJob(id) {
  const next = jobs.filter((j) => j.id !== id);
  jobs.splice(0, jobs.length, ...next);
  saveJobs();
  renderCalGrid();
  renderDayPanel();
}

function icsStamp(iso, time) {
  const compactDate = iso.replace(/-/g, '');
  const hhmm = (time || '09:00').replace(':', '');
  return `${compactDate}T${hhmm}00`;
}

function downloadIcs(id) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  const start = icsStamp(job.date, job.time || '09:00');
  const [hh, mm] = (job.time || '09:00').split(':').map(Number);
  const endH = pad2(Math.min(23, (hh || 9) + 3));
  const end = `${job.date.replace(/-/g, '')}T${endH}${pad2(mm || 0)}00`;
  const summary = `PrimeShine — ${job.name} (${serviceLabel(job.service)})`;
  const desc = [kindLabel(job.kind), job.phone, job.notes, 'primeshinefl.com/booking'].filter(Boolean).join(' · ');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PrimeShine//Owner Jobs//EN',
    'BEGIN:VEVENT',
    `UID:${job.id}@primeshinefl.com`,
    `DTSTART;TZID=America/New_York:${start}`,
    `DTEND;TZID=America/New_York:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `primeshine-${job.date}-${job.name.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function addJobFromForm(event) {
  event.preventDefault();
  const name = document.getElementById('job-name').value.trim();
  const date = document.getElementById('job-date').value || selectedIso || todayIso();
  if (!name) return;
  const service = document.getElementById('job-service').value;
  const kind = document.getElementById('job-kind').value;
  const priceRaw = document.getElementById('job-price').value;
  const job = {
    id: newId(),
    seriesId: null,
    name,
    phone: document.getElementById('job-phone').value.trim(),
    date,
    time: document.getElementById('job-time').value,
    service,
    price: priceRaw === '' ? defaultPrice(service) : Number(priceRaw),
    kind,
    notes: document.getElementById('job-notes').value.trim(),
    done: false,
    paid: false,
    paidAmount: 0,
    paidMethod: '',
    reviewAsked: false,
    reviewReceived: false,
  };
  const created = [job];
  if (kind === 'monthly') {
    job.seriesId = job.id;
    for (let i = 1; i <= 5; i += 1) {
      created.push({
        ...job,
        id: newId(),
        seriesId: job.id,
        date: addMonthsIso(date, i),
        done: false,
      });
    }
  }
  jobs.push(...created);
  if (window.PrimeStore) {
    const client = PrimeStore.upsertClient({ name, phone: job.phone, address: job.notes, source: kind === 'new' ? 'new' : '' });
    created.forEach((row) => { row.clientId = client ? client.id : null; });
  }
  saveJobs();
  selectedIso = date;
  const { y, m } = parseIso(date);
  calCursor = new Date(y, m - 1, 1);
  document.getElementById('job-form').reset();
  document.getElementById('job-date').value = date;
  document.getElementById('job-service').value = service;
  renderCalHeader();
  renderCalGrid();
  renderDayPanel();
}

function bindCalendar() {
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalHeader();
    renderCalGrid();
    renderCalStats();
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalHeader();
    renderCalGrid();
    renderCalStats();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    const n = new Date();
    calCursor = new Date(n.getFullYear(), n.getMonth(), 1);
    selectedIso = todayIso();
    renderCalHeader();
    renderCalGrid();
    renderDayPanel();
  });
  document.getElementById('job-service')?.addEventListener('change', (e) => {
    const price = document.getElementById('job-price');
    if (price && (price.value === '' || JOB_SERVICES.some((s) => String(s.price) === price.value))) {
      price.value = defaultPrice(e.target.value);
    }
  });
  document.getElementById('job-kind')?.addEventListener('change', (e) => {
    const service = document.getElementById('job-service');
    if (e.target.value === 'monthly' && service) {
      service.value = 'monthly';
      const price = document.getElementById('job-price');
      if (price) price.value = 55;
    }
  });
  document.getElementById('job-form')?.addEventListener('submit', addJobFromForm);
}

function initCalendar() {
  if (!document.getElementById('calendar-sec')) return;
  bindCalendar();
  renderCalHeader();
  renderCalGrid();
  renderDayPanel();
  refreshIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalendar);
} else {
  initCalendar();
}
