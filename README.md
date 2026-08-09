# 🏃 Running Dashboard — Anaïs, Vincent, Didi & Ju

Dashboard statique pour suivre l'évolution des sessions de course du groupe.
Données extraites des résumés d'entraînement de chacun.

Chaque coureur n'utilise pas la même appli, et donc ne mesure pas la même chose :
Apple Fitness (Vincent, Anaïs) donne FC, cadence, dénivelé et splits au
kilomètre ; adidas Running (Didi) donne une vitesse de pointe mais pas de FC.
Seules `date`, `duration`, `distance` et `paceSec` sont garanties — le dashboard
retire les statistiques, les courbes et les axes de radar qu'un coureur ne peut
pas renseigner, plutôt que de les afficher à zéro.

## Fonctionnalités

- **Cartes récap** par coureur (distance totale, allure moyenne/meilleure, FC, calories…)
- **Graphique d'évolution** interactif : distance, allure, fréquence cardiaque, cadence, calories ou durée
- **Radar comparatif** des performances moyennes (normalisées)
- **Tableau détaillé** filtrable par coureur
- **Analyse « coach »** dépliable par séance, avec le détail des **splits au kilomètre**
  et le **Pokémon de la séance** — choisi parmi les 151 de la 1re génération classés
  par vitesse de base, d'autant plus rapide que la performance est bonne

## Stack

Site 100 % statique — HTML / CSS / [Chart.js](https://www.chartjs.org/) (CDN). Aucun build requis.

| Fichier | Rôle |
|---|---|
| `index.html` | Structure |
| `styles.css` | Thème sombre type Apple Fitness |
| `data.js` | Données des séances + analyses « coach » |
| `pokemon.js` | Les 151 Pokémon de la 1re génération classés par vitesse de base |
| `app.js` | Rendu + graphiques |
| `assets/pokemon/` | Sprites (un PNG par Pokémon, servi en local) |

## Développement local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mettre à jour les données

Le plus simple : déposer les captures dans le dossier du coureur (`Vincent/`,
`Anaïs/`, `Didi/`, `Ju/`) puis lancer la skill `add-run`, qui fait le reste
(extraction, analyse, Pokémon, commit). Un watcher launchd la déclenche même
automatiquement. Sur Apple Fitness, une séance produit **deux** captures — le
récapitulatif « Workout Details » et le détail des splits ; sur adidas Running,
une seule.

Pour ajouter un coureur : une ligne dans [`.claude/runners.sh`](.claude/runners.sh)
(lu par le hook de détection, le watcher et son installateur), plus une entrée
dans `RUNS`, `RUNNER_COLORS` et `ANALYSES` de `data.js`.

À la main, ajoutez une entrée dans le tableau du coureur concerné dans
[`data.js`](data.js) :

```js
{ date: "2026-06-30", duration: 1900, distance: 4.0, activeCal: 300,
  totalCal: 360, elevation: 8, cadence: 127, paceSec: 475, hr: 138,
  splits: [{ km: 1, sec: 475, paceSec: 475, hr: 136, cadence: 127 }] }
```

- `duration` et `paceSec` sont en **secondes** (`paceSec` = allure par km).
- `distance` en km, `elevation` en m, `hr` en bpm, `cadence` en spm.
- `splits` est facultatif : une entrée par kilomètre, `partial: true` sur le
  dernier tronçon s'il est incomplet, `hr`/`cadence` omis si la montre ne les
  donne pas.

Après toute modification de `data.js`, `pokemon.js`, `app.js` ou `styles.css`,
incrémentez le `?v=N` sur les quatre balises de [`index.html`](index.html) —
sinon le navigateur continue de servir l'ancienne version.
