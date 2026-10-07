---
name: add-run
description: Ajoute une (ou plusieurs) nouvelle(s) séance(s) de course au dashboard à partir des captures d'appli de course déposées dans les dossiers Vincent/, Anaïs/, Didi/, Ju/ ou Pefi/. À utiliser quand l'utilisateur dit "nouvelle run", "nouvelle séance", "ajoute la course", ou /add-run.
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
| Vincent, Anaïs | Apple Fitness | **2** — récapitulatif + splits | tout ; FC/cadence par km presque toujours, mais pas garanties |
| Didi | **Garmin Connect** depuis le 9 sept. 2026 | **1 à 6** — une par onglet | tout, FC et cadence comprises ; + longueur de foulée et zones |
| Didi | adidas Running jusqu'au 5 sept. 2026 | **1** | ni FC, ni cadence, ni dénivelé ; en plus : vitesse de pointe |
| Ju | — | pas encore de séance | — |
| Pefi | Apple Fitness (réglée en français) | **1 ou 2** — le récapitulatif montre souvent les splits en dessous | tout ; FC par km mais **pas de cadence par km** ; + puissance (non stockée) |

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

L'écran adidas Running (Didi jusqu'au 5 septembre 2026) est plus pauvre —
`DISTANCE`, `DURÉE`, `CALORIES` (un seul chiffre → `activeCal`, pas de
`totalCal`), `RYTHME MOY.`, `VITESSE MOY.`, `VITESSE MAX` (→ `maxSpeed`, en
km/h). Il n'y a **ni FC, ni cadence, ni dénivelé** : ces clés sont simplement
absentes de l'objet. Attention, **cet écran ne porte pas toujours de date** : le
titre peut afficher « À L'INSTANT », ce qui veut dire que la course venait de se
terminer quand la capture a été prise. Dans ce cas, la date se lit dans les
métadonnées du fichier :

```bash
mdls -name kMDItemContentCreationDate Didi/prev.XXXX.jpeg
```

### Garmin Connect (Didi, depuis le 9 septembre 2026)

Didi a changé de montre. L'appli est en français et l'activité s'étale sur
plusieurs onglets — **Aperçu**, **Statistiques**, **Circuits**, **Graphiques** —
donc plusieurs captures pour une seule séance, et elles ne se recouvrent pas.
Recoupe-les par la durée totale, qui s'affiche partout.

| Onglet | Ce qu'on en tire |
|---|---|
| Aperçu | **date et heure** (ex. « 9 sept. @ 17:18 »), distance, FC moyenne, allure moyenne, temps total, calories |
| Statistiques | allure moyenne / meilleure, vitesse moyenne / **max** (→ `maxSpeed`), temps total / de déplacement / écoulé, FC moyenne et max |
| Graphiques | courbe de FC, **cadence** moyenne et max, **longueur de foulée**, altitude, temps par zone de FC |
| Circuits | l'équivalent des splits par km, s'il est capturé |

- `activeCal` reçoit le chiffre de l'onglet Aperçu, bien qu'il soit libellé
  « calories dépensées au total ». C'est la seule valeur que l'appli donne à ce
  niveau, et c'est celle qui prolonge la série adidas — le dashboard n'affiche
  que `activeCal`.
- **L'altitude min/max n'est pas du dénivelé positif.** Sans chiffre de dénivelé
  explicite, on omet `elevation`.
- La longueur de foulée et les zones de FC ne sont pas stockées, mais elles font
  d'excellents paragraphes d'analyse : `cadence × longueur de foulée` redonne la
  vitesse moyenne, ce qui désigne précisément le levier à travailler.

> **N'invente jamais une valeur manquante, et ne mets pas 0.** Le dashboard sait
> afficher « — » et retirer un axe du radar, mais un `hr: 0` se lit comme une
> mesure réelle et fausse toutes les moyennes.

Un champ `PAUSE` apparaît quand la séance a été interrompue. On ne le stocke pas,
mais il vaut la peine d'être commenté dans l'analyse : la durée affichée ne
compte que le temps en mouvement, donc l'allure reste juste, mais 5 km d'une
traite et 5 km en trois morceaux ne sont pas le même effort.

**Vérification** : `paceSec` ≈ `duration / distance`. Si l'écart est important, relis l'image.

> **Vincent et Anaïs ne courent que des distances rondes** (5, 6, 7 km…), mais
> leur montre ne coupe pas toute seule : l'écran affiche 6,03 km ou 4,97 km. On
> ne saisit pas ce brut, on le recale — voir « Recaler sur la distance ronde »,
> plus bas.

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
  affiche pas plutôt que d'inventer une valeur. Ce n'est pas une question de
  coureur mais de capture — la colonne manque parfois chez Vincent (19 août)
  comme chez Anaïs (9 août), et elle est présente partout depuis. Regarde
  l'écran, ne te fie pas au dossier.
- **Vérification** : la somme des `sec` doit tomber à quelques secondes de
  `duration` (Apple arrondit chaque ligne).

### Recaler sur la distance ronde (OBLIGATOIRE pour Vincent et Anaïs)

Vincent et Anaïs visent toujours une distance ronde : 5, 6, 7 km. Leur montre,
elle, ne coupe pas la séance au bon endroit — elle enregistre quelques mètres de
trop (6,03 km) ou s'arrête un peu avant (4,97 km). Ces mètres parasites décalent
le chrono et l'allure, et rendent les séances incomparables entre elles. On
saisit donc la séance **à la distance visée**, pas à celle affichée :

1. **`distance`** = la distance ronde visée, c'est-à-dire l'entier le plus proche
   de la valeur affichée (6,03 → 6 ; 4,97 → 5).
2. **`duration`** :
   - montre **trop longue** (6,03 km) → la **somme des splits complets**, qui est
     exactement le temps mis pour couvrir les 6 km. Le tronçon partiel disparaît :
     on ne garde pas sa ligne dans `splits` ;
   - montre **trop courte** (4,97 km) → `duration` affichée **+** le temps qu'il
     restait à courir, soit `(distance_ronde − distance_affichée) × paceSec`,
     arrondi à la seconde. Là on garde tous les splits, dernier partiel compris.
3. **`paceSec`** = `round(duration / distance)` **recalculé** à partir des deux
   valeurs ci-dessus. Jamais l'allure lue à l'écran.

Le reste du récapitulatif — calories, dénivelé, FC et cadence moyennes — est
repris tel quel : quelques dizaines de mètres ne le déplacent pas.

Dans l'analyse, on écrit ces chiffres recalés sans commentaire : ce sont eux, la
séance. Inutile de mentionner le recalage ou la valeur brute de la montre.

> Règle appliquée chez Vincent **à partir des séances traitées le 18 septembre
> 2026**, chez Anaïs **à partir de sa séance du 7 octobre 2026**. Les séances déjà
> en base gardent leurs valeurs brutes — ne les retouche pas, les analyses écrites
> s'appuient dessus. Didi, Ju et Pefi sont saisis à la distance affichée.

## 4. Mettre à jour `data.js`

Ajoute l'objet à la fin du tableau du bon coureur (`RUNS.Vincent`,
`RUNS["Anaïs"]`, `RUNS.Didi`…), en gardant l'ordre chronologique et l'alignement
des colonnes existant. Un nouveau coureur a besoin en plus d'une entrée dans
`RUNNER_COLORS`, d'un avatar dans `RUNNER_MII` (cheveux, yeux, coupe — demande
à Vincent s'il ne les a pas donnés, ou invite la personne à passer par l'Atelier
Mii du dashboard puis la skill `/mii`), d'un bloc dans `ANALYSES` et d'une ligne
dans `.claude/runners.sh` ; puis relance `.claude/watcher/install.sh` après le
commit. Rien à toucher dans `index.html` ni `styles.css`. Avec splits, le bloc passe sur plusieurs lignes :

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
    { titre: "Sorti de la boucle des 5 km", texte: "Le constat chiffré du jour." },
    { titre: "Le départ payé sur quatre km", texte: "Ce que racontent les splits." },
    { titre: "La sortie lente, troisième rappel", texte: "Le conseil pour la prochaine." },
  ],
  pokemon: "Électrode", pokemonAdj: "Impatient",
  pokemonPhrase: "..." },
```

| Champ | Règle |
|---|---|
| `trend` | `"up"` (vrai progrès), `"flat"` (stable / séance facile assumée / reprise), `"down"` (en retrait), `"start"` (première séance uniquement) |
| `verdict` | Titre court et accrocheur (« Record d'allure », « Reprise après coupure ») |
| `text` | **Tableau de `{ titre, texte }`**, jamais une chaîne. Une idée par entrée, titre de 2 à 6 mots qui dit quelque chose |
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
