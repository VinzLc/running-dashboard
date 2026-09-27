/* global Chart, RUNS, RUNNER_COLORS, RUNNER_MII, ANALYSES, POKEDEX */

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

// Le coureur choisi sur l'écran de sélection (null : tout le monde). Il règle
// le filtre au départ, puis ne sert plus qu'à se reconnaître sur les podiums —
// le filtre, lui, reste libre de montrer qui on veut.
let fighter = null;

// ---------- Mii ----------
// Chaque coureur a son avatar façon Mii, dessiné ici en SVG à partir de
// quelques traits déclarés dans RUNNER_MII (data.js) : coupe, couleurs,
// lunettes, barbe. Un nouveau coureur n'a donc besoin que d'une ligne de
// données, pas d'un dessin. Le t-shirt prend la couleur du coureur. Les listes
// ci-dessous nourrissent aussi l'Atelier Mii (plus bas), et verifier.js comme
// .claude/tools/mii.js en relisent les clés : une option ajoutée ici est
// aussitôt proposée, vérifiée et applicable.
const MII_PEAU = "#f3c9a2";

// Éclaircit (t > 0) ou assombrit (t < 0) une couleur hexadécimale.
const shade = (hex, t) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

const rond = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

// Dégagé : le front sans frange, pour les coupes attachées.
const DEGAGE = "M26 47 C24.5 28 35.5 17.5 50 17.5 C64.5 17.5 75.5 28 74 47 C72.5 39 65 31.5 50 31 C35 31.5 27.5 39 26 47 Z";

// Chaque coupe : `back` passe derrière la tête, `front` par-dessus. `longs`
// cache les oreilles, `attache` place l'élastique des coupes attachées.
// Repère : viewBox de 100 × 100, tête centrée en (50, 47).
const MII_COIFFURES = {
  meche: {
    label: "Mèche",
    front: "M25.5 49 C23 28 35 16 51 16 C67.5 16 78 28 74.5 49 C73.6 43 72.2 39 69.8 35.6 C61 35.5 51.5 33 43.5 29 C39.5 33.5 33 36.5 29.2 38.6 C27.4 41.6 26.2 45 25.5 49 Z",
  },
  houppe: {
    label: "Épis",
    front: "M25.5 49 C23.4 33 28 23 35 18.6 L34.6 12.6 L41.6 15.6 L45 9.6 L50.4 14.4 L56.4 9.8 L58.8 15.8 L65.6 13.2 L65 19.4 C72.6 24 77.6 33 74.5 49 C73.6 43.2 72 39.4 69.6 36.6 L64.4 34.8 L60.6 37.2 L56 33.8 L51.4 36.6 L46.8 33.6 L42 36.8 L37.4 34.4 L33.2 37.6 L29.4 37.6 C27.6 40.8 26.3 44.6 25.5 49 Z",
  },
  court: {
    label: "Court",
    front: "M26 48 C24.2 28.5 35.5 17.5 50 17.5 C64.5 17.5 75.8 28.5 74 48 C73.2 43 71.8 39.6 69.8 37.2 C63.5 37.4 57.5 36 52.5 33.6 C46.5 36.4 37.5 38 30.6 37.2 C28.6 40.2 27 43.6 26 48 Z",
  },
  rase: {
    label: "Rasé",
    front: "M26.8 45 C26 29.5 36 20 50 20 C64 20 74 29.5 73.2 45 C71 38 64 33.2 50 33 C36 33.2 29 38 26.8 45 Z",
    opacite: 0.78,
  },
  chauve: { label: "Chauve", brillant: true },
  boucles: {
    label: "Bouclés",
    front: [
      [28, 45, 5.6], [29, 36, 6.6], [34, 27.5, 7.4], [42, 21.5, 8], [50.5, 19.5, 8.2], [59, 21.5, 8], [66.5, 27.5, 7.4], [71, 36, 6.6], [72, 45, 5.6],
      [37, 33, 6.4], [45, 30.5, 6.6], [55, 30.5, 6.6], [63, 33, 6.4],
    ].map(([x, y, r]) => rond(x, y, r)).join(" "),
    boucle: true,
  },
  "longs-frange": {
    label: "Longs, frange",
    longs: true,
    back: "M23.5 46 C21.5 24 35 14 50 14 C65 14 78.5 24 76.5 46 L80 82 Q66 88 50 87 Q34 88 20 82 Z",
    front: "M25.6 48 C24.2 27.5 35.5 17 50 17 C64.5 17 75.8 27.5 74.4 48 C73.2 43 71.6 39.4 70 37 C62 37.8 38 37.8 30 37 C28.4 39.4 26.8 43 25.6 48 Z",
  },
  "longs-raie": {
    label: "Longs, raie",
    longs: true,
    back: "M23.5 46 C21.5 24 35 14 50 14 C65 14 78.5 24 76.5 46 L80 82 Q66 88 50 87 Q34 88 20 82 Z",
    front: "M25.6 50 C24 29 35.5 17 50 17 C65 17 76 29 74.4 50 C73 42.5 69.4 36.4 62.6 33.2 C54.6 30.6 46.4 28.4 40.6 23.6 C37 30.4 31.6 37.2 28.4 43.6 C27 46.2 26.2 48.2 25.6 50 Z",
  },
  queue: {
    label: "Queue-de-cheval",
    back: "M64 20.5 C78 16 90 28 87.5 47 C86.2 58 80.5 66 74 69.5 C78.6 60 80.4 50.5 78 41.5 C76.2 34.5 72 29 66 26.5 Z",
    attache: [69.5, 22.8],
    front: DEGAGE,
  },
  chignon: {
    label: "Chignon",
    back: rond(50, 13.5, 9.5),
    attache: [50, 21.6],
    front: DEGAGE,
  },
};

const MII_LUNETTES = {
  carrees: {
    label: "Carrées",
    dessin: `<g fill="rgba(255,255,255,0.12)" stroke="#1d1d1f" stroke-width="1.7">
      <rect x="34" y="43.6" width="14" height="11.6" rx="3.6"/><rect x="52" y="43.6" width="14" height="11.6" rx="3.6"/>
      <path d="M48 48.4 Q50 46.8 52 48.4 M34 47.6 L27.4 46.4 M66 47.6 L72.6 46.4" fill="none"/></g>`,
  },
  rondes: {
    label: "Rondes",
    dessin: `<g fill="rgba(255,255,255,0.12)" stroke="#8a6a2e" stroke-width="1.5">
      <circle cx="41" cy="49.6" r="6.6"/><circle cx="59" cy="49.6" r="6.6"/>
      <path d="M47.6 48.6 Q50 46.8 52.4 48.6 M34.4 48.4 L27.4 46.6 M65.6 48.4 L72.6 46.6" fill="none"/></g>`,
  },
  soleil: {
    label: "Solaires",
    dessin: `<g stroke="#111" stroke-width="1.2">
      <path d="M31.5 44.4 C38 42.6 46 42.8 49 44.6 L48.4 50.4 C47.4 55.4 36 56.4 33.4 51.6 Z M68.5 44.4 C62 42.6 54 42.8 51 44.6 L51.6 50.4 C52.6 55.4 64 56.4 66.6 51.6 Z" fill="#1c1c24"/>
      <path d="M49 45.4 Q50 44.4 51 45.4 M31.6 45.6 L27.2 46.4 M68.4 45.6 L72.8 46.4" fill="none"/></g>
      <path d="M35.5 46 L39.5 45.2 M55 46 L59 45.2" stroke="#fff" stroke-opacity="0.5" stroke-width="1.4" stroke-linecap="round"/>`,
  },
};

const MII_BARBES = {
  courte: {
    label: "Naissante",
    dessous: (c) => `<path d="M27.6 52 C28 66.5 37.5 75 50 75 C62.5 75 72 66.5 72.4 52 C70 60.5 65 63 60 62.4 C56 60.4 44 60.4 40 62.4 C35 63 30 60.5 27.6 52 Z" fill="${c}" opacity="0.28"/>`,
  },
  complete: {
    label: "Barbe",
    dessous: (c) => `<path d="M27 50 C26.6 68 37 78.5 50 78.5 C63 78.5 73.4 68 73 50 C71 59 66.5 63.4 61 63.6 C57 60.2 43 60.2 39 63.6 C33.5 63.4 29 59 27 50 Z" fill="${c}"/>`,
    dessus: (c) => `<path d="M41.6 61.2 C44.6 57.8 48.4 58 50 59.6 C51.6 58 55.4 57.8 58.4 61.2 C55 60.4 52 60.8 50 61.6 C48 60.8 45 60.4 41.6 61.2 Z" fill="${c}"/>`,
  },
  moustache: {
    label: "Moustache",
    dessus: (c) => `<path d="M41.6 61.4 C44.6 57.6 48.4 57.8 50 59.6 C51.6 57.8 55.4 57.6 58.4 61.4 C55 60.4 52 60.8 50 61.8 C48 60.8 45 60.4 41.6 61.4 Z" fill="${c}"/>`,
  },
};

// Les nuanciers de l'Atelier. Une couleur hors nuancier reste possible (le
// sélecteur « Autre »), ils ne servent qu'à proposer des teintes qui marchent.
const MII_NUANCIERS = {
  cheveux: [
    ["#1f1a17", "Noir"], ["#2e1c12", "Brun foncé"], ["#4a2e1c", "Brun"], ["#6a4327", "Châtain"],
    ["#9a6a3f", "Châtain clair"], ["#b5532a", "Roux"], ["#e3bd6a", "Blond"], ["#efe0b0", "Blond platine"],
    ["#9a9aa0", "Gris"], ["#e8e8ea", "Blanc"],
  ],
  yeux: [
    ["#2b2220", "Noirs"], ["#6b3f22", "Marron"], ["#8a6a2e", "Noisette"], ["#3d9a4f", "Verts"],
    ["#3d7fd6", "Bleus"], ["#7d8a96", "Gris"],
  ],
  peau: [
    ["#fde3c8", "Très clair"], ["#f3c9a2", "Clair"], ["#e0ac7e", "Doré"], ["#c68a5c", "Mat"],
    ["#9a6440", "Foncé"], ["#6e4428", "Très foncé"],
  ],
};

function miiDessin(mii, color, { tete = false } = {}) {
  const peau = mii.peau || MII_PEAU;
  const peauOmbre = shade(peau, -0.1);
  const peauTrait = shade(peau, -0.3);
  const coupe = MII_COIFFURES[mii.coiffure] || MII_COIFFURES.court;
  const cheveux = mii.cheveux;
  const sourcils = mii.sourcils || shade(cheveux, -0.15);
  const contour = shade(cheveux, -0.35);
  const lunettes = MII_LUNETTES[mii.lunettes === true ? "carrees" : mii.lunettes];
  const barbe = MII_BARBES[mii.barbe];
  const trait = `stroke="${contour}" stroke-width="0.8" stroke-opacity="0.5"`;

  const oeil = (x) => {
    const ext = x < 50 ? -1 : 1;
    return `
      <ellipse cx="${x}" cy="49.4" rx="4.3" ry="4.9" fill="#fff"/>
      <circle cx="${x}" cy="50" r="3.4" fill="${mii.yeux}"/>
      <circle cx="${x}" cy="50.2" r="1.55" fill="#161010"/>
      <circle cx="${x - 1.1}" cy="48.7" r="1.05" fill="#fff"/>
      <path d="M${x - 4.7} 48.6 Q${x} 43.4 ${x + 4.7} 48.6" fill="none" stroke="#2a1a14" stroke-width="1.35" stroke-linecap="round"/>
      ${mii.cils ? `<path d="M${x + ext * 4.4} 47.9 l${ext * 2} -1.6" stroke="#2a1a14" stroke-width="1.2" stroke-linecap="round"/>` : ""}`;
  };

  const bandeau = mii.bandeau
    ? `<path d="M27.4 36.4 C35 29.4 65 29.4 72.6 36.4 L73.4 41 C65 34 35 34 26.6 41 Z" fill="#fff"/>
       <path d="M27 38.7 C35 31.7 65 31.7 73 38.7" fill="none" stroke="${color}" stroke-width="1.7"/>`
    : "";

  return `<svg viewBox="${tete ? "17 12 66 66" : "0 0 100 100"}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    ${coupe.back ? `<path d="${coupe.back}" fill="${cheveux}" ${trait}/>` : ""}
    <path d="M14 100 C15 87 29 80.5 50 80.5 C71 80.5 85 87 86 100 Z" fill="${color}"/>
    <path d="M43 64 L43 81 Q50 86.5 57 81 L57 64 Z" fill="${peauOmbre}"/>
    ${coupe.longs ? "" : `<ellipse cx="26.8" cy="51" rx="4.4" ry="6" fill="${peau}"/><ellipse cx="73.2" cy="51" rx="4.4" ry="6" fill="${peau}"/>`}
    <path d="M50 21 C65 21 73.6 32 73.6 47 C73.6 63.5 63 74.5 50 74.5 C37 74.5 26.4 63.5 26.4 47 C26.4 32 35 21 50 21 Z" fill="${peau}"/>
    ${coupe.brillant ? `<ellipse cx="41" cy="28" rx="7" ry="3.4" transform="rotate(-18 41 28)" fill="#fff" opacity="0.28"/>` : ""}
    <circle cx="36.5" cy="59" r="3.6" fill="#ff7a7a" opacity="0.22"/>
    <circle cx="63.5" cy="59" r="3.6" fill="#ff7a7a" opacity="0.22"/>
    ${barbe && barbe.dessous ? barbe.dessous(cheveux) : ""}
    ${oeil(41)}${oeil(59)}
    <path d="M35.6 41.6 Q40.4 38.6 45.6 40.4 M54.4 40.4 Q59.6 38.6 64.4 41.6" fill="none" stroke="${sourcils}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M50.6 52.6 Q48 57.2 50.9 57.9" fill="none" stroke="${peauTrait}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M43.6 62 Q50 70 56.4 62 Q50 63.6 43.6 62 Z" fill="#8e2f3a"/>
    <path d="M44.8 62.4 Q50 63.9 55.2 62.4 L54.4 63.6 Q50 64.8 45.6 63.6 Z" fill="#fff"/>
    ${barbe && barbe.dessus ? barbe.dessus(cheveux) : ""}
    ${coupe.front ? `<path d="${coupe.front}" fill="${cheveux}"${coupe.opacite ? ` fill-opacity="${coupe.opacite}"` : ""}${coupe.longs ? "" : ` ${trait}`}/>` : ""}
    ${coupe.attache ? `<circle cx="${coupe.attache[0]}" cy="${coupe.attache[1]}" r="2.3" fill="${color}" stroke="#fff" stroke-width="0.8"/>` : ""}
    ${bandeau}
    ${lunettes ? lunettes.dessin : ""}
  </svg>`;
}

// Sans Mii déclaré, un avatar neutre plutôt qu'une case vide.
const MII_DEFAUT = { cheveux: "#4a4a4f", coiffure: "court", yeux: "#5b4a3a" };

// Les Mii retouchés dans l'Atelier sur cet appareil passent par-dessus ceux de
// data.js. `MII_DATA` garde la version publiée, pour « Réinitialiser ». Lecture
// protégée : sans stockage (navigation privée), on reste sur data.js.
const MII_KEY = "runs.mii";
const MII_DATA = JSON.parse(JSON.stringify(RUNNER_MII));
const miiLocaux = () => {
  try {
    return JSON.parse(localStorage.getItem(MII_KEY)) || {};
  } catch {
    return {};
  }
};
Object.entries(miiLocaux()).forEach(([n, m]) => {
  if (RUNS[n] && m && m.cheveux && m.yeux) RUNNER_MII[n] = m;
});

// `tete` recadre sur le visage, pour les médaillons ronds (podium, cartes).
const miiSvg = (name, opts) => miiDessin(RUNNER_MII[name] || MII_DEFAUT, RUNNER_COLORS[name] || "#8e8e93", opts);

// Médaillon rond : le visage sur un fond pastel de la couleur du coureur.
const miiBadge = (name, cls = "mii-badge") =>
  `<span class="${cls}" style="--mii-bg:${shade(RUNNER_COLORS[name] || "#8e8e93", 0.55)}">${miiSvg(name, { tete: true })}</span>`;

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
    if (!runs.length) {
      return `
      <div class="runner-card empty">
        <h3>${miiBadge(name, "card-mii")}${name}</h3>
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
        <h3>${miiBadge(name, "card-mii")}${name}</h3>
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
            // Arrondi : sur un écart serré (un seul coureur, 3,5 à 4 km), Chart.js
            // gradue au dixième et affiche ses erreurs de flottant, 4.1000000000000005.
            callback: (v) =>
              metricKey === "paceSec" ? fmtPace(v) : metricKey === "duration" ? fmtDuration(v) : Math.round(v * 100) / 100,
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

// Un 5 km couru à l'intérieur d'un 6 km reste un 5 km. Les splits permettent de
// le retrouver : on fait glisser une fenêtre de `n` kilomètres complets sur la
// séance et on garde la plus rapide. Sans ça, le meilleur 5 km de quelqu'un peut
// être enfermé dans une sortie étiquetée « 6 km » et n'apparaître nulle part.
// En dessous de 5 km on ne suit rien : le kilomètre isolé a déjà son podium, et
// les distances intermédiaires ne sont visées par personne.
const BLOCK_MIN = 5;

function bestBlock(r, n) {
  const full = (r.splits || []).filter((s) => !s.partial);
  if (full.length < n) return null;
  let best = Infinity;
  for (let i = 0; i + n <= full.length; i++) {
    let t = 0;
    for (let k = i; k < i + n; k++) t += full[k].sec;
    best = Math.min(best, t);
  }
  return best;
}

// Ce qu'une séance vaut sur une distance ronde de `n` km : le bloc mesuré quand
// les splits sont là, sinon l'allure moyenne de la séance ramenée à `n` km quand
// elle tombe dans le seau. Ce repli n'est pas un détail — sans lui, toutes les
// séances d'avant août 2026 et toutes celles de Didi sur adidas disparaîtraient
// des courses de distance, faute de détail par kilomètre. On extrapole plutôt
// qu'on ne prend le chrono brut : celui-ci couvre 5,39 km dans le seau des 5 km,
// et le comparer à un bloc de 5 000 m exacts ferait perdre la séance la plus
// longue sur des mètres qu'elle est la seule à avoir courus.
function runTimeOver(r, n) {
  const block = bestBlock(r, n);
  if (block != null) return block;
  return bucketOf(r) === String(n) ? Math.round(r.paceSec * n) : null;
}

// Les distances rondes qu'il vaut la peine de suivre : celles que quelqu'un a
// atteintes au moins une fois.
const BLOCK_DISTANCES = [...new Set(RUNNERS.flatMap((n) => RUNS[n]).map((r) => Math.floor(r.distance)))]
  .filter((n) => n >= BLOCK_MIN)
  .sort((a, b) => a - b);

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
    const blockBests = {};
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
      // Records de distance ronde battus par cette séance. Comme pour le
      // kilomètre, la première fois ne décroche rien : il n'y avait pas de marque
      // à battre, et « Record de distance » dit déjà l'essentiel.
      const blockPRs = [];
      BLOCK_DISTANCES.filter((n) => n <= Math.floor(r.distance)).forEach((n) => {
        const t = runTimeOver(r, n);
        if (t == null) return;
        if (blockBests[n] != null && t < blockBests[n]) blockPRs.push(n);
        if (blockBests[n] == null || t < blockBests[n]) blockBests[n] = t;
      });
      meta[name][r.date] = {
        prev: i > 0 ? sorted[i - 1] : null,
        prevSame: lastInBucket[bucketOf(r)] || null,
        isPacePR: i > 0 && r.paceSec < bestPace,
        isDistPR: i > 0 && r.distance > longest,
        isKmPR: km != null && Number.isFinite(bestKm) && km < bestKm,
        blockPRs,
        blockTimes: Object.fromEntries(
          BLOCK_DISTANCES.filter((n) => n <= Math.floor(r.distance))
            .map((n) => [n, runTimeOver(r, n)])
            .filter(([, t]) => t != null),
        ),
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

  // Le chrono accompagne le record de distance ronde : quand les 5 km tombent à
  // l'intérieur d'un 6 km, ce temps-là ne s'affiche nulle part ailleurs sur la
  // carte — le badge serait invérifiable sans lui.
  const blockBadges = (m.blockPRs || [])
    .map((n) => `<span class="pr">🏅 Record du ${n} km · ${fmtDuration(m.blockTimes[n])}</span>`)
    .join("");

  const prBadges =
    (m.isPacePR ? `<span class="pr">🏅 Record d'allure</span>` : "") +
    (m.isDistPR ? `<span class="pr">🏅 Record de distance</span>` : "") +
    (m.isKmPR ? `<span class="pr">🏅 Record du kilomètre</span>` : "") +
    blockBadges;

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
// Le palmarès se lit à deux échelles : le Général, sur tout l'historique, et
// une saison par mois, qui repart de zéro.
//
// Tout le monde n'arrive pas le même jour, et le dashboard doit accueillir de
// nouveaux coureurs sans qu'on retouche une date à chaque arrivée. Le Général
// démarrait autrefois à la première séance de Didi, pour qu'elle ne parte pas
// avec 16 séances de retard ; Pefi, arrivé en septembre, aurait réclamé la même
// chose, puis le suivant. La règle est donc passée dans les catégories : tout ce
// qui s'accumule avec le temps — kilomètres, calories, séances, records,
// progrès — se compte par semaine de présence (`weeksIn`), à partir de la
// première sortie de chacun. Arriver tard ne coûte plus rien, ni au Général ni
// dans le mois où l'on arrive.

// La dernière séance déposée, tous coureurs confondus, clôt la période en cours :
// le rythme se mesure sur ce que couvrent les données, pas sur l'horloge du
// lecteur — sinon le classement bougerait tout seul d'un jour à l'autre.
const LAST_DATE = RUNNERS.flatMap((n) => RUNS[n].map((r) => r.date)).sort().pop();
const FIRST_RUN = Object.fromEntries(RUNNERS.map((n) => [n, RUNS[n].map((r) => r.date).sort()[0]]));
const lastDayOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

// Semaines de présence d'un coureur sur une saison : de sa première sortie — ou
// du début de la saison, s'il courait déjà avant — à la fin de la saison. Une
// semaine au minimum : sans ce plancher, une première sortie de 5 km la veille
// de la clôture compterait pour 35 km par semaine.
function weeksIn(season, name) {
  const from = [season.start, FIRST_RUN[name]].filter(Boolean).sort().pop();
  const days = (Date.parse(season.end) - Date.parse(from)) / 864e5 + 1;
  return Math.max(days, 7) / 7;
}

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
      scope:
        "Tout l'historique. Arriver en cours de route n'y coûte rien : ce qui s'accumule avec le temps — kilomètres, calories, séances, records, progrès — se compte par semaine de présence, à partir de la première sortie de chacun.",
      start: null,
      end: LAST_DATE,
      match: () => true,
    },
    // Le libellé du mois n'est jamais réinjecté dans la phrase : « la saison de
    // août » demanderait une élision que `toLocaleDateString` ne fournit pas.
    ...months.map((ym) => ({
      id: ym,
      tab: label(ym, oneYear ? { month: "long" } : { month: "long", year: "2-digit" }),
      title: label(ym, { month: "long", year: "numeric" }),
      scope:
        "Une saison close sur elle-même : elle ne compte que ce mois, et la suivante repart de zéro. Comme au Général, ce qui s'accumule se compte par semaine de présence — arriver en cours de mois n'y coûte aucune étoile.",
      start: `${ym}-01`,
      end: [lastDayOf(ym), LAST_DATE].sort()[0],
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
  if (!seasonRuns(season, name).length) return "pas de séance sur cette saison";
  return cat.absent ? cat.absent(name, season) : "pas de donnée dans cette catégorie";
}

// Deux façons de lire une course de distance, et depuis que la distance est
// exacte — le bloc de N kilomètres consécutifs, et non la séance qui va de 5,00
// à 5,99 km — elles désignent le même vainqueur : le chrono divisé par N, c'est
// l'allure. Le bouton ne change donc que l'unité de lecture, et les étoiles
// restent attachées à l'allure pour qu'un seul podium fasse foi.
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
const distanceCategories = (season) => {
  const seasonAll = RUNNERS.flatMap((n) => seasonRuns(season, n));
  const keys = new Set(
    bucketsIn(seasonAll)
      .filter((b) => b.key !== SUB_5)
      .map((b) => Number(b.key)),
  );
  // Un 5 km couru à l'intérieur d'un 6 km fait exister la catégorie, même si
  // personne n'a posé de séance étiquetée 5 km sur la saison.
  seasonAll.forEach((r) =>
    BLOCK_DISTANCES.forEach((n) => {
      if (bestBlock(r, n) != null) keys.add(n);
    }),
  );
  return [...keys]
    .sort((a, b) => a - b)
    .map((n) => {
      const label = `${n} km`;
      const best = (runs) => {
        const ts = runs.map((r) => runTimeOver(r, n)).filter((v) => v != null);
        return ts.length ? Math.min(...ts) : null;
      };
      return {
        id: `km-${n}`,
        // Le drapeau met les courses de distance au même rang visuel que les
        // autres compétitions : dans un menu unique, un onglet sans emoji se lit
        // comme une rubrique plutôt que comme un choix.
        tab: `🏁 ${label}`,
        title: `Le plus rapide sur ${label}`,
        desc: `Le meilleur ${label} de la période, qu'il ait été couru seul ou pris à l'intérieur d'une sortie plus longue : le détail par kilomètre permet d'y retrouver les ${n} kilomètres consécutifs les plus rapides. Tout le monde concourt ainsi sur exactement la même distance, et un ${label} ne se perd pas parce que la séance qui le contient porte une autre étiquette. Les séances sans détail par kilomètre entrent avec leur allure moyenne ramenée à ${label}.`,
        lower: true,
        score: (runs) => {
          const t = best(runs);
          return t == null ? null : t / n;
        },
        fmt: (v) => `${fmtPace(v)}/km`,
        absent: () => `aucun ${label} couru sur cette saison`,
        // La vue chrono ne remplace que ce qui change : le score, son format et
        // la façon de le présenter. Tout le reste — onglet, motif d'absence —
        // reste celui de la catégorie.
        views: {
          time: {
            title: `Le meilleur chrono sur ${label}`,
            desc: `Le même ${label} que la vue allure, lu au chronomètre plutôt qu'au kilomètre. Les deux désignent forcément le même vainqueur : la distance étant exacte, l'allure n'est rien d'autre que ce chrono divisé par ${n}.`,
            score: (runs) => best(runs),
            fmt: (v) => fmtDuration(v),
          },
        },
      };
    });
};

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
    desc: "Les kilomètres courus par semaine de présence sur la période, comptée depuis sa première sortie. La catégorie la plus bête du plateau : il n'y a qu'à sortir, encore et encore.",
    score: (runs, name, season) => (runs.length ? sum(runs.map((r) => r.distance)) / weeksIn(season, name) : null),
    fmt: (v) => `${v.toFixed(1)} km/sem.`,
  },
  {
    id: "metronome",
    tab: "🎯 Métronome",
    title: "Le Métronome",
    desc: "L'allure la plus constante d'une séance à l'autre (le plus petit écart-type), à partir de trois séances : deux sorties tombées par hasard à la même allure ne font pas un métronome. Elle récompense la régularité, et elle sourit assez peu à qui progresse vite : progresser, c'est justement ne pas courir deux fois à la même allure.",
    lower: true,
    score: (runs) => (runs.length > 2 ? stdev(runs.map((r) => r.paceSec)) : null),
    fmt: (v) => `± ${Math.round(v)} s/km`,
    absent: () => "moins de trois séances sur la période, pas encore de régularité à mesurer",
  },
  {
    id: "progress",
    tab: "🚀 Fusée",
    title: "La Fusée",
    desc: "Les secondes au kilomètre grattées entre la première et la dernière séance de la période, ramenées à la semaine de présence. Une fusée se juge à sa poussée, pas à l'altitude qu'elle a mis des mois à atteindre.",
    score: (runs, name, season) => {
      const s = chrono(runs);
      return s.length > 1 ? (s[0].paceSec - s[s.length - 1].paceSec) / weeksIn(season, name) : null;
    },
    fmt: (v) => `${v >= 0 ? "−" : "+"}${Math.abs(v).toFixed(1)} s/km/sem.`,
    absent: () => "une seule séance sur la période, rien à comparer",
  },
  {
    id: "freq",
    tab: "📅 Machine",
    title: "La Machine",
    desc: "Le rythme : nombre de séances par semaine de présence sur la période. Le décompte part de sa propre première sortie et court jusqu'à la fin de la période : trois sorties d'affilée puis plus rien ne font pas une machine.",
    score: (runs, name, season) => (runs.length ? runs.length / weeksIn(season, name) : null),
    fmt: (v) => `${v.toFixed(1)} séances/sem.`,
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
    desc: "Les séances qui ont battu le meilleur chrono de la période, par semaine de présence. Attention au piège : plus le record est haut, plus le suivant est difficile à décrocher.",
    score: (runs, name, season) => {
      const s = chrono(runs);
      if (!s.length) return null;
      let best = Infinity;
      let n = 0;
      s.forEach((r, i) => {
        if (i > 0 && r.paceSec < best) n += 1;
        best = Math.min(best, r.paceSec);
      });
      return n / weeksIn(season, name);
    },
    fmt: (v) => `${v.toFixed(1)} record${v >= 2 ? "s" : ""}/sem.`,
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
    desc: "Les calories actives brûlées par semaine de présence sur la période. Ça dépend au moins autant du gabarit que de l'effort, mais personne n'a jamais refusé un trophée pour ce motif.",
    score: (runs, name, season) => (runs.length ? sum(runs.map((r) => r.activeCal)) / weeksIn(season, name) : null),
    fmt: (v) => `${Math.round(v).toLocaleString("fr-FR")} cal/sem.`,
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
      <div class="podium-avatar">${place === 1 ? `<span class="podium-crown">👑</span>` : ""}${miiBadge(entry.name, "podium-face")}${entry.name === fighter ? `<span class="podium-you" title="C'est toi">1P</span>` : ""}</div>
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
  // Un onglet par distance ronde atteinte : le podium des 5 km d'une personne
  // classe aussi bien ses séances de 5 km que les 5 km qu'elle a laissés dans
  // une sortie plus longue. `personalCategories` écarte ensuite ceux qu'elle n'a
  // pas de quoi remplir.
  ...BLOCK_DISTANCES.map((n) => ({
    id: `block-${n}`,
    tab: `🏅 ${n} km`,
    title: `Les meilleurs ${n} km`,
    desc: `Le temps mis pour couvrir ${n} kilomètres d'affilée, où qu'ils tombent dans la séance. Une sortie plus longue concourt avec ses ${n} meilleurs kilomètres consécutifs ; une séance sans détail par kilomètre entre avec son allure moyenne ramenée à ${n} km, si elle fait la bonne distance.`,
    lower: true,
    value: (r) => runTimeOver(r, n),
    fmt: (v) => fmtDuration(v),
  })),
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
      <div class="podium-avatar">${place === 1 ? `<span class="podium-crown">👑</span>` : ""}${miiBadge(name, "podium-face")}</div>
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
  // Réglage depuis l'extérieur : c'est l'écran de sélection qui coche le
  // coureur choisi, exactement comme l'aurait fait un clic.
  return (values) => {
    selected = keys.filter((k) => values.includes(k));
    paint();
    onChange(selected);
  };
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

let setRunnerFilter = () => {};

function renderFilters() {
  setRunnerFilter = buildMultiSwitch("runnerFilter", "Tous", RUNNERS.map((n) => [n, n]), (sel) => {
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

// ---------- Sélection du personnage ----------
// L'écran d'accueil façon Smash Bros : « Qui êtes-vous ? ». Le choix règle le
// filtre coureur, donc tout ce qui est personnel — carte, courbes, leaderboard
// personnel, trophées, et la dernière analyse dépliée dans le tableau. Il
// s'affiche à chaque arrivée sur l'adresse nue ; `#Pefi` le saute, ce qui fait
// de l'adresse après un choix un lien personnel à mettre en favori ou à envoyer.
const FIGHTER_KEY = "runs.fighter";
const EVERYONE = "tous";
const norm = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const selectScreen = document.getElementById("selectScreen");
const selectGrid = document.getElementById("selectGrid");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Le stockage peut être refusé (navigation privée, données bloquées) : le
// souvenir du dernier choix est un confort, jamais une condition.
const remember = (v) => {
  try {
    localStorage.setItem(FIGHTER_KEY, v);
  } catch {
    /* rien à faire */
  }
};
const recall = () => {
  try {
    return localStorage.getItem(FIGHTER_KEY);
  } catch {
    return null;
  }
};

// `#Pefi`, `#anais`, `#tous` → le coureur, null pour tout le monde, undefined
// si l'adresse ne désigne personne (l'écran de sélection s'affiche alors).
function fighterFromHash() {
  const h = norm(decodeURIComponent(location.hash.slice(1)));
  if (!h) return undefined;
  if (h === EVERYONE) return null;
  return RUNNERS.find((n) => norm(n) === h);
}

// Un nouveau venu porte le bandeau pendant deux semaines après sa première sortie.
const isNewChallenger = (name) =>
  FIRST_RUN[name] && (Date.parse(LAST_DATE) - Date.parse(FIRST_RUN[name])) / 864e5 < 14;

// Le blason du personnage : le Pokémon de sa dernière séance, comme l'emblème
// de série dans le coin d'une case de Smash.
function emblemOf(name) {
  const last = RUNS[name].map((r) => r.date).sort().pop();
  const a = last && ANALYSES[name] && ANALYSES[name][last];
  const p = a && POKEDEX[a.pokemon];
  return p ? `<img class="fighter-emblem" src="assets/pokemon/${p.id}.png" alt="" title="${a.pokemon} ${a.pokemonAdj}" />` : "";
}

function fighterTile(name) {
  const color = RUNNER_COLORS[name] || "#8e8e93";
  const n = RUNS[name].length;
  const meta = n ? `${n} séance${n > 1 ? "s" : ""}` : "Pas encore couru";
  return `
    <button type="button" class="fighter" data-fighter="${name}" style="--c:${color};--c-light:${shade(color, 0.5)}">
      <span class="fighter-art">${miiSvg(name)}</span>
      ${emblemOf(name)}
      ${isNewChallenger(name) ? `<span class="fighter-new">Nouveau challenger !</span>` : ""}
      <span class="fighter-plate"><span class="fighter-name${name.length > 8 ? " long" : ""}">${name}</span><span class="fighter-meta">${meta}</span></span>
      <span class="fighter-token" aria-hidden="true">1P</span>
    </button>`;
}

function renderSelect() {
  selectGrid.innerHTML =
    RUNNERS.map(fighterTile).join("") +
    `<button type="button" class="fighter fighter-all" data-fighter="${EVERYONE}" style="--c:#8e8e93;--c-light:#d1d1d6">
      <span class="fighter-art fighter-random" aria-hidden="true">?</span>
      <span class="fighter-plate"><span class="fighter-name long">Spectateur</span><span class="fighter-meta">Voir tout le monde</span></span>
      <span class="fighter-token" aria-hidden="true">1P</span>
    </button>`;
}

// Le bouton du hero rappelle qui l'on est, et rouvre l'écran.
function renderFighterBadge() {
  document.getElementById("switchFighter").innerHTML = `
    ${fighter ? miiBadge(fighter, "switch-mii") : `<span class="switch-mii switch-all" aria-hidden="true">?</span>`}
    <span class="switch-name">${fighter || "Spectateur"}</span>
    <span class="switch-hint">Changer</span>`;
  document.getElementById("editMii").textContent = fighter ? "✏️ Modifier mon Mii" : "✏️ Atelier Mii";
}

// Le sous-titre se déduit des données : un coureur de plus, et son nom apparaît.
function renderSubtitle() {
  const names = RUNNERS.map((n) => `<b style="color:${RUNNER_COLORS[n]}">${n}</b>`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} &amp; ${names[names.length - 1]}` : names.join("");
  document.getElementById("subtitle").innerHTML = `Suivi des sessions de course — ${list}`;
}

const pageParts = () => document.querySelectorAll("body > header, body > main, body > footer");

function openSelect() {
  renderSelect();
  const last = fighter !== null ? fighter : recall();
  const cursor =
    selectGrid.querySelector(`[data-fighter="${CSS.escape(last || "")}"]`) || selectGrid.querySelector(".fighter");
  cursor.classList.add("cursor");
  selectScreen.classList.remove("ready", "closing");
  selectScreen.classList.add("open");
  document.documentElement.classList.add("selecting");
  // Le reste de la page sort du parcours clavier tant que l'écran est ouvert.
  pageParts().forEach((el) => (el.inert = true));
  cursor.focus({ preventScroll: true });
}

function closeSelect() {
  selectScreen.classList.remove("open", "ready", "closing");
  document.documentElement.classList.remove("selecting", "skip-select");
  pageParts().forEach((el) => (el.inert = false));
}

// Applique un choix : null = tout le monde.
function applyFighter(name) {
  fighter = name;
  setRunnerFilter(name ? [name] : []);
  renderLeaderboard();
  renderFighterBadge();
}

function choose(value) {
  const name = value === EVERYONE ? null : value;
  remember(value);
  history.replaceState(null, "", `#${encodeURIComponent(name || EVERYONE)}`);
  applyFighter(name);
  window.scrollTo(0, 0);
  if (reduceMotion.matches) {
    closeSelect();
    document.getElementById("switchFighter").focus({ preventScroll: true });
    return;
  }
  // « À vos marques… Partez ! » : le temps de lire le bandeau, puis fondu.
  selectScreen.classList.add("ready");
  setTimeout(() => selectScreen.classList.add("closing"), 750);
  setTimeout(() => {
    closeSelect();
    document.getElementById("switchFighter").focus({ preventScroll: true });
  }, 1100);
}

selectGrid.addEventListener("click", (e) => {
  const tile = e.target.closest(".fighter");
  if (tile && !selectScreen.classList.contains("ready")) choose(tile.dataset.fighter);
});

// Flèches pour déplacer le curseur, Échap pour garder la vue en cours.
selectScreen.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !selectScreen.classList.contains("ready")) {
    closeSelect();
    return;
  }
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const tiles = [...selectGrid.querySelectorAll(".fighter")];
  const i = tiles.indexOf(document.activeElement);
  tiles[(i + step + tiles.length) % tiles.length].focus();
});
selectGrid.addEventListener("focusin", (e) => {
  selectGrid.querySelectorAll(".cursor").forEach((t) => t.classList.remove("cursor"));
  e.target.closest(".fighter")?.classList.add("cursor");
});

document.getElementById("switchFighter").addEventListener("click", openSelect);

function initSelect() {
  renderSubtitle();
  const recu = miiDepuisLien(location.hash);
  if (recu) {
    // Un Mii reçu par lien : on garde la vue habituelle de ce lecteur et on
    // ouvre l'Atelier dessus, sans repasser par l'écran de sélection.
    const moi = RUNNERS.includes(recall()) ? recall() : null;
    applyFighter(moi);
    closeSelect();
    openAtelier(recu.name, { mii: recu.mii, recu: true });
    return;
  }
  const fromHash = fighterFromHash();
  if (fromHash === undefined) {
    renderFighterBadge();
    openSelect();
  } else {
    applyFighter(fromHash);
    closeSelect();
  }
}

// ---------- Atelier Mii ----------
// Le Mii Maker du dashboard. Le site est statique : rien de ce qu'on y choisit
// ne peut s'écrire tout seul dans data.js. Le choix vit donc en deux temps —
// enregistré sur l'appareil, où il s'affiche aussitôt, puis partagé sous forme
// de lien #mii?… que Vincent fait reporter dans data.js (skill /mii), et qui
// l'installe alors chez tout le monde.
const miiEditor = document.getElementById("miiEditor");
let atelier = null; // { name, mii (brouillon), onglet, recu }

// Les onglets : `choix` pour une option dessinée (la vignette montre ton Mii
// avec l'option), `nuancier` pour une couleur, `details` pour les bascules.
const MII_ONGLETS = [
  { id: "coiffure", label: "💇 Coupe", choix: MII_COIFFURES },
  { id: "cheveux", label: "🎨 Cheveux", nuancier: "cheveux" },
  { id: "yeux", label: "👁️ Yeux", nuancier: "yeux" },
  { id: "peau", label: "🙂 Teint", nuancier: "peau" },
  { id: "lunettes", label: "👓 Lunettes", choix: MII_LUNETTES, sans: "Sans" },
  { id: "barbe", label: "🧔 Barbe", choix: MII_BARBES, sans: "Rasé de près" },
  { id: "details", label: "✨ Détails" },
];
const MII_DETAILS = [
  ["cils", "Cils"],
  ["bandeau", "Bandeau"],
];

const copieMii = (m) => JSON.parse(JSON.stringify(m || MII_DEFAUT));
const memeMii = (a, b) => miiLien("x", a) === miiLien("x", b);

// Le lien de partage : lisible, et relu tel quel par .claude/tools/mii.js.
function miiLien(name, m) {
  const q = new URLSearchParams({ nom: name, coiffure: m.coiffure, cheveux: m.cheveux.slice(1), yeux: m.yeux.slice(1) });
  // Le teint par défaut n'a pas besoin d'être écrit : un lien plus court, et un
  // Mii « revenu au défaut » reconnu comme identique à celui de data.js.
  if (m.peau && m.peau.toLowerCase() !== MII_PEAU) q.set("peau", m.peau.slice(1));
  if (m.lunettes) q.set("lunettes", m.lunettes === true ? "carrees" : m.lunettes);
  if (m.barbe) q.set("barbe", m.barbe);
  if (m.cils) q.set("cils", "1");
  if (m.bandeau) q.set("bandeau", "1");
  return `${location.origin}${location.pathname}#mii?${q}`;
}

// L'inverse : un lien reçu, filtré sur ce que l'Atelier sait dessiner.
function miiDepuisLien(hash) {
  const i = hash.indexOf("mii?");
  if (i < 0) return null;
  const q = new URLSearchParams(hash.slice(i + 4));
  const name = RUNNERS.find((n) => norm(n) === norm(q.get("nom") || ""));
  const hex = (k) => (/^[0-9a-f]{6}$/i.test(q.get(k) || "") ? `#${q.get(k).toLowerCase()}` : null);
  if (!name || !hex("cheveux") || !hex("yeux")) return null;
  const m = { cheveux: hex("cheveux"), coiffure: MII_COIFFURES[q.get("coiffure")] ? q.get("coiffure") : "court", yeux: hex("yeux") };
  if (hex("peau")) m.peau = hex("peau");
  if (q.get("cils") === "1") m.cils = true;
  if (MII_LUNETTES[q.get("lunettes")]) m.lunettes = q.get("lunettes");
  if (MII_BARBES[q.get("barbe")]) m.barbe = q.get("barbe");
  if (q.get("bandeau") === "1") m.bandeau = true;
  return { name, mii: m };
}

// « le Mii de Pefi », « le Mii d'Anaïs ».
const deNom = (name) => (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(name) ? `d'${name}` : `de ${name}`);

const vignette = (m, name) =>
  `<span class="mii-vignette" style="--mii-bg:${shade(RUNNER_COLORS[name] || "#8e8e93", 0.6)}">${miiDessin(m, RUNNER_COLORS[name] || "#8e8e93", { tete: true })}</span>`;

function renderAtelier() {
  const { name, mii, onglet } = atelier;
  const color = RUNNER_COLORS[name] || "#8e8e93";
  miiEditor.style.setProperty("--c", color);

  document.getElementById("miiWho").innerHTML = RUNNERS.map(
    (n) => `<button type="button" class="mii-who-btn" data-who="${n}" aria-pressed="${n === name}">${miiBadge(n, "mii-who-face")}${n}</button>`,
  ).join("");

  document.getElementById("miiPreview").innerHTML =
    `<div class="mii-bubble" style="--mii-bg:${shade(color, 0.55)}">${miiDessin(mii, color)}</div><p class="mii-preview-name">${name}</p>`;

  document.getElementById("miiTabs").innerHTML = MII_ONGLETS.map(
    (o) => `<button type="button" role="tab" data-onglet="${o.id}" aria-selected="${o.id === onglet}">${o.label}</button>`,
  ).join("");

  const o = MII_ONGLETS.find((x) => x.id === onglet);
  let html;
  if (o.choix) {
    const opts = [...(o.sans ? [["", { label: o.sans }]] : []), ...Object.entries(o.choix)];
    html = opts
      .map(([k, v]) => {
        const essai = { ...mii, [o.id]: k || undefined };
        const on = (mii[o.id] === true ? "carrees" : mii[o.id] || "") === k;
        return `<button type="button" class="mii-opt" data-set="${o.id}" data-value="${k}" aria-pressed="${on}">${vignette(essai, name)}<span>${v.label}</span></button>`;
      })
      .join("");
  } else if (o.nuancier) {
    const actuelle = o.id === "peau" ? mii.peau || MII_PEAU : mii[o.id];
    html =
      MII_NUANCIERS[o.nuancier]
        .map(
          ([hex, label]) =>
            `<button type="button" class="mii-swatch" data-set="${o.id}" data-value="${hex}" aria-pressed="${hex === actuelle}" title="${label}" aria-label="${label}" style="--sw:${hex}"></button>`,
        )
        .join("") +
      `<label class="mii-swatch mii-autre" title="Autre couleur"><input type="color" data-set="${o.id}" value="${actuelle}" aria-label="Autre couleur" /><span>Autre</span></label>`;
  } else {
    html = MII_DETAILS.map(
      ([k, label]) =>
        `<button type="button" class="mii-opt" data-set="${k}" data-value="${mii[k] ? "" : "1"}" aria-pressed="${!!mii[k]}">${vignette({ ...mii, [k]: true }, name)}<span>${label}</span></button>`,
    ).join("");
  }
  document.getElementById("miiOptions").innerHTML = html;
  document.getElementById("miiOptions").className = `mii-options ${o.nuancier ? "is-swatches" : ""}`;
}

function noteAtelier(html, ton = "") {
  const el = document.getElementById("miiNote");
  el.className = `mii-note ${ton}`;
  el.innerHTML = html;
}

const NOTE_DEFAUT =
  "Enregistrer l'affiche sur cet appareil. Pour que tout le monde le voie, partage le lien avec Vincent : c'est lui qui l'ajoute au dashboard.";

function openAtelier(name, { mii, recu = false } = {}) {
  atelier = { name, mii: copieMii(mii || RUNNER_MII[name]), onglet: "coiffure", recu };
  renderAtelier();
  noteAtelier(
    recu
      ? `Mii reçu pour <b>${name}</b> — c'est un aperçu. Enregistre-le pour le voir sur cet appareil ; il n'arrive chez tout le monde qu'une fois ajouté au dashboard.`
      : NOTE_DEFAUT,
  );
  miiEditor.hidden = false;
  document.documentElement.classList.add("selecting");
  pageParts().forEach((el) => (el.inert = true));
  miiEditor.querySelector('[aria-selected="true"]').focus({ preventScroll: true });
}

function closeAtelier() {
  miiEditor.hidden = true;
  atelier = null;
  document.documentElement.classList.remove("selecting");
  pageParts().forEach((el) => (el.inert = false));
  if (location.hash.includes("mii?")) history.replaceState(null, "", `#${encodeURIComponent(fighter || EVERYONE)}`);
  document.getElementById("editMii").focus({ preventScroll: true });
}

// Tout ce qui dessine un Mii, redessiné d'un coup après un enregistrement.
function redessinerMii() {
  renderAll();
  renderLeaderboard();
  renderFighterBadge();
}

function enregistrerMii() {
  const { name, mii } = atelier;
  const locaux = miiLocaux();
  // Revenu à la version publiée : on efface la retouche plutôt que de la garder.
  if (MII_DATA[name] && memeMii(mii, MII_DATA[name])) delete locaux[name];
  else locaux[name] = mii;
  try {
    localStorage.setItem(MII_KEY, JSON.stringify(locaux));
  } catch {
    noteAtelier("Impossible d'enregistrer sur cet appareil (stockage bloqué). Le lien de partage, lui, fonctionne.", "warn");
    return;
  }
  RUNNER_MII[name] = copieMii(mii);
  redessinerMii();
  renderAtelier();
  noteAtelier(
    MII_DATA[name] && memeMii(mii, MII_DATA[name])
      ? "✓ Retour au Mii du dashboard."
      : "✓ Enregistré sur cet appareil. Dernière étape pour que tout le monde le voie : <b>Partager</b>, et envoie le lien à Vincent.",
    "ok",
  );
}

async function partagerMii() {
  const { name, mii } = atelier;
  const url = miiLien(name, mii);
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: `Mii ${deNom(name)}`, text: `Nouveau Mii pour ${name} sur le Running Dashboard`, url });
      noteAtelier("✓ Lien envoyé. Vincent n'a plus qu'à l'ajouter au dashboard.", "ok");
      return;
    }
    await navigator.clipboard.writeText(url);
    noteAtelier("✓ Lien copié ! Envoie-le à Vincent : il l'ajoutera au dashboard.", "ok");
  } catch (e) {
    if (e && e.name === "AbortError") return; // partage annulé
    noteAtelier(`Copie ce lien et envoie-le à Vincent :<input class="mii-link" readonly value="${url}" />`, "warn");
    document.querySelector(".mii-link").select();
  }
}

miiEditor.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t || !atelier) return;
  if (t.dataset.who) {
    openAtelier(t.dataset.who);
  } else if (t.dataset.onglet) {
    atelier.onglet = t.dataset.onglet;
    renderAtelier();
    miiEditor.querySelector(`[data-onglet="${t.dataset.onglet}"]`).focus();
  } else if (t.dataset.set) {
    const { set, value } = t.dataset;
    const bascule = MII_DETAILS.some(([k]) => k === set);
    atelier.mii[set] = bascule ? value === "1" : value;
    if (!atelier.mii[set]) delete atelier.mii[set];
    renderAtelier();
    miiEditor.querySelector(`[data-set="${set}"][data-value="${CSS.escape(bascule ? (value === "1" ? "" : "1") : value)}"]`)?.focus();
  } else if (t.dataset.action === "annuler") {
    closeAtelier();
  } else if (t.dataset.action === "reset") {
    atelier.mii = copieMii(MII_DATA[atelier.name]);
    renderAtelier();
    noteAtelier("Le Mii du dashboard est revenu dans l'Atelier. <b>Enregistrer</b> pour effacer la retouche de cet appareil.");
  } else if (t.dataset.action === "enregistrer") {
    enregistrerMii();
  } else if (t.dataset.action === "partager") {
    partagerMii();
  }
});
// Le sélecteur « Autre » : couleur libre, appliquée en direct.
miiEditor.addEventListener("input", (e) => {
  const t = e.target;
  if (!atelier || t.type !== "color") return;
  atelier.mii[t.dataset.set] = t.value;
  document.getElementById("miiPreview").innerHTML = `<div class="mii-bubble" style="--mii-bg:${shade(RUNNER_COLORS[atelier.name] || "#8e8e93", 0.55)}">${miiDessin(atelier.mii, RUNNER_COLORS[atelier.name] || "#8e8e93")}</div><p class="mii-preview-name">${atelier.name}</p>`;
});
miiEditor.addEventListener("change", (e) => {
  if (atelier && e.target.type === "color") renderAtelier();
});
miiEditor.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAtelier();
});
document.getElementById("editMii").addEventListener("click", () => openAtelier(fighter || RUNNERS[0]));

// ---------- Init ----------
Chart.defaults.color = "#98989d";
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

renderFilters();
initLeaderboard();
initPersonal();
initTrophies();
resetBlocks();
renderAll();
initSelect();
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
