---
name: add-run
description: Ajoute une (ou plusieurs) nouvelle(s) séance(s) de course au dashboard à partir des captures d'appli de course déposées dans les dossiers Vincent/, Anaïs/, Didi/ ou Ju/. À utiliser quand l'utilisateur dit "nouvelle run", "nouvelle séance", "ajoute la course", ou /add-run.
---

# Ajouter une séance de course au dashboard

Procédure pour intégrer de nouvelles captures dans le dashboard. Neuf étapes,
toutes obligatoires sauf mention contraire : lire les captures → remplir
`data.js` → rédiger l'analyse → manifeste → cache-busting → vérifier → pousser.

Deux compagnons à cette procédure :

- **[`references/redaction.md`](references/redaction.md)** — comment écrire
  l'analyse et la vanne Pokémon. À lire avant l'étape 5.
- **`node .claude/tools/verifier.js`** — le contrôle mécanique de l'étape 8. Il
  attrape ce que la relecture laisse passer ; ne commite jamais sans l'avoir vu
  vert.

## 1. Trouver les captures à traiter

- Le dossier détermine le coureur. La liste des coureurs vit dans
  `.claude/runners.sh` — **c'est le seul endroit à modifier pour en ajouter un**
  (le hook de détection, le watcher et son installateur la lisent tous de là).
- **`.claude/captures-integrees.txt` est la source de vérité** : toute capture qui
  n'y figure pas reste à traiter. Compare le contenu des dossiers à ce manifeste
  (le hook `detect-new-runs.sh` fait déjà ce diff et te donne la liste).
- Ne te fie ni au décompte des images, ni à `git status` : une capture peut être
  commitée avant que ses données soient dans `data.js`.

**Chaque coureur a sa propre appli, et donc son propre format.** Lis la capture
avant de supposer quoi que ce soit :

| Coureur | Appli | Captures par séance | Mesures |
|---|---|---|---|
| Vincent, Anaïs | Apple Fitness | **2** — récapitulatif + splits | tout, sauf FC/cadence par km chez Anaïs |
| Didi | adidas Running | **1** | ni FC, ni cadence, ni dénivelé ; en plus : vitesse de pointe |
| Ju | — | pas encore de séance | — |

Pour Vincent et Anaïs, depuis août 2026 :

| Capture | Écran | Ce qu'on en tire |
|---|---|---|
| Récapitulatif | « Workout Details » | date, durée, distance, calories, dénivelé, cadence, allure, FC |
| Splits | « Splits » / « 1 Kilometer » | temps, allure, et parfois FC + cadence, **par kilomètre** |

Les deux n'arrivent pas forcément ensemble, et les séances d'avant août 2026
n'ont qu'un récapitulatif. Lis donc chaque capture pour savoir de quelle date et
de quel type elle relève, **puis vérifie dans `data.js` si la séance y est déjà** :
si oui, complète-la (ajout des `splits`, enrichissement de l'analyse) au lieu de
créer un doublon.

## 2. Lire le récapitulatif

| Champ écran | Clé `data.js` | Conversion |
|---|---|---|
| Date (en haut, ex. "Sun, Jun 28") | `date` | format `YYYY-MM-DD` — l'année est l'année courante sauf indication contraire |
| Workout Time (ex. 0:38:06) | `duration` | en **secondes** (38×60+6 = 2286) |
| Distance (ex. 5.15 km) | `distance` | en km, nombre |
| Active Calories | `activeCal` | nombre |
| Total Calories | `totalCal` | nombre |
| Elevation Gain (ex. 10 m) | `elevation` | en m, nombre |
| Avg. Cadence (ex. 132 spm) | `cadence` | nombre |
| Avg. Pace (ex. 7'23"/km) | `paceSec` | en **secondes/km** (7×60+23 = 443) |
| Avg. Heart Rate (ex. 144 bpm) | `hr` | nombre |

L'écran adidas Running (Didi) est plus pauvre — date **et heure** en haut sous le
titre, puis `DISTANCE`, `DURATION`, `AVG. PACE`, `CALORIES` (un seul chiffre →
`activeCal`, pas de `totalCal`), `AVG. SPEED`, `MAX. SPEED` (→ `maxSpeed`, en
km/h) et `DEHYDRATION`. Il n'y a **ni FC, ni cadence, ni dénivelé** : ces clés
sont simplement absentes de l'objet.

> **N'invente jamais une valeur manquante, et ne mets pas 0.** Le dashboard sait
> afficher « — » et retirer un axe du radar, mais un `hr: 0` se lit comme une
> mesure réelle et fausse toutes les moyennes.

Un champ `PAUSE` apparaît quand la séance a été interrompue. On ne le stocke pas,
mais il vaut la peine d'être commenté dans l'analyse : la durée affichée ne
compte que le temps en mouvement, donc l'allure reste juste, mais 5 km d'une
traite et 5 km en trois morceaux ne sont pas le même effort.

**Vérification** : `paceSec` ≈ `duration / distance`. Si l'écart est important, relis l'image.

## 3. Lire les splits (Apple Fitness uniquement)

L'écran « Splits » liste une ligne par kilomètre : numéro, `Time`, `Pace`, et —
selon la montre — `Heart Rate` et `Cadence`. La **dernière ligne est le tronçon
incomplet** (ex. `00:04` pour 10 m restants) : son `Time` est ridicule mais son
`Pace` reste une allure au km.

```js
splits: [
  { km: 1, sec: 360, paceSec: 360, hr: 139, cadence: 154 },
  { km: 7, sec: 4,   paceSec: 365, hr: 174, cadence: 141, partial: true },
],
```

- `sec` = temps passé sur le tronçon, `paceSec` = allure ramenée au km. Identiques
  sur un kilomètre complet ; différents sur le dernier, marqué `partial: true`.
- `hr` et `cadence` sont **facultatifs** : les omettre quand la capture ne les
  affiche pas (c'est le cas d'Anaïs) plutôt que d'inventer une valeur.
- **Vérification** : la somme des `sec` doit tomber à quelques secondes de
  `duration` (Apple arrondit chaque ligne).

## 4. Mettre à jour `data.js`

Ajoute l'objet à la fin du tableau du bon coureur (`RUNS.Vincent`,
`RUNS["Anaïs"]`, `RUNS.Didi`…), en gardant l'ordre chronologique et l'alignement
des colonnes existant. Un nouveau coureur a besoin en plus d'une entrée dans
`RUNNER_COLORS`, d'un bloc dans `ANALYSES` et d'une ligne dans
`.claude/runners.sh`. Avec splits, le bloc passe sur plusieurs lignes :

```js
{ date: "2026-08-09", duration: 2345, distance: 6.01, activeCal: 463, totalCal: 531, elevation: 4,  cadence: 144, paceSec: 390, hr: 158,
  splits: [
    { km: 1, sec: 360, paceSec: 360, hr: 139, cadence: 154 },
  ] },
```

## 5. Rédiger l'analyse « coach » et attribuer le Pokémon (OBLIGATOIRE)

> **Lis d'abord [`references/redaction.md`](references/redaction.md)** — le
> savoir-faire d'écriture y est au complet : structure en paragraphes, ton à
> viser selon la personne, exploitation des splits, règles du gag Pokémon.
> N'écris pas une analyse sans l'avoir lu, le résultat s'en ressent.

Une analyse par séance, dans `ANALYSES[coureur][date]` de `data.js` :

```js
"2026-08-09": { trend: "up", verdict: "Premier 6 km 🎉",
  text: [
    "Le constat chiffré du jour.",
    "Ce que racontent les splits.",
    "Le conseil pour la prochaine.",
  ],
  pokemon: "Électrode", pokemonAdj: "Impatient",
  pokemonPhrase: "..." },
```

| Champ | Règle |
|---|---|
| `trend` | `"up"` (vrai progrès), `"flat"` (stable / séance facile assumée / reprise), `"down"` (en retrait), `"start"` (première séance uniquement) |
| `verdict` | Titre court et accrocheur (« Record d'allure », « Reprise après coupure ») |
| `text` | **Tableau de paragraphes**, jamais une chaîne. Une idée par entrée |
| `pokemon` | Nom français exact de `pokemon.js`, **une seule fois par coureur** |
| `pokemonAdj` | L'adjectif (« Impatient »), masculin, **une seule fois par coureur** |
| `pokemonPhrase` | La vanne, qui justifie le Pokémon **et** son adjectif |

Avant de choisir, demande à l'outil ce qui est déjà pris chez cette personne et
ce qui reste libre — le faire à l'œil dans `data.js` finit par rater un doublon :

```bash
node .claude/tools/pokedex.js Vincent
```

**Compare uniquement aux séances précédentes du MÊME coureur.** Jamais Vincent
contre Anaïs : ce dashboard n'est pas un classement.

## 6. Compléter le manifeste (OBLIGATOIRE)

Ajoute une ligne par capture traitée à la fin de `.claude/captures-integrees.txt`,
au format `Vincent/IMG_9501.jpeg` ou `Anais/IMG_0560.jpeg` (**préfixe ASCII, sans
tréma**). Sans ça, le hook redemandera indéfiniment de traiter les mêmes images.

## 7. Bumper le cache-busting (OBLIGATOIRE)

Dans `index.html`, incrémente le numéro `?v=N` sur **les quatre** références
(`styles.css`, `data.js`, `pokemon.js`, `app.js`) — sinon le navigateur sert
l'ancienne version et l'UI ne se met pas à jour.

## 8. Vérifier (OBLIGATOIRE, avant le commit)

```bash
node .claude/tools/verifier.js
```

Il relit tout ce qui se vérifie mécaniquement : allure cohérente avec
durée / distance, splits qui totalisent la durée, `text` bien en tableau,
Pokémon et adjectifs sans doublon par coureur, adjectif justifié dans la phrase,
sprites présents, manifeste à jour, cache-busting bumpé.

- **Sortie 1 = ne commite pas.** Corrige d'abord : chaque erreur signalée est une
  faute que l'œil ne rattrape plus dans un fichier de 400 lignes.
- Les `⚠` ne bloquent pas mais méritent un regard (un paragraphe trop long, une
  justification qui se répète, une capture hors manifeste).

## 9. Commit & push

Commit et push systématiquement, sans demander :

```
git add -A && git commit -m "Add <Coureur> run for <YYYY-MM-DD>" && git push
```

Inclure les images (elles sont ajoutées par `git add -A`). Message de commit avec
le co-author Claude habituel.

## Outils

| Commande | À quoi ça sert |
|---|---|
| `node .claude/tools/verifier.js` | Contrôle complet avant commit (étape 8) |
| `node .claude/tools/pokedex.js` | Vue d'ensemble : séances et Pokémon pris par coureur |
| `node .claude/tools/pokedex.js <Coureur>` | Pokémon déjà attribués, adjectifs libres, zone de vitesse du jour |
| `node .claude/tools/pokedex.js <Coureur> <allureSec>` | Même chose pour une allure pas encore saisie |
