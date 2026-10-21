#!/usr/bin/env bash
# Découpe la carte du trajet dans le récapitulatif Apple Fitness, pour l'afficher
# en tête de l'analyse. Pas de redessin : on garde le tracé coloré par Apple, sur
# sa carte, et on ne retire que ce qui gêne — les boutons du haut, et le nom du
# lieu en dessous (le dépôt est public).
#
#   .claude/tools/trajet.sh Vincent/IMG_0216.jpeg 2026-10-21
#     → assets/trajets/vincent-2026-10-21.jpg, à référencer dans data.js :
#       trajet: "assets/trajets/vincent-2026-10-21.jpg"
#
# Le coureur se déduit du dossier, via .claude/runners.sh (clé ASCII, en
# minuscules : « Anaïs/ » donne anais-…).
#
# La bande découpée est calée sur l'écran « Workout Details » d'un iPhone en
# 1290×2796 : de 11,3 % à 32,2 % de la hauteur, toute la largeur. En proportions,
# elle suit un autre format d'écran, mais REGARDE le résultat avant de le
# committer — un tracé qui déborde ou un bouton qui dépasse se voit tout de suite.
# Uniquement macOS (sips) ; aucun module Python requis.

set -euo pipefail

capture="${1:?usage : trajet.sh <capture du récapitulatif> <YYYY-MM-DD>}"
date="${2:?usage : trajet.sh <capture du récapitulatif> <YYYY-MM-DD>}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
[ -f "$capture" ] || { echo "Capture introuvable : $capture" >&2; exit 1; }
[[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "Date attendue au format YYYY-MM-DD : $date" >&2; exit 1; }

# shellcheck source=../runners.sh
. .claude/runners.sh
dossier="$(dirname "$capture")"
cle=""
while IFS=$'\t' read -r k d; do
  [ "${d#./}" = "${dossier#./}" ] && cle="$k"
done <<RUNNERS
$(runner_dirs .)
RUNNERS
[ -n "$cle" ] || { echo "« $dossier » n'est pas un dossier de coureur (.claude/runners.sh)" >&2; exit 1; }

sortie="assets/trajets/$(printf '%s' "$cle" | tr '[:upper:]' '[:lower:]')-$date.jpg"
mkdir -p assets/trajets

largeur="$(sips -g pixelWidth "$capture" | awk '/pixelWidth/ { print $2 }')"
hauteur="$(sips -g pixelHeight "$capture" | awk '/pixelHeight/ { print $2 }')"
haut=$(( hauteur * 113 / 1000 ))
bande=$(( hauteur * 209 / 1000 ))

tmp="$(mktemp -t trajet).jpg"
trap 'rm -f "$tmp"' EXIT
sips -c "$bande" "$largeur" --cropOffset "$haut" 0 "$capture" --out "$tmp" >/dev/null
# 900 px de large : net sur la carte d'analyse (820 px au plus), ~70 Ko.
sips --resampleWidth 900 -s formatOptions 80 "$tmp" --out "$sortie" >/dev/null

echo "$sortie"
