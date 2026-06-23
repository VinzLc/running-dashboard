# 🏃 Running Dashboard — Anaïs & Vincent

Dashboard statique pour suivre l'évolution des sessions de course d'Anaïs et Vincent.
Données extraites des résumés d'entraînement Apple Fitness.

## Fonctionnalités

- **Cartes récap** par coureur (distance totale, allure moyenne/meilleure, FC, calories…)
- **Graphique d'évolution** interactif : distance, allure, fréquence cardiaque, cadence, calories ou durée
- **Radar comparatif** des performances moyennes (normalisées)
- **Tableau détaillé** filtrable par coureur

## Stack

Site 100 % statique — HTML / CSS / [Chart.js](https://www.chartjs.org/) (CDN). Aucun build requis.

| Fichier | Rôle |
|---|---|
| `index.html` | Structure |
| `styles.css` | Thème sombre type Apple Fitness |
| `data.js` | Données des séances |
| `app.js` | Rendu + graphiques |

## Développement local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mettre à jour les données

Ajoutez une entrée dans le tableau du coureur concerné dans [`data.js`](data.js) :

```js
{ date: "2026-06-30", duration: 1900, distance: 4.0, activeCal: 300,
  totalCal: 360, elevation: 8, cadence: 127, paceSec: 475, hr: 138 }
```

- `duration` et `paceSec` sont en **secondes** (`paceSec` = allure par km).
- `distance` en km, `elevation` en m, `hr` en bpm, `cadence` en spm.
