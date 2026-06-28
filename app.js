/* global Chart, RUNS, RUNNER_COLORS, ANALYSES */

const RUNNERS = Object.keys(RUNS);

// Coureurs actuellement affichés (pilote cartes, graphiques et tableau).
// Par défaut : tous.
let viewRunners = [...RUNNERS];

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
  el.innerHTML = viewRunners.map((name) => {
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
let currentMetric = "distance";
function renderEvolution(metricKey = currentMetric) {
  currentMetric = metricKey;
  const metric = METRICS[metricKey];
  const ctx = document.getElementById("evolutionChart");

  const datasets = viewRunners.map((name) => {
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
let radarChart;
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

  const datasets = viewRunners.map((name) => ({
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

  if (radarChart) radarChart.destroy();
  radarChart = new Chart(ctx, {
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

// ---------- Insights objectifs (calculés sur chaque coureur séparément) ----------
// Pour chaque séance : la séance précédente du même coureur + drapeaux record.
const INSIGHTS = (() => {
  const meta = {};
  RUNNERS.forEach((name) => {
    const sorted = [...RUNS[name]].sort((a, b) => a.date.localeCompare(b.date));
    meta[name] = {};
    let bestPace = Infinity;
    let longest = -Infinity;
    sorted.forEach((r, i) => {
      meta[name][r.date] = {
        prev: i > 0 ? sorted[i - 1] : null,
        isPacePR: i > 0 && r.paceSec < bestPace,
        isDistPR: i > 0 && r.distance > longest,
      };
      bestPace = Math.min(bestPace, r.paceSec);
      longest = Math.max(longest, r.distance);
    });
  });
  return meta;
})();

// Puce d'écart vs séance précédente. good : true=vert, false=orange, null=neutre.
function deltaChip(label, value, fmt, good) {
  if (Math.abs(value) < 1e-9) return `<span class="delta-chip flat">${label} =</span>`;
  const arrow = value > 0 ? "▲" : "▼";
  const cls = good === null ? "flat" : good ? "good" : "bad";
  return `<span class="delta-chip ${cls}">${label} ${arrow} ${fmt(Math.abs(value))}</span>`;
}

function analysisHtml(r) {
  const m = INSIGHTS[r.name][r.date];
  const a = (typeof ANALYSES !== "undefined" && ANALYSES[r.name]) ? ANALYSES[r.name][r.date] : null;

  let deltas;
  if (m.prev) {
    const dPace = r.paceSec - m.prev.paceSec; // < 0 = plus rapide
    const dDist = r.distance - m.prev.distance;
    const dHr = r.hr - m.prev.hr;
    deltas =
      deltaChip("Allure", dPace, (v) => Math.round(v) + " s/km", dPace < 0) +
      deltaChip("Distance", dDist, (v) => v.toFixed(2) + " km", dDist > 0) +
      deltaChip("FC", dHr, (v) => Math.round(v) + " bpm", null);
  } else {
    deltas = `<span class="delta-chip flat">Première séance — référence de départ</span>`;
  }

  const prBadges =
    (m.isPacePR ? `<span class="pr">🏅 Record d'allure</span>` : "") +
    (m.isDistPR ? `<span class="pr">🏅 Record de distance</span>` : "");

  const trend = a ? a.trend : "flat";
  const verdict = a ? a.verdict : "Analyse à venir";
  const text = a ? a.text : "Analyse non disponible pour cette séance.";

  return `
    <div class="analysis">
      <div class="analysis-head">
        <span class="verdict trend-${trend}">${verdict}</span>
        ${prBadges}
      </div>
      <div class="delta-row">${m.prev ? '<span class="delta-label">vs séance précédente :</span>' : ""}${deltas}</div>
      <p class="coach">${text}</p>
    </div>`;
}

// ---------- Tableau ----------
function renderTable() {
  const tbody = document.querySelector("#runsTable tbody");
  let rows = viewRunners.flatMap((name) => RUNS[name].map((r) => ({ ...r, name })));
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

  tbody.innerHTML = rows
    .map((r) => {
      const key = `${r.name}__${r.date}`;
      return `
      <tr class="run-row" data-key="${key}" aria-expanded="false">
        <td><span class="chevron">▸</span> ${fmtDate(r.date)}</td>
        <td><span class="badge"><span class="dot" style="background:${RUNNER_COLORS[r.name]}"></span>${r.name}</span></td>
        <td>${r.distance.toFixed(2)} km</td>
        <td>${fmtDuration(r.duration)}</td>
        <td>${fmtPace(r.paceSec)}/km</td>
        <td>${r.hr} bpm</td>
        <td>${r.cadence} spm</td>
        <td>${r.activeCal} cal</td>
        <td>${r.elevation} m</td>
      </tr>
      <tr class="analysis-row" data-key="${key}">
        <td colspan="9">${analysisHtml(r)}</td>
      </tr>`;
    })
    .join("");
}

// ---------- Sélecteur global de coureur ----------
function applyRunnerFilter(value) {
  viewRunners = value === "all" ? [...RUNNERS] : [value];
  renderCards();
  renderEvolution();
  renderRadar();
  renderTable();
}

function renderRunnerFilter() {
  const el = document.getElementById("runnerFilter");
  const opts = [["all", "Tous"], ...RUNNERS.map((n) => [n, n])];
  el.innerHTML = opts
    .map(([k, label], i) => `<button data-runner="${k}" class="${i === 0 ? "active" : ""}">${label}</button>`)
    .join("");
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyRunnerFilter(btn.dataset.runner);
    });
  });
}

// ---------- Init ----------
Chart.defaults.color = "#98989d";
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

renderRunnerFilter();
renderCards();
renderMetricSwitch();
renderEvolution("distance");
renderRadar();
renderTable();
document.getElementById("totalRuns").textContent = sum(RUNNERS.map((n) => RUNS[n].length));

// Déploiement de l'analyse au clic sur une ligne (délégation : survit aux re-render)
document.querySelector("#runsTable tbody").addEventListener("click", (e) => {
  const row = e.target.closest(".run-row");
  if (!row) return;
  const open = row.classList.toggle("open");
  row.setAttribute("aria-expanded", String(open));
  const detail = row.parentElement.querySelector(`.analysis-row[data-key="${CSS.escape(row.dataset.key)}"]`);
  if (detail) detail.classList.toggle("open", open);
});
