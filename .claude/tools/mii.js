#!/usr/bin/env node
// Reporte dans data.js un Mii créé dans l'Atelier Mii du dashboard. L'Atelier
// ne peut rien écrire lui-même (le site est statique) : il produit un lien
// #mii?nom=…&coiffure=…, que la personne envoie à Vincent, et c'est ce script
// qui en fait la ligne de RUNNER_MII — donc le Mii de tout le monde.
//
//   node .claude/tools/mii.js '<lien complet ou partie après #>'
//
// Les options valides sont relues dans app.js (MII_COIFFURES, MII_LUNETTES,
// MII_BARBES) : une option ajoutée à l'Atelier est acceptée ici sans retouche.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const DATA = path.join(ROOT, "data.js");
const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exit(1);
};

const arg = process.argv[2];
if (!arg) fail("usage : node .claude/tools/mii.js '<lien #mii?…>'");
const i = arg.indexOf("mii?");
const q = new URLSearchParams(i >= 0 ? arg.slice(i + 4) : arg.replace(/^#/, ""));

// ---------- Ce que le dashboard sait dessiner ----------
const ctx = {};
vm.createContext(ctx);
const src = fs.readFileSync(DATA, "utf8");
vm.runInContext(`${src}\nglobalThis.__out = { RUNS, RUNNER_MII };`, ctx);
const { RUNS, RUNNER_MII } = ctx.__out;

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const cles = (nom) => {
  const bloc = (app.split(`const ${nom} = {`)[1] || "").split("\n};")[0];
  return [...bloc.matchAll(/^ {2}"?([a-z-]+)"?: \{/gm)].map((m) => m[1]);
};
const COUPES = cles("MII_COIFFURES");
const LUNETTES = cles("MII_LUNETTES");
const BARBES = cles("MII_BARBES");
const PEAU_DEFAUT = (app.match(/const MII_PEAU = "(#[0-9a-f]{6})"/i) || [])[1];

// ---------- Lecture et contrôle du lien ----------
const strip = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const name = Object.keys(RUNS).find((n) => strip(n) === strip(q.get("nom") || ""));
if (!name) fail(`coureur « ${q.get("nom")} » inconnu (${Object.keys(RUNS).join(", ")})`);

const hex = (k, requis) => {
  const v = q.get(k);
  if (v == null || v === "") {
    if (requis) fail(`${k} manquant dans le lien`);
    return null;
  }
  if (!/^[0-9a-f]{6}$/i.test(v)) fail(`${k} : « ${v} » n'est pas une couleur hexadécimale`);
  return `#${v.toLowerCase()}`;
};
const choix = (k, valides) => {
  const v = q.get(k);
  if (v == null || v === "") return null;
  if (!valides.includes(v)) fail(`${k} : « ${v} » inconnu (${valides.join(", ")})`);
  return v;
};

const coiffure = choix("coiffure", COUPES);
if (!coiffure) fail("coiffure manquante dans le lien");

// Ordre des clés : celui des lignes existantes de data.js.
const mii = { cheveux: hex("cheveux", true), coiffure, yeux: hex("yeux", true) };
const peau = hex("peau");
if (peau && peau !== PEAU_DEFAUT) mii.peau = peau;
if (q.get("cils") === "1") mii.cils = true;
const lunettes = choix("lunettes", LUNETTES);
if (lunettes) mii.lunettes = lunettes;
const barbe = choix("barbe", BARBES);
if (barbe) mii.barbe = barbe;
if (q.get("bandeau") === "1") mii.bandeau = true;

// ---------- Écriture ----------
const deNom = /^[aeiouyàâäéèêëîïôöùûüh]/i.test(name) ? `d'${name}` : `de ${name}`;
const cle = /^[A-Za-z_$][\w$]*$/.test(name) ? name : `"${name}"`;
const valeur = Object.entries(mii)
  .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : v}`)
  .join(", ");
const ligne = `  ${cle}: { ${valeur} },`;

const debut = src.indexOf("const RUNNER_MII = {");
if (debut < 0) fail("RUNNER_MII introuvable dans data.js");
const fin = src.indexOf("\n};", debut);
const bloc = src.slice(debut, fin);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = new RegExp(`^  (?:"${esc(name)}"|${esc(name)}): \\{.*\\},$`, "m");

let nouveau;
const avant = bloc.match(re);
if (avant) {
  if (avant[0] === ligne) {
    console.log(`= ${name} : ce Mii est déjà celui de data.js, rien à changer.`);
    process.exit(0);
  }
  nouveau = bloc.replace(re, ligne);
  console.log(`- ${avant[0].trim()}`);
} else {
  nouveau = `${bloc}\n${ligne}`;
  console.log(`(${name} n'avait pas encore de Mii)`);
}
console.log(`+ ${ligne.trim()}`);
fs.writeFileSync(DATA, src.slice(0, debut) + nouveau + src.slice(fin));

// Contrôle de relecture : data.js doit toujours s'évaluer, avec le bon Mii.
const verif = {};
vm.createContext(verif);
vm.runInContext(`${fs.readFileSync(DATA, "utf8")}\nglobalThis.__m = RUNNER_MII;`, verif);
if (JSON.stringify(verif.__m[name]) !== JSON.stringify(mii)) fail("relecture de data.js incohérente — vérifie le fichier");
console.log(`✓ Mii ${deNom} reporté dans data.js${RUNNER_MII[name] ? "" : " (nouvelle entrée)"}.`);
