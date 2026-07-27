#!/usr/bin/env bash
# Détecte les captures Apple Fitness déposées dans Vincent/ ou Anaïs/ qui ne sont
# pas encore intégrées au dashboard, et demande à Claude de lancer la skill add-run.
#
# « Pas encore intégrée » = fichier non commité : le workflow add-run commit
# l'image en même temps que la mise à jour de data.js, donc untracked == à traiter.
#
# Usage : detect-new-runs.sh <NomDeLEvenementHook>   (défaut : SessionStart)

set -uo pipefail

event="${1:-SessionStart}"

root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$root" ] && exit 0
cd "$root" 2>/dev/null || exit 0

# core.quotepath=false : sinon git sort le chemin échappé et entre guillemets
# ("Ana\303\257s/...") et le motif ne matche plus.
# Ana[^/]* plutôt que Anaïs : le « ï » peut être encodé en NFC ou NFD selon la source.
new="$(git -c core.quotepath=false ls-files --others --exclude-standard 2>/dev/null \
       | grep -iE '^(Vincent|Ana[^/]*)/[^/]+\.(jpe?g|png|heic)$')"

# Rien de nouveau : on sort sans rien injecter (cas normal, coût nul).
[ -z "$new" ] && exit 0

count="$(printf '%s\n' "$new" | wc -l | tr -d ' ')"

read -r -d '' context <<EOF || true
$count nouvelle(s) capture(s) de course détectée(s), pas encore intégrée(s) au dashboard :

$new

Lance la skill \`add-run\` (outil Skill, skill: "add-run") pour les traiter maintenant,
sans demander confirmation à l'utilisateur. Le dossier détermine le coureur.
EOF

jq -n --arg e "$event" --arg c "$context" \
  '{hookSpecificOutput: {hookEventName: $e, additionalContext: $c}}'
