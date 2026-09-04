/** Live primeshinefl.com menu - owner OS must match this, not the old draft ranges. */
const PRIME_MENU = {
  brand: 'PrimeShine Mobile Detailing',
  owner: 'Charles',
  phone: '863-860-9238',
  phoneTel: '8638609238',
  site: 'https://primeshinefl.com',
  booking: 'https://primeshinefl.com/booking',
  reviewUrl: 'https://g.page/r/CblZQEEuV9DzECE/review',
  areas: 'Bartow · Lakeland · Winter Haven',
  hours: '8AM-6PM',
  promo: {
    active: true,
    label: 'First 10 customers: 50% off any package',
    flyer: 'First 10 customers get 50% off any package. Same prices as primeshinefl.com.',
  },
  packages: [
    { id: 'exterior', label: 'Exterior wash', sedan: 40, suv: 50, includes: 'Hand wash, wheels, tires, and shine.' },
    { id: 'interior', label: 'Interior detail', sedan: 60, suv: 80, includes: 'Vacuum, wipe-down, and interior refresh.' },
    { id: 'full', label: 'Full detail', sedan: 120, suv: 150, includes: 'Interior + exterior - wash, tire shine, and inside clean.' },
  ],
  addons: [
    { id: 'shampoo', label: 'Shampoo package', price: 40 },
    { id: 'odor', label: 'Odor treatment', price: 20 },
    { id: 'pethair', label: 'Pet hair removal', price: 20 },
    { id: 'headlights', label: 'Headlight restoration', price: 25 },
  ],
  monthly: { id: 'monthly', label: 'Monthly wash (owner upsell - not on the website)', price: 55 },
};

function menuPackage(serviceId) {
  return PRIME_MENU.packages.find((p) => p.id === serviceId) || null;
}

function menuPrice(serviceId, vehicle) {
  if (serviceId === 'monthly') return PRIME_MENU.monthly.price;
  const pack = menuPackage(serviceId);
  if (!pack) return 0;
  return vehicle === 'sedan' ? pack.sedan : pack.suv;
}

function menuServiceLabel(serviceId, vehicle) {
  if (serviceId === 'monthly') return PRIME_MENU.monthly.label;
  const pack = menuPackage(serviceId);
  if (!pack) return serviceId || 'Custom';
  const size = vehicle === 'sedan' ? 'sedan' : 'SUV / truck';
  return `${pack.label} · ${size}`;
}

function menuOptionsHtml(selected) {
  const rows = [];
  PRIME_MENU.packages.forEach((p) => {
    rows.push({ id: `${p.id}|sedan`, label: `${p.label} · sedan $${p.sedan}`, service: p.id, vehicle: 'sedan', price: p.sedan });
    rows.push({ id: `${p.id}|suv`, label: `${p.label} · SUV / truck $${p.suv}`, service: p.id, vehicle: 'suv', price: p.suv });
  });
  rows.push({ id: 'monthly|suv', label: `Monthly wash · $${PRIME_MENU.monthly.price} (owner upsell)`, service: 'monthly', vehicle: 'suv', price: PRIME_MENU.monthly.price });
  return rows.map((r) => `<option value="${r.id}" data-service="${r.service}" data-vehicle="${r.vehicle}" data-price="${r.price}"${selected === r.id ? ' selected' : ''}>${r.label}</option>`).join('');
}

function parseMenuChoice(value) {
  const [service, vehicle] = String(value || 'full|suv').split('|');
  return {
    service: service || 'full',
    vehicle: vehicle === 'sedan' ? 'sedan' : 'suv',
    price: menuPrice(service || 'full', vehicle === 'sedan' ? 'sedan' : 'suv'),
  };
}

function menuQuoteLine() {
  return `I come to you. Exterior $40 sedan / $50 SUV. Interior $60 / $80. Full $120 / $150. First 10 customers: 50% off any package. Book at primeshinefl.com/booking or text ${PRIME_MENU.phone}.`;
}

function menuCardHtml() {
  const packs = PRIME_MENU.packages.map((p) => `
    <div class="flex justify-between items-start py-2 border-b border-white/5 gap-3">
      <div>
        <p class="text-slate-200 font-semibold">${p.label}</p>
        <p class="text-xs text-slate-500">${p.includes}</p>
      </div>
      <p class="text-gold-400 font-bold text-sm text-right shrink-0">$${p.sedan} / $${p.suv}</p>
    </div>`).join('');
  const adds = PRIME_MENU.addons.map((a) => `
    <div class="flex justify-between py-1.5 text-sm"><span class="text-slate-300">${a.label}</span><span class="text-sky-400 font-bold">+$${a.price}</span></div>`).join('');
  return `
    <div class="glass-card p-4 mb-4">
      <div class="flex items-center justify-between gap-2 mb-1">
        <h3 class="font-bold text-white">Live website menu</h3>
        <a class="text-xs text-sky-400 font-semibold" href="${PRIME_MENU.site}/pricing" target="_blank" rel="noopener">primeshinefl.com/pricing</a>
      </div>
      <p class="text-xs text-slate-500 mb-3">Sedan / SUV·truck. Same numbers customers see. Do not quote the old ranges.</p>
      ${packs}
      <p class="text-[10px] uppercase tracking-wide text-slate-500 mt-3 mb-1">Add-ons</p>
      ${adds}
      ${PRIME_MENU.promo.active ? `<p class="mt-3 text-sm text-gold-400 font-semibold">${PRIME_MENU.promo.label}</p>` : ''}
    </div>`;
}

window.PrimeMenu = {
  data: PRIME_MENU,
  price: menuPrice,
  label: menuServiceLabel,
  optionsHtml: menuOptionsHtml,
  parseChoice: parseMenuChoice,
  quoteLine: menuQuoteLine,
  cardHtml: menuCardHtml,
};
