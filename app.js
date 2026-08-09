/* global Chart, RUNS, RUNNER_COLORS, ANALYSES, POKEDEX */

const RUNNERS = Object.keys(RUNS);

// Coureurs actuellement affichés (pilote cartes, graphiques et tableau).
// Par défaut : tous.
let viewRunners = [...RUNNERS];

// ---------- Filtre de distance ----------
// Comparer ce qui est comparable : une séance appartient au seau de son
// kilométrage entier (5,39 km → « 5 km »), et tout ce qui est sous 5 km tient
// dans un seul seau — à ce stade, un 3,7 km et un 4,8 km relèvent de la même
// mise en route. Par défaut, aucun filtre.
const ANY_DISTANCE = "all";
const SUB_5 = "sub5";
let viewBucket = ANY_DISTANCE;

const bucketOf = (r) => (r.distance < 5 ? SUB_5 : String(Math.floor(r.distance)));

// Les seaux proposés sont déduits des données, pas écrits en dur : le jour où
// un premier 6 km tombe, le bouton apparaît de lui-même — et en attendant,
// aucun bouton ne renvoie vers un graphique vide.
const DISTANCE_BUCKETS = (() => {
  const present = new Set(RUNNERS.flatMap((n) => RUNS[n].map(bucketOf)));
  const buckets = [];
  if (present.delete(SUB_5)) buckets.push({ key: SUB_5, label: "Moins de 5 km" });
  [...present]
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((km) => buckets.push({ key: String(km), label: `${km} km` }));
  return buckets;
})();

const bucketLabel = (key) => (DISTANCE_BUCKETS.find((b) => b.key === key) || {}).label || "";

// Séances d'un coureur, filtre de distance appliqué.
const runsOf = (name) =>
  viewBucket === ANY_DISTANCE ? RUNS[name] : RUNS[name].filter((r) => bucketOf(r) === viewBucket);

// Certaines combinaisons ne contiennent aucune séance — Ju n'a pas encore
// déposé de capture, Anaïs n'a pas encore couru 6 km — et un graphique vide
// n'explique rien de lui-même. `metric` couvre le second cas de vide : la
// sélection contient des séances, mais aucune ne mesure la métrique demandée.
function emptyMessage(metric) {
  // Le libellé garde sa casse : « fc moy. » se lit comme une coquille.
  if (metric) return `Aucune donnée de ${metric.label} pour cette sélection.`;
  const scope = viewBucket === ANY_DISTANCE ? "" : ` de ${bucketLabel(viewBucket).toLowerCase()}`;
  return `Aucune séance${scope} pour l'instant.`;
}

// Toutes les applis ne mesurent pas tout : adidas Running, côté Didi, ne donne
// ni FC ni cadence ni dénivelé. Une métrique n'existe donc pour un coureur que
// si au moins une de ses séances la porte — et il faut le vérifier avant de
// tracer, de moyenner ou d'afficher quoi que ce soit.
const hasMetric = (runs, key) => runs.some((r) => r[key] != null);

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
  distance: { label: "Distance", unit: "km", get: (r) => r.distance, fmt: (v) => v.toFixed(2) + " km",
    desc: "Distance totale parcourue pendant la séance, en kilomètres. Plus elle monte, plus l'endurance progresse." },
  paceSec:  { label: "Allure",   unit: "/km", get: (r) => r.paceSec, fmt: (v) => fmtPace(v) + "/km", invert: true,
    desc: "Allure : temps moyen pour parcourir 1 km (min'sec\"/km). Plus la valeur est basse, plus tu cours vite." },
  hr:       { label: "FC moy.",  unit: "bpm", get: (r) => r.hr, fmt: (v) => Math.round(v) + " bpm",
    desc: "Fréquence cardiaque moyenne, en battements par minute (bpm). Elle reflète l'intensité de l'effort ; à allure égale, une FC qui baisse = un cœur qui s'améliore." },
  cadence:  { label: "Cadence",  unit: "spm", get: (r) => r.cadence, fmt: (v) => Math.round(v) + " spm",
    desc: "Cadence : nombre de pas par minute (spm, steps per minute). Une cadence plus élevée traduit une foulée plus vive et souvent plus économe." },
  activeCal:{ label: "Calories", unit: "cal", get: (r) => r.activeCal, fmt: (v) => Math.round(v) + " cal",
    desc: "Calories actives brûlées pendant la séance (l'énergie dépensée par l'effort, hors métabolisme de base)." },
  duration: { label: "Durée",    unit: "min", get: (r) => r.duration, fmt: (v) => fmtDuration(v),
    desc: "Durée totale de la séance (temps de course), en minutes et secondes." },
};

// Axe temps commun aux séances affichées, trié. Recalculé à chaque rendu :
// garder les dates des séances filtrées étirerait l'axe sur du vide.
const visibleDates = () =>
  [...new Set(viewRunners.flatMap((n) => runsOf(n).map((r) => r.date)))].sort();

// Message affiché par-dessus un graphique sans donnée (ou retiré si data revient).
function setChartEmpty(canvasId, message) {
  const wrap = document.getElementById(canvasId).parentElement;
  let note = wrap.querySelector(".empty-note");
  if (!message) {
    if (note) note.remove();
    return;
  }
  if (!note) {
    note = document.createElement("p");
    note.className = "empty-note";
    wrap.appendChild(note);
  }
  note.textContent = message;
}

// ---------- Cartes récap ----------
function renderCards() {
  const el = document.getElementById("summaryCards");
  el.innerHTML = viewRunners.map((name) => {
    const runs = runsOf(name);
    const color = RUNNER_COLORS[name];
    if (!runs.length) {
      return `
      <div class="runner-card empty">
        <h3><span class="dot" style="background:${color}"></span>${name}</h3>
        <p class="empty-note">${emptyMessage()}</p>
      </div>`;
    }
    const totalKm = sum(runs.map((r) => r.distance));
    const avgPace = avg(runs.map((r) => r.paceSec));
    const bestPace = Math.min(...runs.map((r) => r.paceSec));
    const longest = Math.max(...runs.map((r) => r.distance));
    const totalCal = sum(runs.map((r) => r.activeCal));

    // Chaque coureur remplit les huit cases, mais pas avec les mêmes chiffres :
    // la FC pour ceux dont la montre la mesure, la vitesse de pointe pour ceux
    // dont l'appli la donne. Une case absente est retirée, jamais mise à zéro.
    const stats = [
      ["Séances", `${runs.length}`],
      ["Distance totale", `${totalKm.toFixed(1)} <small>km</small>`],
      ["Allure moy.", `${fmtPace(avgPace)}<small>/km</small>`],
      ["Meilleure allure", `${fmtPace(bestPace)}<small>/km</small>`],
    ];
    if (hasMetric(runs, "hr")) {
      const avgHr = avg(runs.filter((r) => r.hr != null).map((r) => r.hr));
      stats.push(["FC moyenne", `${Math.round(avgHr)} <small>bpm</small>`]);
    }
    if (hasMetric(runs, "maxSpeed")) {
      const topSpeed = Math.max(...runs.filter((r) => r.maxSpeed != null).map((r) => r.maxSpeed));
      stats.push(["Vitesse de pointe", `${topSpeed.toFixed(1)} <small>km/h</small>`]);
    }
    stats.push(
      ["Plus longue", `${longest.toFixed(2)} <small>km</small>`],
      ["Calories actives", `${totalCal} <small>cal</small>`],
      ["Distance moy.", `${(totalKm / runs.length).toFixed(2)} <small>km</small>`],
    );

    return `
      <div class="runner-card">
        <h3><span class="dot" style="background:${color}"></span>${name}</h3>
        <div class="stat-grid">
          ${stats
            .map(([label, value]) => `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`)
            .join("")}
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

  const descEl = document.getElementById("metricDesc");
  if (descEl) descEl.textContent = metric.desc;

  const dates = visibleDates();

  // Un coureur sans séance dans le filtre courant — ou dont l'appli ne mesure
  // pas la métrique affichée — n'est pas tracé plutôt que tracé vide : une
  // entrée de légende sans courbe se lit comme un bug.
  const plotted = viewRunners.filter(
    (name) => runsOf(name).length && hasMetric(runsOf(name), metricKey),
  );
  setChartEmpty(
    "evolutionChart",
    plotted.length ? "" : emptyMessage(dates.length ? metric : null),
  );

  const datasets = plotted.map((name) => {
    // `?? null` : une séance isolée peut manquer la métrique alors que d'autres
    // l'ont (Didi n'a pas de FC du tout, mais le cas se poserait pour une montre
    // changée en cours de route). Chart.js coupe sur null, pas sur undefined.
    const byDate = Object.fromEntries(runsOf(name).map((r) => [r.date, metric.get(r) ?? null]));
    return {
      label: name,
      data: dates.map((d) => (d in byDate ? byDate[d] : null)),
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
    data: { labels: dates.map(fmtDate), datasets },
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
  buildSwitch("metricSwitch", Object.entries(METRICS).map(([k, m]) => [k, m.label]), renderEvolution);
}

// ---------- Radar comparatif (moyennes normalisées) ----------
let radarChart;
function renderRadar() {
  const ctx = document.getElementById("radarChart");
  const ALL_AXES = [
    { key: "distance", label: "Distance", higher: true },
    { key: "paceSec", label: "Vitesse", higher: false },
    { key: "cadence", label: "Cadence", higher: true },
    { key: "hr", label: "Intensité FC", higher: true },
    { key: "activeCal", label: "Calories", higher: true },
    { key: "duration", label: "Endurance", higher: true },
  ];

  const shown = viewRunners.filter((name) => runsOf(name).length);
  setChartEmpty("radarChart", shown.length ? "" : emptyMessage());

  // Un radar ne compare que sur des axes communs : dès que l'un des coureurs
  // affichés ne mesure pas la cadence ou la FC, l'axe disparaît pour tout le
  // monde. Le garder en mettant l'autre à zéro dessinerait un creux qui se lit
  // comme une contre-performance alors que c'est une absence de mesure.
  const axes = ALL_AXES.filter((a) => shown.every((name) => hasMetric(runsOf(name), a.key)));

  // Bornes de normalisation prises sur tous les coureurs, mais dans le filtre
  // de distance courant : à 5 km, c'est aux 5 km d'en face qu'on se compare.
  // Elles ne dépendent pas de viewRunners, sinon isoler un coureur le
  // repousserait mécaniquement à 100 sur chaque axe.
  const bounds = {};
  axes.forEach((a) => {
    const vals = RUNNERS.flatMap((n) => runsOf(n).map((r) => r[a.key])).filter((v) => v != null);
    bounds[a.key] = { min: Math.min(...vals), max: Math.max(...vals) };
  });

  const datasets = shown.map((name) => ({
    label: name,
    data: axes.map((a) => {
      const m = avg(runsOf(name).filter((r) => r[a.key] != null).map((r) => r[a.key]));
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

// Détail kilomètre par kilomètre, lu sur la capture « Splits » (absent des
// séances antérieures à août 2026, d'où le retour vide).
function splitsHtml(r) {
  if (!r.splits || !r.splits.length) return "";

  // Seuls les kilomètres complets fixent l'échelle : le dernier tronçon fait
  // souvent quelques dizaines de mètres, son allure extrapolée est bruitée et
  // écraserait toutes les autres barres si on la laissait borner l'échelle.
  const full = r.splits.filter((s) => !s.partial);
  if (!full.length) return "";
  const fastest = Math.min(...full.map((s) => s.paceSec));
  const slowest = Math.max(...full.map((s) => s.paceSec));
  const span = slowest - fastest || 1;
  // Barre = temps passé : plus elle est longue, plus le kilomètre a été lent.
  const width = (p) => 30 + Math.max(0, Math.min(1, (p - fastest) / span)) * 70;

  const hasHr = r.splits.some((s) => s.hr != null);
  const hasCadence = r.splits.some((s) => s.cadence != null);
  const anyPartial = r.splits.some((s) => s.partial);

  const rows = r.splits
    .map((s) => {
      const cls = s.partial ? "partial" : s.paceSec === fastest ? "best" : s.paceSec === slowest ? "worst" : "";
      const extra = [
        hasHr && s.hr != null ? `${s.hr} bpm` : "",
        hasCadence && s.cadence != null ? `${s.cadence} spm` : "",
      ].filter(Boolean).join(" · ");
      return `
        <div class="split ${cls}">
          <span class="split-km">${s.km}${s.partial ? "*" : ""}</span>
          <span class="split-track"><span class="split-bar" style="width:${width(s.paceSec).toFixed(1)}%"></span></span>
          <span class="split-pace">${fmtPace(s.paceSec)}</span>
          <span class="split-extra">${extra}</span>
        </div>`;
    })
    .join("");

  // Écart premier / dernier kilomètre complet : c'est le chiffre qui dit si la
  // séance a été tenue ou si le départ a été payé sur la fin.
  const drift = full[full.length - 1].paceSec - full[0].paceSec;
  const driftLabel =
    drift > 0
      ? `${Math.round(drift)} s/km perdues entre le 1er et le dernier kilomètre`
      : drift < 0
        ? `${Math.round(-drift)} s/km gagnées entre le 1er et le dernier kilomètre`
        : "allure identique du premier au dernier kilomètre";

  return `
    <div class="splits">
      <div class="splits-head">
        <span class="splits-title">Allure kilomètre par kilomètre</span>
        <span class="splits-drift ${drift > 5 ? "bad" : drift < -5 ? "good" : ""}">${driftLabel}</span>
      </div>
      ${rows}
      ${anyPartial ? `<p class="splits-note">* dernier tronçon incomplet — allure ramenée au kilomètre.</p>` : ""}
    </div>`;
}

// Le Pokémon de la séance : rang de vitesse dans la 1re génération à l'appui.
function pokemonHtml(a) {
  if (!a || !a.pokemon || typeof POKEDEX === "undefined") return "";
  const p = POKEDEX[a.pokemon];
  if (!p) return "";
  return `
    <div class="pokemon">
      <img class="pokemon-sprite" src="assets/pokemon/${p.id}.png" alt="${p.nom}" width="96" height="96" loading="lazy" />
      <div>
        <div class="pokemon-name">${p.nom}
          <span class="pokemon-rank">${p.rang}<sup>e</sup> / 151 en vitesse · ${p.vitesse}</span>
        </div>
        <p class="pokemon-phrase">${a.pokemonPhrase || ""}</p>
      </div>
    </div>`;
}

function analysisHtml(r) {
  const m = INSIGHTS[r.name][r.date];
  const a = (typeof ANALYSES !== "undefined" && ANALYSES[r.name]) ? ANALYSES[r.name][r.date] : null;

  let deltas;
  if (m.prev) {
    const dPace = r.paceSec - m.prev.paceSec; // < 0 = plus rapide
    const dDist = r.distance - m.prev.distance;
    deltas =
      deltaChip("Allure", dPace, (v) => Math.round(v) + " s/km", dPace < 0) +
      deltaChip("Distance", dDist, (v) => v.toFixed(2) + " km", dDist > 0);
    // Pas de puce FC quand l'une des deux séances ne la mesure pas : un écart
    // calculé sur une valeur absente vaudrait NaN.
    if (r.hr != null && m.prev.hr != null) {
      deltas += deltaChip("FC", r.hr - m.prev.hr, (v) => Math.round(v) + " bpm", null);
    }
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
      ${splitsHtml(r)}
      <p class="coach">${text}</p>
      ${pokemonHtml(a)}
    </div>`;
}

// ---------- Tableau ----------
// Un tiret cadratin plutôt qu'une case vide : il dit « non mesuré » là où le
// blanc laisserait croire à un oubli de saisie.
const cell = (value, unit) => (value == null ? '<span class="na">—</span>' : `${value} ${unit}`);

function renderTable() {
  const tbody = document.querySelector("#runsTable tbody");
  let rows = viewRunners.flatMap((name) => runsOf(name).map((r) => ({ ...r, name })));
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><p class="empty-note">${emptyMessage()}</p></td></tr>`;
    return;
  }

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
        <td>${cell(r.hr, "bpm")}</td>
        <td>${cell(r.cadence, "spm")}</td>
        <td>${cell(r.activeCal, "cal")}</td>
        <td>${cell(r.elevation, "m")}</td>
      </tr>
      <tr class="analysis-row" data-key="${key}">
        <td colspan="9">${analysisHtml(r)}</td>
      </tr>`;
    })
    .join("");
}

// ---------- Sélecteurs globaux ----------
// Les trois barres de boutons (coureur, distance, métrique) partagent le même
// comportement : un seul actif à la fois, on prévient au changement.
function buildSwitch(elId, options, onPick) {
  const el = document.getElementById(elId);
  el.innerHTML = options
    .map(([k, label], i) => `<button data-value="${k}" class="${i === 0 ? "active" : ""}">${label}</button>`)
    .join("");
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onPick(btn.dataset.value);
    });
  });
}

// Tout ce qui dépend des deux filtres globaux, y compris le décompte du pied
// de page — sinon il annoncerait 34 séances sous un dashboard qui n'en montre 6.
function renderAll() {
  renderCards();
  renderEvolution();
  renderRadar();
  renderTable();
  document.getElementById("totalRuns").textContent = sum(viewRunners.map((n) => runsOf(n).length));
}

function renderFilters() {
  buildSwitch("runnerFilter", [["all", "Tous"], ...RUNNERS.map((n) => [n, n])], (v) => {
    viewRunners = v === "all" ? [...RUNNERS] : [v];
    renderAll();
  });
  buildSwitch(
    "distanceFilter",
    [[ANY_DISTANCE, "Toutes"], ...DISTANCE_BUCKETS.map((b) => [b.key, b.label])],
    (v) => {
      viewBucket = v;
      renderAll();
    },
  );
}

// ---------- Init ----------
Chart.defaults.color = "#98989d";
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

renderFilters();
renderMetricSwitch();
renderAll();

// Déploiement de l'analyse au clic sur une ligne (délégation : survit aux re-render)
document.querySelector("#runsTable tbody").addEventListener("click", (e) => {
  const row = e.target.closest(".run-row");
  if (!row) return;
  const open = row.classList.toggle("open");
  row.setAttribute("aria-expanded", String(open));
  const detail = row.parentElement.querySelector(`.analysis-row[data-key="${CSS.escape(row.dataset.key)}"]`);
  if (detail) detail.classList.toggle("open", open);
});
