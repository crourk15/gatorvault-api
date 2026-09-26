(function () {
  const NOTIFY_EMAIL = "crourk15@gmail.com";
  const BUSINESS_PHONE = "8638609238";

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("visible"));
  }

  function bookingPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      name: String(data.name || "").trim(),
      phone: String(data.phone || "").trim(),
      address: String(data.address || "").trim(),
      vehicle: String(data.vehicle || "").trim(),
      service: String(data.service || "").trim(),
      datetime: String(data.datetime || "").trim(),
      notes: String(data.notes || "").trim() || "(none)",
    };
  }

  function smsSummary(p) {
    return (
      "PrimeShine booking: " +
      p.name +
      ", " +
      p.service +
      ", " +
      p.datetime +
      ", " +
      p.phone +
      ", " +
      p.address
    ).slice(0, 300);
  }

  async function submitNetlifyForms(p) {
    const body = new URLSearchParams({
      "form-name": "booking",
      name: p.name,
      phone: p.phone,
      address: p.address,
      vehicle: p.vehicle,
      service: p.service,
      datetime: p.datetime,
      notes: p.notes,
    });
    await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  }

  async function submitViaFunction(p) {
    const res = await fetch("/.netlify/functions/booking-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error("function notify failed");
    return res.json().catch(() => ({ ok: true }));
  }

  async function submitViaFormSubmit(p) {
    // 1) Full booking details to email inbox
    const emailRes = await fetch("https://formsubmit.co/ajax/" + NOTIFY_EMAIL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: p.name,
        phone: p.phone,
        address: p.address,
        vehicle: p.vehicle,
        service: p.service,
        datetime: p.datetime,
        notes: p.notes,
        _subject: "PrimeShine Booking — " + p.name + " — " + p.service,
        _template: "table",
        _captcha: "false",
      }),
    });
    if (!emailRes.ok) throw new Error("formsubmit email failed");

    // 2) Short text via US carrier email-to-SMS gateways (best-effort)
    const summary = smsSummary(p);
    const gateways = [
      BUSINESS_PHONE + "@vtext.com",
      BUSINESS_PHONE + "@tmomail.net",
      BUSINESS_PHONE + "@txt.att.net",
    ];
    try {
      await fetch("https://formsubmit.co/ajax/" + gateways[0], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: summary,
          _subject: "PrimeShine Booking",
          _captcha: "false",
          _cc: gateways.slice(1).join(","),
        }),
      });
    } catch (_) {}

    return emailRes.json().catch(() => ({ ok: true }));
  }

  const form = document.querySelector("#booking-form");
  const success = document.querySelector("#booking-success");
  if (form && success) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const payload = bookingPayload(form);
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Sending…";
      }
      success.classList.remove("show");
      success.textContent = "";

      let delivered = false;
      try {
        await submitViaFunction(payload);
        delivered = true;
      } catch (_) {
        try {
          await submitViaFormSubmit(payload);
          delivered = true;
        } catch (err) {
          console.error(err);
        }
      }

      // Backup copy in Netlify Forms dashboard (ignore failures on local file://).
      try {
        await submitNetlifyForms(payload);
      } catch (_) {}

      if (delivered) {
        success.textContent =
          "Thanks, " +
          payload.name +
          "! We received your request for " +
          payload.service +
          ". PrimeShine will confirm shortly by phone at " +
          payload.phone +
          ".";
        form.reset();
      } else {
        success.textContent =
          "We couldn’t send that request automatically. Please call or text 863-860-9238 and we’ll book you right away.";
      }
      success.classList.add("show");
      success.scrollIntoView({ behavior: "smooth", block: "center" });
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Schedule My Detail";
      }
    });
  }
})();
