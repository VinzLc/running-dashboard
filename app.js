/* global Chart, RUNS, RUNNER_COLORS, ANALYSES, POKEDEX */

const RUNNERS = Object.keys(RUNS);

// Coureurs actuellement affichés (pilote cartes, graphiques et tableau).
// Les deux filtres sont multi-sélection ; rien de coché vaut « tout », ce qui
// évite un état où le dashboard se vide sans que rien à l'écran ne l'explique.
// `viewRunners` est donc toujours peuplé — c'est le filtre qui détend, pas les
// lecteurs qui gèrent le cas vide.
let viewRunners = [...RUNNERS];

// « Rien de coché » et « tout coché » donnent le même `viewRunners` mais ne
// veulent pas dire la même chose : les cartes personnelles s'ouvrent quand on a
// demandé quelqu'un, et restent repliées quand on n'a rien demandé.
let runnerFilterOn = false;

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

// Le même seau, glissé dans une phrase : « vs 6 km du 9 août », « première
// sortie de moins de 5 km ». Le libellé du bouton garde sa majuscule, pas lui.
const bucketPhrase = (key) => (key === SUB_5 ? "moins de 5 km" : bucketLabel(key).toLowerCase());

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
// « 1 août » n'existe pas en français, et l'étiquette « vs 5 km du 1 août » le
// donnait à lire en toutes lettres : le premier du mois prend son rang.
const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return d.getDate() === 1 ? label.replace(/^1\b/, "1er") : label;
};

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
  // Une seule personne filtrée : la carte prend toute la largeur au lieu de
  // rester seule dans la colonne de gauche, moitié de dashboard vide à sa
  // droite. C'est la grille qui change, pas la carte — elle ne sait rien du
  // nombre de ses voisines.
  el.classList.toggle("single", viewRunners.length === 1);
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

// Un seul seau de kilométrage entier coché — « 5 km », « 6 km » — et toutes les
// séances affichées tiennent dans la même tranche d'un kilomètre : la courbe de
// distance devient une ligne plate qui n'apprend rien. On retire alors la
// métrique du sélecteur plutôt que de la laisser mener à un graphique sans
// relief. « Moins de 5 km » garde la sienne (de 2 à 4,9 km, il y a une pente à
// lire), et deux seaux cochés aussi : la courbe dit alors laquelle des deux
// distances a été courue ce jour-là.
const distanceIsFlat = () => viewBuckets.length === 1 && viewBuckets[0] !== SUB_5;

const visibleMetrics = () =>
  Object.entries(METRICS).filter(([k]) => !(k === "distance" && distanceIsFlat()));

function renderMetricSwitch() {
  const metrics = visibleMetrics();
  // La métrique regardée peut être celle qui vient de disparaître : on retombe
  // sur l'allure, la première de la liste restante, plutôt que sur un panneau
  // dont plus aucun bouton n'est allumé.
  if (!metrics.some(([k]) => k === currentMetric)) currentMetric = metrics[0][0];
  buildSwitch("metricSwitch", metrics.map(([k, m]) => [k, m.label]), renderEvolution, currentMetric);
}

// Le meilleur kilomètre d'une séance, ou null si elle n'a pas de splits. Le
// tronçon incomplet de fin est exclu partout où ce chiffre sert (badge, podium) :
// quarante mètres extrapolés au kilomètre donnent une allure flatteuse qui n'a
// jamais été tenue sur mille mètres.
function bestFullKm(r) {
  const full = (r.splits || []).filter((s) => !s.partial);
  return full.length ? Math.min(...full.map((s) => s.paceSec)) : null;
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
    let bestKm = Infinity;
    // Dernière séance vue dans chaque seau de distance : c'est elle, et non la
    // séance de la veille, qui rend l'écart lisible. Comparer un 6 km au 5 km
    // qui le précède annonce « distance ▲ 1,02 km, allure ▲ 11 s/km » — deux
    // chiffres exacts qui, ensemble, ne disent rien : on court forcément moins
    // vite un kilomètre de plus.
    const lastInBucket = {};
    sorted.forEach((r, i) => {
      // Le record du kilomètre ne se compare qu'entre séances détaillées : la
      // première à porter des splits est la référence et ne décroche rien, comme
      // la première séance tout court pour les deux autres records.
      const km = bestFullKm(r);
      meta[name][r.date] = {
        prev: i > 0 ? sorted[i - 1] : null,
        prevSame: lastInBucket[bucketOf(r)] || null,
        isPacePR: i > 0 && r.paceSec < bestPace,
        isDistPR: i > 0 && r.distance > longest,
        isKmPR: km != null && Number.isFinite(bestKm) && km < bestKm,
      };
      lastInBucket[bucketOf(r)] = r;
      bestPace = Math.min(bestPace, r.paceSec);
      longest = Math.max(longest, r.distance);
      if (km != null) bestKm = Math.min(bestKm, km);
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

  // La référence : la dernière sortie de la même distance quand il y en a une,
  // la séance précédente sinon. Une première sortie sur une distance n'a rien
  // de comparable — on le dit plutôt que de faire semblant.
  const cmp = m.prevSame || m.prev;
  const sameBucket = cmp === m.prevSame;

  let deltas;
  if (cmp) {
    const dPace = r.paceSec - cmp.paceSec; // < 0 = plus rapide
    const dDist = r.distance - cmp.distance;
    deltas =
      deltaChip("Allure", dPace, (v) => Math.round(v) + " s/km", dPace < 0) +
      deltaChip("Distance", dDist, (v) => v.toFixed(2) + " km", dDist > 0);
    // Pas de puce FC quand l'une des deux séances ne la mesure pas : un écart
    // calculé sur une valeur absente vaudrait NaN.
    if (r.hr != null && cmp.hr != null) {
      deltas += deltaChip("FC", r.hr - cmp.hr, (v) => Math.round(v) + " bpm", null);
    }
    if (!sameBucket) {
      deltas += `<span class="delta-chip flat">Première sortie de ${bucketPhrase(bucketOf(r))}</span>`;
    }
  } else {
    deltas = `<span class="delta-chip flat">Première séance — référence de départ</span>`;
  }

  // « vs 6 km précédent » se lit ; « vs moins de 5 km précédent », non.
  const deltaLabel = !cmp
    ? ""
    : sameBucket && cmp !== m.prev
      ? `vs ${bucketPhrase(bucketOf(r))} du ${fmtDate(cmp.date)} :`
      : "vs séance précédente :";

  const prBadges =
    (m.isPacePR ? `<span class="pr">🏅 Record d'allure</span>` : "") +
    (m.isDistPR ? `<span class="pr">🏅 Record de distance</span>` : "") +
    (m.isKmPR ? `<span class="pr">🏅 Record du kilomètre</span>` : "");

  const trend = a ? a.trend : "flat";
  const verdict = a ? a.verdict : "Analyse à venir";
  const text = a ? a.text : [{ titre: "", texte: "Analyse non disponible pour cette séance." }];

  return `
    <div class="analysis">
      <div class="analysis-head">
        <span class="verdict trend-${trend}">${verdict}</span>
        ${prBadges}
      </div>
      <div class="delta-row">${deltaLabel ? `<span class="delta-label">${deltaLabel}</span>` : ""}${deltas}</div>
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
// distribue 3, 2 et 1 étoiles, et l'onglet « Étoiles » additionne le tout.
// Volontairement à l'écart des filtres du haut : c'est un palmarès, pas une vue
// de la sélection courante — sans quoi isoler un coureur donnerait un podium à
// une place.
const STARS_BY_RANK = [3, 2, 1];

// ---------- Saisons ----------
// Le palmarès se lit à deux échelles, et les deux ont leur raison d'être.
//
// Le Général ne remonte pas plus loin que la première séance de Didi : sur tout
// l'historique, les catégories de volume ne mesuraient qu'une chose — qui a
// commencé le plus tôt — et Didi, arrivée fin juillet, partait avec 16 séances
// de retard qu'aucune performance ne pouvait rattraper.
//
// Les saisons mensuelles, elles, peuvent remonter avant cette date sans injustice :
// un mois est un concours autonome qui repart de zéro, donc n'avoir pas encore
// couru en mai ne coûte aucune étoile — il n'y a simplement pas de saison de mai
// pour Didi. Conséquence à assumer : le Général n'est pas la somme des saisons,
// il ne couvre que juillet à partir du 23.
const LEADERBOARD_START = "2026-07-23";
const LB_START_LABEL = new Date(`${LEADERBOARD_START}T00:00:00`).toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "long",
});

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

const SEASONS = (() => {
  const months = [...new Set(RUNNERS.flatMap((n) => RUNS[n].map((r) => r.date.slice(0, 7))))].sort();
  // « Août » suffit tant que tout tient dans la même année ; le jour où un second
  // août arrive, les deux onglets doivent porter leur millésime.
  const oneYear = new Set(months.map((m) => m.slice(0, 4))).size <= 1;
  const label = (ym, opts) => capitalize(new Date(`${ym}-01T00:00:00`).toLocaleDateString("fr-FR", opts));

  return [
    {
      id: "general",
      tab: "🏆 Général",
      title: "Général",
      scope: `Le cumul depuis le ${LB_START_LABEL}, date à laquelle tout le monde était enfin en course. Les saisons mensuelles remontent plus loin — le Général n'en est donc pas la somme.`,
      match: (r) => r.date >= LEADERBOARD_START,
    },
    // Le libellé du mois n'est jamais réinjecté dans la phrase : « la saison de
    // août » demanderait une élision que `toLocaleDateString` ne fournit pas.
    ...months.map((ym) => ({
      id: ym,
      tab: label(ym, oneYear ? { month: "long" } : { month: "long", year: "2-digit" }),
      title: label(ym, { month: "long", year: "numeric" }),
      scope:
        "Une saison close sur elle-même : elle ne compte que ce mois, et la suivante repart de zéro. Arriver en cours de route n'y coûte donc aucune étoile.",
      match: (r) => r.date.startsWith(ym),
    })),
  ];
})();

const seasonRuns = (season, name) => RUNS[name].filter((r) => season.match(r));

const chrono = (runs) => [...runs].sort((a, b) => a.date.localeCompare(b.date));
const stdev = (arr) => {
  const m = avg(arr);
  return Math.sqrt(avg(arr.map((v) => (v - m) ** 2)));
};

// Une catégorie note chaque coureur (`score`, `null` = ne concourt pas) et sait
// dire dans quel sens on lit la note (`lower`). Les deux motifs d'exclusion
// communs à toutes — rien couru du tout, rien couru sur la saison — sont
// traités ici ; `absent` ne couvre que le motif propre à la catégorie.
function absentReason(cat, season, name) {
  if (!RUNS[name].length) return "pas encore de séance";
  if (!seasonRuns(season, name).length) {
    return season.id === "general"
      ? `aucune séance depuis le ${LB_START_LABEL}`
      : `pas de séance sur cette saison`;
  }
  return cat.absent ? cat.absent(name, season) : "pas de donnée dans cette catégorie";
}

// Deux façons de lire une course de distance, et elles ne désignent pas toujours
// le même vainqueur : l'allure compare des kilomètres, le chrono compare des
// séances. Dans le seau « 5 km », un 5,39 km demande deux minutes de plus qu'un
// 5,01 km à allure égale — le chrono récompense donc autant la distance choisie
// que la vitesse, et c'est pour ça que les étoiles restent attachées à l'allure.
// Un bouton d'affichage ne doit pas rebattre le classement général.
let lbDistanceView = "pace";

// Le drapeau à damier sert déjà d'emblème aux courses de distance : le
// reprendre pour une vue le ferait lire comme une compétition de plus.
const DISTANCE_VIEWS = [
  ["pace", "🏃 Allure"],
  ["time", "⏱️ Chrono"],
];

// Les seaux de distance sont recalculés pour chaque saison : proposer un onglet
// « 6 km » à un mois où personne n'a couru 6 km mènerait vers un podium vide.
// Les sorties de moins de 5 km n'ont pas d'onglet : le seau va de la mise en
// route de 2 km au 4,9 km, ce qui n'est pas une distance mais un fourre-tout —
// deux séances y courent rarement la même course.
const distanceCategories = (season) =>
  bucketsIn(RUNNERS.flatMap((n) => seasonRuns(season, n)))
    .filter((b) => b.key !== SUB_5)
    .map((b) => {
      const label = b.label.toLowerCase();
      const inBucket = (runs) => runs.filter((r) => bucketOf(r) === b.key);
      return {
        id: `km-${b.key}`,
        // Le drapeau met les courses de distance au même rang visuel que les
        // autres compétitions : dans un menu unique, un onglet sans emoji se lit
        // comme une rubrique plutôt que comme un choix.
        tab: `🏁 ${b.label}`,
        title: `Le plus rapide sur ${label}`,
        desc: `Meilleure allure réalisée sur une séance de ${label}. Une seule séance suffit à concourir : c'est le record qui compte, pas la moyenne.`,
        lower: true,
        score: (runs) => {
          const rs = inBucket(runs);
          return rs.length ? Math.min(...rs.map((r) => r.paceSec)) : null;
        },
        fmt: (v) => `${fmtPace(v)}/km`,
        absent: () => `aucune séance de ${label} sur cette saison`,
        // La vue chrono ne remplace que ce qui change : le score, son format et
        // la façon de le présenter. Tout le reste — onglet, motif d'absence —
        // reste celui de la catégorie.
        views: {
          time: {
            title: `Le meilleur chrono sur ${label}`,
            desc: `Le meilleur temps total réalisé sur une séance de ${label}, chronomètre brut. À lire en sachant ce que le seau contient : il va de ${b.key},00 à ${b.key},99 km, et une séance plus longue de 300 m coûte près de deux minutes à allure égale. Cette vue récompense donc aussi le fait de s'arrêter près de la borne — c'est pourquoi les étoiles de la catégorie restent attribuées à l'allure.`,
            score: (runs) => {
              const rs = inBucket(runs);
              return rs.length ? Math.min(...rs.map((r) => r.duration)) : null;
            },
            fmt: (v) => fmtDuration(v),
          },
        },
      };
    });

// Le seul podium qui se joue à l'intérieur des séances plutôt qu'entre elles :
// il ne retient qu'un kilomètre, le meilleur, et se moque de ce qu'il y avait
// autour. Comme les courses de distance, l'onglet n'est proposé qu'aux saisons
// qui ont de quoi le remplir — les splits n'existent que depuis août 2026, et
// avant ça le podium serait vide.
const BEST_KM = {
  id: "best-km",
  tab: "⚡ Éclair",
  title: "L'Éclair",
  desc: "Le kilomètre le plus rapide de la période, isolé dans le détail des splits. Peu importe la séance dans laquelle il tombe, ce qu'il y avait avant ou la façon dont ça s'est fini : un seul bon kilomètre suffit à concourir. Les tronçons incomplets de fin de parcours ne comptent pas — quarante mètres extrapolés ne sont pas un kilomètre couru.",
  lower: true,
  score: (runs) => {
    const best = runs.map(bestFullKm).filter((v) => v != null);
    return best.length ? Math.min(...best) : null;
  },
  fmt: (v) => `${fmtPace(v)}/km`,
  absent: (name) =>
    RUNS[name].some((r) => r.splits && r.splits.length)
      ? "aucune séance détaillée par kilomètre sur cette saison"
      : "ses captures ne détaillent pas les kilomètres",
};

const bestKmCategories = (season) =>
  RUNNERS.some((n) => seasonRuns(season, n).some((r) => bestFullKm(r) != null)) ? [BEST_KM] : [];

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
function rankCategory(cat, season) {
  const scored = RUNNERS.map((name) => ({ name, value: cat.score(seasonRuns(season, name), name, season) }))
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

// Catégories notées d'une saison — distances du mois, puis les fun, communes à
// toutes les saisons. Mémorisé : le classement aux étoiles les reparcourt toutes
// à chaque rendu, et elles ne dépendent que de données figées.
const scoredCache = new Map();
function scoredCategories(season) {
  if (!scoredCache.has(season.id)) {
    scoredCache.set(season.id, [...distanceCategories(season), ...bestKmCategories(season), ...FUN_CATEGORIES]);
  }
  return scoredCache.get(season.id);
}

const starTotalsCache = new Map();
function starTotals(season) {
  if (!starTotalsCache.has(season.id)) {
    const totals = Object.fromEntries(RUNNERS.map((n) => [n, 0]));
    scoredCategories(season).forEach((cat) =>
      rankCategory(cat, season).forEach((e) => {
        totals[e.name] += e.stars;
      }),
    );
    starTotalsCache.set(season.id, totals);
  }
  return starTotalsCache.get(season.id);
}

// Le classement aux étoiles : la seule catégorie qui lit les autres plutôt que
// les séances. Elle n'entre jamais dans `scoredCategories`, sans quoi elle se
// compterait elle-même.
const STANDINGS = {
  id: "standings",
  tab: "🌟 Étoiles",
  title: "Le classement aux étoiles",
  desc: (season) =>
    `Le total des étoiles récoltées sur les ${scoredCategories(season).length} autres onglets de la saison. Chacun distribue 3 étoiles au premier, 2 au deuxième, 1 au troisième — sauf ceux où il n'y a qu'un concourant, qui ne rapportent rien.`,
  score: (runs, name, season) => (runs.length ? starTotals(season)[name] : null),
  fmt: (v) => `${v} étoile${v > 1 ? "s" : ""}`,
  // Le classement ne se rapporte pas à lui-même : les étoiles sont déjà le score
  // affiché, en redessiner 3 au-dessus de la tête du premier se lirait comme un
  // second compte qui contredit le premier.
  noStars: true,
};

const categoriesOf = (season) => [STANDINGS, ...scoredCategories(season)];

// La catégorie telle qu'elle est regardée : en vue chrono, le score et son
// format changent, et la catégorie ne distribue plus d'étoiles — elles sont
// déjà distribuées sur l'allure, en dessiner d'autres ici afficherait deux
// vérités contradictoires sur le même podium.
function viewed(cat) {
  const v = cat.views && cat.views[lbDistanceView];
  return v ? { ...cat, ...v, noStars: true } : cat;
}

// « 4e », « 5e »… La suite du classement commençait à un numéro que seul le
// podium au-dessus laissait deviner. C'est le rang qui est écrit, pas la
// position dans la liste : deux ex æquo portent le même, comme sur les marches.
const placeHtml = (rank) => `<span class="lb-rest-place">${rank + 1}<sup>e</sup></span>`;

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

let lbSeason = SEASONS[0].id;
let lbCategory = STANDINGS.id;

function renderLeaderboard() {
  const season = SEASONS.find((s) => s.id === lbSeason) || SEASONS[0];
  const cats = categoriesOf(season);
  // Les onglets de distance changent d'une saison à l'autre : celui qu'on
  // regardait peut ne pas exister dans la nouvelle. On retombe alors sur le
  // classement aux étoiles plutôt que sur un panneau vide.
  const rawCat = cats.find((c) => c.id === lbCategory) || STANDINGS;
  lbCategory = rawCat.id;
  const cat = viewed(rawCat);

  const ranked = rankCategory(cat, season);
  const desc = typeof cat.desc === "function" ? cat.desc(season) : cat.desc;

  document.getElementById("lbScope").innerHTML =
    `<b>${season.title}</b> — ${season.scope} Les filtres du haut ne s'y appliquent pas.`;
  document.getElementById("lbDesc").innerHTML = `<b>${cat.title}</b> — ${desc}`;
  document.getElementById("lbPodium").innerHTML = ranked.length
    ? ranked.slice(0, 3).map((e, i) => podiumSlot(e, cat, i, Math.min(ranked.length, 3))).join("")
    : `<p class="empty-note">Personne ne concourt dans cette catégorie sur cette saison.</p>`;

  // Au-delà du podium : la suite du classement, l'avertissement « pas
  // d'étoiles » et les absents avec leur motif. Tout ce qui explique le podium
  // sans y tenir de place.
  const rest = ranked.slice(3);
  const absents = RUNNERS.filter((n) => !ranked.some((e) => e.name === n));
  document.getElementById("lbExtra").innerHTML = [
    rest.length
      ? `<ul class="lb-rest">${rest
          .map((e) => `<li>${placeHtml(e.rank)}<span class="dot" style="background:${RUNNER_COLORS[e.name]}"></span>${e.name}<span class="lb-rest-value">${cat.fmt(e.value)}</span></li>`)
          .join("")}</ul>`
      : "",
    rawCat.views && lbDistanceView === "time"
      ? `<p class="lb-note">Vue chrono : ce podium classe des temps, pas des allures. Les étoiles de la catégorie, elles, se jouent sur la vue allure et ne bougent pas d'ici.</p>`
      : "",
    ranked.length === 1 && !cat.noStars
      ? `<p class="lb-note">Un seul concourant : cette catégorie ne distribue pas d'étoiles.</p>`
      : "",
    absents.length
      ? `<p class="lb-note">Hors classement : ${absents
          .map((n) => `<b>${n}</b> — ${absentReason(cat, season, n)}`)
          .join(" · ")}</p>`
      : "",
  ].join("");

  renderLeaderboardTabs(season, cats, rawCat);
  document.querySelectorAll("#lbSeasons button").forEach((b) => {
    const on = b.dataset.value === season.id;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

// Un seul menu, sans sous-rubriques : les douze entrées sont toutes la même
// chose — une compétition à regarder. Les répartir sous « Classement », « Par
// distance » et « Catégories fun » laissait croire à trois réglages distincts
// alors qu'un seul choix est actif à la fois. Redessiné à chaque changement de
// saison, puisque les courses de distance proposées en dépendent.
function renderLeaderboardTabs(season, cats, rawCat) {
  const group = (label, buttons, grid) => `
    <div class="lb-tabs-group">
      <span class="filter-label">${label}</span>
      <div class="filter-switch${grid ? " tab-grid" : ""}">${buttons}</div>
    </div>`;

  const competitions = cats
    .map((c) => {
      const on = c.id === lbCategory;
      return `<button type="button" data-value="${c.id}" class="${on ? "active" : ""}" aria-pressed="${on}">${c.tab}</button>`;
    })
    .join("");

  // La bascule allure/chrono n'apparaît que là où elle veut dire quelque chose :
  // une seule des douze compétitions se lit de deux façons.
  const views = rawCat.views
    ? DISTANCE_VIEWS.map(([id, label]) => {
        const on = id === lbDistanceView;
        return `<button type="button" data-view="${id}" class="${on ? "active" : ""}" aria-pressed="${on}">${label}</button>`;
      }).join("")
    : "";

  document.getElementById("lbTabs").innerHTML =
    group("Compétition", competitions, true) + (views ? group("Vue", views) : "");
}

function initLeaderboard() {
  document.getElementById("lbSeasons").innerHTML = SEASONS.map(
    (s) => `<button type="button" data-value="${s.id}">${s.tab}</button>`,
  ).join("");

  // Délégation sur les deux barres : les onglets de catégorie sont recréés à
  // chaque rendu, un écouteur posé sur les boutons ne leur survivrait pas.
  document.getElementById("lbSeasons").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    lbSeason = btn.dataset.value;
    renderLeaderboard();
  });
  // La même barre porte deux réglages : la compétition regardée et, pour les
  // courses de distance, la façon de la lire.
  document.getElementById("lbTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.view) lbDistanceView = btn.dataset.view;
    else lbCategory = btn.dataset.value;
    renderLeaderboard();
  });

  renderLeaderboard();
}

// ---------- Leaderboard personnel ----------
// Le même podium, mais entre les sorties d'une seule personne : ici on ne
// compare plus des coureurs, on compare des séances. C'est la seule compétition
// du dashboard qu'on puisse gagner tout seul — et la seule où tout l'historique
// compte sans injustice, puisque personne n'y affronte quelqu'un d'arrivé avant.
//
// Pas d'étoiles : elles appartiennent au palmarès collectif, en distribuer ici
// laisserait croire que battre ses propres séances rapporte au général.
const RUN_CATEGORIES = [
  {
    id: "pace",
    tab: "🏁 Allure",
    title: "Les plus rapides",
    desc: "Les sorties à la meilleure allure moyenne. La mesure la plus brute qui soit : le temps mis pour chaque kilomètre, du départ à l'arrivée.",
    lower: true,
    value: (r) => r.paceSec,
    fmt: (v) => `${fmtPace(v)}/km`,
  },
  {
    id: "dist",
    tab: "📏 Distance",
    title: "Les plus longues",
    desc: "Les sorties les plus longues en kilomètres, sans regarder le temps qu'elles ont pris. Aller plus loin est un progrès en soi.",
    value: (r) => r.distance,
    fmt: (v) => `${v.toFixed(2)} km`,
  },
  {
    id: "time",
    tab: "⏱️ Temps de course",
    title: "Les plus longtemps dehors",
    desc: "Le temps passé à courir, distance mise de côté. Une sortie lente et longue vaut cher ici — c'est fait exprès, elle vaut cher pour de vrai.",
    value: (r) => r.duration,
    fmt: (v) => fmtDuration(v),
  },
  {
    id: "bestkm",
    tab: "⚡ Meilleur km",
    title: "Le meilleur kilomètre",
    desc: "Le kilomètre le plus rapide de chaque sortie, tronçons incomplets exclus. Une séance moyenne peut très bien contenir un excellent kilomètre.",
    lower: true,
    value: bestFullKm,
    fmt: (v) => `${fmtPace(v)}/km`,
  },
  {
    id: "cal",
    tab: "🔥 Calories",
    title: "Les plus coûteuses",
    desc: "Les calories actives dépensées sur la séance. Ça monte avec la distance comme avec l'intensité : c'est la dépense totale, pas l'effort par kilomètre.",
    value: (r) => r.activeCal,
    fmt: (v) => `${Math.round(v)} cal`,
  },
  {
    id: "hr",
    tab: "🧊 FC la plus basse",
    title: "Les plus calmes",
    desc: "Les séances au cœur le plus tranquille. Le podium des sorties faciles — celles qu'on oublie et qui font pourtant le gros du travail de fond.",
    lower: true,
    value: (r) => r.hr,
    fmt: (v) => `${Math.round(v)} bpm`,
  },
  {
    id: "cadence",
    tab: "👟 Cadence",
    title: "Les foulées les plus vives",
    desc: "Le nombre de pas par minute. Une cadence haute traduit une foulée courte et rapide, en général plus économe et moins traumatisante.",
    value: (r) => r.cadence,
    fmt: (v) => `${Math.round(v)} spm`,
  },
  {
    id: "elev",
    tab: "⛰️ Dénivelé",
    title: "Les plus pentues",
    desc: "Le dénivelé positif accumulé. Sur du plat on parle de quelques mètres, mais à allure égale, ceux-là comptent double dans les jambes.",
    value: (r) => r.elevation,
    fmt: (v) => `${Math.round(v)} m`,
  },
];

// Une catégorie n'est proposée que si la personne a de quoi la remplir : Didi
// n'a ni FC ni cadence, et l'onglet mènerait à un podium vide.
const personalCategories = (runs) => RUN_CATEGORIES.filter((c) => runs.some((r) => c.value(r) != null));

// Ex æquo au même rang, comme au leaderboard : deux séances à la seconde près
// ne peuvent pas être départagées par l'ordre du tableau.
function rankRuns(cat, runs) {
  const scored = runs.map((r) => ({ run: r, value: cat.value(r) })).filter((e) => e.value != null);
  scored.sort((a, b) => (cat.lower ? a.value - b.value : b.value - a.value));
  let rank = 0;
  scored.forEach((e, i) => {
    if (i > 0 && e.value !== scored[i - 1].value) rank = i;
    e.rank = rank;
  });
  return scored;
}

// Le nom d'une sortie, c'est sa distance et sa date : rien d'autre ne la
// distingue, et les deux ensemble suffisent à la retrouver dans le tableau.
const runLabel = (r) => `${r.distance.toFixed(2)} km · ${fmtDate(r.date)}`;

function runPodiumSlot(name, entry, cat, index, total) {
  const place = Math.min(entry.rank + 1, 3);
  const color = RUNNER_COLORS[name];
  const order = total >= 3 ? [2, 1, 3][index] || index + 1 : index + 1;
  return `
    <div class="podium-slot rank-${place}" style="--c:${color};--glow:${color}55;order:${order}">
      <div class="podium-avatar">${place === 1 ? `<span class="podium-crown">👑</span>` : ""}${name[0]}</div>
      <div class="podium-name">${entry.run.distance.toFixed(2)} km</div>
      <div class="podium-sub">${fmtDate(entry.run.date)}</div>
      <div class="podium-value">${cat.fmt(entry.value)}</div>
      <div class="podium-block"><span class="podium-rank">${entry.rank + 1}</span></div>
    </div>`;
}

let plCategory = RUN_CATEGORIES[0].id;

// Les deux cartes personnelles avaient chacune sa barre de pastilles : le même
// réglage que le filtre coureur du haut, posé une troisième fois. Elles lisent
// maintenant `viewRunners`, et rendent un bloc par personne quand la sélection
// en compte plusieurs. Celles qui n'ont rien déposé sont écartées d'office —
// avec « Tous », un podium vide au nom de Ju ne dit rien de plus que son
// absence du tableau.
const personalRunners = () => viewRunners.filter((n) => RUNS[n].length);

// Quatre palmarès et quatre vitrines dépliés d'un coup, c'est trois écrans de
// défilement pour des cartes qu'on vient consulter, pas lire de bout en bout.
// Sans filtre coureur, chaque bloc est donc replié sur son titre ; dès qu'on a
// demandé quelqu'un, ses blocs s'ouvrent — c'est qu'on venait les voir. Le clic
// sur un titre passe outre, et l'état tient jusqu'au prochain coup de filtre.
let plOpen = new Set();
let trOpen = new Set();

function resetBlocks() {
  const open = runnerFilterOn ? personalRunners() : [];
  plOpen = new Set(open);
  trOpen = new Set(open);
}

// Le titre d'un bloc : une pastille, un nom, et de quoi le replier. `teaser`
// n'apparaît qu'une fois replié — c'est ce qui reste à lire quand le contenu
// est caché, sinon il redit ce qui est juste en dessous.
function blockHead(name, open, teaser) {
  return `
    <h3 class="block-head">
      <button type="button" class="block-toggle" data-runner="${name}" aria-expanded="${open}">
        <span class="panel-chev" aria-hidden="true"></span>
        <span class="dot" style="background:${RUNNER_COLORS[name]}"></span>${name}
        ${!open && teaser ? `<span class="block-teaser">${teaser}</span>` : ""}
      </button>
    </h3>`;
}

// Délégation partagée : les blocs sont redessinés à chaque rendu.
function initBlockToggles(elId, open, render) {
  document.getElementById(elId).addEventListener("click", (e) => {
    const btn = e.target.closest(".block-toggle");
    if (!btn) return;
    const name = btn.dataset.runner;
    if (!open().delete(name)) open().add(name);
    render();
  });
}

// Le palmarès d'une personne dans la catégorie affichée. `solo` retire le titre
// nominatif et le repli : à une seule personne, le paragraphe de cadrage la
// nomme déjà, et il n'y a rien à replier pour faire de la place.
function personalBlock(name, cat, solo) {
  const runs = RUNS[name];
  const ranked = rankRuns(cat, runs);
  const open = solo || plOpen.has(name);
  // Replié, le titre porte le vainqueur de la catégorie : c'est la ligne pour
  // laquelle on aurait déplié.
  const head = solo
    ? ""
    : blockHead(name, open, ranked.length ? `${runLabel(ranked[0].run)} — ${cat.fmt(ranked[0].value)}` : "donnée non mesurée");
  const wrap = (body) =>
    `<div class="pl-block${open ? "" : " collapsed"}">${head}<div class="block-body"${open ? "" : " hidden"}>${body}</div></div>`;

  // La catégorie vient de la sélection entière : elle peut manquer à l'un de
  // ses membres — Didi n'a ni FC ni cadence. Son bloc reste, pour qu'on ne
  // croie pas l'avoir décoché par mégarde.
  if (!ranked.length) {
    return wrap(`<p class="empty-note">Son appli ne mesure pas cette donnée — rien à classer ici.</p>`);
  }

  // La suite du classement s'arrête à la 8e : au-delà, ce n'est plus un palmarès
  // mais le tableau des séances, qui existe déjà plus bas.
  const rest = ranked.slice(3, 8);
  const others = ranked.length - 8;
  return wrap(`
      <div class="podium">
        ${ranked
          .slice(0, 3)
          .map((e, i) => runPodiumSlot(name, e, cat, i, Math.min(ranked.length, 3)))
          .join("")}
      </div>
      <div class="lb-extra">
        ${rest.length
          ? `<ul class="lb-rest">${rest
              .map(
                (e) =>
                  `<li>${placeHtml(e.rank)}<span class="dot" style="background:${RUNNER_COLORS[name]}"></span>${runLabel(e.run)}<span class="lb-rest-value">${cat.fmt(e.value)}</span></li>`,
              )
              .join("")}</ul>`
          : ""}
        ${others > 0
          ? `<p class="lb-note">…et ${others} autre${others > 1 ? "s" : ""} séance${others > 1 ? "s" : ""} plus bas dans ce classement.</p>`
          : ""}
      </div>`);
}

function renderPersonal() {
  const names = personalRunners();
  const solo = names.length === 1;
  const scope = document.getElementById("plScope");
  const tabs = document.getElementById("plTabs");
  const desc = document.getElementById("plDesc");
  const blocks = document.getElementById("plBlocks");

  // Un onglet est proposé dès qu'une des personnes affichées peut le remplir :
  // le retirer parce que Didi n'a pas de FC priverait Vincent de sa catégorie
  // dans la même sélection.
  const cats = RUN_CATEGORIES.filter((c) =>
    names.some((n) => RUNS[n].some((r) => c.value(r) != null)),
  );
  // L'onglet regardé peut ne pas exister dans la sélection suivante : on
  // retombe sur le premier disponible plutôt que sur un panneau vide.
  const cat = cats.find((c) => c.id === plCategory) || cats[0];
  if (cat) plCategory = cat.id;

  if (!cat) {
    scope.innerHTML = "Personne d'affiché n'a encore déposé de séance.";
    tabs.innerHTML = "";
    desc.innerHTML = "";
    blocks.innerHTML = `<p class="empty-note">Le podium s'ouvrira à la première sortie.</p>`;
    return;
  }

  // Le filtre de distance, lui, ne s'applique toujours pas : un palmarès
  // personnel amputé de la moitié des sorties n'en est plus un.
  const note =
    "Aucune étoile en jeu et aucune comparaison avec les autres : c'est un palmarès privé. " +
    "Le filtre coureur du haut choisit qui apparaît ici ; le filtre de distance ne s'y applique pas.";
  scope.innerHTML = solo
    ? `<b>${names[0]}</b> — ses ${RUNS[names[0]].length} séances en concurrence les unes avec les autres, sur tout son historique. ${note}`
    : `Un palmarès par personne — chacun ses propres sorties en concurrence les unes avec les autres, sur tout son historique. ${note}`;
  desc.innerHTML = `<b>${cat.title}</b> — ${cat.desc}`;
  blocks.innerHTML = names.map((n) => personalBlock(n, cat, solo)).join("");

  // Même enveloppe que le palmarès collectif : `.lb-tabs` espace des groupes,
  // pas un libellé et sa rangée.
  tabs.innerHTML = `
    <div class="lb-tabs-group">
      <span class="filter-label">Catégorie</span>
      <div class="filter-switch tab-grid">
        ${cats
          .map((c) => {
            const on = c.id === plCategory;
            return `<button type="button" data-value="${c.id}" class="${on ? "active" : ""}" aria-pressed="${on}">${c.tab}</button>`;
          })
          .join("")}
      </div>
    </div>`;
}

function initPersonal() {
  initBlockToggles("plBlocks", () => plOpen, renderPersonal);
  // Délégation : les onglets de catégorie sont redessinés à chaque rendu.
  document.getElementById("plTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    plCategory = btn.dataset.value;
    renderPersonal();
  });
}

// ---------- Trophées ----------
// Une vitrine façon PlayStation : des paliers fixes, annoncés d'avance, qu'on
// décroche une fois pour toutes. C'est le contraire du leaderboard — on n'y bat
// personne, on franchit une barre — et c'est ce qui le rend jouable même pour
// qui finira toujours dernier au palmarès collectif.
//
// Trois règles de conception :
//  · un trophée porte la date où il a été gagné, pas celle du jour — on rejoue
//    donc l'historique dans l'ordre au lieu de tester l'état final ;
//  · aucun palier ne dépend d'une donnée inventée : ce qui n'est pas mesuré est
//    « hors de portée », pas « verrouillé » (voir DATA_REQUIREMENTS) ;
//  · un trophée verrouillé dit ce qui en approche le plus. Un cadenas muet
//    n'apprend rien ; « il t'a manqué 8 secondes » fait relacer les chaussures.
const TIERS = {
  bronze: { emoji: "🥉", label: "Bronze" },
  argent: { emoji: "🥈", label: "Argent" },
  or: { emoji: "🥇", label: "Or" },
  platine: { emoji: "🏆", label: "Platine" },
};

const daysBetween = (a, b) => (new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 864e5;

// Première séance qui remplit la condition, dans l'ordre chronologique.
const firstWhere = (runs, pred) => (chrono(runs).find(pred) || {}).date || null;

// Date à laquelle un cumul franchit son palier. Les séances suivantes ne
// changent rien : un trophée déjà gagné ne se regagne pas.
function crossedAt(runs, valueOf, target) {
  let total = 0;
  for (const r of chrono(runs)) {
    total += valueOf(r);
    if (total >= target) return r.date;
  }
  return null;
}

// La séance qui serre le palier de plus près, pour l'indice des trophées
// verrouillés.
function closestRun(runs, valueOf, lower) {
  const scored = runs.map((r) => [valueOf(r), r]).filter(([v]) => v != null);
  if (!scored.length) return null;
  return scored.sort((a, b) => (lower ? a[0] - b[0] : b[0] - a[0]))[0][1];
}

const near = (r, text) => (r ? `${text} le ${fmtDate(r.date)}` : null);
const fullSplits = (r) => (r.splits || []).filter((s) => !s.partial);

// Les trois paliers de distance partagent le même indice : la plus longue.
const nearDistance = (runs) => {
  const r = closestRun(runs, (x) => x.distance);
  return r ? near(r, `au plus loin : ${r.distance.toFixed(2)} km`) : null;
};

// Ce qu'une appli ne mesure pas ne se rattrape pas en courant : les captures
// d'adidas Running ne donnent ni FC, ni cadence, ni dénivelé, ni splits. Ces
// trophées-là sortent du décompte plutôt que de rester verrouillés à vie —
// sinon le Platine se refermerait pour un motif qui n'a rien à voir avec la
// course.
const DATA_REQUIREMENTS = {
  hr: { has: (r) => r.hr != null, why: "ses captures ne mesurent pas la fréquence cardiaque" },
  cadence: { has: (r) => r.cadence != null, why: "ses captures ne mesurent pas la cadence" },
  elevation: { has: (r) => r.elevation != null, why: "ses captures ne mesurent pas le dénivelé" },
  splits: { has: (r) => bestFullKm(r) != null, why: "ses captures ne détaillent pas les kilomètres" },
};

const outOfReach = (t, runs) => !!t.needs && runs.length > 0 && !runs.some(DATA_REQUIREMENTS[t.needs].has);

const TROPHIES = [
  {
    id: "first-run",
    tier: "bronze",
    name: "Le premier pas",
    desc: "Enregistrer sa toute première séance. Le trophée le plus facile du tableau, et pourtant celui que le plus de gens ratent.",
    at: (runs) => (chrono(runs)[0] || {}).date || null,
  },
  {
    id: "km-10",
    tier: "bronze",
    name: "Dix bornes au compteur",
    desc: "Accumuler 10 km, toutes sorties confondues.",
    at: (runs) => crossedAt(runs, (r) => r.distance, 10),
    progress: (runs) => [sum(runs.map((r) => r.distance)), 10, (v) => `${v.toFixed(1)} km`],
  },
  {
    id: "km-marathon",
    tier: "argent",
    name: "Le marathon en pièces détachées",
    desc: "Cumuler 42,195 km. En une fois c'est un exploit, en vingt fois c'est un trophée — et ça compte quand même.",
    at: (runs) => crossedAt(runs, (r) => r.distance, 42.195),
    progress: (runs) => [sum(runs.map((r) => r.distance)), 42.195, (v) => `${v.toFixed(1)} km`],
  },
  {
    id: "km-100",
    tier: "or",
    name: "Centurion",
    desc: "Cumuler 100 km depuis la première séance.",
    at: (runs) => crossedAt(runs, (r) => r.distance, 100),
    progress: (runs) => [sum(runs.map((r) => r.distance)), 100, (v) => `${v.toFixed(1)} km`],
  },
  {
    id: "dist-5",
    tier: "bronze",
    name: "Le club des 5",
    desc: "Boucler 5 km en une seule sortie. La distance qui sépare « je cours un peu » de « je cours ».",
    at: (runs) => firstWhere(runs, (r) => r.distance >= 5),
    near: nearDistance,
  },
  {
    id: "dist-6",
    tier: "argent",
    name: "Six",
    desc: "Boucler 6 km en une seule sortie.",
    at: (runs) => firstWhere(runs, (r) => r.distance >= 6),
    near: nearDistance,
  },
  {
    id: "dist-10",
    tier: "or",
    name: "Dix d'un coup",
    desc: "Boucler 10 km en une seule sortie, sans pause et sans négocier.",
    at: (runs) => firstWhere(runs, (r) => r.distance >= 10),
    near: nearDistance,
  },
  {
    id: "sub-30",
    tier: "or",
    name: "Sous la barre des 30",
    desc: "Couvrir 5 km ou plus en moins de 30 minutes. Le palier symbolique de la course à pied : 6'00 au kilomètre, tenus jusqu'au bout.",
    at: (runs) => firstWhere(runs, (r) => r.distance >= 5 && r.duration < 1800),
    near: (runs) => {
      const r = closestRun(runs, (x) => (x.distance >= 5 ? x.duration : null), true);
      return near(r, r ? `au plus près : ${fmtDuration(r.duration)}` : "");
    },
  },
  {
    id: "km-fast",
    tier: "argent",
    name: "Un kilomètre canon",
    desc: "Passer un kilomètre entier sous 5'45. Un seul suffit — personne ne demande de le refaire quatre fois.",
    needs: "splits",
    at: (runs) => firstWhere(runs, (r) => bestFullKm(r) != null && bestFullKm(r) < 345),
    near: (runs) => {
      const r = closestRun(runs, bestFullKm, true);
      return near(r, r ? `au plus près : ${fmtPace(bestFullKm(r))}` : "");
    },
  },
  {
    id: "neg-split",
    tier: "argent",
    name: "Négatif",
    desc: "Finir plus vite qu'on a commencé : dernier kilomètre complet plus rapide que le premier. La marque des gens qui savent partir doucement.",
    needs: "splits",
    at: (runs) =>
      firstWhere(runs, (r) => {
        const f = fullSplits(r);
        return f.length > 1 && f[f.length - 1].paceSec < f[0].paceSec;
      }),
  },
  {
    id: "metronome",
    tier: "argent",
    name: "Le métronome",
    desc: "Tenir moins de 50 secondes d'écart entre le kilomètre le plus rapide et le plus lent d'une même sortie.",
    needs: "splits",
    at: (runs) =>
      firstWhere(runs, (r) => {
        const f = fullSplits(r).map((s) => s.paceSec);
        return f.length > 1 && Math.max(...f) - Math.min(...f) < 50;
      }),
    near: (runs) => {
      const spread = (r) => {
        const f = fullSplits(r).map((s) => s.paceSec);
        return f.length > 1 ? Math.max(...f) - Math.min(...f) : null;
      };
      const r = closestRun(runs, spread, true);
      return near(r, r ? `au plus près : ${Math.round(spread(r))} s d'écart` : "");
    },
  },
  {
    id: "runs-10",
    tier: "bronze",
    name: "Le dixième",
    desc: "Enregistrer 10 séances. Le moment où ça arrête d'être une lubie.",
    at: (runs) => (chrono(runs)[9] || {}).date || null,
    progress: (runs) => [runs.length, 10, (v) => `${Math.round(v)} séances`],
  },
  {
    id: "three-in-seven",
    tier: "argent",
    name: "Trois en sept jours",
    desc: "Courir trois fois à l'intérieur d'une même semaine glissante.",
    at: (runs) => {
      const s = chrono(runs);
      for (let i = 2; i < s.length; i++) {
        if (daysBetween(s[i - 2].date, s[i].date) <= 6) return s[i].date;
      }
      return null;
    },
  },
  {
    id: "month-7",
    tier: "or",
    name: "Le mois plein",
    desc: "Sept séances dans un même mois calendaire. Presque deux par semaine, sans trou.",
    at: (runs) => {
      const count = {};
      for (const r of chrono(runs)) {
        const m = r.date.slice(0, 7);
        count[m] = (count[m] || 0) + 1;
        if (count[m] >= 7) return r.date;
      }
      return null;
    },
    progress: (runs) => {
      const count = {};
      runs.forEach((r) => {
        const m = r.date.slice(0, 7);
        count[m] = (count[m] || 0) + 1;
      });
      const best = Math.max(0, ...Object.values(count));
      return [best, 7, (v) => `${Math.round(v)} séances`, "meilleur mois à ce jour"];
    },
  },
  {
    id: "comeback",
    tier: "bronze",
    name: "Le retour",
    desc: "Repartir courir après au moins dix jours d'arrêt. Reprendre est plus dur que continuer, et ça méritait sa récompense.",
    at: (runs) => {
      const s = chrono(runs);
      for (let i = 1; i < s.length; i++) {
        if (daysBetween(s[i - 1].date, s[i].date) >= 10) return s[i].date;
      }
      return null;
    },
  },
  {
    id: "hr-125",
    tier: "argent",
    name: "Cœur de marbre",
    desc: "Boucler une séance sous 125 bpm de moyenne. Le trophée de la sortie vraiment lente — celle que tout le monde saute.",
    needs: "hr",
    at: (runs) => firstWhere(runs, (r) => r.hr != null && r.hr < 125),
    near: (runs) => {
      const r = closestRun(runs, (x) => x.hr, true);
      return near(r, r ? `au plus près : ${r.hr} bpm` : "");
    },
  },
  {
    id: "cadence-150",
    tier: "argent",
    name: "Foulée vive",
    desc: "Tenir 150 pas par minute de moyenne sur une séance. Des pas plus courts, plus nombreux, et des genoux qui disent merci.",
    needs: "cadence",
    at: (runs) => firstWhere(runs, (r) => r.cadence != null && r.cadence >= 150),
    near: (runs) => {
      const r = closestRun(runs, (x) => x.cadence);
      return near(r, r ? `au plus près : ${r.cadence} spm` : "");
    },
  },
  {
    id: "elev-10",
    tier: "bronze",
    name: "Un peu de relief",
    desc: "Encaisser 10 m de dénivelé positif sur une sortie. On est loin de la montagne, mais les jambes font la différence.",
    needs: "elevation",
    at: (runs) => firstWhere(runs, (r) => r.elevation != null && r.elevation >= 10),
    near: (runs) => {
      const r = closestRun(runs, (x) => x.elevation);
      return near(r, r ? `au plus près : ${r.elevation} m` : "");
    },
  },
  {
    id: "cal-1000",
    tier: "bronze",
    name: "Le premier millier",
    desc: "Brûler 1 000 calories actives, cumulées sur toutes les sorties.",
    at: (runs) => crossedAt(runs, (r) => r.activeCal, 1000),
    progress: (runs) => [sum(runs.map((r) => r.activeCal)), 1000, (v) => `${Math.round(v)} cal`],
  },
  {
    id: "cal-5000",
    tier: "or",
    name: "Fournaise",
    desc: "Brûler 5 000 calories actives au total. De quoi justifier à peu près n'importe quel dessert.",
    at: (runs) => crossedAt(runs, (r) => r.activeCal, 5000),
    progress: (runs) => [sum(runs.map((r) => r.activeCal)), 5000, (v) => `${Math.round(v)} cal`],
  },
];

// Le Platine ne se joue pas, il se constate : il tombe le jour où le dernier
// trophée à portée se débloque. Il est donc exclu du dénominateur — c'est la
// récompense des 100 %, pas une case de plus à cocher.
const PLATINE = {
  id: "platine",
  tier: "platine",
  name: "Le tableau complet",
  desc: "Débloquer tous les autres trophées à sa portée. Il n'y a rien après.",
  at: (runs) => {
    const dates = TROPHIES.filter((t) => !outOfReach(t, runs)).map((t) => t.at(runs));
    return dates.length && dates.every(Boolean) ? dates.sort().pop() : null;
  },
};

function trophyState(t, runs) {
  if (outOfReach(t, runs)) return { state: "oor", why: DATA_REQUIREMENTS[t.needs].why };
  const date = t.at(runs);
  return date ? { state: "unlocked", date } : { state: "locked" };
}

function trophyCard(t, runs) {
  const { state, date, why } = trophyState(t, runs);
  const tier = TIERS[t.tier];

  let meta = "";
  if (state === "unlocked") {
    meta = `<div class="trophy-meta unlocked">Débloqué le ${fmtDate(date)}</div>`;
  } else if (state === "oor") {
    meta = `<div class="trophy-meta">Hors de portée — ${why}</div>`;
  } else {
    // Verrouillé : la barre de progression quand le palier s'accumule, l'indice
    // du « plus près » quand il se joue sur une seule séance.
    const p = t.progress ? t.progress(runs) : null;
    const hint = t.near ? t.near(runs) : null;
    if (p) {
      const [now, target, fmt, label] = p;
      const pct = Math.max(0, Math.min(100, (now / target) * 100));
      meta = `
        <div class="trophy-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
        <div class="trophy-meta">${fmt(now)} / ${fmt(target)}${label ? ` · ${label}` : ""}</div>`;
    } else if (hint) {
      meta = `<div class="trophy-meta">🔒 ${capitalize(hint)}</div>`;
    } else {
      meta = `<div class="trophy-meta">🔒 Verrouillé</div>`;
    }
  }

  return `
    <div class="trophy ${state} tier-${t.tier}">
      <div class="trophy-medal" aria-hidden="true">${tier.emoji}</div>
      <div class="trophy-body">
        <div class="trophy-name">${t.name}<span class="trophy-tier">${tier.label}</span></div>
        <div class="trophy-desc">${t.desc}</div>
        ${meta}
      </div>
    </div>`;
}

// La vitrine d'une personne : son compteur, sa jauge, sa grille. Comme le
// palmarès personnel, elle suit le filtre coureur du haut et se répète quand
// plusieurs personnes sont cochées — les paliers étant les mêmes pour tout le
// monde, deux vitrines côte à côte se comparent d'un coup d'œil.
function trophyBlock(name, solo) {
  const runs = RUNS[name];
  const reachable = TROPHIES.filter((t) => !outOfReach(t, runs));
  const unlocked = reachable.filter((t) => t.at(runs));
  const pct = reachable.length ? (unlocked.length / reachable.length) * 100 : 0;
  const oor = TROPHIES.length - reachable.length;
  const byTier = (tier) => unlocked.filter((t) => t.tier === tier).length;
  const platine = PLATINE.at(runs);

  const open = solo || trOpen.has(name);
  // Replié, il ne reste que le titre et son compteur : la vingtaine de tuiles,
  // la jauge et le paragraphe d'explication — le même pour tout le monde —
  // attendent qu'on les demande.
  return `
    <div class="tr-block${open ? "" : " collapsed"}">
      ${solo ? "" : blockHead(name, open, `${unlocked.length} / ${reachable.length} · ${Math.round(pct)} %`)}
      <div class="block-body"${open ? "" : " hidden"}>
      <div class="trophy-progress">
        <div class="tr-head">
          <span class="tr-count">${unlocked.length} <em>/ ${reachable.length}</em></span>
          <span class="tr-tiers">
            ${TIERS.bronze.emoji} ${byTier("bronze")} &nbsp; ${TIERS.argent.emoji} ${byTier("argent")} &nbsp; ${TIERS.or.emoji} ${byTier("or")}
            &nbsp;·&nbsp; ${platine ? "Platine décroché 🏆" : "Platine à décrocher"}
          </span>
        </div>
        <div class="tr-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
        <p class="lb-scope">
          <b>${name}</b> — ${Math.round(pct)} % du tableau. Les paliers sont les mêmes pour tout le monde et ne se perdent jamais : chacun porte la date du jour où il est tombé.
          ${oor ? ` ${oor} trophée${oor > 1 ? "s sont hors de portée" : " est hors de portée"} faute de mesure, et ne compte${oor > 1 ? "nt" : ""} donc pas dans le total.` : ""}
        </p>
      </div>
      <div class="trophy-grid">
        ${[PLATINE, ...TROPHIES].map((t) => trophyCard(t, runs)).join("")}
      </div>
      </div>
    </div>`;
}

function initTrophies() {
  initBlockToggles("trBlocks", () => trOpen, renderTrophies);
}

function renderTrophies() {
  const names = personalRunners();
  const el = document.getElementById("trBlocks");
  // Aucune séance dans la sélection : la vitrine entière serait verrouillée, et
  // quinze cadenas alignés se lisent comme une panne plutôt que comme un début.
  el.innerHTML = names.length
    ? names.map((n) => trophyBlock(n, names.length === 1)).join("")
    : `<p class="empty-note">Personne d'affiché n'a encore déposé de séance : la vitrine s'ouvrira à la première sortie.</p>`;
}


// ---------- Cartes repliables ----------
// Trois cartes s'ouvrent fermées. Le palmarès, le palmarès personnel et les
// trophées sont des à-côtés qu'on vient consulter ; dépliés, ils repoussaient
// le détail des séances à deux écrans de défilement alors que c'est lui qu'on
// vient lire après une sortie.
const COLLAPSED_BY_DEFAULT = ["leaderboard", "personal", "trophies"];

// L'état est retenu d'une visite à l'autre : replier une carte est un réglage,
// pas un geste à refaire à chaque rechargement. Un stockage indisponible
// (navigation privée, quota) ne doit rien casser — on retombe alors sur les
// défauts ci-dessus.
const PANEL_STATE_KEY = "runs.panels";

function loadPanelState() {
  try {
    return JSON.parse(localStorage.getItem(PANEL_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePanelState(key, open) {
  try {
    const state = loadPanelState();
    state[key] = open;
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch {
    /* rien à faire : l'état de la session reste correct, seul l'oubli est acquis */
  }
}

function setPanelOpen(panel, open) {
  panel.classList.toggle("collapsed", !open);
  panel.querySelector(".panel-toggle").setAttribute("aria-expanded", String(open));
  panel.querySelector(".panel-body").hidden = !open;
  // Chart.js mesure son conteneur au tracé : replié, le canvas n'avait aucune
  // taille, et le graphique revenait écrasé de son dépliage sans ce resize.
  if (open && evoChart && panel.querySelector("#evolutionChart")) evoChart.resize();
}

function initCollapsibles() {
  const saved = loadPanelState();
  document.querySelectorAll(".panel[data-panel]").forEach((panel) => {
    const key = panel.dataset.panel;
    setPanelOpen(panel, key in saved ? saved[key] : !COLLAPSED_BY_DEFAULT.includes(key));
    panel.querySelector(".panel-toggle").addEventListener("click", () => {
      const open = panel.classList.contains("collapsed");
      setPanelOpen(panel, open);
      savePanelState(key, open);
    });
  });
}

// ---------- Sélecteurs globaux ----------
// Un seul actif à la fois : c'est le comportement du sélecteur de métrique, où
// deux courbes de nature différente sur le même axe n'auraient pas de sens.
// `active` : la barre est redessinée quand le filtre de distance change, et
// l'actif n'est alors pas forcément le premier bouton — il faut le lui dire.
function buildSwitch(elId, options, onPick, active = options[0][0]) {
  const el = document.getElementById(elId);
  el.innerHTML = options
    .map(([k, label]) => `<button data-value="${k}" class="${k === active ? "active" : ""}">${label}</button>`)
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
// Le palmarès collectif, lui, n'en dépend pas et n'est rendu qu'à l'init : il
// compare tout le monde par construction.
function renderAll() {
  renderCards();
  // Avant le graphique : le sélecteur peut changer la métrique courante quand
  // celle qu'on regardait vient d'être retirée par le filtre de distance.
  renderMetricSwitch();
  renderEvolution();
  renderPersonal();
  renderTrophies();
  renderTable();
  document.getElementById("totalRuns").textContent = sum(viewRunners.map((n) => runsOf(n).length));
}

function renderFilters() {
  buildMultiSwitch("runnerFilter", "Tous", RUNNERS.map((n) => [n, n]), (sel) => {
    viewRunners = sel.length ? sel : [...RUNNERS];
    runnerFilterOn = sel.length > 0;
    resetBlocks();
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
initLeaderboard();
initPersonal();
initTrophies();
resetBlocks();
renderAll();
// En dernier : les panneaux sont rendus à leur taille naturelle, donc Chart.js
// mesure un conteneur réel avant qu'on replie quoi que ce soit. Tout est
// synchrone, rien n'est peint entre-temps.
initCollapsibles();

// Déploiement de l'analyse au clic sur une ligne (délégation : survit aux re-render)
document.querySelector("#runsTable tbody").addEventListener("click", (e) => {
  const row = e.target.closest(".run-row");
  if (!row) return;
  const open = row.classList.toggle("open");
  row.setAttribute("aria-expanded", String(open));
  const detail = row.parentElement.querySelector(`.analysis-row[data-key="${CSS.escape(row.dataset.key)}"]`);
  if (detail) detail.classList.toggle("open", open);
});
