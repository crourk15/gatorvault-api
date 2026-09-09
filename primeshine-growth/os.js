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
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  const sep = ios ? '&' : '?';
  return `sms:${d}${sep}body=${encodeURIComponent(body || '')}`;
}

function reviewScript(name) {
  const url = (PrimeStore.os.settings.reviewUrl || '').trim() || 'https://g.page/r/CblZQEEuV9DzECE/review';
  return `Hey ${name || 'there'}, thanks for booking PrimeShine. If you have 2 minutes, a Google review would mean a lot: ${url}`;
}

function monthlyPitchScript(name) {
  return `Hey ${name || 'there'} — want me on a monthly maintenance plan? I come to you, same week each month. Price depends on the car — I'll lock your amount when you say yes. Reply YES and I'll get you on the calendar.`;
}

function monthlyConfirmScript(name, price, date, time) {
  const when = PrimeStore.prettyDate(date);
  const t = time || '9:00';
  return `Hey ${name || 'there'} — you're on PrimeShine monthly maintenance at $${price}/month. We come to you. Next visit ${when} at ${t}. Reply if you need a different day. — Charles, 863-860-9238`;
}

function monthlyScript(name) {
  return monthlyPitchScript(name);
}

function monthlyHowToHtml(buttonId) {
  return `
    <div class="glass-card p-4 mb-4 border border-green-500/30">
      <p class="text-xs uppercase tracking-widest text-green-400 font-bold mb-1">Monthly plan</p>
      <h3 class="font-bold text-white mb-1">How to put someone on monthly</h3>
      <p class="text-sm text-slate-400 mb-3">This is not a website package. You quote a monthly dollar amount after they say yes. Each car can be different.</p>
      <ol class="text-sm text-slate-300 space-y-2 mb-4 list-decimal pl-5">
        <li>They say <strong class="text-white">yes</strong> — in the driveway or by text.</li>
        <li>Tap the green button below.</li>
        <li>Type <strong class="text-white">what they pay each month</strong> (whatever you quoted — $50, $80, $120).</li>
        <li>Pick the <strong class="text-white">next</strong> wash day — not the one you already did.</li>
        <li>Tap <strong class="text-white">Lock plan + send text</strong>. Read it, then hit Send in Messages.</li>
      </ol>
      <p class="text-xs text-slate-500 mb-3">That locks the next 6 months on your calendar and texts them the amount + first visit.</p>
      <button type="button" id="${buttonId}" class="w-full bg-green-500 text-navy-900 font-bold rounded-lg py-3 min-h-[44px]">They said yes — lock them in</button>
    </div>
  `;
}

function bookingFormHtml(prefix, title, hint) {
  const serviceOptions = window.PrimeMenu ? PrimeMenu.optionsHtml('full|suv') : '';
  return `
    <form id="${prefix}-job-form" class="space-y-2 bg-navy-800/50 rounded-lg p-3">
      <p class="text-sm font-bold text-gold-400">${title}</p>
      <p class="text-xs text-slate-400 mb-1">${hint}</p>
      <input id="${prefix}-job-name" required placeholder="Name" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
      <input id="${prefix}-job-phone" type="tel" placeholder="Phone" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
      <input id="${prefix}-job-asked" placeholder="What they asked for (wash, interior, full…)" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="date-chip" data-book-chip="${prefix}" data-days="0">Today</button>
        <button type="button" class="date-chip" data-book-chip="${prefix}" data-days="1">Tomorrow</button>
        <button type="button" class="date-chip" data-book-chip="${prefix}" data-days="3">+3 days</button>
        <button type="button" class="date-chip" data-book-chip="${prefix}" data-days="7">+7 days</button>
      </div>
      <p id="${prefix}-job-when" class="text-xs text-gold-400 font-semibold"></p>
      <div class="grid grid-cols-2 gap-2">
        <input id="${prefix}-job-date" type="date" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
        <input id="${prefix}-job-time" type="time" value="09:00" class="bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
      </div>
      <select id="${prefix}-job-service" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]">${serviceOptions}</select>
      <input id="${prefix}-job-price" type="number" placeholder="Price" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
      <input id="${prefix}-job-notes" placeholder="Address / notes" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px]"/>
      <p id="${prefix}-job-msg" class="text-xs hidden"></p>
      <button type="submit" class="w-full bg-gold-500 text-navy-900 font-bold rounded-lg py-3 min-h-[44px]">Save on calendar</button>
      <button type="button" id="${prefix}-save-call" class="w-full bg-navy-700 text-white font-bold rounded-lg py-3 min-h-[44px]">Save as call — not booked yet</button>
    </form>
  `;
}

function readBookingFields(prefix) {
  const form = document.getElementById(`${prefix}-job-form`);
  const dateInput = document.getElementById(`${prefix}-job-date`);
  const parsed = window.PrimeMenu
    ? PrimeMenu.parseChoice(document.getElementById(`${prefix}-job-service`)?.value)
    : { service: 'full', vehicle: 'suv', price: 150 };
  const asked = (document.getElementById(`${prefix}-job-asked`)?.value || '').trim();
  const notes = (document.getElementById(`${prefix}-job-notes`)?.value || '').trim();
  return {
    form,
    name: (document.getElementById(`${prefix}-job-name`)?.value || '').trim(),
    phone: (document.getElementById(`${prefix}-job-phone`)?.value || '').trim(),
    asked,
    date: (form && form.dataset.scheduleDate) || dateInput?.value || PrimeStore.todayIso(),
    time: document.getElementById(`${prefix}-job-time`)?.value || '09:00',
    service: parsed.service,
    vehicle: parsed.vehicle,
    price: Number(document.getElementById(`${prefix}-job-price`)?.value) || parsed.price,
    notes: [asked, notes].filter(Boolean).join(' · '),
  };
}

function showBookMsg(prefix, text, ok) {
  const msg = document.getElementById(`${prefix}-job-msg`);
  if (!msg) return;
  msg.textContent = text;
  msg.className = ok ? 'text-xs text-green-400' : 'text-xs text-red-400';
}

function fillBookingForm(prefix, draft) {
  const set = (id, value) => {
    const el = document.getElementById(`${prefix}-${id}`);
    if (el && value != null) el.value = value;
  };
  set('job-name', draft.name || '');
  set('job-phone', draft.phone || '');
  set('job-asked', draft.asked || '');
  set('job-notes', draft.notes || '');
  if (draft.date && typeof window[`setBookDate_${prefix}`] === 'function') {
    window[`setBookDate_${prefix}`](draft.date);
  }
}

function bindBookingForm(prefix, defaultDays) {
  const form = document.getElementById(`${prefix}-job-form`);
  const dateInput = document.getElementById(`${prefix}-job-date`);
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  const today = PrimeStore.todayIso();
  const setScheduleDate = (iso) => {
    form.dataset.scheduleDate = iso;
    if (dateInput) dateInput.value = iso;
    const when = document.getElementById(`${prefix}-job-when`);
    if (when) when.textContent = `Saving for ${PrimeStore.prettyDate(iso)}`;
    form.querySelectorAll(`[data-book-chip="${prefix}"]`).forEach((btn) => {
      const target = PrimeStore.shiftIso(today, Number(btn.getAttribute('data-days') || 0));
      btn.classList.toggle('on', target === iso);
    });
  };
  window[`setBookDate_${prefix}`] = setScheduleDate;
  setScheduleDate(PrimeStore.shiftIso(today, defaultDays || 0));
  const priceInput = document.getElementById(`${prefix}-job-price`);
  if (priceInput && !priceInput.value && window.PrimeMenu) priceInput.value = PrimeMenu.price('full', 'suv');
  document.getElementById(`${prefix}-job-service`)?.addEventListener('change', (e) => {
    const parsed = window.PrimeMenu ? PrimeMenu.parseChoice(e.target.value) : { price: 0 };
    if (priceInput) priceInput.value = parsed.price;
  });
  form.querySelectorAll(`[data-book-chip="${prefix}"]`).forEach((btn) => {
    btn.addEventListener('click', () => setScheduleDate(PrimeStore.shiftIso(today, Number(btn.getAttribute('data-days') || 0))));
  });
  dateInput?.addEventListener('change', () => {
    if (dateInput.value) setScheduleDate(dateInput.value);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = readBookingFields(prefix);
    if (!fields.name) {
      showBookMsg(prefix, 'Add their name so you can find them later.', false);
      return;
    }
    window._bookFlash = {
      prefix,
      text: `Booked ${fields.name} on ${PrimeStore.prettyDate(fields.date)} at ${fields.time} · $${fields.price}.`,
      ok: true,
    };
    PrimeStore.addJob({
      name: fields.name,
      phone: fields.phone,
      date: fields.date,
      time: fields.time,
      service: fields.service,
      vehicle: fields.vehicle,
      price: fields.price,
      kind: fields.service === 'monthly' ? 'monthly' : 'new',
      notes: fields.notes,
      asked: fields.asked,
      source: 'phone',
    });
    if (typeof selectedIso !== 'undefined') {
      selectedIso = fields.date;
      const [yy, mm] = fields.date.split('-').map(Number);
      if (typeof calCursor !== 'undefined') calCursor = new Date(yy, mm - 1, 1);
    }
    if (fields.date !== today && typeof showRoom === 'function' && prefix === 'today') {
      showRoom('calendar');
    }
  });
  document.getElementById(`${prefix}-save-call`)?.addEventListener('click', () => {
    const fields = readBookingFields(prefix);
    if (!fields.name && !fields.phone) {
      showBookMsg(prefix, 'Save a name or a phone so this call does not disappear.', false);
      return;
    }
    window._bookFlash = {
      prefix,
      text: `Saved ${fields.name || fields.phone} as a call. Book them when they pick a day.`,
      ok: true,
    };
    PrimeStore.addLead({
      name: fields.name || 'Phone lead',
      phone: fields.phone,
      source: 'phone',
      asked: fields.asked,
      notes: fields.notes,
      status: 'lead',
    });
  });
  if (window._bookFlash && window._bookFlash.prefix === prefix) {
    const flash = window._bookFlash;
    window._bookFlash = null;
    showBookMsg(flash.prefix, flash.text, flash.ok);
  }
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
    if (typeof renderCalAgenda === 'function') renderCalAgenda();
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

function jobStatus(j) {
  if (j.reviewReceived) return 'Paid · review in';
  if (j.paid && j.reviewAsked) return 'Paid · review text sent — follow up';
  if (j.paid) return 'Paid · send the review text';
  if (j.done) return 'Done — collect payment';
  return 'Booked';
}

function jobActionButtons(j) {
  const bits = [];
  if (j.phone) bits.push(`<a class="text-xs font-semibold px-3 py-2 rounded-lg bg-navy-800 text-white min-h-[40px]" href="${telHref(j.phone)}">Call</a>`);
  if (!j.done) bits.push(`<button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-gold-500 text-navy-900 min-h-[40px]" data-finish="${j.id}">Mark done</button>`);
  if (j.done && !j.paid) bits.push(`<button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-gold-500 text-navy-900 min-h-[40px]" data-collect="${j.id}">Collect</button>`);
  if (j.done && !j.reviewReceived) bits.push(`<button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-sky-500 text-navy-900 min-h-[40px]" data-review="${j.id}">Send review text</button>`);
  if (j.reviewAsked && !j.reviewReceived) bits.push(`<button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-green-500/20 text-green-400 min-h-[40px]" data-got-review="${j.id}">They left a review</button>`);
  bits.push(`<button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-green-500 text-navy-900 min-h-[40px]" data-enroll-name="${esc(j.name)}" data-enroll-phone="${esc(j.phone || '')}">Put on monthly</button>`);
  return bits.join('');
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
  const needReview = PrimeStore.jobs.filter((j) => j.done && !j.reviewReceived);
  const collected = PrimeStore.collectedRevenue();
  const goal = typeof REVENUE_GOAL === 'number' ? REVENUE_GOAL : 3000;
  const pace = Math.min(100, Math.round((collected / goal) * 100));
  const week = PrimeStore.weekMoney();
  const pipe = PrimeStore.pipeline();
  const move = moneyMove();
  const reviewUrl = (PrimeStore.os.settings.reviewUrl || '').trim();
  const openCalls = PrimeStore.openLeads();
  const weekAhead = PrimeStore.daysAgenda(8);

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
      <div class="tipbox p-3 rounded-lg mb-3">
        <p class="text-xs font-bold text-gold-400 mb-1">Do this next</p>
        <p class="text-sm text-white">${esc(move)}</p>
      </div>
      <button type="button" id="today-enroll-top" class="w-full bg-green-500 text-navy-900 font-bold rounded-lg py-3 min-h-[44px]">Put someone on monthly</button>
      <p class="text-[11px] text-slate-500 mt-2 text-center">Not the Plan tab. Plan is the 30-day checklist.</p>
    </div>

    ${monthlyHowToHtml('today-enroll')}
    ${PrimeStore.monthlyClients().length ? `<div class="glass-card p-4 mb-4">
      <h3 class="font-bold text-white mb-2">On monthly now</h3>
      ${PrimeStore.monthlyClients().map((c) => `
        <div class="py-2 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-white">${esc(c.name)} · $${c.monthly.price}/mo · next ${esc(c.monthly.nextDate || c.monthly.startDate || '')}</p>
          <button type="button" class="text-xs font-bold bg-navy-700 text-white px-3 py-2 rounded-lg min-h-[40px]" data-edit-monthly="${c.id}">Fix date / amount</button>
        </div>`).join('')}
    </div>` : ''}

    ${!reviewUrl ? `<div class="glass-card p-4 mb-4 border border-gold-500/30">
      <h3 class="font-bold text-white mb-1">Paste your Google review link once</h3>
      <p class="text-xs text-slate-400 mb-2">Needed so “Send review text” has a real link. Find it in Google Business Profile → Ask for reviews → copy the short link.</p>
      <input id="today-review-url" placeholder="https://g.page/r/..." class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[44px] mb-2"/>
      <button type="button" id="today-review-url-save" class="w-full bg-gold-500 text-navy-900 font-bold rounded-lg py-3 min-h-[44px]">Save review link</button>
    </div>` : ''}

    ${openCalls.length ? `<div class="glass-card p-4 mb-4 border border-gold-500/30">
      <h3 class="font-bold text-white mb-1">Calls to book</h3>
      <p class="text-xs text-slate-400 mb-3">They called. They are not on the calendar yet. Do not lose them.</p>
      ${openCalls.map((l) => `
        <div class="py-3 border-b border-white/5">
          <p class="text-white font-semibold">${esc(l.name || 'No name')} · ${esc(l.phone || 'No phone')}</p>
          <p class="text-xs text-slate-500 mb-2">${esc(l.asked || l.notes || 'No note yet')}</p>
          <div class="flex flex-wrap gap-2">
            ${l.phone ? `<a class="text-xs font-semibold px-3 py-2 rounded-lg bg-navy-800 text-white min-h-[40px]" href="${telHref(l.phone)}">Call back</a>` : ''}
            <button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-gold-500 text-navy-900 min-h-[40px]" data-book-lead="${l.id}">Book this call</button>
            <button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-navy-700 text-slate-300 min-h-[40px]" data-lost-lead="${l.id}">Lost them</button>
          </div>
        </div>`).join('')}
    </div>` : ''}

    <div class="glass-card p-4 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="font-bold text-white">This week + next</h3>
        <button type="button" class="text-xs text-sky-400 font-semibold" data-goto="calendar">Full calendar</button>
      </div>
      ${weekAhead.map((day) => `
        <div class="py-2 border-b border-white/5">
          <p class="text-xs font-bold text-gold-400">${esc(day.label)}${day.isToday ? ' · today' : ''}</p>
          ${day.jobs.length
            ? day.jobs.map((j) => `<p class="text-sm text-white">${esc(j.time || '')} ${esc(j.name)} · $${j.price}${j.kind === 'monthly' ? ' · monthly' : ''}</p>`).join('')
            : '<p class="text-xs text-slate-500">Open</p>'}
        </div>`).join('')}
    </div>

    ${needReview.length ? `<div class="glass-card p-4 mb-4 border border-sky-500/30">
      <h3 class="font-bold text-white mb-1">Send a review text</h3>
      <p class="text-xs text-slate-400 mb-3">Paid or finished jobs still waiting on a Google review. Tap the blue button — it opens Messages with the text ready.</p>
      ${needReview.map((j) => `
        <div class="py-3 border-b border-white/5">
          <p class="text-white font-semibold">${esc(j.name)} · $${j.paidAmount || j.price}</p>
          <p class="text-xs text-slate-500 mb-2">${esc(j.date)} · ${esc(j.phone || 'No phone saved')} · ${jobStatus(j)}</p>
          <div class="flex flex-wrap gap-2">${jobActionButtons(j)}</div>
        </div>`).join('')}
    </div>` : ''}

    <div class="glass-card p-4 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="font-bold text-white">Jobs today</h3>
        <button type="button" class="text-xs text-sky-400 font-semibold" data-goto="calendar">Open calendar</button>
      </div>
      ${todaysJobs.length ? todaysJobs.map((j) => `
        <div class="py-3 border-b border-white/5">
          <p class="text-white font-semibold">${esc(j.time || '')} ${esc(j.name)} · $${j.price}</p>
          <p class="text-xs text-slate-500 mb-2">${jobStatus(j)}${j.phone ? '' : ' · add a phone to text them'}</p>
          <div class="flex flex-wrap gap-2">${jobActionButtons(j)}</div>
        </div>`).join('') : '<p class="text-sm text-slate-500">No jobs on today yet. Use the form below — Today, Tomorrow, +3, or +7.</p>'}
      ${unpaid.length ? `<p class="text-xs text-red-300 mt-3">${unpaid.length} job(s) finished and not collected.</p>` : ''}
    </div>

    <div class="glass-card p-4 mb-4">
      ${bookingFormHtml('today', 'Someone called — book them', 'Today / Tomorrow / +3 / +7. If they have not picked a day, save as a call so you do not lose them.')}
    </div>

    ${window.PrimeMenu ? PrimeMenu.cardHtml() : ''}

    <div class="glass-card p-4 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="font-bold text-white">Today’s growth tasks</h3>
        <button type="button" class="text-xs text-sky-400 font-semibold" data-goto="plan">Full 30-day plan</button>
      </div>
      ${tasks.length ? tasks.map((t) => `
        <label class="flex items-start gap-3 py-2 border-b border-white/5 ${t.done ? 'task-done' : ''}">
          <input type="checkbox" class="checkbox-custom mt-0.5 today-task" data-key="${t.k}" ${t.done ? 'checked' : ''}/>
          <span class="text-sm text-slate-300 task-text"><span class="text-[10px] text-slate-500">${esc(t.cat)} · ${esc(t.time)}</span><br/>${esc(t.text)}</span>
        </label>`).join('') : '<p class="text-sm text-slate-500">Rest or no tasks loaded.</p>'}
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
  root.querySelectorAll('[data-review]').forEach((btn) => {
    btn.addEventListener('click', () => openReview(btn.getAttribute('data-review')));
  });
  root.querySelectorAll('[data-got-review]').forEach((btn) => {
    btn.addEventListener('click', () => PrimeStore.markReview(btn.getAttribute('data-got-review'), true));
  });
  document.getElementById('today-review-url-save')?.addEventListener('click', () => {
    const url = document.getElementById('today-review-url').value.trim();
    PrimeStore.os.settings.reviewUrl = url;
    PrimeStore.persist();
  });
  bindBookingForm('today', 0);
  document.getElementById('today-enroll')?.addEventListener('click', () => openMonthly());
  document.getElementById('today-enroll-top')?.addEventListener('click', () => openMonthly());
  root.querySelectorAll('[data-edit-monthly]').forEach((btn) => {
    btn.addEventListener('click', () => openMonthlyForClient(btn.getAttribute('data-edit-monthly')));
  });
  root.querySelectorAll('[data-enroll-name]').forEach((btn) => {
    btn.addEventListener('click', () => openMonthly({
      name: btn.getAttribute('data-enroll-name') || '',
      phone: btn.getAttribute('data-enroll-phone') || '',
    }));
  });
  root.querySelectorAll('[data-book-lead]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lead = PrimeStore.os.leads.find((l) => l.id === btn.getAttribute('data-book-lead'));
      if (!lead) return;
      fillBookingForm('today', lead);
      document.getElementById('today-job-name')?.focus();
    });
  });
  root.querySelectorAll('[data-lost-lead]').forEach((btn) => {
    btn.addEventListener('click', () => PrimeStore.updateLead(btn.getAttribute('data-lost-lead'), { status: 'lost' }));
  });

  const kit = document.getElementById('day1-kit');
  if (kit) kit.classList.toggle('hidden', day1Done());
}

function renderBook() {
  const root = document.getElementById('book-desk');
  if (!root) return;
  const q = (root.querySelector('#book-search')?.value || '').toLowerCase();
  const openCalls = PrimeStore.openLeads();
  const agenda = PrimeStore.daysAgenda(14);
  const monthly = PrimeStore.monthlyClients();
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
  const peopleHtml = all.length ? all.map((c) => {
    const hist = PrimeStore.clientJobs(c.ghost ? null : c.id, c.name, c.phone);
    const next = hist.filter((j) => !j.done && j.date >= PrimeStore.todayIso()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const last = hist.find((j) => j.done);
    const plan = c.monthly && c.monthly.active ? ` · monthly $${c.monthly.price}` : '';
    return `<article class="glass-card-light p-4 mb-3">
      <div class="flex justify-between gap-2">
        <div>
          <p class="text-white font-bold">${esc(c.name)}</p>
          <p class="text-xs text-slate-500">${esc(c.phone || 'No phone')} ${c.source ? '· ' + esc(c.source) : ''}${plan}</p>
          <p class="text-xs text-slate-400 mt-1">Last: ${last ? last.date + ' · $' + (last.paidAmount || last.price) : '—'} · Next: ${next ? next.date : '—'}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        ${c.phone ? `<a class="px-3 py-2 rounded-lg bg-navy-800 text-white text-xs font-semibold min-h-[40px]" href="${telHref(c.phone)}">Call</a>` : ''}
        ${last ? `<button type="button" class="px-3 py-2 rounded-lg bg-sky-500 text-navy-900 text-xs font-semibold min-h-[40px]" data-review="${last.id}">Send review text</button>` : ''}
        ${c.monthly && c.monthly.active
          ? `<button type="button" class="px-3 py-2 rounded-lg bg-navy-700 text-white text-xs font-semibold min-h-[40px]" data-edit-monthly="${c.ghost ? '' : c.id}">Fix monthly</button>`
          : `<button type="button" class="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold min-h-[40px]" data-enroll-name="${esc(c.name)}" data-enroll-phone="${esc(c.phone || '')}">Enroll monthly</button>`}
        ${last && !last.reviewReceived ? `<button type="button" class="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold min-h-[40px]" data-got-review="${last.id}">They left a review</button>` : ''}
      </div>
    </article>`;
  }).join('') : '<p class="text-sm text-slate-500">No clients yet. Book a job or save a call.</p>';

  root.innerHTML = `
    <div class="glass-card gold-glow p-4 md:p-6 mb-4">
      <h2 class="text-xl font-black text-white mb-1">Book desk</h2>
      <p class="text-sm text-slate-400">Someone called? Put them here. Either lock a day, or save the call so they do not disappear.</p>
    </div>

    ${openCalls.length ? `<div class="glass-card p-4 mb-4 border border-gold-500/30">
      <h3 class="font-bold text-white mb-1">Calls waiting</h3>
      <p class="text-xs text-slate-400 mb-3">${openCalls.length} people not on the calendar yet.</p>
      ${openCalls.map((l) => `
        <div class="py-3 border-b border-white/5">
          <p class="text-white font-semibold">${esc(l.name || 'No name')} · ${esc(l.phone || 'No phone')}</p>
          <p class="text-xs text-slate-500 mb-2">${esc(l.asked || l.notes || 'No note yet')}</p>
          <div class="flex flex-wrap gap-2">
            ${l.phone ? `<a class="text-xs font-semibold px-3 py-2 rounded-lg bg-navy-800 text-white min-h-[40px]" href="${telHref(l.phone)}">Call back</a>` : ''}
            <button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-gold-500 text-navy-900 min-h-[40px]" data-book-lead="${l.id}">Book this call</button>
            <button type="button" class="text-xs font-semibold px-3 py-2 rounded-lg bg-navy-700 text-slate-300 min-h-[40px]" data-lost-lead="${l.id}">Lost them</button>
          </div>
        </div>`).join('')}
    </div>` : ''}

    <div class="glass-card p-4 mb-4">
      ${bookingFormHtml('desk', 'Book this person', 'Tap Today, Tomorrow, +3, or +7. If they have not picked a day, save as a call.')}
    </div>

    <div class="glass-card p-4 mb-4">
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-bold text-white">Who is booked — next 14 days</h3>
        <button type="button" class="text-xs text-sky-400 font-semibold" data-goto="calendar">Open calendar</button>
      </div>
      ${agenda.map((day) => `
        <button type="button" class="agenda-day ${day.jobs.length ? '' : 'open'} ${day.isToday ? 'is-today' : ''} mb-2" data-goto-day="${day.iso}">
          <p class="text-xs font-bold text-gold-400 mb-1">${esc(day.label)}${day.isToday ? ' · today' : ''}</p>
          ${day.jobs.length
            ? day.jobs.map((j) => `<p class="text-sm text-white">${esc(j.time || '')} ${esc(j.name)} · $${j.price}${j.kind === 'monthly' ? ' · monthly' : ''}</p>`).join('')
            : '<p class="text-xs text-slate-500">Open</p>'}
        </button>`).join('')}
    </div>

    ${monthlyHowToHtml('desk-enroll')}
    ${monthly.length ? `<div class="glass-card p-4 mb-4">
      <h3 class="font-bold text-white mb-2">On monthly now</h3>
      ${monthly.map((c) => `
        <div class="py-2 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-white">${esc(c.name)} · $${c.monthly.price}/mo · next ${esc(c.monthly.nextDate || c.monthly.startDate || '')}</p>
          <button type="button" class="text-xs font-bold bg-navy-700 text-white px-3 py-2 rounded-lg min-h-[40px]" data-edit-monthly="${c.id}">Fix date / amount</button>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="glass-card p-4 mb-4">
      <h3 class="font-bold text-white mb-1">People you have detailed</h3>
      <p class="text-sm text-slate-400 mb-3">Call them, send the review text, or enroll monthly.</p>
      <input id="book-search" placeholder="Search name or phone" class="w-full bg-navy-900 border border-white/10 rounded-lg px-3 py-3 text-white min-h-[44px] mb-4"/>
      <div id="book-root">${peopleHtml}</div>
    </div>
  `;

  bindBookingForm('desk', 1);
  document.getElementById('book-search')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const box = document.getElementById('book-root');
    if (!box) return;
    const filtered = all.filter((c) => !query || c.name.toLowerCase().includes(query) || (c.phone || '').includes(query));
    box.innerHTML = filtered.length ? filtered.map((c) => {
      const hist = PrimeStore.clientJobs(c.ghost ? null : c.id, c.name, c.phone);
      const next = hist.filter((j) => !j.done && j.date >= PrimeStore.todayIso()).sort((a, b) => a.date.localeCompare(b.date))[0];
      const last = hist.find((j) => j.done);
      const plan = c.monthly && c.monthly.active ? ` · monthly $${c.monthly.price}` : '';
      return `<article class="glass-card-light p-4 mb-3">
        <p class="text-white font-bold">${esc(c.name)}</p>
        <p class="text-xs text-slate-500">${esc(c.phone || 'No phone')}${plan}</p>
        <p class="text-xs text-slate-400 mt-1">Last: ${last ? last.date : '—'} · Next: ${next ? next.date : '—'}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          ${c.phone ? `<a class="px-3 py-2 rounded-lg bg-navy-800 text-white text-xs font-semibold min-h-[40px]" href="${telHref(c.phone)}">Call</a>` : ''}
          ${c.monthly && c.monthly.active
            ? `<button type="button" class="px-3 py-2 rounded-lg bg-navy-700 text-white text-xs font-semibold min-h-[40px]" data-edit-monthly="${c.ghost ? '' : c.id}">Fix monthly</button>`
            : `<button type="button" class="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold min-h-[40px]" data-enroll-name="${esc(c.name)}" data-enroll-phone="${esc(c.phone || '')}">Enroll monthly</button>`}
        </div>
      </article>`;
    }).join('') : '<p class="text-sm text-slate-500">No match.</p>';
    box.querySelectorAll('[data-enroll-name]').forEach((btn) => {
      btn.addEventListener('click', () => openMonthly({
        name: btn.getAttribute('data-enroll-name') || '',
        phone: btn.getAttribute('data-enroll-phone') || '',
      }));
    });
    box.querySelectorAll('[data-edit-monthly]').forEach((btn) => {
      btn.addEventListener('click', () => openMonthlyForClient(btn.getAttribute('data-edit-monthly')));
    });
  });
  root.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => showRoom(btn.getAttribute('data-goto')));
  });
  root.querySelectorAll('[data-goto-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const iso = btn.getAttribute('data-goto-day');
      if (typeof selectedIso !== 'undefined') selectedIso = iso;
      const [yy, mm] = iso.split('-').map(Number);
      if (typeof calCursor !== 'undefined') calCursor = new Date(yy, mm - 1, 1);
      showRoom('calendar');
    });
  });
  root.querySelectorAll('[data-book-lead]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lead = PrimeStore.os.leads.find((l) => l.id === btn.getAttribute('data-book-lead'));
      if (!lead) return;
      fillBookingForm('desk', lead);
      document.getElementById('desk-job-name')?.focus();
    });
  });
  root.querySelectorAll('[data-lost-lead]').forEach((btn) => {
    btn.addEventListener('click', () => PrimeStore.updateLead(btn.getAttribute('data-lost-lead'), { status: 'lost' }));
  });
  document.getElementById('desk-enroll')?.addEventListener('click', () => openMonthly());
  root.querySelectorAll('[data-enroll-name]').forEach((btn) => {
    btn.addEventListener('click', () => openMonthly({
      name: btn.getAttribute('data-enroll-name') || '',
      phone: btn.getAttribute('data-enroll-phone') || '',
    }));
  });
  root.querySelectorAll('[data-edit-monthly]').forEach((btn) => {
    btn.addEventListener('click', () => openMonthlyForClient(btn.getAttribute('data-edit-monthly')));
  });
  root.querySelectorAll('[data-review]').forEach((btn) => {
    btn.addEventListener('click', () => openReview(btn.getAttribute('data-review')));
  });
  root.querySelectorAll('[data-got-review]').forEach((btn) => {
    btn.addEventListener('click', () => PrimeStore.markReview(btn.getAttribute('data-got-review'), true));
  });
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
    ${col('Need review', p.needReview, (j) => `<p class="text-sm text-white py-1">${esc(j.name)} <button type="button" class="text-sky-400 text-xs font-bold" data-review="${j.id}">Text</button></p>`)}
    ${col('Monthly coming', p.monthlyDue, (j) => `<p class="text-sm text-green-400 py-1">${esc(j.date)} · ${esc(j.name)}</p>`)}
  </div>`;
  root.querySelectorAll('[data-review]').forEach((btn) => {
    btn.addEventListener('click', () => openReview(btn.getAttribute('data-review')));
  });
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

function openReview(id) {
  const job = PrimeStore.jobs.find((j) => j.id === id);
  if (!job) return;
  const overlay = document.getElementById('review-overlay');
  if (!overlay) return;
  overlay.dataset.jobId = id;
  document.getElementById('review-name').textContent = `${job.name} · $${job.paidAmount || job.price}`;
  document.getElementById('review-phone').value = job.phone || '';
  const urlInput = document.getElementById('review-link-input');
  if (urlInput) urlInput.value = PrimeStore.os.settings.reviewUrl || '';
  document.getElementById('review-preview').value = reviewScript(job.name);
  const warn = document.getElementById('review-warn');
  if (warn) {
    if (!job.phone) warn.textContent = 'Add their phone, then tap Open Messages.';
    else if (!(PrimeStore.os.settings.reviewUrl || '').trim()) warn.textContent = 'Paste the Google review link so the text is useful.';
    else warn.textContent = 'Opens Messages with this text. You tap Send.';
  }
  overlay.classList.remove('hidden');
}

function closeReview() {
  document.getElementById('review-overlay')?.classList.add('hidden');
}

function monthlyDraft() {
  const overlay = document.getElementById('monthly-overlay');
  return {
    clientId: overlay?.dataset.clientId || '',
    name: (document.getElementById('monthly-name')?.value || '').trim(),
    phone: (document.getElementById('monthly-phone')?.value || '').trim(),
    price: Number(document.getElementById('monthly-price')?.value) || 0,
    startDate: document.getElementById('monthly-date')?.value || PrimeStore.todayIso(),
    time: document.getElementById('monthly-time')?.value || '09:00',
    notes: (document.getElementById('monthly-notes')?.value || '').trim(),
  };
}

function syncMonthlyPreview() {
  const d = monthlyDraft();
  const preview = document.getElementById('monthly-preview');
  if (preview) preview.value = monthlyConfirmScript(d.name, d.price || '___', d.startDate, d.time);
  document.querySelectorAll('.monthly-chip').forEach((btn) => {
    const iso = PrimeStore.shiftIso(PrimeStore.todayIso(), Number(btn.getAttribute('data-days') || 0));
    btn.classList.toggle('on', iso === d.startDate);
  });
}

function openMonthlyForClient(clientId) {
  const client = PrimeStore.os.clients.find((c) => c.id === clientId);
  if (!client) return openMonthly();
  const plan = client.monthly || {};
  openMonthly({
    clientId: client.id,
    name: client.name,
    phone: client.phone,
    price: plan.price || '',
    startDate: plan.nextDate || plan.startDate,
    time: plan.time || '09:00',
    notes: plan.notes || '',
  });
}

function openMonthlyFromJob(jobId) {
  const job = PrimeStore.jobs.find((j) => j.id === jobId);
  if (!job) return;
  const client = PrimeStore.os.clients.find((c) => c.id === job.clientId)
    || PrimeStore.os.clients.find((c) => c.name === job.name)
    || PrimeStore.os.clients.find((c) => job.phone && c.phone === job.phone);
  openMonthly({
    clientId: client ? client.id : '',
    name: job.name,
    phone: job.phone,
    price: (client && client.monthly && client.monthly.price) || job.price,
    startDate: job.date,
    time: job.time || '09:00',
    notes: (client && client.monthly && client.monthly.notes) || '',
  });
}

function openMonthly(draft) {
  const overlay = document.getElementById('monthly-overlay');
  if (!overlay) return;
  const editing = !!(draft && draft.clientId);
  overlay.dataset.clientId = (draft && draft.clientId) || '';
  const title = document.getElementById('monthly-title');
  const hint = document.getElementById('monthly-hint');
  if (title) title.textContent = editing ? 'Fix their monthly plan' : 'Lock their monthly plan';
  if (hint) {
    hint.textContent = editing
      ? 'Wrong date or amount? Change it here. This date is the next time you come back — not the wash you already did.'
      : 'You already washed them (or will today). This date is the next monthly visit, not their first time with you.';
  }
  const start = PrimeStore.shiftIso(PrimeStore.todayIso(), 7);
  document.getElementById('monthly-name').value = (draft && draft.name) || '';
  document.getElementById('monthly-phone').value = (draft && draft.phone) || '';
  document.getElementById('monthly-price').value = (draft && draft.price) || '';
  document.getElementById('monthly-date').value = (draft && draft.startDate) || start;
  document.getElementById('monthly-time').value = (draft && draft.time) || '09:00';
  document.getElementById('monthly-notes').value = (draft && draft.notes) || '';
  const warn = document.getElementById('monthly-warn');
  if (warn) {
    warn.textContent = editing
      ? 'Saves the new next-visit date on the calendar, then you can text them the update.'
      : 'Locks the next 6 months on your calendar, then opens Messages. You tap Send.';
  }
  const sms = document.getElementById('monthly-sms');
  const save = document.getElementById('monthly-save');
  if (sms) sms.textContent = editing ? 'Save new date + send text' : 'Lock plan + send text';
  if (save) save.textContent = editing ? 'Save new date only' : 'Lock plan only — text later';
  syncMonthlyPreview();
  overlay.classList.remove('hidden');
}

function closeMonthly() {
  document.getElementById('monthly-overlay')?.classList.add('hidden');
}

function saveMonthlyEnroll() {
  const d = monthlyDraft();
  const warn = document.getElementById('monthly-warn');
  if (!d.name) {
    if (warn) warn.textContent = 'Add their name.';
    document.getElementById('monthly-name')?.focus();
    return null;
  }
  if (!d.price) {
    if (warn) warn.textContent = 'Put the monthly amount they agreed to pay.';
    document.getElementById('monthly-price')?.focus();
    return null;
  }
  if (d.clientId) return PrimeStore.updateMonthly(d.clientId, d);
  return PrimeStore.enrollMonthly(d);
}

function syncReviewDraft() {
  const overlay = document.getElementById('review-overlay');
  const id = overlay?.dataset.jobId;
  const job = PrimeStore.jobs.find((j) => j.id === id);
  if (!job) return job;
  const phone = document.getElementById('review-phone').value.trim();
  const url = document.getElementById('review-link-input').value.trim();
  if (url) PrimeStore.os.settings.reviewUrl = url;
  if (phone !== (job.phone || '')) {
    PrimeStore.updateJob(id, { phone });
  } else {
    PrimeStore.persist();
  }
  const preview = document.getElementById('review-preview');
  if (preview) preview.value = reviewScript(job.name);
  return PrimeStore.jobs.find((j) => j.id === id);
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
  ['nav-monthly', 'menu-monthly', 'dock-monthly'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => openMonthly());
  });
  document.getElementById('collect-cancel')?.addEventListener('click', closeCollect);
  document.getElementById('collect-save')?.addEventListener('click', () => {
    const id = document.getElementById('collect-overlay').dataset.jobId;
    PrimeStore.collectJob(id, {
      amount: document.getElementById('collect-amount').value,
      method: document.getElementById('collect-method').value,
    });
    closeCollect();
    openReview(id);
  });
  document.getElementById('review-cancel')?.addEventListener('click', closeReview);
  document.getElementById('review-copy')?.addEventListener('click', async () => {
    const job = syncReviewDraft();
    const text = document.getElementById('review-preview').value;
    try { await navigator.clipboard.writeText(text); } catch (e) {
      document.getElementById('review-preview').select();
      document.execCommand('copy');
    }
    if (job) PrimeStore.markReview(job.id, false);
    const btn = document.getElementById('review-copy');
    const prev = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = prev; }, 1400);
  });
  document.getElementById('review-sms')?.addEventListener('click', () => {
    const job = syncReviewDraft();
    if (!job) return;
    const phone = document.getElementById('review-phone').value.trim();
    if (!phone) {
      document.getElementById('review-warn').textContent = 'Add their phone first.';
      document.getElementById('review-phone').focus();
      return;
    }
    PrimeStore.markReview(job.id, false);
    window.location.href = smsHref(phone, document.getElementById('review-preview').value);
  });
  document.getElementById('review-got')?.addEventListener('click', () => {
    const id = document.getElementById('review-overlay').dataset.jobId;
    PrimeStore.markReview(id, true);
    closeReview();
  });
  document.getElementById('review-phone')?.addEventListener('input', () => {
    const preview = document.getElementById('review-preview');
    const id = document.getElementById('review-overlay').dataset.jobId;
    const job = PrimeStore.jobs.find((j) => j.id === id);
    if (preview && job) preview.value = reviewScript(job.name);
  });
  document.getElementById('review-link-input')?.addEventListener('input', () => {
    PrimeStore.os.settings.reviewUrl = document.getElementById('review-link-input').value.trim();
    const id = document.getElementById('review-overlay').dataset.jobId;
    const job = PrimeStore.jobs.find((j) => j.id === id);
    const preview = document.getElementById('review-preview');
    if (preview && job) preview.value = reviewScript(job.name);
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
  ['monthly-name', 'monthly-phone', 'monthly-price', 'monthly-date', 'monthly-time'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', syncMonthlyPreview);
    document.getElementById(id)?.addEventListener('change', syncMonthlyPreview);
  });
  document.querySelectorAll('.monthly-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const iso = PrimeStore.shiftIso(PrimeStore.todayIso(), Number(btn.getAttribute('data-days') || 0));
      document.getElementById('monthly-date').value = iso;
      syncMonthlyPreview();
    });
  });
  document.getElementById('monthly-cancel')?.addEventListener('click', closeMonthly);
  document.getElementById('monthly-save')?.addEventListener('click', () => {
    const saved = saveMonthlyEnroll();
    if (!saved) return;
    closeMonthly();
  });
  document.getElementById('monthly-sms')?.addEventListener('click', () => {
    const saved = saveMonthlyEnroll();
    if (!saved) return;
    const phone = document.getElementById('monthly-phone').value.trim();
    const text = document.getElementById('monthly-preview').value;
    if (!phone) {
      document.getElementById('monthly-warn').textContent = 'Add their phone so the text can open.';
      return;
    }
    closeMonthly();
    window.location.href = smsHref(phone, text);
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
      if (review) review.value = PrimeStore.os.settings.reviewUrl || 'https://g.page/r/CblZQEEuV9DzECE/review';
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
