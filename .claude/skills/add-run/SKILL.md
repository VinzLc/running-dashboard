---
name: add-run
description: Ajoute une (ou plusieurs) nouvelle(s) séance(s) de course au dashboard à partir des captures Apple Fitness déposées dans les dossiers Vincent/ ou Anaïs/. À utiliser quand l'utilisateur dit "nouvelle run", "nouvelle séance", "ajoute la course", ou /add-run.
---

# Ajouter une séance de course au dashboard

Procédure pour intégrer de nouvelles captures Apple Fitness dans le dashboard.

## 1. Trouver les captures à traiter

- Les captures sont dans `Vincent/` et `Anaïs/` (le dossier détermine le coureur).
- **`.claude/captures-integrees.txt` est la source de vérité** : toute capture qui
  n'y figure pas reste à traiter. Compare le contenu des dossiers à ce manifeste
  (le hook `detect-new-runs.sh` fait déjà ce diff et te donne la liste).
- Ne te fie ni au décompte des images, ni à `git status` : une capture peut être
  commitée avant que ses données soient dans `data.js`.

**Une séance = deux captures** depuis août 2026 :

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

**Vérification** : `paceSec` ≈ `duration / distance`. Si l'écart est important, relis l'image.

## 3. Lire les splits

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

Ajoute l'objet à la fin du tableau du bon coureur (`RUNS.Vincent` ou
`RUNS["Anaïs"]`), en gardant l'ordre chronologique et l'alignement des colonnes
existant. Avec splits, le bloc passe sur plusieurs lignes :

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
  text: "...",
  pokemon: "Électrode", pokemonPhrase: "..." },
```

- **Compare uniquement aux séances précédentes du MÊME coureur** (jamais Vincent
  vs Anaïs). Regarde l'historique de la personne dans `RUNS` : allure, distance,
  FC, cadence, durée, et les splits quand il y en a.
- **`trend`** : `"up"` (vrai progrès), `"flat"` (stable ou séance volontairement
  facile / reprise), `"down"` (en retrait), `"start"` (toute première séance).
- **`verdict`** : titre court accrocheur (ex. « Record d'allure », « Reprise après coupure »).
- **`text`** : 2 à 4 phrases minimum, ton d'un coach bienveillant qui constate les
  progrès. Cite des chiffres réels et les écarts vs séances précédentes. Contexte :
  Vincent 30 ans, Anaïs 29 ans, 9 ans de muscu chacun mais **très novices en
  cardio** (souligne l'adaptation aérobie, FC qui baisse à effort égal,
  distance/allure qui montent, records).
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

## 6. Attribuer le Pokémon de la séance (OBLIGATOIRE)

`pokemon.js` contient les 151 Pokémon de la 1re génération classés par **vitesse
de base**, rang 1 = le plus rapide (Électrode) → rang 151 = le plus lent (Ramoloss).

1. **Calcule le rang visé** à partir de l'allure du jour, positionnée dans
   l'historique complet du coureur (nouvelle séance incluse) :

   ```
   rang ≈ 145 − 140 × (pireAllure − allureDuJour) / (pireAllure − meilleureAllure)
   ```

   Sa meilleure allure de tous les temps vise donc le haut du classement, sa
   plus lente le bas. Une tolérance de ±20 rangs est normale.

2. **Choisis un Pokémon libre dans cette zone.** Un même Pokémon ne sert
   **qu'une seule fois par coureur** — chacun se constitue son propre Pokédex.
   Vérifie les `pokemon:` déjà présents dans le bloc du coureur avant de choisir.

3. **Privilégie celui qui fait la meilleure blague.** Une chaîne d'évolution qui
   suit la progression (Chenipan → Papilusion pour le premier 5 km, Goupix →
   Feunard), un trait de caractère qui colle à la séance (Ronflex pour une sortie
   volontairement lente, Psykokwak pour un coup de mou, Kicklee qui n'est
   littéralement que deux jambes). Un bon gag vaut mieux qu'un rang exact : tu
   peux sortir de la zone si la phrase justifie l'écart — Électrode, le plus
   rapide de tous, a été attribué à une séance partie trop vite et explosée en
   vol, parce que son attaque signature s'appelle Explosion.

4. **`pokemonPhrase`** : une à deux phrases, humoristiques, qui font le lien entre
   le Pokémon et la performance du jour, avec un chiffre réel de la séance.
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
