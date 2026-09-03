function getTodayDayNum() {
  const start = new Date(`${PLAN_START_ISO}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - start) / 86400000) + 1;
  if (diff < 1) return 1;
  if (diff > 30) return 30;
  return diff;
}

function getDefaultState() {
  return { tasks: {}, revenue: 0, jobs: 0, reviews: 0 };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return getDefaultState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

let state = loadState();
let currentWeek = 1;
let todayDay = getTodayDayNum();
let openDayNum = null;

function taskKey(dayNum, block, idx) {
  return `d${dayNum}_${block}_${idx}`;
}

function computeStats() {
  let totalTasks = 0;
  let doneTasks = 0;
  const completedDays = new Set();

  PLAN_DATA.forEach((day) => {
    let dayTotal = 0;
    let dayDone = 0;
    ["morning", "evening", "weekend"].forEach((block) => {
      day[block].forEach((t, i) => {
        dayTotal++;
        totalTasks++;
        const k = taskKey(day.day, block, i);
        if (state.tasks[k]) {
          dayDone++;
          doneTasks++;
        }
      });
    });
    if (dayTotal > 0 && dayDone === dayTotal) completedDays.add(day.day);
    if (dayTotal === 0) completedDays.add(day.day);
  });

  return { totalTasks, doneTasks, completedDays, daysComplete: completedDays.size };
}

function updateWelcome() {
  const el = document.getElementById("welcome-line");
  if (!el) return;
  const day = PLAN_DATA.find((d) => d.day === todayDay);
  const label = day ? `Day ${todayDay} (${day.dow}, ${day.date})` : `Day ${todayDay}`;
  el.textContent = `Welcome back, Charles! Today is ${label} — let's build your empire.`;
}

function updateDashboard() {
  const stats = computeStats();
  document.getElementById("stat-days-h9i0").textContent = stats.daysComplete;
  document.getElementById("stat-tasks-j1k2").textContent = stats.doneTasks;
  document.getElementById("stat-jobs-l3m4").textContent = state.jobs;
  document.getElementById("stat-reviews-n5o6").textContent = state.reviews;
  document.getElementById("days-done-label-p1a2").textContent = stats.daysComplete;

  const dayPct = Math.round((stats.daysComplete / 30) * 100);
  document.getElementById("progress-bar-main-b3c4").style.width = `${dayPct}%`;
  document.getElementById("progress-pct-d5e6").textContent = `${dayPct}% days`;

  const revPct = Math.min(100, Math.round((state.revenue / REVENUE_GOAL) * 100));
  document.getElementById("revenue-pct-f7g8").textContent = `${revPct}%`;
  document.getElementById("revenue-input-r5t6").value = state.revenue;
}

function getTypeBadge(type) {
  if (type === "weekday") return '<span class="badge-morning text-xs font-semibold px-2 py-0.5 rounded-full">WEEKDAY</span>';
  if (type === "weekend") return '<span class="badge-weekend text-xs font-semibold px-2 py-0.5 rounded-full">WEEKEND LITE</span>';
  if (type === "rest") return '<span class="badge-rest text-xs font-semibold px-2 py-0.5 rounded-full">REST DAY</span>';
  return "";
}

function getDayLabel(type) {
  if (type === "weekday") return { cls: "badge-morning", label: "MORNING HUSTLE" };
  if (type === "weekend") return { cls: "badge-weekend", label: "WEEKEND LITE" };
  if (type === "rest") return { cls: "badge-rest", label: "REST DAY" };
  return { cls: "badge-morning", label: "" };
}

function renderDayCards() {
  const grid = document.getElementById("day-cards-grid-u1v2");
  const weekDays = PLAN_DATA.filter((d) => d.weekNum === currentWeek);
  const stats = computeStats();

  let html = "";
  weekDays.forEach((day) => {
    const isComplete = stats.completedDays.has(day.day);
    const isToday = day.day === todayDay;
    const allTasks = [...day.morning, ...day.evening, ...day.weekend];
    const firstTask = allTasks.length > 0 ? allTasks[0].text : (day.type === "rest" ? "Rest & recharge. You've earned it!" : "");
    const preview = firstTask.length > 80 ? `${firstTask.substring(0, 80)}...` : firstTask;
    const label = getDayLabel(day.type);
    const completeBadge = isComplete ? '<span class="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">COMPLETE</span>' : "";
    const todayBadge = isToday ? '<span class="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-semibold">TODAY</span>' : "";
    const finalBadge = day.isFinal ? '<span class="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full font-semibold">FINAL DAY</span>' : "";
    const totalT = allTasks.length;
    const doneT = allTasks.filter((t) => {
      const block = day.morning.includes(t) ? "morning" : day.evening.includes(t) ? "evening" : "weekend";
      const idx = day[block].indexOf(t);
      return state.tasks[taskKey(day.day, block, idx)];
    }).length;

    html += `
      <div class="day-card glass-card-light p-4 ${isComplete ? "completed" : ""} ${isToday ? "active-day" : ""}" data-day="${day.day}">
        <div class="flex items-start justify-between mb-2 gap-2">
          <div>
            <span class="text-gold-400 font-black text-lg">Day ${day.day}</span>
            <span class="text-slate-400 text-sm ml-2">${day.dow}, ${day.date}</span>
          </div>
          <div class="flex flex-wrap gap-1 justify-end">${todayBadge}${completeBadge}${finalBadge}</div>
        </div>
        <div class="mb-2">
          <span class="${label.cls} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">${label.label}</span>
        </div>
        <p class="text-xs text-slate-400 mb-3 leading-relaxed">${preview}</p>
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-slate-500">${doneT}/${totalT} tasks</span>
          <span class="text-[10px] text-gold-500 font-semibold">Tap to expand →</span>
        </div>
        <div class="w-full bg-navy-800 rounded-full h-1 mt-2 overflow-hidden">
          <div class="h-1 rounded-full bg-gradient-to-r from-gold-600 to-gold-400 progress-fill" style="width: ${totalT > 0 ? Math.round((doneT / totalT) * 100) : 100}%"></div>
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;

  grid.querySelectorAll(".day-card").forEach((card) => {
    card.addEventListener("click", () => {
      openDayModal(parseInt(card.dataset.day, 10));
    });
  });
}

function renderWeekTheme() {
  const theme = WEEK_THEMES[currentWeek];
  document.getElementById("week-theme-banner-s9t0").innerHTML = `
    <p class="text-sm md:text-base font-semibold text-gold-400">${theme.icon} ${theme.title}</p>
    <p class="text-xs text-slate-400">${theme.desc}</p>
  `;
}

function renderTaskBlock(day, blockName, tasks, title, timeRange, emoji) {
  if (tasks.length === 0) return "";
  let html = `<div class="mb-5">
    <h4 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
      <span>${emoji}</span> ${title} <span class="text-xs text-slate-500 font-normal">${timeRange}</span>
    </h4>
    <div class="space-y-2">`;
  tasks.forEach((t, i) => {
    const k = taskKey(day.day, blockName, i);
    const isDone = state.tasks[k];
    const catClass = CAT_CLASSES[t.cat] || "cat-admin";
    const catIcon = CAT_ICONS[t.cat] || "⚙️";
    html += `
      <div class="flex items-start gap-3 p-3 rounded-lg bg-navy-800/60 ${isDone ? "task-done" : ""}" data-task-key="${k}">
        <input type="checkbox" class="checkbox-custom mt-0.5 task-checkbox" data-key="${k}" ${isDone ? "checked" : ""} />
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="${catClass} text-[10px] font-bold px-2 py-0.5 rounded-full">${catIcon} ${t.cat}</span>
            <span class="text-[10px] text-slate-500">⏱ ${t.time}</span>
          </div>
          <p class="task-text text-sm text-slate-300 leading-relaxed">${t.text}</p>
        </div>
      </div>`;
  });
  html += "</div></div>";
  return html;
}

function openDayModal(dayNum) {
  openDayNum = dayNum;
  const day = PLAN_DATA.find((d) => d.day === dayNum);
  if (!day) return;

  const overlay = document.getElementById("day-modal-overlay-y5z6");
  const body = document.getElementById("modal-body-e1f2");
  const typeBadge = getTypeBadge(day.type);

  let morningBlock = "";
  let eveningBlock = "";
  let weekendBlock = "";

  if (day.type === "weekday") {
    morningBlock = renderTaskBlock(day, "morning", day.morning, "Morning Block", "8:30 AM – 1:30 PM", "☀️");
    eveningBlock = renderTaskBlock(day, "evening", day.evening, "Evening Block", "After 6:00 PM", "🌙");
  }
  if (day.type === "weekend" || day.type === "rest") {
    weekendBlock = renderTaskBlock(day, "weekend", day.weekend, day.type === "rest" ? "Optional" : "Weekend Tasks", "15–30 min max", day.type === "rest" ? "😴" : "🌿");
  }

  const restMessage = day.type === "rest" && day.weekend.length === 0
    ? '<div class="text-center py-8"><p class="text-3xl mb-3">😴</p><p class="text-slate-400">Full rest day. You\'ve earned it, Charles!</p></div>'
    : "";

  const finalBanner = day.isFinal
    ? '<div class="bg-gradient-to-r from-gold-600/20 to-gold-400/10 border border-gold-500/30 rounded-xl p-4 mb-5 text-center"><p class="text-gold-400 font-bold text-lg">🏆 Congratulations! Day 30 — You Made It!</p><p class="text-sm text-slate-400">Time to celebrate and plan Month 2!</p></div>'
    : "";

  const todayBanner = day.day === todayDay
    ? '<div class="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3 mb-4 text-center"><p class="text-sky-400 font-semibold text-sm">📍 This is today\'s plan — start here.</p></div>'
    : "";

  body.innerHTML = `
    <div class="mb-5">
      <div class="flex flex-wrap items-center gap-3 mb-2">
        <h3 class="text-xl md:text-2xl font-black text-gold-400">Day ${day.day}</h3>
        <span class="text-sm text-slate-400">${day.dow}, ${day.date}, 2026</span>
        ${typeBadge}
      </div>
    </div>
    ${todayBanner}
    ${finalBanner}
    ${morningBlock}
    ${eveningBlock}
    ${weekendBlock}
    ${restMessage}
    ${day.tip ? `<div class="tipbox p-4 rounded-lg mb-4"><p class="text-xs font-bold text-gold-400 mb-1">💡 PRO TIP</p><p class="text-sm text-slate-300">${day.tip}</p></div>` : ""}
    ${day.quote ? `<div class="text-center pt-2 pb-1"><p class="text-xs text-slate-500 italic">${day.quote}</p></div>` : ""}
  `;

  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  body.querySelectorAll(".task-checkbox").forEach((cb) => {
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", (e) => {
      const key = e.target.dataset.key;
      state.tasks[key] = e.target.checked;
      saveState();
      updateDashboard();
      const parent = e.target.closest("[data-task-key]");
      if (parent) parent.classList.toggle("task-done", e.target.checked);
      renderDayCards();
    });
  });
}

function closeDayModal() {
  document.getElementById("day-modal-overlay-y5z6").classList.add("hidden");
  document.body.style.overflow = "";
  openDayNum = null;
}

function goToToday() {
  todayDay = getTodayDayNum();
  const day = PLAN_DATA.find((d) => d.day === todayDay);
  currentWeek = day?.weekNum || 1;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.week, 10) === currentWeek);
  });
  updateWelcome();
  renderWeekTheme();
  renderDayCards();
  openDayModal(todayDay);
  document.getElementById("plan-sec")?.scrollIntoView({ behavior: "smooth" });
}

function init() {
  if (typeof lucide !== "undefined" && typeof lucide.createIcons === "function") {
    lucide.createIcons();
  }

  const today = PLAN_DATA.find((d) => d.day === todayDay);
  currentWeek = today?.weekNum || 1;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.week, 10) === currentWeek);
  });

  updateWelcome();
  updateDashboard();
  renderWeekTheme();
  renderDayCards();

  document.getElementById("today-btn")?.addEventListener("click", goToToday);

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentWeek = parseInt(btn.dataset.week, 10);
      renderWeekTheme();
      renderDayCards();
    });
  });

  document.getElementById("revenue-input-r5t6").addEventListener("input", (e) => {
    state.revenue = parseInt(e.target.value, 10) || 0;
    saveState();
    updateDashboard();
  });

  document.querySelector(".jobs-plus-btn").addEventListener("click", () => {
    state.jobs += 1;
    saveState();
    updateDashboard();
  });
  document.querySelector(".jobs-minus-btn").addEventListener("click", () => {
    if (state.jobs > 0) state.jobs -= 1;
    saveState();
    updateDashboard();
  });

  document.querySelector(".reviews-plus-btn").addEventListener("click", () => {
    state.reviews += 1;
    saveState();
    updateDashboard();
  });
  document.querySelector(".reviews-minus-btn").addEventListener("click", () => {
    if (state.reviews > 0) state.reviews -= 1;
    saveState();
    updateDashboard();
  });

  document.getElementById("modal-close-btn-c9d0").addEventListener("click", closeDayModal);
  document.getElementById("day-modal-overlay-y5z6").addEventListener("click", (e) => {
    if (e.target.id === "day-modal-overlay-y5z6") closeDayModal();
  });

  document.getElementById("mobile-menu-btn-q8w1").addEventListener("click", () => {
    document.getElementById("mobile-menu-ov4k").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  });
  document.getElementById("mobile-close-btn-x9r2").addEventListener("click", () => {
    document.getElementById("mobile-menu-ov4k").classList.add("hidden");
    document.body.style.overflow = "";
  });
  document.querySelectorAll(".mobile-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.getElementById("mobile-menu-ov4k").classList.add("hidden");
      document.body.style.overflow = "";
    });
  });

  document.getElementById("reset-btn-w3x4").addEventListener("click", () => {
    document.getElementById("reset-modal-g3h4").classList.remove("hidden");
  });
  document.getElementById("reset-cancel-i5j6").addEventListener("click", () => {
    document.getElementById("reset-modal-g3h4").classList.add("hidden");
  });
  document.getElementById("reset-confirm-k7l8").addEventListener("click", () => {
    state = getDefaultState();
    saveState();
    updateDashboard();
    renderDayCards();
    document.getElementById("reset-modal-g3h4").classList.add("hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDayModal();
      document.getElementById("reset-modal-g3h4").classList.add("hidden");
      document.getElementById("mobile-menu-ov4k").classList.add("hidden");
      document.body.style.overflow = "";
    }
  });

  if (new URLSearchParams(window.location.search).get("today") === "1") {
    goToToday();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
