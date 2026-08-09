#!/usr/bin/env bash
# Détecte les captures Apple Fitness déposées dans Vincent/ ou Anaïs/ qui ne sont
# pas encore intégrées au dashboard, et demande à Claude de lancer la skill add-run.
#
# « Pas encore intégrée » = la capture n'est pas listée dans le manifeste
# .claude/captures-integrees.txt, que la skill add-run complète à chaque séance
# traitée. On ne compte plus les images pour les comparer au nombre de séances de
# data.js : depuis août 2026 une séance donne DEUX captures (le récapitulatif et
# le détail des splits), et rien ne garantit qu'elles arrivent ensemble — un
# décompte ne sait plus dire ce qui manque. On ne se fie pas non plus au fait que
# le fichier soit non commité : l'étape « git add -A » de la skill peut committer
# une image avant que ses données ne soient dans data.js, et la séance passerait
# alors à la trappe pour toujours.
#
# Le manifeste dit exactement QUELLES captures restent à traiter, mais pas à
# quelle séance elles appartiennent : on demande donc à Claude de lire la date
# dans chaque image avant de l'ajouter.
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

# La liste des coureurs vit dans un seul fichier, partagé avec le watcher.
# shellcheck source=../runners.sh
. .claude/runners.sh 2>/dev/null || exit 0

manifest=".claude/captures-integrees.txt"

emit() { # $1 = contexte à injecter
  jq -n --arg e "$event" --arg c "$1" \
    '{hookSpecificOutput: {hookEventName: $e, additionalContext: $c}}' || exit 0
  exit 0
}

# Sans manifeste, impossible de distinguer une capture neuve d'une capture déjà
# exploitée. On le signale plutôt que de rester muet (détection désactivée en
# silence) ou de tout redéclarer comme neuf (36 captures à revérifier à la main).
if [ ! -f "$manifest" ]; then
  emit "Le manifeste ${manifest} est introuvable : la détection automatique des
nouvelles séances est hors service tant qu'il n'est pas reconstruit.

Reconstruis-le à partir de data.js et des dossiers Vincent/ et Anaïs/ : une ligne
par capture déjà intégrée, au format \`Vincent/IMG_1234.jpeg\` (préfixe \`Vincent\`
ou \`Anais\`, sans tréma). Voir la skill add-run pour le détail."
fi

# Captures d'un dossier qui n'apparaissent pas dans le manifeste.
pending_of() { # $1 = dossier réel, $2 = préfixe manifeste (Vincent | Anais)
  find "$1" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) \
    2>/dev/null \
    | sort \
    | while IFS= read -r img; do
        grep -qxF "$2/$(basename "$img")" "$manifest" || printf '%s\n' "$img"
      done
}

report=""
total=0

while IFS=$'\t' read -r key dir; do
  [ -n "$dir" ] || continue
  dir="${dir#./}" # chemins relatifs propres dans le rapport

  pending="$(pending_of "$dir" "$key")"
  [ -z "$pending" ] && continue

  n="$(printf '%s\n' "$pending" | grep -c .)"
  total=$(( total + n ))
  # Le nom affiché est celui du dossier : c'est lui que l'utilisateur voit, la
  # clé ASCII ne sert qu'à indexer le manifeste.
  report="${report}${dir} — ${n} capture(s) non traitée(s) :
${pending}

"
done <<RUNNERS
$(runner_dirs .)
RUNNERS

# Rien de nouveau : on sort sans rien injecter (cas normal, coût nul).
[ "$total" -eq 0 ] && exit 0

emit "${total} capture(s) Apple Fitness non intégrée(s) au dashboard :

${report}Lance la skill \`add-run\` (outil Skill, skill: \"add-run\") pour les traiter
maintenant, sans demander confirmation à l'utilisateur. Le dossier détermine le
coureur.

Une séance produit normalement DEUX captures : le récapitulatif « Workout
Details » et le détail des splits par kilomètre. Elles n'arrivent pas forcément
ensemble, et une séance ancienne peut n'en avoir qu'une. Lis chaque capture pour
savoir de quelle date et de quel type elle relève, puis vérifie dans data.js si
la séance y figure déjà : si oui, complète-la (splits, analyse) au lieu de créer
un doublon. Dans tous les cas, ajoute les captures traitées au manifeste
${manifest}."
