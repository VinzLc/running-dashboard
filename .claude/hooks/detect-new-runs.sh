#!/usr/bin/env bash
# Détecte les captures Apple Fitness déposées dans Vincent/ ou Anaïs/ qui ne sont
# pas encore intégrées au dashboard, et demande à Claude de lancer la skill add-run.
#
# « Pas encore intégrée » = il y a plus d'images dans le dossier d'un coureur que
# de séances enregistrées pour lui dans data.js (invariant : 1 capture = 1 séance).
# On ne se fie PAS au fait que le fichier soit non commité : l'étape « git add -A »
# de la skill peut committer une image avant que ses données ne soient dans data.js,
# et la séance passerait alors à la trappe pour toujours.
#
# Le décompte dit COMBIEN de séances manquent ; les dates de modification disent
# LESQUELLES sont les plus probables — c'est une heuristique, donc on demande à
# Claude de vérifier la date lue dans l'image avant de l'ajouter.
#
# Usage : detect-new-runs.sh <NomDeLEvenementHook>   (défaut : SessionStart)

set -uo pipefail

event="${1:-SessionStart}"

# Ce script tourne sur UserPromptSubmit, où un code de sortie non nul bloquerait
# le message de l'utilisateur. On sort donc toujours 0, quoi qu'il arrive.
command -v jq >/dev/null 2>&1 || exit 0

root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$root" ] && exit 0
cd "$root" 2>/dev/null || exit 0
[ -f data.js ] || exit 0

# Nombre de séances déjà enregistrées dans data.js, par coureur.
# Le tableau d'un coureur va de « Nom: [ » à la ligne « ], » ; on compte les
# lignes contenant « date: " » à l'intérieur. ANALYSES utilise des accolades et
# n'a pas de clé « date: », donc aucun risque de confusion.
runs_recorded() { # $1 = motif awk du nom de coureur
  awk -v pat="$1" '
    $0 ~ "^  " pat ": \\["      { inside = 1; next }
    inside && /^  \],?$/        { inside = 0 }
    inside && /date: "/         { n++ }
    END                         { print n + 0 }
  ' data.js
}

# Nombre de captures présentes dans un dossier.
images_present() {
  find "$1" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) \
    2>/dev/null | grep -c .
}

# Les $2 captures les plus récemment modifiées d'un dossier (les candidates).
newest_images() {
  find "$1" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) \
    -print0 2>/dev/null \
    | { xargs -0 stat -f '%m %N' 2>/dev/null || xargs -0 stat -c '%Y %n' 2>/dev/null; } \
    | sort -rn | head -n "$2" | cut -d' ' -f2-
}

report=""
total=0

for runner in Vincent "Anaïs"; do
  # Le dossier Anaïs peut être encodé en NFC ou NFD selon la source : on le
  # retrouve par glob plutôt que par nom littéral.
  dir=""
  if [ "$runner" = "Vincent" ]; then
    [ -d Vincent ] && dir="Vincent"
    pat="Vincent"
  else
    for d in Ana*/; do [ -d "$d" ] && dir="${d%/}"; done
    pat="\"Ana[^\"]*\""
  fi
  [ -z "$dir" ] && continue

  present="$(images_present "$dir")"
  recorded="$(runs_recorded "$pat")"
  missing=$(( present - recorded ))
  [ "$missing" -le 0 ] && continue

  candidates="$(newest_images "$dir" "$missing")"
  [ -z "$candidates" ] && continue

  total=$(( total + missing ))
  report="${report}${runner} — ${present} capture(s) dans ${dir}/ mais ${recorded} séance(s) dans data.js, soit ${missing} manquante(s). Candidate(s) la/les plus récente(s) :
${candidates}

"
done

# Rien de nouveau : on sort sans rien injecter (cas normal, coût nul).
[ "$total" -eq 0 ] && exit 0

read -r -d '' context <<EOF || true
${total} séance(s) de course non intégrée(s) au dashboard détectée(s) :

${report}Lance la skill \`add-run\` (outil Skill, skill: "add-run") pour les traiter maintenant,
sans demander confirmation à l'utilisateur. Le dossier détermine le coureur.

Les candidates ci-dessus sont déduites des dates de modification des fichiers :
vérifie la date lue DANS chaque image avant de l'ajouter. Si une candidate est
déjà présente dans data.js, ignore-la et examine les autres captures du dossier
pour trouver celle qui manque réellement.
EOF

jq -n --arg e "$event" --arg c "$context" \
  '{hookSpecificOutput: {hookEventName: $e, additionalContext: $c}}' || exit 0

exit 0
