---
name: add-run
description: Ajoute une (ou plusieurs) nouvelle(s) séance(s) de course au dashboard à partir des captures Apple Fitness déposées dans les dossiers Vincent/ ou Anaïs/. À utiliser quand l'utilisateur dit "nouvelle run", "nouvelle séance", "ajoute la course", ou /add-run.
---

# Ajouter une séance de course au dashboard

Procédure pour intégrer une nouvelle capture Apple Fitness dans le dashboard.

## 1. Trouver la/les nouvelle(s) image(s)

- Les captures sont dans `Vincent/` et `Anaïs/` (le dossier détermine le coureur).
- Une image est "nouvelle" si elle n'est pas encore reflétée dans `data.js`. Repère-la via `git status` (fichier non suivi) ou en comparant les dates des images au contenu de `data.js`.
- Si plusieurs nouvelles images, traite-les toutes.

## 2. Lire l'image et extraire les données

Lis l'image avec l'outil Read. Une capture Apple Fitness "Workout Details" contient :

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

## 3. Mettre à jour `data.js`

Ajoute l'objet à la fin du tableau du bon coureur (`RUNS.Vincent` ou `RUNS["Anaïs"]`), en gardant l'ordre chronologique et l'alignement des colonnes existant. Exemple :

```js
{ date: "2026-06-28", duration: 2286, distance: 5.15, activeCal: 367, totalCal: 434, elevation: 10, cadence: 132, paceSec: 443, hr: 144 },
```

## 4. Rédiger l'analyse « coach » (OBLIGATOIRE)

Chaque séance a une analyse IA dépliable dans le tableau, stockée dans l'objet `ANALYSES` de `data.js` (`ANALYSES[coureur][date]`). Ajoute une entrée pour la nouvelle séance :

```js
"2026-06-28": { trend: "up", verdict: "Premier 5 km 🎉",
  text: "..." },
```

- **Compare uniquement aux séances précédentes du MÊME coureur** (jamais Vincent vs Anaïs). Regarde l'historique de la personne dans `RUNS` : allure, distance, FC, cadence, durée.
- **`trend`** : `"up"` (vrai progrès), `"flat"` (stable ou séance volontairement facile / reprise), `"down"` (en retrait), `"start"` (toute première séance de la personne).
- **`verdict`** : titre court accrocheur (ex. « Record d'allure », « Reprise après coupure »).
- **`text`** : 2-3 phrases, ton d'un coach bienveillant qui constate les progrès. Cite des chiffres réels et les écarts vs séances précédentes. Garde en tête le contexte : Vincent 30 ans, Anaïs 29 ans, 9 ans de muscu chacun mais **très novices en cardio** (souligne l'adaptation aérobie, FC qui baisse à effort égal, distance/allure qui montent, records, etc.).
- Les écarts chiffrés vs séance précédente et les badges « Record » sont calculés automatiquement en JS — pas besoin de les mettre dans le texte, mais tu peux les commenter.

## 5. Bumper le cache-busting (OBLIGATOIRE)

Dans `index.html`, incrémente le numéro `?v=N` sur **les trois** références (`styles.css`, `data.js`, `app.js`) — sinon le navigateur sert l'ancienne version et l'UI ne se met pas à jour.

## 6. Commit & push

Commit et push systématiquement, sans demander :

```
git add -A && git commit -m "Add <Coureur> run for <YYYY-MM-DD>" && git push
```

Inclure l'image (elle est ajoutée par `git add -A`). Message de commit avec le co-author Claude habituel.
