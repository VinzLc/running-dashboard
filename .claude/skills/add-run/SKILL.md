---
name: add-run
description: Ajoute une (ou plusieurs) nouvelle(s) séance(s) de course au dashboard à partir des captures d'appli de course déposées dans les dossiers Vincent/, Anaïs/, Didi/ ou Ju/. À utiliser quand l'utilisateur dit "nouvelle run", "nouvelle séance", "ajoute la course", ou /add-run.
---

# Ajouter une séance de course au dashboard

Procédure pour intégrer de nouvelles captures dans le dashboard.

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

## 5. Rédiger l'analyse « coach » (OBLIGATOIRE)

Chaque séance a une analyse IA dépliable dans le tableau, stockée dans l'objet
`ANALYSES` de `data.js` (`ANALYSES[coureur][date]`) :

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

- **Compare uniquement aux séances précédentes du MÊME coureur** (jamais Vincent
  vs Anaïs). Regarde l'historique de la personne dans `RUNS` : allure, distance,
  FC, cadence, durée, et les splits quand il y en a.
- **`trend`** : `"up"` (vrai progrès), `"flat"` (stable ou séance volontairement
  facile / reprise), `"down"` (en retrait), `"start"` (toute première séance).
- **`verdict`** : titre court accrocheur (ex. « Record d'allure », « Reprise après coupure »).
- **`text`** : un **tableau de paragraphes**, jamais une chaîne unique — le
  dashboard rend un `<p>` par entrée, et un pavé de dix phrases n'est pas lu.
  Une idée par paragraphe (2 à 4 phrases chacun), dans cet ordre naturel : le
  constat chiffré du jour, ce que racontent les splits ou la FC, puis le conseil
  ou la mise en perspective. Compte 2 paragraphes pour une séance ordinaire, 4 à
  6 pour une grosse séance à commenter. Une analyse d'une ou deux phrases peut
  rester un tableau à un seul élément.
  Ton d'un coach bienveillant qui constate les
  progrès. Cite des chiffres réels et les écarts vs séances précédentes. Contexte :
  Vincent 30 ans, Anaïs 29 ans, 9 ans de muscu chacun mais **très novices en
  cardio** (souligne l'adaptation aérobie, FC qui baisse à effort égal,
  distance/allure qui montent, records).
- **Adapte le ton à la personne** (voir « Profils » juste en dessous) : la même
  séance ne se commente pas de la même façon selon qui la lit.
- **N'analyse que ce qui est mesuré.** Sans FC ni cadence (Didi), l'adaptation
  aérobie n'est pas observable : appuie-toi sur ce que l'appli donne — allure,
  régularité d'une sortie à l'autre, temps de pause, vitesse de pointe, et le
  fait que le parcours soit identique à chaque fois (le chrono devient alors une
  mesure très propre du progrès).
- **N'invente pas de contexte personnel.** Pour un coureur dont on ne connaît ni
  l'âge ni le passé sportif, tiens-t'en aux chiffres. En français, évite aussi
  les accords qui présument du genre (« ton allure est passée de… » plutôt que
  « tu es passé·e de… ») tant que la personne ne l'a pas indiqué.
- **Exploite les splits** — c'est là que se trouve ce que les moyennes cachent :
  - *gestion de l'effort* : écart entre le 1er et le dernier kilomètre complet.
    Un positive split marqué (départ rapide, fin qui s'écroule) est le défaut
    le plus fréquent chez un débutant, et le conseil le plus utile à donner ;
  - *dérive cardiaque* : la FC monte-t-elle à allure constante ?
  - *tenue de la foulée* : la cadence s'effondre-t-elle sur la fin ?
  - compare aussi aux splits des séances précédentes : le conseil déjà donné
    a-t-il été suivi ?
- Les écarts chiffrés vs séance précédente, les badges « Record » et le graphique
  des splits sont générés automatiquement en JS — inutile de les recopier, mais
  tu peux les commenter.

### Profils des coureurs — à lire avant d'écrire

L'analyse est sérieuse **et** humoristique, et le dosage change selon la personne :

| Coureur | Ce qu'il faut viser |
|---|---|
| **Vincent** | L'auteur du dashboard : il lit tout, y compris les analyses des autres. Franchise sur les points à corriger. |
| **Anaïs** | Veut des **axes d'amélioration concrets** et aime les analyses poussées : creuse les splits, la dérive cardiaque, la tenue de cadence. Termine toujours par la consigne suivante, précise. Elle ne court jamais seule — ses séances sont celles de Vincent. |
| **Didi** | **A besoin d'encouragement.** Son objectif est de retrouver son niveau d'avant, et c'est atteignable : dis-le, chiffres à l'appui. Insiste sur ce qui remonte. |
| **Ju** | Le grand frère, compétiteur : il donnera tout dès qu'il sentira le duel. Joue là-dessus, et surtout **fais-le rire**. |

Les éléments personnels qui nourrissent les vannes (surnoms, animaux, goûts
musicaux, références de jeux) sont dans **`.claude/profils-coureurs.local.md`** —
non commité, **parce que ce dépôt est public**. Lis-le s'il est là.

> ⚠️ Ce qui est écrit dans `data.js` **devient public**. Une référence complice à
> un chat ou à un groupe de metal passe très bien ; nommer un conjoint, un
> employeur ou une adresse, non — sauf accord explicite de Vincent.

## 6. Attribuer le Pokémon de la séance (OBLIGATOIRE)

**C'est une section humoristique**, rien d'autre : le dashboard affiche le
sprite, le nom et la vanne. Aucun rang, aucune statistique — le lecteur n'a pas
besoin d'un classement pour comprendre la blague. **Le gag prime sur tout le reste.**

1. **Cherche d'abord la blague.** Une chaîne d'évolution qui suit la progression
   (Chenipan → Papilusion pour le premier 5 km, Goupix → Feunard), un trait de
   caractère qui colle à la séance (Ronflex pour une sortie volontairement lente,
   Psykokwak pour un coup de mou, Kicklee qui n'est littéralement que deux jambes,
   Canarticho pour 4 minutes de pause au milieu d'un 5 km).

2. **Cale grossièrement sur la performance.** `pokemon.js` classe les 151 par
   vitesse de base (rang 1 = Électrode, rang 151 = Ramoloss) : une bonne séance
   appelle plutôt un Pokémon rapide, une sortie tranquille un lent. C'est un
   repère, pas une règle — Électrode, le plus rapide de tous, a été attribué à une
   séance partie trop vite et explosée en vol, parce que son attaque signature
   s'appelle Explosion. Un bon gag justifie n'importe quel écart.

3. **Un même Pokémon ne sert qu'une fois par coureur** — chacun se constitue son
   propre Pokédex, et une évolution ne peut donc pas revenir en arrière. En
   revanche, **le même Pokémon peut très bien être attribué à plusieurs
   personnes** : les Pokédex sont indépendants. Vérifie donc uniquement les
   `pokemon:` déjà présents dans le bloc du coureur concerné.

4. **Ajoute un adjectif** (`pokemonAdj`) : « Persian Impérial », « Chenipan
   Frétillant », « Canarticho Distrait ». C'est lui qui personnalise la créature —
   151 Pokémon × une cinquantaine d'adjectifs, la combinaison est unique même
   quand la bestiole ne l'est pas. La palette vit dans `POKEMON_ADJECTIFS`
   (`pokemon.js`), mais en inventer un hors liste est encouragé s'il fait mieux
   rire. **Toujours au masculin** (on dit « le Pokémon »), et **jamais deux fois
   le même adjectif chez un même coureur**.

5. **`pokemonPhrase`** : une à trois phrases, humoristiques, qui font le lien entre
   le Pokémon et la performance du jour, avec un chiffre réel de la séance —
   **et qui justifient l'adjectif**, sinon ce n'est qu'un mot de plus :

   > Persian : rapide, silencieux, et absolument pas du genre à se donner en
   > spectacle. […] **Impérial**, parce que trois records d'affilée sans jamais
   > dépasser 11,2 km/h, c'est la démarche de quelqu'un qui sait qu'on le regarde.

   N'utilise **pas de guillemets droits** dans la chaîne (préfère « » ou rien) —
   ils cassent le littéral JS.

Le sprite est déjà dans `assets/pokemon/<id>.png` pour les 151 : rien à
télécharger, il suffit que le nom français corresponde exactement à `pokemon.js`.

## 7. Compléter le manifeste (OBLIGATOIRE)

Ajoute une ligne par capture traitée à la fin de `.claude/captures-integrees.txt`,
au format `Vincent/IMG_9501.jpeg` ou `Anais/IMG_0560.jpeg` (**préfixe ASCII, sans
tréma**). Sans ça, le hook redemandera indéfiniment de traiter les mêmes images.

## 8. Bumper le cache-busting (OBLIGATOIRE)

Dans `index.html`, incrémente le numéro `?v=N` sur **les quatre** références
(`styles.css`, `data.js`, `pokemon.js`, `app.js`) — sinon le navigateur sert
l'ancienne version et l'UI ne se met pas à jour.

## 9. Commit & push

Commit et push systématiquement, sans demander :

```
git add -A && git commit -m "Add <Coureur> run for <YYYY-MM-DD>" && git push
```

Inclure les images (elles sont ajoutées par `git add -A`). Message de commit avec
le co-author Claude habituel.
