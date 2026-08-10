/* global Chart, RUNS, RUNNER_COLORS, ANALYSES, POKEDEX */

const RUNNERS = Object.keys(RUNS);

// Coureurs actuellement affichés (pilote cartes, graphiques et tableau).
// Les deux filtres sont multi-sélection ; rien de coché vaut « tout », ce qui
// évite un état où le dashboard se vide sans que rien à l'écran ne l'explique.
// `viewRunners` est donc toujours peuplé — c'est le filtre qui détend, pas les
// lecteurs qui gèrent le cas vide.
let viewRunners = [...RUNNERS];

// ---------- Filtre de distance ----------
// Comparer ce qui est comparable : une séance appartient au seau de son
// kilométrage entier (5,39 km → « 5 km »), et tout ce qui est sous 5 km tient
// dans un seul seau — à ce stade, un 3,7 km et un 4,8 km relèvent de la même
// mise en route. Ici, en revanche, la liste vide se lit directement comme
// « toutes distances » : lister les trois seaux reviendrait au même.
const SUB_5 = "sub5";
let viewBuckets = [];

const bucketOf = (r) => (r.distance < 5 ? SUB_5 : String(Math.floor(r.distance)));

// Les seaux proposés sont déduits des données, pas écrits en dur : le jour où
// un premier 6 km tombe, le bouton apparaît de lui-même — et en attendant,
// aucun bouton ne renvoie vers un graphique vide. Le leaderboard, qui ne
// regarde qu'une tranche de l'historique, en déduit les siens sur cette
// tranche : un seau que plus personne n'a couru depuis n'y a pas d'onglet.
const bucketsIn = (runs) => {
  const present = new Set(runs.map(bucketOf));
  const buckets = [];
  if (present.delete(SUB_5)) buckets.push({ key: SUB_5, label: "Moins de 5 km" });
  [...present]
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((km) => buckets.push({ key: String(km), label: `${km} km` }));
  return buckets;
};

const DISTANCE_BUCKETS = bucketsIn(RUNNERS.flatMap((n) => RUNS[n]));

const bucketLabel = (key) => (DISTANCE_BUCKETS.find((b) => b.key === key) || {}).label || "";

// Séances d'un coureur, filtre de distance appliqué.
const runsOf = (name) =>
  viewBuckets.length ? RUNS[name].filter((r) => viewBuckets.includes(bucketOf(r))) : RUNS[name];

// Certaines combinaisons ne contiennent aucune séance — Ju n'a pas encore
// déposé de capture, Anaïs n'a pas encore couru 6 km — et un graphique vide
// n'explique rien de lui-même. `metric` couvre le second cas de vide : la
// sélection contient des séances, mais aucune ne mesure la métrique demandée.
function emptyMessage(metric) {
  // Le libellé garde sa casse : « fc moy. » se lit comme une coquille.
  if (metric) return `Aucune donnée de ${metric.label} pour cette sélection.`;
  const scope = viewBuckets.length
    ? ` de ${viewBuckets.map((b) => bucketLabel(b).toLowerCase()).join(" ou ")}`
    : "";
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

// Le Pokémon de la séance — section purement humoristique : le sprite, le nom,
// la vanne. Le rang de vitesse sert encore à choisir, jamais à s'afficher : le
// lecteur n'a pas besoin d'un classement pour comprendre la blague.
// L'adjectif (« Persian Impérial ») personnalise la créature au-delà des 151
// possibles ; il est justifié dans la phrase, sinon ce n'est qu'un mot de plus.
function pokemonHtml(a) {
  if (!a || !a.pokemon || typeof POKEDEX === "undefined") return "";
  const p = POKEDEX[a.pokemon];
  if (!p) return "";
  const adj = a.pokemonAdj ? ` <span class="pokemon-adj">${a.pokemonAdj}</span>` : "";
  // Grille plutôt que flex imbriqué : sur mobile, la phrase peut alors passer
  // sous le sprite et récupérer toute la largeur au lieu de s'étrangler à côté.
  return `
    <div class="pokemon">
      <img class="pokemon-sprite" src="assets/pokemon/${p.id}.png" alt="${p.nom}" width="96" height="96" loading="lazy" />
      <div class="pokemon-name">${p.nom}${adj}</div>
      <p class="pokemon-phrase">${a.pokemonPhrase || ""}</p>
    </div>`;
}

// L'analyse coach est un tableau de paragraphes `{ titre, texte }` : un pavé de
// dix phrases ne se lit pas, surtout sur téléphone, et les titres donnent le fil
// de la séance à qui parcourt sans tout lire. Une chaîne nue reste acceptée
// (paragraphe sans titre) pour ne pas casser sur une analyse ancienne.
function coachHtml(text) {
  const paras = (Array.isArray(text) ? text : [text]).filter(Boolean);
  return `<div class="coach">${paras
    .map((p) => {
      const { titre, texte } = typeof p === "string" ? { titre: "", texte: p } : p;
      return `${titre ? `<h4>${titre}</h4>` : ""}<p>${texte}</p>`;
    })
    .join("")}</div>`;
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
  const text = a ? a.text : [{ titre: "", texte: "Analyse non disponible pour cette séance." }];

  return `
    <div class="analysis">
      <div class="analysis-head">
        <span class="verdict trend-${trend}">${verdict}</span>
        ${prBadges}
      </div>
      <div class="delta-row">${m.prev ? '<span class="delta-label">vs séance précédente :</span>' : ""}${deltas}</div>
      ${splitsHtml(r)}
      ${coachHtml(text)}
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
    .map((r, i) => {
      const key = `${r.name}__${r.date}`;
      // Quand on isole un coureur, c'est son actualité qu'on vient voir : sa
      // dernière séance s'ouvre d'elle-même. Les lignes sont triées par date
      // décroissante, donc c'est la première. En vue « Tous », on ne déplie
      // rien — ouvrir la séance d'une seule personne serait arbitraire.
      const open = viewRunners.length === 1 && i === 0;
      return `
      <tr class="run-row${open ? " open" : ""}" data-key="${key}" aria-expanded="${open}">
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
      <tr class="analysis-row${open ? " open" : ""}" data-key="${key}">
        <td colspan="9">${analysisHtml(r)}</td>
      </tr>`;
    })
    .join("");
}

// ---------- Leaderboard ----------
// Un podium par catégorie, façon plateau de Mario Party : chaque catégorie
// distribue 3, 2 et 1 étoiles, et l'onglet « Général » additionne le tout.
// Volontairement à l'écart des filtres du haut : c'est un palmarès sur
// l'ensemble des séances, pas une vue de la sélection courante — sans quoi
// isoler un coureur donnerait un podium à une place.
const STARS_BY_RANK = [3, 2, 1];

// Le palmarès ne remonte pas plus loin que la première séance de Didi. Sur tout
// l'historique, les catégories de volume ne mesuraient qu'une chose — qui a
// commencé le plus tôt — et Didi, arrivée fin juillet, partait avec 16 séances
// de retard qu'aucune performance ne pouvait rattraper. Une fenêtre commune
// compare des coureurs, pas des dates d'inscription.
const LEADERBOARD_START = "2026-07-23";
const LB_START_LABEL = new Date(`${LEADERBOARD_START}T00:00:00`).toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "long",
});

const lbRunsOf = (name) => RUNS[name].filter((r) => r.date >= LEADERBOARD_START);
const LB_BUCKETS = bucketsIn(RUNNERS.flatMap(lbRunsOf));

const chrono = (runs) => [...runs].sort((a, b) => a.date.localeCompare(b.date));
const stdev = (arr) => {
  const m = avg(arr);
  return Math.sqrt(avg(arr.map((v) => (v - m) ** 2)));
};

// Une catégorie note chaque coureur (`score`, `null` = ne concourt pas) et sait
// dire dans quel sens on lit la note (`lower`). Les deux motifs d'exclusion
// communs à toutes — rien couru du tout, rien couru sur la période — sont
// traités ici ; `absent` ne couvre que le motif propre à la catégorie.
function absentReason(cat, name) {
  if (!RUNS[name].length) return "pas encore de séance";
  if (!lbRunsOf(name).length) return `aucune séance depuis le ${LB_START_LABEL}`;
  return cat.absent ? cat.absent() : "pas de donnée dans cette catégorie";
}

const DISTANCE_CATEGORIES = LB_BUCKETS.map((b) => ({
  id: `km-${b.key}`,
  tab: b.label,
  title: `Le plus rapide sur ${b.label.toLowerCase()}`,
  desc: `Meilleure allure réalisée sur une séance de ${b.label.toLowerCase()} depuis le ${LB_START_LABEL}. Une seule séance suffit à concourir : c'est le record qui compte, pas la moyenne.`,
  lower: true,
  score: (runs) => {
    const rs = runs.filter((r) => bucketOf(r) === b.key);
    return rs.length ? Math.min(...rs.map((r) => r.paceSec)) : null;
  },
  fmt: (v) => `${fmtPace(v)}/km`,
  absent: () => `aucune séance de ${b.label.toLowerCase()} sur la période`,
}));

const FUN_CATEGORIES = [
  {
    id: "km-total",
    tab: "🗺️ Compteur de km",
    title: "Le Compteur de kilomètres",
    desc: "Le plus grand total de kilomètres sur la période. La catégorie la plus bête du plateau : il n'y a qu'à sortir, encore et encore.",
    score: (runs) => (runs.length ? sum(runs.map((r) => r.distance)) : null),
    fmt: (v) => `${v.toFixed(1)} km`,
  },
  {
    id: "metronome",
    tab: "🎯 Métronome",
    title: "Le Métronome",
    desc: "L'allure la plus constante d'une séance à l'autre (le plus petit écart-type). Elle récompense la régularité, et elle sourit assez peu à qui progresse vite : progresser, c'est justement ne pas courir deux fois à la même allure.",
    lower: true,
    score: (runs) => (runs.length > 1 ? stdev(runs.map((r) => r.paceSec)) : null),
    fmt: (v) => `± ${Math.round(v)} s/km`,
    absent: () => "une seule séance sur la période, rien à comparer",
  },
  {
    id: "progress",
    tab: "🚀 Fusée",
    title: "La Fusée",
    desc: "Les secondes au kilomètre grattées entre la première et la dernière séance de la période. Du progrès brut, sans regarder le temps qu'il a fallu pour l'obtenir.",
    score: (runs) => {
      const s = chrono(runs);
      return s.length > 1 ? s[0].paceSec - s[s.length - 1].paceSec : null;
    },
    fmt: (v) => `${v >= 0 ? "−" : "+"}${Math.abs(Math.round(v))} s/km`,
    absent: () => "une seule séance sur la période, rien à comparer",
  },
  {
    id: "freq",
    tab: "📅 Machine",
    title: "La Machine",
    desc: "Le rythme : nombre de séances par semaine. Le décompte part de sa propre première sortie et non du début de la période, pour que rejoindre en retard ne coûte rien.",
    score: (runs) => {
      const s = chrono(runs);
      if (s.length < 2) return null;
      const jours = (new Date(s[s.length - 1].date) - new Date(s[0].date)) / 864e5 + 1;
      return (s.length / jours) * 7;
    },
    fmt: (v) => `${v.toFixed(1)} séances/sem.`,
    absent: () => "une seule séance sur la période, pas encore de rythme",
  },
  {
    id: "avg-dist",
    tab: "📏 Gros Rouleur",
    title: "Le Gros Rouleur",
    desc: "La distance moyenne par sortie sur la période. Peu de séances mais longues bat beaucoup de séances mais courtes — c'est fait exprès, tout le monde ne doit pas gagner au même jeu.",
    score: (runs) => (runs.length ? avg(runs.map((r) => r.distance)) : null),
    fmt: (v) => `${v.toFixed(2)} km`,
  },
  {
    id: "pr-hunter",
    tab: "🏅 Chasseur de records",
    title: "Le Chasseur de records",
    desc: "Le nombre de séances qui ont battu le meilleur chrono de la période. Attention au piège : plus le record est haut, plus le suivant est difficile à décrocher.",
    score: (runs) => {
      const s = chrono(runs);
      if (!s.length) return null;
      let best = Infinity;
      let n = 0;
      s.forEach((r, i) => {
        if (i > 0 && r.paceSec < best) n += 1;
        best = Math.min(best, r.paceSec);
      });
      return n;
    },
    fmt: (v) => `${v} record${v > 1 ? "s" : ""}`,
  },
  {
    id: "coldheart",
    tab: "🧊 Cœur de glace",
    title: "Le Cœur de glace",
    desc: "La fréquence cardiaque moyenne la plus basse sur la période. Comparer deux cœurs n'a aucune valeur scientifique — la FC max dépend surtout de l'âge — mais ça reste la catégorie la plus classe à gagner.",
    lower: true,
    score: (runs) => {
      const v = runs.filter((r) => r.hr != null).map((r) => r.hr);
      return v.length ? avg(v) : null;
    },
    fmt: (v) => `${Math.round(v)} bpm`,
    absent: () => "son appli ne mesure pas la FC",
  },
  {
    id: "burner",
    tab: "🔥 Lance-flammes",
    title: "Le Lance-flammes",
    desc: "Le plus de calories actives brûlées sur la période. Ça dépend au moins autant du gabarit que de l'effort, mais personne n'a jamais refusé un trophée pour ce motif.",
    score: (runs) => (runs.length ? sum(runs.map((r) => r.activeCal)) : null),
    fmt: (v) => `${Math.round(v).toLocaleString("fr-FR")} cal`,
  },
];

// Classement d'une catégorie : les non-concourants sortent, les ex æquo
// partagent le rang (deux premiers, puis un troisième — pas de deuxième).
// Une catégorie à un seul concourant ne distribue rien : Vincent est le seul à
// avoir couru 6 km, lui donner 3 étoiles pour ça fausserait le général. La
// règle vit ici et nulle part ailleurs, pour que le total des étoiles et les
// étoiles dessinées sur le podium ne puissent pas se contredire.
function rankCategory(cat) {
  const scored = RUNNERS.map((name) => ({ name, value: cat.score(lbRunsOf(name), name) }))
    .filter((e) => e.value != null && Number.isFinite(e.value));
  scored.sort((a, b) => (cat.lower ? a.value - b.value : b.value - a.value));
  const awards = scored.length > 1 && !cat.noStars;
  let rank = 0;
  scored.forEach((e, i) => {
    if (i > 0 && e.value !== scored[i - 1].value) rank = i;
    e.rank = rank;
    e.stars = awards ? STARS_BY_RANK[rank] || 0 : 0;
  });
  return scored;
}

const SCORED_CATEGORIES = [...DISTANCE_CATEGORIES, ...FUN_CATEGORIES];
const STAR_TOTALS = (() => {
  const totals = Object.fromEntries(RUNNERS.map((n) => [n, 0]));
  SCORED_CATEGORIES.forEach((cat) =>
    rankCategory(cat).forEach((e) => {
      totals[e.name] += e.stars;
    }),
  );
  return totals;
})();

const GENERAL = {
  id: "general",
  tab: "🌟 Général",
  title: "Classement général",
  desc: `Le total des étoiles récoltées sur les ${SCORED_CATEGORIES.length} autres onglets. Chacun distribue 3 étoiles au premier, 2 au deuxième, 1 au troisième — sauf ceux où il n'y a qu'un concourant, qui ne rapportent rien. Tout se joue depuis le ${LB_START_LABEL} : avant, le classement ne récompensait que d'avoir commencé tôt.`,
  score: (runs, name) => (runs.length ? STAR_TOTALS[name] : null),
  fmt: (v) => `${v} étoile${v > 1 ? "s" : ""}`,
  // Le général ne se rapporte pas à lui-même : les étoiles sont déjà le score
  // affiché, en redessiner 3 au-dessus de la tête du premier se lirait comme un
  // second compte qui contredit le premier.
  noStars: true,
};

const CATEGORIES = [GENERAL, ...SCORED_CATEGORIES];

const starsHtml = (n) =>
  Array.from({ length: n }, () => `<svg class="star" aria-hidden="true"><use href="#mp-star" /></svg>`).join("");

// Une place du podium. Le bloc suit le rang affiché, pas la position : deux ex
// æquo en tête méritent deux blocs de la même hauteur, tous deux marqués « 1 ».
function podiumSlot(entry, cat, index, total) {
  const place = Math.min(entry.rank + 1, 3);
  const color = RUNNER_COLORS[entry.name];
  // À trois places ou plus, le vainqueur passe au centre — c'est ce qui fait
  // lire la marche haute comme un podium et pas comme un simple histogramme.
  const order = total >= 3 ? [2, 1, 3][index] || index + 1 : index + 1;
  return `
    <div class="podium-slot rank-${place}" style="--c:${color};--glow:${color}55;order:${order}">
      <div class="podium-stars">${starsHtml(entry.stars)}</div>
      <div class="podium-avatar">${place === 1 ? `<span class="podium-crown">👑</span>` : ""}${entry.name[0]}</div>
      <div class="podium-name">${entry.name}</div>
      <div class="podium-value">${cat.fmt(entry.value)}</div>
      <div class="podium-block"><span class="podium-rank">${entry.rank + 1}</span></div>
    </div>`;
}

let lbCategory = GENERAL.id;
function renderLeaderboard(catId = lbCategory) {
  lbCategory = catId;
  const cat = CATEGORIES.find((c) => c.id === catId) || GENERAL;
  const ranked = rankCategory(cat);

  document.getElementById("lbDesc").innerHTML = `<b>${cat.title}</b> — ${cat.desc}`;
  document.getElementById("lbPodium").innerHTML = ranked.length
    ? ranked.slice(0, 3).map((e, i) => podiumSlot(e, cat, i, Math.min(ranked.length, 3))).join("")
    : `<p class="empty-note">Personne ne concourt encore dans cette catégorie.</p>`;

  // Au-delà du podium : la suite du classement, l'avertissement « pas
  // d'étoiles » et les absents avec leur motif. Tout ce qui explique le podium
  // sans y tenir de place.
  const rest = ranked.slice(3);
  const absents = RUNNERS.filter((n) => !ranked.some((e) => e.name === n));
  document.getElementById("lbExtra").innerHTML = [
    rest.length
      ? `<ol class="lb-rest" start="4">${rest
          .map((e) => `<li><span class="dot" style="background:${RUNNER_COLORS[e.name]}"></span>${e.name}<span class="lb-rest-value">${cat.fmt(e.value)}</span></li>`)
          .join("")}</ol>`
      : "",
    ranked.length === 1 && cat.id !== GENERAL.id
      ? `<p class="lb-note">Un seul concourant : cette catégorie ne distribue pas d'étoiles.</p>`
      : "",
    absents.length
      ? `<p class="lb-note">Hors classement : ${absents
          .map((n) => `<b>${n}</b> — ${absentReason(cat, n)}`)
          .join(" · ")}</p>`
      : "",
  ].join("");

  document.querySelectorAll("#lbTabs button").forEach((b) => {
    const on = b.dataset.value === catId;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function renderLeaderboardTabs() {
  // La fenêtre est écrite en toutes lettres, avec son motif : un palmarès qui
  // ignore en silence les deux tiers des séances passerait pour un bug.
  document.getElementById("lbScope").textContent =
    `Depuis le ${LB_START_LABEL}, quand tout le monde était en course — les filtres du haut ne s'y appliquent pas`;

  const groups = [
    ["Classement", [GENERAL]],
    ["Par distance", DISTANCE_CATEGORIES],
    ["Catégories fun", FUN_CATEGORIES],
  ];
  const el = document.getElementById("lbTabs");
  el.innerHTML = groups
    .map(
      ([label, cats]) => `
      <div class="lb-tab-row">
        <span class="filter-label">${label}</span>
        <div class="filter-switch">
          ${cats.map((c) => `<button type="button" data-value="${c.id}">${c.tab}</button>`).join("")}
        </div>
      </div>`,
    )
    .join("");
  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) renderLeaderboard(btn.dataset.value);
  });
}

// ---------- Sélecteurs globaux ----------
// Un seul actif à la fois : c'est le comportement du sélecteur de métrique, où
// deux courbes de nature différente sur le même axe n'auraient pas de sens.
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

// Multi-sélection, pour les deux filtres globaux : comparer Anaïs et Didi sans
// Vincent, ou les 5 et 6 km sans les mises en route, demande de cocher
// plusieurs valeurs. « Tous » n'est pas une valeur de plus mais l'état « rien
// de coché » ; et le premier clic sur une valeur isole celle-ci au lieu de
// décocher les autres une à une, parce que c'est ce qu'on vient faire neuf
// fois sur dix.
function buildMultiSwitch(elId, allLabel, options, onChange) {
  const el = document.getElementById(elId);
  const ALL = "__all__";
  const keys = options.map(([k]) => k);
  let selected = [];

  el.innerHTML = [[ALL, allLabel], ...options]
    .map(([k, label]) => `<button type="button" data-value="${k}">${label}</button>`)
    .join("");

  const paint = () =>
    el.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.value === ALL ? !selected.length : selected.includes(b.dataset.value);
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const v = btn.dataset.value;
    if (v === ALL) selected = [];
    else if (!selected.length) selected = [v];
    else {
      const next = new Set(selected);
      if (!next.delete(v)) next.add(v);
      // Ordre de déclaration, pas ordre de clic : sinon les cartes récap
      // changeraient de place selon l'ordre dans lequel on a coché.
      selected = keys.filter((k) => next.has(k));
    }
    paint();
    onChange(selected);
  });

  paint();
}

// Tout ce qui dépend des deux filtres globaux, y compris le décompte du pied
// de page — sinon il annoncerait 34 séances sous un dashboard qui n'en montre 6.
// Le leaderboard, lui, n'en dépend pas et n'est rendu qu'à l'init.
function renderAll() {
  renderCards();
  renderEvolution();
  renderTable();
  document.getElementById("totalRuns").textContent = sum(viewRunners.map((n) => runsOf(n).length));
}

function renderFilters() {
  buildMultiSwitch("runnerFilter", "Tous", RUNNERS.map((n) => [n, n]), (sel) => {
    viewRunners = sel.length ? sel : [...RUNNERS];
    renderAll();
  });
  buildMultiSwitch("distanceFilter", "Toutes", DISTANCE_BUCKETS.map((b) => [b.key, b.label]), (sel) => {
    viewBuckets = sel;
    renderAll();
  });
}

// ---------- Init ----------
Chart.defaults.color = "#98989d";
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

renderFilters();
renderMetricSwitch();
renderLeaderboardTabs();
renderLeaderboard();
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
