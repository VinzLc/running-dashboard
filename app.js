/* global Chart, RUNS, RUNNER_COLORS */

const RUNNERS = Object.keys(RUNS);

// ---------- Helpers ----------
const fmtPace = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
};
const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// ---------- Métriques disponibles ----------
const METRICS = {
  distance: { label: "Distance", unit: "km", get: (r) => r.distance, fmt: (v) => v.toFixed(2) + " km" },
  paceSec:  { label: "Allure",   unit: "/km", get: (r) => r.paceSec, fmt: (v) => fmtPace(v) + "/km", invert: true },
  hr:       { label: "FC moy.",  unit: "bpm", get: (r) => r.hr, fmt: (v) => Math.round(v) + " bpm" },
  cadence:  { label: "Cadence",  unit: "spm", get: (r) => r.cadence, fmt: (v) => Math.round(v) + " spm" },
  activeCal:{ label: "Calories", unit: "cal", get: (r) => r.activeCal, fmt: (v) => Math.round(v) + " cal" },
  duration: { label: "Durée",    unit: "min", get: (r) => r.duration, fmt: (v) => fmtDuration(v) },
};

// Axe temps commun (toutes les dates, triées)
const ALL_DATES = [...new Set(RUNNERS.flatMap((n) => RUNS[n].map((r) => r.date)))].sort();

// ---------- Cartes récap ----------
function renderCards() {
  const el = document.getElementById("summaryCards");
  el.innerHTML = RUNNERS.map((name) => {
    const runs = RUNS[name];
    const color = RUNNER_COLORS[name];
    const totalKm = sum(runs.map((r) => r.distance));
    const avgPace = avg(runs.map((r) => r.paceSec));
    const avgHr = avg(runs.map((r) => r.hr));
    const bestPace = Math.min(...runs.map((r) => r.paceSec));
    const longest = Math.max(...runs.map((r) => r.distance));
    const totalCal = sum(runs.map((r) => r.activeCal));
    return `
      <div class="runner-card">
        <h3><span class="dot" style="background:${color}"></span>${name}</h3>
        <div class="stat-grid">
          <div class="stat"><div class="label">Séances</div><div class="value">${runs.length}</div></div>
          <div class="stat"><div class="label">Distance totale</div><div class="value">${totalKm.toFixed(1)} <small>km</small></div></div>
          <div class="stat"><div class="label">Allure moy.</div><div class="value">${fmtPace(avgPace)}<small>/km</small></div></div>
          <div class="stat"><div class="label">Meilleure allure</div><div class="value">${fmtPace(bestPace)}<small>/km</small></div></div>
          <div class="stat"><div class="label">FC moyenne</div><div class="value">${Math.round(avgHr)} <small>bpm</small></div></div>
          <div class="stat"><div class="label">Plus longue</div><div class="value">${longest.toFixed(2)} <small>km</small></div></div>
          <div class="stat"><div class="label">Calories actives</div><div class="value">${totalCal} <small>cal</small></div></div>
          <div class="stat"><div class="label">Distance moy.</div><div class="value">${(totalKm / runs.length).toFixed(2)} <small>km</small></div></div>
        </div>
      </div>`;
  }).join("");
}

// ---------- Graphique d'évolution ----------
let evoChart;
function renderEvolution(metricKey) {
  const metric = METRICS[metricKey];
  const ctx = document.getElementById("evolutionChart");

  const datasets = RUNNERS.map((name) => {
    const byDate = Object.fromEntries(RUNS[name].map((r) => [r.date, metric.get(r)]));
    return {
      label: name,
      data: ALL_DATES.map((d) => (d in byDate ? byDate[d] : null)),
      borderColor: RUNNER_COLORS[name],
      backgroundColor: RUNNER_COLORS[name] + "33",
      borderWidth: 2.5,
      tension: 0.35,
      spanGaps: true,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: RUNNER_COLORS[name],
    };
  });

  const cfg = {
    type: "line",
    data: { labels: ALL_DATES.map(fmtDate), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#f5f5f7", font: { size: 13 }, usePointStyle: true } },
        tooltip: {
          callbacks: { label: (c) => `${c.dataset.label}: ${c.raw == null ? "—" : metric.fmt(c.raw)}` },
        },
      },
      scales: {
        x: { ticks: { color: "#98989d" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: {
          reverse: !!metric.invert,
          ticks: {
            color: "#98989d",
            callback: (v) => (metricKey === "paceSec" ? fmtPace(v) : metricKey === "duration" ? fmtDuration(v) : v),
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  };

  if (evoChart) {
    evoChart.data = cfg.data;
    evoChart.options = cfg.options;
    evoChart.update();
  } else {
    evoChart = new Chart(ctx, cfg);
  }
}

function renderMetricSwitch() {
  const el = document.getElementById("metricSwitch");
  el.innerHTML = Object.entries(METRICS)
    .map(([k, m], i) => `<button data-metric="${k}" class="${i === 0 ? "active" : ""}">${m.label}</button>`)
    .join("");
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderEvolution(btn.dataset.metric);
    });
  });
}

// ---------- Radar comparatif (moyennes normalisées) ----------
function renderRadar() {
  const ctx = document.getElementById("radarChart");
  const axes = [
    { key: "distance", label: "Distance", higher: true },
    { key: "paceSec", label: "Vitesse", higher: false },
    { key: "cadence", label: "Cadence", higher: true },
    { key: "hr", label: "Intensité FC", higher: true },
    { key: "activeCal", label: "Calories", higher: true },
    { key: "duration", label: "Endurance", higher: true },
  ];

  // bornes globales pour normaliser 0..100
  const bounds = {};
  axes.forEach((a) => {
    const vals = RUNNERS.flatMap((n) => RUNS[n].map((r) => r[a.key]));
    bounds[a.key] = { min: Math.min(...vals), max: Math.max(...vals) };
  });

  const datasets = RUNNERS.map((name) => ({
    label: name,
    data: axes.map((a) => {
      const m = avg(RUNS[name].map((r) => r[a.key]));
      const { min, max } = bounds[a.key];
      let norm = max === min ? 50 : ((m - min) / (max - min)) * 100;
      if (!a.higher) norm = 100 - norm; // pour l'allure : plus rapide = mieux
      return Math.round(norm);
    }),
    borderColor: RUNNER_COLORS[name],
    backgroundColor: RUNNER_COLORS[name] + "26",
    borderWidth: 2,
    pointBackgroundColor: RUNNER_COLORS[name],
  }));

  new Chart(ctx, {
    type: "radar",
    data: { labels: axes.map((a) => a.label), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#f5f5f7", usePointStyle: true } },
        tooltip: { enabled: false },
      },
      scales: {
        r: {
          angleLines: { color: "rgba(255,255,255,0.1)" },
          grid: { color: "rgba(255,255,255,0.1)" },
          pointLabels: { color: "#f5f5f7", font: { size: 12 } },
          ticks: { display: false, maxTicksLimit: 5 },
          suggestedMin: 0,
          suggestedMax: 100,
        },
      },
    },
  });
}

// ---------- Tableau ----------
function renderTable(filter = "all") {
  const tbody = document.querySelector("#runsTable tbody");
  let rows = RUNNERS.flatMap((name) => RUNS[name].map((r) => ({ ...r, name })));
  if (filter !== "all") rows = rows.filter((r) => r.name === filter);
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td><span class="badge"><span class="dot" style="background:${RUNNER_COLORS[r.name]}"></span>${r.name}</span></td>
        <td>${r.distance.toFixed(2)} km</td>
        <td>${fmtDuration(r.duration)}</td>
        <td>${fmtPace(r.paceSec)}/km</td>
        <td>${r.hr} bpm</td>
        <td>${r.cadence} spm</td>
        <td>${r.activeCal} cal</td>
        <td>${r.elevation} m</td>
      </tr>`
    )
    .join("");
}

function renderFilterSwitch() {
  const el = document.getElementById("filterSwitch");
  const opts = [["all", "Tous"], ...RUNNERS.map((n) => [n, n])];
  el.innerHTML = opts
    .map(([k, label], i) => `<button data-filter="${k}" class="${i === 0 ? "active" : ""}">${label}</button>`)
    .join("");
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTable(btn.dataset.filter);
    });
  });
}

// ---------- Init ----------
Chart.defaults.color = "#98989d";
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

renderCards();
renderMetricSwitch();
renderEvolution("distance");
renderRadar();
renderFilterSwitch();
renderTable();
document.getElementById("totalRuns").textContent = sum(RUNNERS.map((n) => RUNS[n].length));
