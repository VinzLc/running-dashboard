#!/usr/bin/env node
// Le Pokédex d'un coureur : ce qui est déjà pris, ce qui reste libre, et la zone
// de vitesse où piocher pour la séance du jour. Grepper `pokemon:` à la main dans
// data.js marchait à cinq séances ; à vingt-deux, on rate un doublon.
//
//   node .claude/tools/pokedex.js              → vue d'ensemble
//   node .claude/tools/pokedex.js Vincent      → Pokédex complet + zone du jour
//   node .claude/tools/pokedex.js Anaïs 449    → même chose pour une allure donnée
//                                                (secondes/km, séance pas encore saisie)
//
// La zone n'est qu'un repère : un bon gag justifie n'importe quel écart.
// C'est la règle de la skill add-run, pas un classement à respecter.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");

function loadGlobals(file, names) {
  const ctx = {};
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  vm.runInContext(src + `\nglobalThis.__out = { ${names.join(", ")} };`, ctx);
  return ctx.__out;
}

const { RUNS, ANALYSES } = loadGlobals("data.js", ["RUNS", "ANALYSES"]);
const { POKEMON, POKEDEX, POKEMON_ADJECTIFS } = loadGlobals("pokemon.js", ["POKEMON", "POKEDEX", "POKEMON_ADJECTIFS"]);

const fmtPace = (s) => `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, "0")}"`;
const strip = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const [arg, allureArg] = process.argv.slice(2);

// ---------- Vue d'ensemble ----------
if (!arg) {
  console.log("Pokédex par coureur — `pokedex.js <Coureur>` pour le détail\n");
  Object.keys(RUNS).forEach((name) => {
    const bloc = ANALYSES[name] || {};
    const pris = Object.values(bloc).filter((a) => a.pokemon).length;
    const adjs = new Set(Object.values(bloc).map((a) => a.pokemonAdj).filter(Boolean));
    console.log(
      `  ${name.padEnd(10)} ${String(RUNS[name].length).padStart(2)} séance(s) · ` +
      `${String(pris).padStart(3)} Pokémon pris sur 151 · ${adjs.size} adjectif(s) sur ${POKEMON_ADJECTIFS.length}`,
    );
  });
  process.exit(0);
}

// ---------- Un coureur ----------
const name = Object.keys(RUNS).find((n) => strip(n) === strip(arg));
if (!name) {
  console.error(`Coureur inconnu : « ${arg} ». Connus : ${Object.keys(RUNS).join(", ")}`);
  process.exit(1);
}

const runs = RUNS[name];
const bloc = ANALYSES[name] || {};
const attribues = Object.entries(bloc)
  .filter(([, a]) => a.pokemon)
  .sort(([a], [b]) => a.localeCompare(b));

console.log(`\n=== ${name} — ${runs.length} séance(s) ===\n`);

if (attribues.length) {
  console.log("Déjà attribués (interdits pour ce coureur) :");
  attribues.forEach(([date, a]) => {
    const p = POKEDEX[a.pokemon];
    const rang = p ? `rang ${p.rang}` : "inconnu de pokemon.js";
    console.log(`  ${date}  ${`${a.pokemon} ${a.pokemonAdj || ""}`.trim().padEnd(28)} ${rang}`);
  });
} else {
  console.log("Aucun Pokémon attribué : tout est libre.");
}

const adjsPris = new Set(attribues.map(([, a]) => a.pokemonAdj).filter(Boolean));
const adjsLibres = POKEMON_ADJECTIFS.filter((x) => !adjsPris.has(x));
console.log(`\nAdjectifs libres (${adjsLibres.length}/${POKEMON_ADJECTIFS.length}) :`);
console.log(`  ${adjsLibres.join(", ")}`);

// ---------- Zone de vitesse ----------
// Le rang suit la performance du jour, replacée dans TOUT l'historique du
// coureur : sa meilleure allure vise le haut du classement, sa pire le bas.
const allures = runs.map((r) => r.paceSec);
const allure = allureArg ? Number(allureArg) : allures[allures.length - 1];

if (!runs.length || !Number.isFinite(allure)) {
  console.log("\nPas d'allure exploitable : choisis librement, le gag prime.");
  process.exit(0);
}

const pire = Math.max(...allures, allure);
const meilleure = Math.min(...allures, allure);
const rang = pire === meilleure
  ? 75
  : Math.round(145 - 140 * (pire - allure) / (pire - meilleure));

const source = allureArg ? "allure fournie" : `dernière séance (${runs[runs.length - 1].date})`;
console.log(`\nZone visée pour ${fmtPace(allure)}/km — ${source}`);
console.log(`  historique : ${fmtPace(meilleure)} (meilleure) → ${fmtPace(pire)} (pire) · rang ≈ ${rang}`);

const pris = new Set(attribues.map(([, a]) => a.pokemon));
const zone = POKEMON
  .filter((p) => !pris.has(p.nom) && Math.abs(p.rang - rang) <= 18)
  .sort((a, b) => Math.abs(a.rang - rang) - Math.abs(b.rang - rang))
  .slice(0, 14)
  .sort((a, b) => a.rang - b.rang);

console.log(`\nLibres dans la zone (rang ${Math.max(1, rang - 18)}–${Math.min(151, rang + 18)}) :`);
zone.forEach((p) => console.log(`  rang ${String(p.rang).padStart(3)}  ${p.nom}`));
console.log("\nRappel : le gag prime. Sortir de la zone est permis si la phrase le justifie.");
