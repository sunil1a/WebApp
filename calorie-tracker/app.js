import { FOODS, VOLUME_ML } from "./foods.js";
import { parseMeal } from "./parser.js";
import { estimateFromText, estimateFromImage, describeError } from "./ai.js";

const MEALS = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const $ = (id) => document.getElementById(id);

// ---------- storage ----------
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
let entries = load("ct.entries", []);
let settings = { goal: 2000, apiKey: "", ...load("ct.settings", {}) };
const persist = () => save("ct.entries", entries);

// ---------- dates ----------
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const shiftDay = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d); };
const prettyDate = (k) => {
  if (k === dayKey()) return "Today";
  if (k === shiftDay(dayKey(), -1)) return "Yesterday";
  return fromKey(k).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};
const entriesFor = (k) => entries.filter((e) => e.date === k);
const totalFor = (k) => entriesFor(k).reduce((s, e) => s + e.kcal, 0);

function defaultMeal() {
  const h = new Date().getHours();
  if (h < 11) return "Breakfast";
  if (h < 16) return "Lunch";
  if (h < 19) return "Snacks";
  return "Dinner";
}

const fmtQty = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- tabs ----------
let dashDate = dayKey();
document.querySelectorAll(".tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === `tab-${btn.dataset.tab}`));
    if (btn.dataset.tab === "dashboard") renderDashboard();
    window.scrollTo(0, 0);
  });
});

// ---------- meal selector ----------
let currentMeal = defaultMeal();
const mealButtons = document.querySelectorAll("#meal-select button");
function renderMealSelect() {
  mealButtons.forEach((b) => {
    b.classList.toggle("active", b.dataset.meal === currentMeal);
    b.setAttribute("aria-checked", b.dataset.meal === currentMeal);
  });
}
mealButtons.forEach((b) => b.addEventListener("click", () => { currentMeal = b.dataset.meal; renderMealSelect(); }));

// ---------- status ----------
function setStatus(msg, isError = false) {
  $("status").textContent = msg;
  $("status").classList.toggle("error", isError);
}

// ---------- preview (items before saving) ----------
let preview = [];

function showPreview(items) {
  preview = items.map((it) => ({ ...it, perUnit: it.kcal != null && it.qty ? it.kcal / it.qty : null }));
  renderPreview();
}

function renderPreview() {
  $("preview-card").hidden = preview.length === 0;
  const list = $("preview-list");
  list.innerHTML = "";
  preview.forEach((it, i) => {
    const li = document.createElement("li");
    if (!it.matched) li.className = "unmatched";
    const note = !it.matched
      ? "Not found — enter calories"
      : it.source === "ai" ? `${esc(it.unit)} <span class="tag">AI estimate</span>` : esc(it.unit);
    li.innerHTML = `
      <input class="qty" type="number" min="0" step="0.5" value="${fmtQty(it.qty)}" aria-label="Quantity">
      <div class="name">${it.manual
        ? `<input class="name-in" type="text" placeholder="Food name" value="${esc(it.name)}" aria-label="Food name">`
        : `${esc(it.name)}<small>${note}</small>`}</div>
      <input class="kcal-in" type="number" min="0" step="1" value="${it.kcal ?? ""}" placeholder="kcal" aria-label="Calories">
      <button type="button" class="icon-btn" aria-label="Remove">&times;</button>`;
    const [qtyIn, kcalIn] = [li.querySelector(".qty"), li.querySelector(".kcal-in")];
    qtyIn.addEventListener("input", () => {
      const q = parseFloat(qtyIn.value) || 0;
      it.qty = q;
      if (it.perUnit != null) { it.kcal = Math.round(it.perUnit * q); kcalIn.value = it.kcal; }
      updatePreviewTotal();
    });
    kcalIn.addEventListener("input", () => {
      it.kcal = kcalIn.value === "" ? null : Math.max(0, Math.round(parseFloat(kcalIn.value)));
      it.perUnit = it.kcal != null && it.qty ? it.kcal / it.qty : null;
      updatePreviewTotal();
    });
    li.querySelector(".name-in")?.addEventListener("input", (e) => { it.name = e.target.value; });
    li.querySelector(".icon-btn").addEventListener("click", () => { preview.splice(i, 1); renderPreview(); });
    list.appendChild(li);
  });
  updatePreviewTotal();
}

function updatePreviewTotal() {
  $("preview-total").textContent = `${preview.reduce((s, it) => s + (it.kcal || 0), 0)} kcal`;
}

$("btn-add-row").addEventListener("click", () => {
  preview.push({ name: "", qty: 1, unit: "serving", kcal: null, perUnit: null, matched: true, manual: true, source: "manual" });
  renderPreview();
  $("preview-list").lastElementChild.querySelector(".name-in").focus();
});

$("btn-discard").addEventListener("click", () => { preview = []; renderPreview(); clearPhoto(); });

$("btn-save").addEventListener("click", () => {
  const missing = preview.filter((it) => it.kcal == null || (it.manual && !it.name.trim()));
  if (missing.length) {
    setStatus("Enter a name and calories for every item, or remove it.", true);
    return;
  }
  const now = new Date();
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  for (const it of preview) {
    entries.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      date: dayKey(now), time, meal: currentMeal,
      name: it.name.trim(), qty: it.qty, unit: it.unit, kcal: it.kcal, source: it.source || "db",
    });
  }
  persist();
  setStatus(`Added ${preview.length} item${preview.length > 1 ? "s" : ""} to ${currentMeal}.`);
  preview = [];
  $("food-text").value = "";
  clearPhoto();
  renderPreview();
  renderToday();
});

// ---------- calculate from text ----------
$("btn-calc").addEventListener("click", calculate);
$("food-text").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) calculate();
});

async function calculate() {
  const text = $("food-text").value.trim();
  if (!text) { setStatus("Type or speak what you ate first.", true); return; }
  const items = parseMeal(text, FOODS, VOLUME_ML);
  const unknown = items.filter((it) => !it.matched);

  if (unknown.length && settings.apiKey) {
    setStatus("Estimating unfamiliar items with AI…");
    $("btn-calc").disabled = true;
    try {
      const desc = unknown.map((it) => it.name).join("\n");
      const estimated = await estimateFromText(settings.apiKey, desc);
      const known = items.filter((it) => it.matched);
      showPreview([...known, ...estimated]);
      setStatus("");
    } catch (err) {
      showPreview(items);
      setStatus(describeError(err), true);
    } finally {
      $("btn-calc").disabled = false;
    }
    return;
  }

  showPreview(items);
  if (!items.length) setStatus("Couldn't find any food in that. Try e.g. “2 roti and dal”.", true);
  else if (unknown.length) setStatus("Some items aren't in the food list — enter their calories, or add an API key in Settings for AI estimates.");
  else setStatus("");
}

// ---------- voice dictation ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
if (!SpeechRecognition) {
  $("btn-mic").disabled = true;
  $("btn-mic").title = "Voice input isn't supported in this browser";
} else {
  $("btn-mic").addEventListener("click", () => {
    if (recognizer) { recognizer.stop(); return; }
    recognizer = new SpeechRecognition();
    recognizer.lang = "en-IN";
    recognizer.interimResults = true;
    recognizer.continuous = false;
    const base = $("food-text").value.trim();
    recognizer.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      $("food-text").value = base ? `${base}, ${said}` : said;
    };
    recognizer.onerror = (e) => {
      setStatus(e.error === "not-allowed" ? "Microphone permission denied." : "Didn't catch that — try again.", true);
    };
    recognizer.onend = () => {
      recognizer = null;
      $("btn-mic").classList.remove("listening");
      $("btn-mic").querySelector("span").textContent = "Speak";
      if ($("food-text").value.trim() !== base) calculate();
    };
    recognizer.start();
    $("btn-mic").classList.add("listening");
    $("btn-mic").querySelector("span").textContent = "Stop";
    setStatus("Listening… say something like “two roti and one bowl dal”.");
  });
}

// ---------- photo ----------
function clearPhoto() {
  $("photo-preview").hidden = true;
  $("photo-preview").removeAttribute("src");
  $("photo-input").value = "";
}

function resizeImage(file, maxSide = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image.")); };
    img.src = url;
  });
}

$("photo-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!settings.apiKey) {
    setStatus("Photo logging needs an Anthropic API key — add one in Settings.", true);
    clearPhoto();
    return;
  }
  try {
    const dataUrl = await resizeImage(file);
    $("photo-preview").src = dataUrl;
    $("photo-preview").hidden = false;
    setStatus("Analysing your meal photo…");
    $("btn-calc").disabled = true;
    const items = await estimateFromImage(settings.apiKey, dataUrl.split(",")[1], "image/jpeg", $("food-text").value.trim());
    showPreview(items);
    setStatus(items.length ? "Check the portions and adjust if needed." : "No food recognised in that photo.", !items.length);
  } catch (err) {
    setStatus(describeError(err), true);
  } finally {
    $("btn-calc").disabled = false;
  }
});

// ---------- today list (log tab) ----------
function entryRow(e, onDelete) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div class="name">${esc(e.name)}<small>${esc(e.meal)} · ${fmtQty(e.qty)} ${esc(e.unit)}${e.time ? ` · ${esc(e.time)}` : ""}</small></div>
    <span class="kcal">${e.kcal} kcal</span>
    <button type="button" class="icon-btn" aria-label="Delete ${esc(e.name)}">&times;</button>`;
  li.querySelector("button").addEventListener("click", () => {
    entries = entries.filter((x) => x.id !== e.id);
    persist();
    onDelete();
  });
  return li;
}

function renderToday() {
  const k = dayKey();
  const list = $("today-list");
  list.innerHTML = "";
  const todays = entriesFor(k);
  [...todays].reverse().forEach((e) => list.appendChild(entryRow(e, renderToday)));
  $("today-empty").hidden = todays.length > 0;
  $("log-total").textContent = `${totalFor(k)} / ${settings.goal} kcal`;
}

// ---------- dashboard ----------
const RING_LEN = 2 * Math.PI * 52;

function renderDashboard() {
  const k = dashDate;
  const total = totalFor(k);
  const goal = settings.goal;
  $("dash-date").textContent = prettyDate(k);
  $("next-day").disabled = k >= dayKey();
  $("dash-total").textContent = total;
  $("dash-goal").textContent = goal;

  const ring = $("ring-fg");
  ring.style.strokeDasharray = RING_LEN;
  ring.style.strokeDashoffset = RING_LEN * (1 - Math.min(total / goal, 1));
  ring.classList.toggle("over", total > goal);
  $("dash-remaining").textContent = total > goal
    ? `${total - goal} kcal over your goal`
    : `${goal - total} kcal remaining`;

  // per meal
  const dayEntries = entriesFor(k);
  $("meal-bars").innerHTML = MEALS.map((m) => {
    const kc = dayEntries.filter((e) => e.meal === m).reduce((s, e) => s + e.kcal, 0);
    const pct = total ? Math.round((kc / total) * 100) : 0;
    return `<div class="row"><div class="row-head"><span>${m}</span><span class="muted">${kc} kcal</span></div>
      <div class="bar"><span style="width:${pct}%"></span></div></div>`;
  }).join("");

  // week chart, ending on the selected day
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(k, i - 6));
  const totals = days.map(totalFor);
  const max = Math.max(goal, ...totals) * 1.2;
  const chart = $("week-chart");
  chart.innerHTML = `<div class="plot"><div class="goal-line" style="bottom:${(goal / max) * 100}%" title="Goal ${goal} kcal"></div>`
    + days.map((d, i) => `
      <div class="col${d === k ? " sel" : ""}${totals[i] > goal ? " over" : ""}" data-day="${d}" title="${prettyDate(d)}: ${totals[i]} kcal">
        <span class="v">${totals[i] || ""}</span>
        <div class="b" style="height:${(totals[i] / max) * 100}%"></div>
      </div>`).join("")
    + `</div><div class="days">${days.map((d) => `<span>${fromKey(d).toLocaleDateString(undefined, { weekday: "narrow" })}</span>`).join("")}</div>`;
  chart.querySelectorAll(".col").forEach((c) => c.addEventListener("click", () => {
    if (c.dataset.day <= dayKey()) { dashDate = c.dataset.day; renderDashboard(); }
  }));

  // entries
  const list = $("dash-list");
  list.innerHTML = "";
  MEALS.forEach((m) => dayEntries.filter((e) => e.meal === m)
    .forEach((e) => list.appendChild(entryRow(e, () => { renderDashboard(); renderToday(); }))));
  $("dash-empty").hidden = dayEntries.length > 0;
}

$("prev-day").addEventListener("click", () => { dashDate = shiftDay(dashDate, -1); renderDashboard(); });
$("next-day").addEventListener("click", () => {
  if (dashDate < dayKey()) { dashDate = shiftDay(dashDate, 1); renderDashboard(); }
});

// ---------- settings ----------
$("goal-input").value = settings.goal;
$("key-input").value = settings.apiKey;
$("btn-save-settings").addEventListener("click", () => {
  const goal = parseInt($("goal-input").value, 10);
  settings.goal = goal >= 800 && goal <= 6000 ? goal : 2000;
  settings.apiKey = $("key-input").value.trim();
  $("goal-input").value = settings.goal;
  save("ct.settings", settings);
  $("settings-status").textContent = "Saved.";
  setTimeout(() => { $("settings-status").textContent = ""; }, 2000);
  renderToday();
});
$("goal-input").addEventListener("change", () => $("btn-save-settings").click());

$("btn-export").addEventListener("click", () => {
  const rows = [["date", "time", "meal", "item", "quantity", "unit", "kcal"],
    ...entries.map((e) => [e.date, e.time, e.meal, e.name, e.qty, e.unit, e.kcal])];
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `calories-${dayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("btn-clear").addEventListener("click", () => {
  if (!confirm("Delete all logged meals? This can't be undone.")) return;
  entries = [];
  persist();
  renderToday();
  renderDashboard();
});

// ---------- init ----------
$("today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
renderMealSelect();
renderToday();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
