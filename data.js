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
  ],
  "Anaïs": [
    { date: "2026-05-17", duration: 1856, distance: 3.76, activeCal: 173, totalCal: 211, elevation: 5,  cadence: 129, paceSec: 493, hr: 131 },
    { date: "2026-05-23", duration: 1882, distance: 3.68, activeCal: 164, totalCal: 202, elevation: 3,  cadence: 129, paceSec: 511, hr: 118 },
    { date: "2026-05-27", duration: 1918, distance: 3.64, activeCal: 155, totalCal: 194, elevation: 10, cadence: 125, paceSec: 527, hr: 111 },
    { date: "2026-05-30", duration: 1939, distance: 3.88, activeCal: 175, totalCal: 214, elevation: 6,  cadence: 125, paceSec: 499, hr: 124 },
    { date: "2026-06-09", duration: 1895, distance: 3.66, activeCal: 169, totalCal: 207, elevation: 6,  cadence: 126, paceSec: 517, hr: 124 },
    { date: "2026-06-14", duration: 1868, distance: 3.87, activeCal: 177, totalCal: 215, elevation: 12, cadence: 126, paceSec: 482, hr: 125 },
    { date: "2026-06-20", duration: 2123, distance: 4.47, activeCal: 206, totalCal: 249, elevation: 9,  cadence: 130, paceSec: 474, hr: 127 },
  ],
};

const RUNNER_COLORS = {
  Vincent: "#0a84ff",
  "Anaïs": "#ff375f",
};
