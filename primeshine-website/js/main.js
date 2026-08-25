(function () {
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

  const form = document.querySelector("#booking-form");
  const success = document.querySelector("#booking-success");
  if (form && success) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get("name") || "there";
      const service = data.get("service") || "your detail";
      success.textContent =
        "Thanks, " +
        name +
        "! We received your request for " +
        service +
        ". PrimeShine will confirm your appointment shortly at the phone number you provided.";
      success.classList.add("show");
      form.reset();
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
})();
