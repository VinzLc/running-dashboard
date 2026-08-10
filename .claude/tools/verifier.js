#!/usr/bin/env node
// Vérifie la cohérence du dashboard avant commit : données, analyses, sprites,
// manifeste, cache-busting. Chaque contrôle ici correspond à une erreur qui a
// déjà été commise (ou qui coûterait cher à repérer à l'œil dans data.js).
//
//   node .claude/tools/verifier.js
//
// Sortie : ✗ erreurs (sortie 1, ne pas committer) et ⚠ avertissements (sortie 0,
// à regarder mais pas bloquants — un avertissement peut être un choix assumé).

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------- Chargement ----------
// data.js et pokemon.js sont des scripts de navigateur (des `const` globaux, pas
// de module.exports) : on les évalue dans un contexte jetable et on récupère les
// symboles à la sortie plutôt que de les parser à la main.
function loadGlobals(file, names) {
  const ctx = {};
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const capture = `\nglobalThis.__out = { ${names.map((n) => `${n}: typeof ${n} === "undefined" ? undefined : ${n}`).join(", ")} };`;
  try {
    vm.runInContext(src + capture, ctx);
  } catch (e) {
    console.error(`✗ ${file} n'est pas du JavaScript valide : ${e.message}`);
    process.exit(1);
  }
  return ctx.__out;
}

const { RUNS, RUNNER_COLORS, ANALYSES } = loadGlobals("data.js", ["RUNS", "RUNNER_COLORS", "ANALYSES"]);
const { POKEDEX, POKEMON_ADJECTIFS } = loadGlobals("pokemon.js", ["POKEDEX", "POKEMON_ADJECTIFS"]);

const fmtPace = (s) => `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, "0")}"`;
const strip = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

// ---------- Structure générale ----------
const runners = Object.keys(RUNS);
runners.forEach((name) => {
  if (!RUNNER_COLORS[name]) err(`${name} : pas de couleur dans RUNNER_COLORS`);
  if (!ANALYSES[name]) err(`${name} : pas de bloc dans ANALYSES`);
});
Object.keys(ANALYSES)
  .filter((n) => !RUNS[n])
  .forEach((n) => err(`ANALYSES.${n} : aucun coureur de ce nom dans RUNS`));

// ---------- Séances ----------
runners.forEach((name) => {
  const runs = RUNS[name];
  const seen = new Set();
  let previous = "";

  runs.forEach((r, i) => {
    const at = `${name} ${r.date || `#${i + 1}`}`;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) {
      err(`${at} : date absente ou mal formée (attendu YYYY-MM-DD)`);
      return;
    }
    if (seen.has(r.date)) err(`${at} : séance en double`);
    seen.add(r.date);
    if (previous && r.date < previous) err(`${at} : rompt l'ordre chronologique (après ${previous})`);
    previous = r.date;

    ["duration", "distance", "paceSec"].forEach((k) => {
      if (typeof r[k] !== "number" || !(r[k] > 0)) err(`${at} : ${k} absent ou non positif`);
    });

    // Un 0 se lit comme une mesure réelle et fausse les moyennes : une mesure
    // absente doit être une clé absente. (Le dénivelé, lui, peut valoir 0.)
    ["hr", "cadence", "maxSpeed"].forEach((k) => {
      if (r[k] === 0) err(`${at} : ${k}: 0 — supprime la clé plutôt que de mettre un zéro`);
    });

    if (r.duration > 0 && r.distance > 0 && r.paceSec > 0) {
      const attendu = r.duration / r.distance;
      const ecart = Math.abs(attendu - r.paceSec);
      if (ecart > 5) {
        err(`${at} : allure incohérente — ${fmtPace(r.paceSec)}/km saisi, ` +
            `${fmtPace(attendu)}/km calculé (${r.duration}s / ${r.distance}km), ${Math.round(ecart)} s d'écart`);
      }
    }

    if (r.splits) verifierSplits(at, r);
  });
});

function verifierSplits(at, r) {
  const s = r.splits;
  if (!Array.isArray(s) || !s.length) {
    err(`${at} : splits vide — retire la clé plutôt que de la laisser vide`);
    return;
  }

  s.forEach((sp, i) => {
    if (sp.km !== i + 1) err(`${at} : splits mal numérotés (attendu km ${i + 1}, trouvé ${sp.km})`);
    if (!(sp.sec > 0) || !(sp.paceSec > 0)) err(`${at} : km ${sp.km} — sec/paceSec absent ou non positif`);
    // Sur un kilomètre complet, le temps passé EST l'allure au km.
    if (!sp.partial && Math.abs(sp.sec - sp.paceSec) > 2) {
      err(`${at} : km ${sp.km} — kilomètre complet mais sec (${sp.sec}) ≠ paceSec (${sp.paceSec})`);
    }
    if (sp.partial && i !== s.length - 1) err(`${at} : km ${sp.km} marqué partial sans être le dernier`);
  });

  const total = s.reduce((a, sp) => a + sp.sec, 0);
  if (Math.abs(total - r.duration) > 20) {
    err(`${at} : somme des splits ${total}s vs durée ${r.duration}s — ${Math.abs(total - r.duration)}s d'écart`);
  }

  // Un 5,32 km donne 5 kilomètres pleins + un tronçon ; l'oubli du dernier
  // tronçon est l'erreur de saisie la plus fréquente sur l'écran Splits.
  const pleins = s.filter((sp) => !sp.partial).length;
  if (pleins !== Math.floor(r.distance)) {
    warn(`${at} : ${pleins} kilomètre(s) complet(s) pour ${r.distance} km — un tronçon manque ou est mal marqué`);
  }
}

// ---------- Analyses ----------
const TRENDS = ["up", "flat", "down", "start"];
const mots = (s) => s.toLowerCase().replace(/[^a-zà-ÿ0-9 ]/g, " ").split(/\s+/).filter(Boolean);

runners.forEach((name) => {
  const bloc = ANALYSES[name] || {};
  const dates = RUNS[name].map((r) => r.date);
  const pokemons = new Map();
  const adjectifs = new Map();

  Object.keys(bloc)
    .filter((d) => !dates.includes(d))
    .forEach((d) => err(`ANALYSES.${name}["${d}"] : aucune séance à cette date`));

  RUNS[name].forEach((r, i) => {
    const at = `${name} ${r.date}`;
    const a = bloc[r.date];
    if (!a) {
      err(`${at} : séance sans analyse — l'analyse est obligatoire`);
      return;
    }

    if (!TRENDS.includes(a.trend)) err(`${at} : trend « ${a.trend} » inconnu (${TRENDS.join(", ")})`);
    if (a.trend === "start" && i !== 0) err(`${at} : trend "start" alors que ce n'est pas la première séance`);
    if (i === 0 && a.trend !== "start") warn(`${at} : première séance, trend "start" attendu`);
    if (!a.verdict || !String(a.verdict).trim()) err(`${at} : verdict vide`);

    // `text` : tableau de paragraphes. Une chaîne unique s'affiche encore, mais
    // c'est le pavé illisible qu'on cherche justement à éviter.
    if (!Array.isArray(a.text)) {
      err(`${at} : text doit être un tableau de paragraphes, pas une chaîne`);
    } else if (!a.text.length || a.text.some((p) => typeof p !== "string" || !p.trim())) {
      err(`${at} : text contient un paragraphe vide`);
    } else {
      a.text.forEach((p, k) => {
        if (p.length > 700) warn(`${at} : paragraphe ${k + 1} de ${p.length} caractères — coupe-le en deux`);
      });
    }

    verifierPokemon(at, a, pokemons, adjectifs);
  });
});

function verifierPokemon(at, a, pokemons, adjectifs) {
  if (!a.pokemon) {
    err(`${at} : pas de Pokémon attribué`);
    return;
  }
  const p = POKEDEX[a.pokemon];
  if (!p) {
    err(`${at} : « ${a.pokemon} » ne figure pas dans pokemon.js (nom français exact attendu)`);
    return;
  }
  if (!fs.existsSync(path.join(ROOT, "assets", "pokemon", `${p.id}.png`))) {
    err(`${at} : sprite manquant — assets/pokemon/${p.id}.png`);
  }
  if (pokemons.has(a.pokemon)) {
    err(`${at} : ${a.pokemon} déjà attribué le ${pokemons.get(a.pokemon)} — un Pokémon ne sert qu'une fois par coureur`);
  }
  pokemons.set(a.pokemon, at.split(" ").pop());

  if (!a.pokemonAdj) {
    err(`${at} : pas d'adjectif (pokemonAdj)`);
  } else {
    if (!/^[A-ZÀ-Þ]/.test(a.pokemonAdj)) err(`${at} : l'adjectif « ${a.pokemonAdj} » doit commencer par une majuscule`);
    if (adjectifs.has(a.pokemonAdj)) {
      err(`${at} : adjectif « ${a.pokemonAdj} » déjà utilisé le ${adjectifs.get(a.pokemonAdj)} chez ce coureur`);
    }
    adjectifs.set(a.pokemonAdj, at.split(" ").pop());
    if (POKEMON_ADJECTIFS && !POKEMON_ADJECTIFS.includes(a.pokemonAdj)) {
      warn(`${at} : « ${a.pokemonAdj} » hors palette — pense à l'ajouter à POKEMON_ADJECTIFS`);
    }
  }

  const phrase = a.pokemonPhrase || "";
  if (!phrase.trim()) {
    err(`${at} : pokemonPhrase vide`);
    return;
  }
  // L'adjectif doit être justifié dans la vanne, sinon c'est un mot posé là.
  const iAdj = a.pokemonAdj ? phrase.lastIndexOf(a.pokemonAdj) : -1;
  if (a.pokemonAdj && iAdj === -1) {
    err(`${at} : la phrase ne justifie pas l'adjectif « ${a.pokemonAdj} »`);
  } else if (iAdj > 0) {
    // Redite : la justification qui recopie mot pour mot la phrase d'origine
    // fait retomber la blague. On cherche le plus long fragment commun.
    const base = mots(phrase.slice(0, iAdj)).join(" ");
    const just = mots(phrase.slice(iAdj));
    let pire = "";
    for (let x = 0; x < just.length; x++) {
      for (let y = x + 5; y <= just.length; y++) {
        const g = just.slice(x, y).join(" ");
        if (base.includes(g) && g.length > pire.length) pire = g;
      }
    }
    if (pire) warn(`${at} : la justification répète la phrase — « ${pire} »`);
  }
}

// ---------- Cache-busting ----------
// L'oubli le plus coûteux : les données sont justes, le navigateur sert
// l'ancienne version, et on cherche le bug dans le code.
const ASSETS = ["styles.css", "data.js", "pokemon.js", "app.js"];
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const versions = {};
ASSETS.forEach((f) => {
  const m = html.match(new RegExp(`${f.replace(".", "\\.")}\\?v=(\\d+)`));
  if (!m) err(`index.html : ${f} n'a pas de ?v=N`);
  else versions[f] = Number(m[1]);
});
const distinctes = [...new Set(Object.values(versions))];
if (distinctes.length > 1) {
  err(`index.html : versions désynchronisées — ${Object.entries(versions).map(([f, v]) => `${f}=${v}`).join(", ")}`);
}

const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
try {
  const modifies = git(["diff", "--name-only", "HEAD"]).split("\n").filter(Boolean);
  const touches = ASSETS.filter((f) => modifies.includes(f));
  if (touches.length) {
    const avant = git(["show", "HEAD:index.html"]).match(/data\.js\?v=(\d+)/);
    if (avant && distinctes.length === 1 && distinctes[0] <= Number(avant[1])) {
      err(`cache-busting non bumpé : ${touches.join(", ")} modifié(s) mais ?v= toujours à ${avant[1]}`);
    }
  }
} catch {
  // Pas de dépôt git, ou pas encore de commit : rien à comparer.
}

// ---------- Manifeste des captures ----------
const MANIFESTE = path.join(ROOT, ".claude", "captures-integrees.txt");
if (!fs.existsSync(MANIFESTE)) {
  err(".claude/captures-integrees.txt introuvable — la détection des nouvelles séances est hors service");
} else {
  // Le manifeste préfixe en ASCII (« Anais/ ») ce que le disque nomme « Anaïs/ » :
  // on résout le dossier réel en comparant sans les accents.
  const dossiers = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .reduce((acc, d) => ({ ...acc, [strip(d.name)]: d.name }), {});

  const lignes = fs.readFileSync(MANIFESTE, "utf8").split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const listees = new Set();
  lignes.forEach((ligne) => {
    const [cle, fichier] = ligne.split("/");
    const dossier = dossiers[strip(cle || "")];
    if (!dossier) {
      err(`manifeste : « ${ligne} » — aucun dossier ne correspond à « ${cle} »`);
      return;
    }
    const reel = path.join(ROOT, dossier, fichier || "");
    if (!fs.existsSync(reel)) err(`manifeste : « ${ligne} » — fichier introuvable`);
    else listees.add(path.join(dossier, fichier));
  });

  runners.forEach((name) => {
    const dossier = dossiers[strip(name)];
    if (!dossier) return;
    const captures = fs.readdirSync(path.join(ROOT, dossier))
      .filter((f) => /\.(jpe?g|png|heic)$/i.test(f))
      .filter((f) => !listees.has(path.join(dossier, f)));
    if (captures.length) {
      warn(`${dossier} : ${captures.length} capture(s) hors manifeste — non traitée(s) ? (${captures.slice(0, 3).join(", ")}${captures.length > 3 ? "…" : ""})`);
    }
  });
}

// ---------- Rapport ----------
const seances = runners.reduce((n, r) => n + RUNS[r].length, 0);
console.log(`${runners.length} coureurs, ${seances} séances, ${Object.values(ANALYSES).reduce((n, b) => n + Object.keys(b).length, 0)} analyses`);
warnings.forEach((w) => console.log(`⚠  ${w}`));
errors.forEach((e) => console.log(`✗  ${e}`));

if (errors.length) {
  console.log(`\n${errors.length} erreur(s) — ne pas committer en l'état.`);
  process.exit(1);
}
console.log(warnings.length ? `\nAucune erreur, ${warnings.length} avertissement(s).` : "\nTout est cohérent.");
