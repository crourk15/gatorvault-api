function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function telHref(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `tel:${d}` : '';
}

function smsHref(phone, body) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  return `sms:${d}&body=${encodeURIComponent(body || '')}`;
}

function reviewScript(name) {
  const url = PrimeStore.os.settings.reviewUrl || 'your Google review link';
  return `Hey ${name || 'there'}, thanks so much for booking PrimeShine! If you have 2 minutes, a Google review would mean the world: ${url}`;
}

function monthlyScript(name) {
  return `Hey ${name || 'there'} — want me on a monthly plan? $55/month, I come to you, same week each month. Reply YES and I’ll lock your day.`;
}

function moneyMove() {
  const pipe = PrimeStore.pipeline();
  if (pipe.unpaid.length) return `Collect payment from ${pipe.unpaid[0].name} ($${pipe.unpaid[0].price}).`;
  if (pipe.needReview.length) return `Ask ${pipe.needReview[0].name} for a Google review.`;
  const todayJobs = PrimeStore.jobs.filter((j) => j.date === PrimeStore.todayIso() && !j.done);
  if (todayJobs.length) return `Finish today’s job: ${todayJobs[0].name}.`;
  if (pipe.leads.length) return `Text lead ${pipe.leads[0].name || pipe.leads[0].phone} and get them on the calendar.`;
  if (pipe.overdue.length) return `Reschedule overdue job: ${pipe.overdue[0].name}.`;
  return 'No jobs on the books — do today’s growth tasks, then book someone.';
}

function showRoom(name) {
  document.querySelectorAll('[data-room]').forEach((el) => {
    el.classList.toggle('hidden', el.getAttribute('data-room') !== name);
  });
  document.querySelectorAll('[data-room-btn]').forEach((btn) => {
    btn.classList.toggle('dock-active', btn.getAttribute('data-room-btn') === name);
  });
  try { sessionStorage.setItem('primeshine_room', name); } catch (e) {}
  if (name === 'calendar' && typeof renderCalGrid === 'function') {
    renderCalHeader();
    renderCalGrid();
    renderDayPanel();
  }
  if (name === 'plan' && typeof renderDayCards === 'function') {
    renderWeekTheme();
    renderDayCards();
  }
  refreshOs();
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function day1Done() {
  if (typeof PLAN_DATA === 'undefined' || typeof state === 'undefined' || typeof taskKey !== 'function') return false;
  if (typeof todayDay === 'number' && todayDay > 1) return true;
  const day = PLAN_DATA.find((d) => d.day === 1);
  if (!day) return false;
  const blocks = ['morning', 'evening', 'weekend'];
  return blocks.every((block) => day[block].every((t, i) => state.tasks[taskKey(1, block, i)]));
}

function renderToday() {
  const root = document.getElementById('today-root');
  if (!root) return;
  const today = PrimeStore.todayIso();
  const day = typeof PLAN_DATA !== 'undefined' ? PLAN_DATA.find((d) => d.day === todayDay) : null;
  const tasks = [];
  if (day) {
    ['morning', 'evening', 'weekend'].forEach((block) => {
      day[block].forEach((t, i) => {
        const k = taskKey(day.day, block, i);
        tasks.push({ k, text: t.text, cat: t.cat, time: t.time, done: !!(state.tasks && state.tasks[k]), block });
      });
    });
  }
  const todaysJobs = PrimeStore.jobs.filter((j) => j.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const unpaid = PrimeStore.jobs.filter((j) => j.done && !j.paid);
  const collected = PrimeStore.collectedRevenue();
  const goal = typeof REVENUE_GOAL === 'number' ? REVENUE_GOAL : 3000;
  const pace = Math.min(100, Math.round((collected / goal) * 100));
  const week = PrimeStore.weekMoney();
  const pipe = PrimeStore.pipeline();
  const move = moneyMove();

  root.innerHTML = `
    <div class="glass-card gold-glow p-4 md:p-6 mb-4">
      <p class="text-xs uppercase tracking-widest text-gold-400 font-bold mb-1">Today</p>
      <h2 class="text-2xl font-black text-white mb-1">${day ? `Day ${day.day} · ${day.dow} ${day.date}` : today}</h2>
      <p class="text-sm text-slate-400 mb-4">${day ? (WEEK_THEMES[day.weekNum] || {}).title || '' : ''}</p>
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="bg-navy-800/80 rounded-lg p-3 text-center"><div class="text-xl font-black text-white">$${collected}</div><div class="text-[10px] text-slate-500">Collected / $${goal}</div></div>
        <div class="bg-navy-800/80 rounded-lg p-3 text-center"><div class="text-xl font-black text-gold-400">${todaysJobs.length}</div><div class="text-[10px] text-slate-500">Jobs today</div></div>
        <div class="bg-navy-800/80 rounded-lg p-3 text-center"><div class="text-xl font-black text-green-400">$${week.net}</div><div class="text-[10px] text-slate-500">This week net</div></div>
      </div>
      <div class="w-full bg-navy-800 rounded-full h-2 mb-2 overflow-hidden"><div class="h-2 bg-gradient-to-r from-gold-600 to-gold-400" style="width:${pace}%"></div></div>
      <p class="text-xs text-slate-500 mb-4">${pace}% of $3,000 from paid jobs — not a guess.</p>
      <div class="tipbox p-3 rounded-lg">
        <p class="text-xs font-bold text-gold-400 mb-1">Money move</p>
        <p class="text-sm text-white">${esc(move)}</p>
      </div>
    </div>

    <div class="glass-card p-4 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="font-bold text-white">Today’s tasks</h3>
        <button type="button" class="text-xs text-sky-400 font-semibold" data-goto="plan">Open full plan</button>
      </div>
      ${tasks.length ? tasks.map((t) => `
        <label class="flex items-start gap-3 py-2 border-b border-white/5 ${t.done ? 'task-done' : ''}">
          <input type="checkbox" class="checkbox-custom mt-0.5 today-task" data-key="${t.k}" ${t.done ? 'checked' : ''}/>
          <span class="text-sm text-slate-300 task-text">${esc(t.text)}</span>
        </label>`).join('') : '<p class="text-sm text-slate-500">Rest or no tasks loaded.</p>'}
    </div>

    <div class="glass-card p-4 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="font-bold text-white">On the driveway</h3>
        <button type="button" class="text-xs text-sky-400 font-semibold" data-goto="calendar">Calendar</button>
      </div>
      ${todaysJobs.length ? todaysJobs.map((j) => `
        <div class="py-3 border-b border-white/5">
          <p class="text-white font-semibold">${esc(j.time || '')} ${esc(j.name)} · $${j.price}</p>
          <p class="text-xs text-slate-500 mb-2">${j.done ? (j.paid ? 'Paid' : 'Done — not collected') : 'Booked'}</p>
          <div class="flex flex-wrap gap-2">
            ${j.phone ? `<a class="text-xs font-semibold px-3 py-2 rounded-lg bg-navy-800 text-white" href="${telHref(j.phone)}">Call</a>` : ''}
            ${!j.done ? `<button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-gold-500 text-navy-900" data-finish="${j.id}">Mark done</button>` : ''}
            ${j.done && !j.paid ? `<button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-gold-500 text-navy-900" data-collect="${j.id}">Collect</button>` : ''}
          </div>
        </div>`).join('') : '<p class="text-sm text-slate-500">No jobs today. Book one from Calendar or convert a lead.</p>'}
      ${unpaid.length ? `<p class="text-xs text-red-300 mt-3">${unpaid.length} job(s) finished and not collected.</p>` : ''}
      <form id="today-job-form" class="mt-4 space-y-2 bg-navy-800/50 rounded-lg p-3">
        <p class="text-xs font-bold text-gold-400">Add a job for today</p>
        <input id="today-job-name" required placeholder="Client name" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
        <input id="today-job-phone" type="tel" placeholder="Phone" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
        <div class="grid grid-cols-2 gap-2">
          <select id="today-job-service" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]">
            <option value="full">Full Detail $140</option>
            <option value="interior">Interior $80</option>
            <option value="exterior">Exterior $60</option>
            <option value="monthly">Monthly $55</option>
          </select>
          <input id="today-job-price" type="number" placeholder="Price" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
        </div>
        <button type="submit" class="w-full bg-gold-500 text-navy-900 font-bold rounded-lg py-3 min-h-[44px]">Save on today</button>
      </form>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
      ${[['Leads', pipe.leads.length], ['Booked', pipe.booked.length], ['Unpaid', pipe.unpaid.length], ['Paid', pipe.paid.length], ['Need review', pipe.needReview.length], ['Monthly due', pipe.monthlyDue.length]].map(([label, n]) => `
        <div class="bg-navy-800/70 rounded-lg p-3 text-center"><div class="text-lg font-black text-white">${n}</div><div class="text-[10px] text-slate-500">${label}</div></div>`).join('')}
    </div>
  `;

  root.querySelectorAll('.today-task').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      state.tasks[e.target.dataset.key] = e.target.checked;
      saveState();
      if (typeof updateDashboard === 'function') updateDashboard();
      if (typeof renderDayCards === 'function') renderDayCards();
      refreshOs();
    });
  });
  root.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => showRoom(btn.getAttribute('data-goto')));
  });
  root.querySelectorAll('[data-finish]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const job = PrimeStore.jobs.find((j) => j.id === btn.getAttribute('data-finish'));
      if (!job) return;
      job.done = true;
      PrimeStore.persist();
      openCollect(job.id);
    });
  });
  root.querySelectorAll('[data-collect]').forEach((btn) => {
    btn.addEventListener('click', () => openCollect(btn.getAttribute('data-collect')));
  });
  document.getElementById('today-job-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('today-job-name').value.trim();
    if (!name) return;
    const service = document.getElementById('today-job-service').value;
    const prices = { full: 140, interior: 80, exterior: 60, monthly: 55 };
    const phone = document.getElementById('today-job-phone').value.trim();
    const price = Number(document.getElementById('today-job-price').value) || prices[service] || 0;
    const client = PrimeStore.upsertClient({ name, phone, source: 'new' });
    PrimeStore.jobs.push({
      id: `job_${Date.now()}_today`,
      seriesId: null,
      clientId: client ? client.id : null,
      name,
      phone,
      date: PrimeStore.todayIso(),
      time: '09:00',
      service,
      price,
      kind: service === 'monthly' ? 'monthly' : 'new',
      notes: '',
      done: false,
      paid: false,
      paidAmount: 0,
      paidMethod: '',
      reviewAsked: false,
      reviewReceived: false,
    });
    PrimeStore.persist();
  });

  const kit = document.getElementById('day1-kit');
  if (kit) kit.classList.toggle('hidden', day1Done());
}

function renderBook() {
  const root = document.getElementById('book-root');
  if (!root) return;
  const q = (document.getElementById('book-search')?.value || '').toLowerCase();
  const clients = PrimeStore.os.clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
  const fromJobs = [];
  PrimeStore.jobs.forEach((j) => {
    if (!PrimeStore.os.clients.some((c) => c.name === j.name || (j.phone && c.phone === j.phone))) {
      if (!fromJobs.some((x) => x.name === j.name && x.phone === j.phone)) {
        fromJobs.push({ id: `ghost_${j.id}`, name: j.name, phone: j.phone, source: 'job', ghost: true });
      }
    }
  });
  const all = [...clients, ...fromJobs.filter((g) => !q || g.name.toLowerCase().includes(q))];
  root.innerHTML = all.length ? all.map((c) => {
    const hist = PrimeStore.clientJobs(c.ghost ? null : c.id, c.name, c.phone);
    const next = hist.find((j) => !j.done && j.date >= PrimeStore.todayIso());
    const last = hist.find((j) => j.done);
    return `<article class="glass-card-light p-4 mb-3">
      <div class="flex justify-between gap-2">
        <div>
          <p class="text-white font-bold">${esc(c.name)}</p>
          <p class="text-xs text-slate-500">${esc(c.phone || 'No phone')} ${c.source ? '· ' + esc(c.source) : ''}</p>
          <p class="text-xs text-slate-400 mt-1">Last: ${last ? last.date + ' · $' + (last.paidAmount || last.price) : '—'} · Next: ${next ? next.date : '—'}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        ${c.phone ? `<a class="px-3 py-2 rounded-lg bg-navy-800 text-white text-xs font-semibold min-h-[40px]" href="${telHref(c.phone)}">Call</a>` : ''}
        ${c.phone ? `<a class="px-3 py-2 rounded-lg bg-sky-500/20 text-sky-400 text-xs font-semibold min-h-[40px]" href="${smsHref(c.phone, reviewScript(c.name))}">Review text</a>` : ''}
        ${c.phone ? `<a class="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold min-h-[40px]" href="${smsHref(c.phone, monthlyScript(c.name))}">Monthly text</a>` : ''}
      </div>
    </article>`;
  }).join('') : '<p class="text-sm text-slate-500">No clients yet. Add a job on the calendar or a lead under Money.</p>';
}

function renderMoney() {
  const root = document.getElementById('money-root');
  if (!root) return;
  const collected = PrimeStore.collectedRevenue();
  const spent = PrimeStore.expenseTotal();
  const week = PrimeStore.weekMoney();
  const paid = PrimeStore.jobs.filter((j) => j.paid).sort((a, b) => b.date.localeCompare(a.date));
  const unpaid = PrimeStore.jobs.filter((j) => j.done && !j.paid);
  const expenses = PrimeStore.os.expenses.slice().sort((a, b) => b.date.localeCompare(a.date));
  root.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      <div class="glass-card-light p-3 text-center"><div class="text-xl font-black text-white">$${collected}</div><div class="text-[10px] text-slate-500">Collected</div></div>
      <div class="glass-card-light p-3 text-center"><div class="text-xl font-black text-red-300">$${spent}</div><div class="text-[10px] text-slate-500">Spent</div></div>
      <div class="glass-card-light p-3 text-center"><div class="text-xl font-black text-green-400">$${collected - spent}</div><div class="text-[10px] text-slate-500">Net all-time</div></div>
      <div class="glass-card-light p-3 text-center"><div class="text-xl font-black text-gold-400">$${week.net}</div><div class="text-[10px] text-slate-500">This week net</div></div>
    </div>
    ${unpaid.length ? `<div class="glass-card p-4 mb-4"><h3 class="font-bold text-white mb-2">Uncollected</h3>${unpaid.map((j) => `
      <div class="flex justify-between items-center py-2 border-b border-white/5">
        <span class="text-sm text-slate-300">${esc(j.date)} · ${esc(j.name)} · $${j.price}</span>
        <button type="button" class="text-xs font-bold bg-gold-500 text-navy-900 px-3 py-2 rounded-lg" data-collect="${j.id}">Collect</button>
      </div>`).join('')}</div>` : ''}
    <div class="glass-card p-4 mb-4">
      <h3 class="font-bold text-white mb-3">Add expense</h3>
      <form id="exp-form" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select id="exp-cat" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]">
          <option value="gas">Gas</option>
          <option value="supplies">Supplies</option>
          <option value="ads">Ads</option>
          <option value="other">Other</option>
        </select>
        <input id="exp-amount" type="number" min="0" step="1" required placeholder="Amount" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
        <input id="exp-date" type="date" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
        <input id="exp-notes" placeholder="Notes" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
        <button class="sm:col-span-2 bg-navy-700 text-white font-bold rounded-lg py-3 min-h-[44px]" type="submit">Save expense</button>
      </form>
      <ul class="mt-3">${expenses.slice(0, 12).map((e) => `<li class="text-sm text-slate-400 py-1 flex justify-between"><span>${esc(e.date)} · ${esc(e.category)} · ${esc(e.notes)}</span><span>$${e.amount} <button class="text-red-400" data-del-exp="${e.id}" type="button">×</button></span></li>`).join('') || '<li class="text-slate-500 text-sm">No expenses yet.</li>'}</ul>
    </div>
    <div class="glass-card p-4 mb-4">
      <h3 class="font-bold text-white mb-2">Paid jobs</h3>
      <ul>${paid.slice(0, 20).map((j) => `<li class="text-sm text-slate-300 py-1">${esc(j.date)} · ${esc(j.name)} · $${j.paidAmount || j.price} · ${esc(j.paidMethod)}</li>`).join('') || '<li class="text-slate-500 text-sm">Nothing collected yet. Mark a job done and tap Collect.</li>'}</ul>
    </div>
  `;
  document.getElementById('exp-date').value = PrimeStore.todayIso();
  document.getElementById('exp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    PrimeStore.addExpense({
      category: document.getElementById('exp-cat').value,
      amount: Number(document.getElementById('exp-amount').value) || 0,
      date: document.getElementById('exp-date').value || PrimeStore.todayIso(),
      notes: document.getElementById('exp-notes').value.trim(),
    });
  });
  root.querySelectorAll('[data-del-exp]').forEach((btn) => {
    btn.addEventListener('click', () => PrimeStore.deleteExpense(btn.getAttribute('data-del-exp')));
  });
  root.querySelectorAll('[data-collect]').forEach((btn) => {
    btn.addEventListener('click', () => openCollect(btn.getAttribute('data-collect')));
  });
}

function renderPipeline() {
  const root = document.getElementById('pipe-root');
  if (!root) return;
  const p = PrimeStore.pipeline();
  const col = (title, items, fmt) => `
    <div class="glass-card-light p-3 min-h-[120px]">
      <p class="text-xs font-bold text-gold-400 mb-2">${title} · ${items.length}</p>
      ${items.slice(0, 8).map(fmt).join('') || '<p class="text-xs text-slate-500">Empty</p>'}
    </div>`;
  root.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    ${col('Leads', p.leads, (l) => `<p class="text-sm text-white py-1">${esc(l.name || l.phone)} <span class="text-slate-500">${esc(l.source)}</span></p>`)}
    ${col('Booked', p.booked, (j) => `<p class="text-sm text-white py-1">${esc(j.date)} · ${esc(j.name)}</p>`)}
    ${col('Overdue', p.overdue, (j) => `<p class="text-sm text-red-300 py-1">${esc(j.date)} · ${esc(j.name)}</p>`)}
    ${col('Unpaid', p.unpaid, (j) => `<p class="text-sm text-gold-400 py-1">${esc(j.name)} · $${j.price}</p>`)}
    ${col('Need review', p.needReview, (j) => `<p class="text-sm text-white py-1">${esc(j.name)}</p>`)}
    ${col('Monthly coming', p.monthlyDue, (j) => `<p class="text-sm text-green-400 py-1">${esc(j.date)} · ${esc(j.name)}</p>`)}
  </div>`;
}

function renderLeadsForm() {
  const form = document.getElementById('lead-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    PrimeStore.addLead({
      name: document.getElementById('lead-name').value.trim(),
      phone: document.getElementById('lead-phone').value.trim(),
      source: document.getElementById('lead-source').value,
      notes: document.getElementById('lead-notes').value.trim(),
    });
    form.reset();
  });
}

function openCollect(id) {
  const job = PrimeStore.jobs.find((j) => j.id === id);
  if (!job) return;
  const overlay = document.getElementById('collect-overlay');
  document.getElementById('collect-name').textContent = `${job.name} · $${job.price}`;
  document.getElementById('collect-amount').value = job.price || '';
  document.getElementById('collect-method').value = job.paidMethod || 'zelle';
  overlay.dataset.jobId = id;
  overlay.classList.remove('hidden');
}

function closeCollect() {
  document.getElementById('collect-overlay')?.classList.add('hidden');
}

function refreshOs() {
  renderToday();
  renderBook();
  renderMoney();
  renderPipeline();
  renderLeadsForm();
  const hint = document.getElementById('rev-live');
  if (hint) hint.textContent = `$${PrimeStore.collectedRevenue()}`;
}

function bindOsChrome() {
  document.querySelectorAll('[data-room-btn]').forEach((btn) => {
    btn.addEventListener('click', () => showRoom(btn.getAttribute('data-room-btn')));
  });
  document.getElementById('book-search')?.addEventListener('input', renderBook);
  document.getElementById('collect-cancel')?.addEventListener('click', closeCollect);
  document.getElementById('collect-save')?.addEventListener('click', () => {
    const id = document.getElementById('collect-overlay').dataset.jobId;
    PrimeStore.collectJob(id, {
      amount: document.getElementById('collect-amount').value,
      method: document.getElementById('collect-method').value,
    });
    const ask = document.getElementById('collect-review').checked;
    if (ask) {
      PrimeStore.markReview(id, false);
      const job = PrimeStore.jobs.find((j) => j.id === id);
      if (job?.phone) window.location.href = smsHref(job.phone, reviewScript(job.name));
    }
    closeCollect();
  });
  document.getElementById('export-csv')?.addEventListener('click', () => {
    const csv = PrimeStore.exportCsv();
    const blob = new Blob([`JOBS\n${csv.jobs}\n\nCLIENTS\n${csv.clients}\n\nMONEY\n${csv.money}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `primeshine-books-${PrimeStore.todayIso()}.csv`;
    a.click();
  });
  document.getElementById('export-json')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([PrimeStore.exportJson()], { type: 'application/json' }));
    a.download = `primeshine-backup-${PrimeStore.todayIso()}.json`;
    a.click();
  });
  document.getElementById('pin-save')?.addEventListener('click', async () => {
    const pin = document.getElementById('pin-input').value.trim();
    await PrimeStore.setPin(pin);
    document.getElementById('pin-status').textContent = pin ? 'PIN saved. It will lock next visit on this phone.' : 'PIN cleared.';
    document.getElementById('pin-input').value = '';
  });
  document.getElementById('review-url-save')?.addEventListener('click', () => {
    PrimeStore.os.settings.reviewUrl = document.getElementById('review-url').value.trim();
    PrimeStore.persist();
    document.getElementById('pin-status').textContent = 'Review link saved.';
  });
  document.getElementById('copy-page-link')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(window.location.href); } catch (err) {
      const hint = document.getElementById('page-link-fallback');
      if (hint) { hint.value = window.location.href; hint.hidden = false; hint.select(); }
    }
    const prev = btn.textContent;
    btn.textContent = 'Copied — text it to yourself';
    setTimeout(() => { btn.textContent = prev; }, 2000);
  });
}

async function bindLock() {
  const lock = document.getElementById('lock-screen');
  const app = document.getElementById('app-shell');
  if (!PrimeStore.hasPin() || PrimeStore.isUnlocked()) {
    lock?.classList.add('hidden');
    app?.classList.remove('hidden');
    return;
  }
  lock?.classList.remove('hidden');
  app?.classList.add('hidden');
  document.getElementById('unlock-btn')?.addEventListener('click', async () => {
    const ok = await PrimeStore.checkPin(document.getElementById('unlock-pin').value.trim());
    const err = document.getElementById('unlock-err');
    if (!ok) { if (err) err.textContent = 'Wrong PIN'; return; }
    PrimeStore.unlock();
    lock.classList.add('hidden');
    app.classList.remove('hidden');
    refreshOs();
  });
}

function initOs() {
  bindOsChrome();
  bindLock().then(() => {
    if (!PrimeStore.hasPin() || PrimeStore.isUnlocked()) {
      const start = sessionStorage.getItem('primeshine_room') || 'today';
      showRoom(start);
      const review = document.getElementById('review-url');
      if (review) review.value = PrimeStore.os.settings.reviewUrl || '';
    }
  });
  PrimeStore.onChange(() => {
    refreshOs();
    if (typeof renderCalGrid === 'function') {
      renderCalGrid();
      renderDayPanel();
    }
  });
  document.addEventListener('primeshine:job-done', (e) => {
    if (e.detail?.id) openCollect(e.detail.id);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOs);
else initOs();
