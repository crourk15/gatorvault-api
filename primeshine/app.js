const BUSINESS = {
  name: "Primeshine Mobile Detailing",
  email: "",
  phone: "",
  serviceArea: "Gainesville & North Central Florida",
};

const menuBtn = document.querySelector("[data-menu]");
const nav = document.querySelector("[data-nav]");
const year = document.querySelector("[data-year]");
const form = document.querySelector("[data-book-form]");
const success = document.querySelector("[data-success]");
const errorEl = document.querySelector("[data-form-error]");
const phoneLink = document.querySelector("[data-phone-link]");

if (year) year.textContent = String(new Date().getFullYear());

function setMenu(open) {
  nav?.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
  menuBtn?.setAttribute("aria-expanded", open ? "true" : "false");
}

if (menuBtn && nav) {
  menuBtn.addEventListener("click", () => {
    setMenu(!nav.classList.contains("is-open"));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });
}

if (phoneLink) {
  if (BUSINESS.phone) {
    const digits = BUSINESS.phone.replace(/\D/g, "");
    phoneLink.href = `tel:${digits}`;
    phoneLink.textContent = `Call ${BUSINESS.phone}`;
    phoneLink.hidden = false;
  } else {
    phoneLink.hidden = true;
  }
}

function value(id) {
  const el = form?.elements.namedItem(id);
  return el && "value" in el ? String(el.value).trim() : "";
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (errorEl) errorEl.textContent = "";

  const name = value("name");
  const phone = value("phone");
  const service = value("service");
  const location = value("location");
  const vehicle = value("vehicle");
  const notes = value("notes");
  const email = value("email");

  if (!name || !phone || !service || !location) {
    if (errorEl) errorEl.textContent = "Name, phone, service, and location are required.";
    return;
  }

  const body = [
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : "",
    `Service: ${service}`,
    `Location: ${location}`,
    vehicle ? `Vehicle: ${vehicle}` : "",
    notes ? `Notes: ${notes}` : "",
  ].filter(Boolean).join("\n");

  if (BUSINESS.email) {
    const subject = encodeURIComponent(`Primeshine booking — ${name}`);
    window.location.href = `mailto:${BUSINESS.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
  }

  form.classList.add("hidden");
  success?.classList.add("show");
  success?.focus();
});
