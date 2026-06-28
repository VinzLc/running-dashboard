// Données des sessions de course — extraites des captures Apple Fitness.
// Allure en secondes/km pour permettre les calculs/graphiques.
// Durée en secondes. Distance en km. Dénivelé en m. FC en bpm. Cadence en spm.

const RUNS = {
  Vincent: [
    { date: "2026-05-16", duration: 1893, distance: 3.74, activeCal: 268, totalCal: 324, elevation: 13, cadence: 123, paceSec: 505, hr: 133 },
    { date: "2026-05-17", duration: 1877, distance: 3.80, activeCal: 268, totalCal: 322, elevation: 7,  cadence: 122, paceSec: 494, hr: 132 },
    { date: "2026-05-23", duration: 1844, distance: 3.79, activeCal: 261, totalCal: 315, elevation: 4,  cadence: 121, paceSec: 486, hr: 128 },
    { date: "2026-05-27", duration: 1918, distance: 3.72, activeCal: 258, totalCal: 314, elevation: 10, cadence: 121, paceSec: 515, hr: 127 },
    { date: "2026-05-30", duration: 1937, distance: 3.95, activeCal: 282, totalCal: 338, elevation: 6,  cadence: 123, paceSec: 490, hr: 135 },
    { date: "2026-06-09", duration: 1896, distance: 3.77, activeCal: 261, totalCal: 317, elevation: 6,  cadence: 124, paceSec: 503, hr: 135 },
    { date: "2026-06-11", duration: 1712, distance: 3.62, activeCal: 256, totalCal: 306, elevation: 9,  cadence: 126, paceSec: 472, hr: 137 },
    { date: "2026-06-14", duration: 1868, distance: 4.05, activeCal: 287, totalCal: 342, elevation: 10, cadence: 126, paceSec: 461, hr: 138 },
    { date: "2026-06-20", duration: 2124, distance: 4.63, activeCal: 334, totalCal: 396, elevation: 7,  cadence: 127, paceSec: 458, hr: 139 },
    { date: "2026-06-23", duration: 2053, distance: 4.55, activeCal: 327, totalCal: 387, elevation: 6,  cadence: 129, paceSec: 451, hr: 143 },
    { date: "2026-06-26", duration: 2180, distance: 4.84, activeCal: 346, totalCal: 410, elevation: 6,  cadence: 131, paceSec: 450, hr: 142 },
    { date: "2026-06-28", duration: 2286, distance: 5.15, activeCal: 367, totalCal: 434, elevation: 10, cadence: 132, paceSec: 443, hr: 144 },
  ],
  "Anaïs": [
    { date: "2026-05-17", duration: 1856, distance: 3.76, activeCal: 173, totalCal: 211, elevation: 5,  cadence: 129, paceSec: 493, hr: 131 },
    { date: "2026-05-23", duration: 1882, distance: 3.68, activeCal: 164, totalCal: 202, elevation: 3,  cadence: 129, paceSec: 511, hr: 118 },
    { date: "2026-05-27", duration: 1918, distance: 3.64, activeCal: 155, totalCal: 194, elevation: 10, cadence: 125, paceSec: 527, hr: 111 },
    { date: "2026-05-30", duration: 1939, distance: 3.88, activeCal: 175, totalCal: 214, elevation: 6,  cadence: 125, paceSec: 499, hr: 124 },
    { date: "2026-06-09", duration: 1895, distance: 3.66, activeCal: 169, totalCal: 207, elevation: 6,  cadence: 126, paceSec: 517, hr: 124 },
    { date: "2026-06-14", duration: 1868, distance: 3.87, activeCal: 177, totalCal: 215, elevation: 12, cadence: 126, paceSec: 482, hr: 125 },
    { date: "2026-06-20", duration: 2123, distance: 4.47, activeCal: 206, totalCal: 249, elevation: 9,  cadence: 130, paceSec: 474, hr: 127 },
    { date: "2026-06-28", duration: 2285, distance: 4.86, activeCal: 233, totalCal: 280, elevation: 8,  cadence: 131, paceSec: 470, hr: 129 },
  ],
};

const RUNNER_COLORS = {
  Vincent: "#0a84ff",
  "Anaïs": "#ff375f",
};

// Analyses « coach » par séance, rédigées en comparant chaque run aux précédentes
// du MÊME coureur (jamais de mélange Vincent / Anaïs).
// trend : "up" (progrès) | "flat" (stable / volontairement facile) | "down" (en retrait) | "start" (1re séance)
// Contexte coureurs : Vincent 30 ans, Anaïs 29 ans — 9 ans de musculation chacun, très novices en cardio.
const ANALYSES = {
  Vincent: {
    "2026-05-16": { trend: "start", verdict: "Point de départ",
      text: "Première séance enregistrée : 3,74 km en 8'25\"/km à 133 bpm. C'est ta ligne de base. Avec 9 ans de muscu dans les jambes mais un cardio encore neuf, l'objectif des prochaines semaines n'est pas la vitesse mais d'habituer le cœur et le souffle à l'effort continu." },
    "2026-05-17": { trend: "up", verdict: "Déjà plus rapide",
      text: "Deux jours seulement après la première sortie, et déjà 11 s/km de gagnées (8'14\" contre 8'25\") pour une fréquence cardiaque identique. Enchaîner si vite montre une bonne récupération — un héritage direct de ton entraînement en force." },
    "2026-05-23": { trend: "up", verdict: "Cœur plus efficace",
      text: "Allure encore grignotée (8'06\"/km), mais surtout la FC moyenne baisse à 128 bpm alors que tu cours aussi vite. Le cœur travaille moins pour le même effort : c'est le premier vrai signe d'adaptation aérobie. Continue comme ça." },
    "2026-05-27": { trend: "flat", verdict: "Séance en souplesse",
      text: "Sortie plus tranquille : 8'35\"/km, la plus lente jusqu'ici, sur une distance raccourcie. Ta FC est au plus bas (127 bpm), donc c'est une séance facile assumée, pas un coup de moins bien. Ces sorties en aisance construisent l'endurance autant que les rapides." },
    "2026-05-30": { trend: "up", verdict: "Rebond + distance record",
      text: "Joli rebond : retour à 8'10\"/km et surtout ta plus longue distance à ce jour (3,95 km), tu frôles la barre des 4 km. Les calories montent avec le volume. Tu commences à tenir l'effort plus longtemps." },
    "2026-06-09": { trend: "flat", verdict: "Reprise après coupure",
      text: "Reprise après 10 jours de coupure : 8'23\"/km, un poil en retrait, ce qui est parfaitement normal après une pause. La FC reste un peu haute pour l'allure, le temps de retrouver le rythme. L'essentiel est d'être reparti." },
    "2026-06-11": { trend: "up", verdict: "Première sous les 8'/km",
      text: "Cap symbolique franchi : première sortie sous les 8'/km (7'52\") ! Tu as raccourci la distance pour pousser l'allure, et signé ta séance la plus courte en durée (28:32). La vitesse pure progresse nettement." },
    "2026-06-14": { trend: "up", verdict: "Plus vite ET plus loin",
      text: "Du costaud : plus vite (7'41\"/km) ET plus loin (4,05 km, nouveau record de distance) dans la même séance. D'habitude on gagne sur l'un en lâchant sur l'autre — là tu progresses sur les deux. Le moteur cardio se construit pour de bon." },
    "2026-06-20": { trend: "up", verdict: "Cap des 4,5 km",
      text: "Gros bond d'endurance : 4,63 km, ton record, en gardant une allure de 7'38\"/km. Plus de 35 min d'effort continu et 334 cal brûlées. Le cœur monte à 139 bpm mais tient la distance — exactement la progression attendue." },
    "2026-06-23": { trend: "up", verdict: "Record d'allure",
      text: "Nouveau record d'allure : 7'31\"/km sur 4,55 km, avec une cadence qui grimpe (129 spm), signe d'une foulée plus efficace. Tu cours désormais près d'une minute par km plus vite qu'à tes débuts de mai." },
    "2026-06-26": { trend: "up", verdict: "Presque 5 km",
      text: "Tout proche des 5 km : 4,84 km, record de distance, à 7'30\"/km (record d'allure égalé) et meilleure cadence (131 spm). Distance et vitesse continuent de monter ensemble. Le palier des 5 km est à portée de main." },
    "2026-06-28": { trend: "up", verdict: "Premier 5 km 🎉",
      text: "Le voilà, ton premier 5 km : 5,15 km en 7'23\"/km, record sur les deux tableaux ! En six semaines tu es passé de 3,7 km à 8'25\" à un vrai 5K à 7'23\". Pour un cardio parti de zéro, c'est une progression remarquable — ton fond musculaire a clairement accéléré l'adaptation." },
  },
  "Anaïs": {
    "2026-05-17": { trend: "start", verdict: "Point de départ",
      text: "Première séance enregistrée : 3,76 km en 8'13\"/km à 131 bpm. C'est ta référence de départ. Comme pour toute débutante en cardio venant de la force, le plan est simple : laisser le cœur et le souffle s'habituer avant de chercher la vitesse." },
    "2026-05-23": { trend: "flat", verdict: "Effort mieux dosé",
      text: "L'allure ralentit un peu (8'31\"/km), mais regarde la FC : 118 bpm, soit 13 de moins qu'à la première sortie. Tu apprends à doser ton effort plutôt qu'à tout donner — exactement la bonne approche pour bâtir une base aérobie solide." },
    "2026-05-27": { trend: "flat", verdict: "Séance tout en contrôle",
      text: "Séance tout en contrôle : 8'47\"/km, mais une FC moyenne de seulement 111 bpm, ta plus basse. Tu cours en grande aisance respiratoire. Ces sorties faciles ne paient pas tout de suite au chrono, mais elles posent les fondations de l'endurance." },
    "2026-05-30": { trend: "up", verdict: "Accélération + record",
      text: "Belle accélération : 8'19\"/km (28 s/km de gagnées) sur ta plus longue distance à ce jour (3,88 km). La FC remonte logiquement à 124 bpm puisque tu pousses davantage. Tu commences à transformer la base construite en vitesse." },
    "2026-06-09": { trend: "flat", verdict: "Reprise après coupure",
      text: "Reprise après 10 jours sans courir : 8'37\"/km, un léger retrait bien normal après une coupure. Distance et FC restent dans tes standards. L'essentiel est d'avoir relancé la machine — la forme revient vite." },
    "2026-06-14": { trend: "up", verdict: "Record d'allure",
      text: "Record d'allure : 8'02\"/km, soit 35 s/km de mieux que la séance précédente, ta meilleure performance jusqu'ici. Et tout ça à FC quasi inchangée (125 bpm) : le même effort te fait désormais aller bien plus vite. L'adaptation cardio porte ses fruits." },
    "2026-06-20": { trend: "up", verdict: "Sous 8' et cap des 4 km",
      text: "Double cap franchi : ta première sortie sous les 8'/km (7'54\") et ton record de distance (4,47 km, +0,6 km d'un coup). Plus de 35 min d'effort, 206 cal. Distance et vitesse progressent ensemble — pour un cardio parti de novice, la marche est nette." },
    "2026-06-28": { trend: "up", verdict: "Double record",
      text: "Double record d'un coup : 4,86 km (ta plus longue distance) à 7'50\"/km (ta meilleure allure, 4 s/km de mieux que le 20 juin). Et tout ça pour seulement 129 bpm de moyenne, à peine plus qu'avant : tu cours désormais plus loin ET plus vite sans que le cœur s'emballe. Le cap des 5 km est à portée." },
  },
};
