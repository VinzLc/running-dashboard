#!/usr/bin/env bash
# Appelé par launchd dès que le contenu de Vincent/ ou Anaïs/ change (WatchPaths).
# Si une capture n'est pas encore intégrée au dashboard, lance Claude Code en
# headless pour la traiter via la skill add-run — sans intervention humaine.
#
# Pourquoi launchd et pas un hook Claude Code : aucun événement de hook ne
# surveille le système de fichiers. Les hooks ne peuvent réagir qu'au démarrage
# d'une session ou à l'envoi d'un message ; launchd, lui, réagit au dépôt du
# fichier lui-même.
#
# DRY_RUN=1 : affiche la commande sans l'exécuter (pour tester sans consommer
# de tokens ni modifier le dépôt).

set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 0
cd "$root" || exit 0

# L'authentification de Claude Code lit le trousseau login.keychain-db, dont
# l'entrée est indexée sur le nom de compte pris dans $USER. Sans USER, le
# binaire répond « Not logged in · Please run /login » et l'analyse échoue
# silencieusement. launchd fournit bien USER, mais on le rétablit par sécurité
# pour tout autre contexte d'appel (cron, sudo, environnement scrubbé).
[ -n "${USER:-}" ] || USER="$(id -un)"
export USER

log="$root/.claude/watcher/watcher.log"
say() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$log"; }

# Le log ne doit pas grossir indéfiniment (on garde les 500 dernières lignes).
if [ -f "$log" ] && [ "$(wc -c <"$log" | tr -d ' ')" -gt 1000000 ]; then
  tail -n 500 "$log" >"$log.tmp" && mv "$log.tmp" "$log"
fi

# --- Verrou -----------------------------------------------------------------
# launchd peut redéclencher pendant qu'une analyse tourne (dépôt de plusieurs
# captures d'affilée). mkdir est atomique, donc utilisable comme verrou.
lock="$root/.claude/watcher/.lock"
if ! mkdir "$lock" 2>/dev/null; then
  if [ -n "$(find "$lock" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
    say "verrou vieux de plus de 30 min, on le considère périmé"
    rm -rf "$lock" 2>/dev/null
    mkdir "$lock" 2>/dev/null || exit 0
  else
    say "une analyse est déjà en cours, abandon"
    exit 0
  fi
fi
trap 'rm -rf "$lock" 2>/dev/null' EXIT

# --- Dossiers des coureurs --------------------------------------------------
# Le « ï » d'Anaïs peut être encodé en NFC ou NFD : on passe par un glob.
runner_dirs() {
  [ -d Vincent ] && printf '%s\n' Vincent
  for d in Ana*/; do [ -d "$d" ] && printf '%s\n' "${d%/}"; done
}

# --- Attendre la fin de la copie -------------------------------------------
# Le Finder peut écrire le fichier progressivement : launchd nous réveille dès
# la création, donc on attend que la liste des images ET leurs tailles cessent
# de bouger avant de lire quoi que ce soit.
fingerprint() {
  runner_dirs | while IFS= read -r d; do
    find "$d" -maxdepth 1 -type f \
      \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) \
      -exec stat -f '%N %z' {} + 2>/dev/null
  done | sort
}

prev=""
stable=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  cur="$(fingerprint)"
  if [ "$cur" = "$prev" ]; then
    stable=1
    break
  fi
  prev="$cur"
  sleep 2
done
[ "$stable" -eq 1 ] || say "les fichiers bougeaient encore après 20 s, on continue quand même"

# --- Y a-t-il du travail ? --------------------------------------------------
# On réutilise le script du hook : il est la seule source de vérité sur
# « quelles séances manquent », et ne sort quelque chose que s'il y en a.
work="$("$root/.claude/hooks/detect-new-runs.sh" Watcher 2>/dev/null)"
if [ -z "$work" ]; then
  say "déclenché, mais aucune séance manquante — rien à faire"
  exit 0
fi

# --- Localiser le binaire claude -------------------------------------------
# Le chemin du binaire embarqué dans l'extension VS Code contient son numéro de
# version, qui change à chaque mise à jour : on prend donc le plus récent au
# lieu de figer un chemin. Les numéros ne se trient pas alphabétiquement
# (2.1.220 < 2.1.99 en lexical), d'où la comparaison sur la date de fichier.
find_cli() {
  local c newest=""
  c="$(command -v claude 2>/dev/null)"
  if [ -n "$c" ] && [ -x "$c" ]; then printf '%s' "$c"; return 0; fi
  # launchd donne un PATH réduit à /usr/bin:/bin:/usr/sbin:/sbin, donc un CLI
  # autonome installé ailleurs échappe à « command -v » : on regarde les
  # emplacements habituels avant de se rabattre sur l'extension VS Code.
  for c in "$HOME/.local/bin/claude" /opt/homebrew/bin/claude /usr/local/bin/claude; do
    [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done
  for c in "$HOME"/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude; do
    [ -x "$c" ] || continue
    if [ -z "$newest" ] || [ "$c" -nt "$newest" ]; then newest="$c"; fi
  done
  [ -n "$newest" ] && { printf '%s' "$newest"; return 0; }
  return 1
}

cli="$(find_cli)" || { say "ERREUR : binaire claude introuvable, abandon"; exit 0; }

# --- Lancer l'analyse -------------------------------------------------------
prompt='Une ou plusieurs captures Apple Fitness viennent d'"'"'être déposées dans Vincent/ ou Anaïs/ et ne sont pas encore intégrées au dashboard. Lance la skill add-run (outil Skill, skill: "add-run") et suis-la jusqu'"'"'au bout, y compris le commit et le push. Le dossier détermine le coureur. Ne demande aucune confirmation : personne ne lit cette session.'

# Allowlist volontairement étroite : de quoi lire les captures, éditer les
# fichiers du dashboard et publier — rien d'autre. Pas de bypass global.
say "séance(s) manquante(s) détectée(s), lancement de l'analyse"
say "--- début session claude ($cli) ---"

if [ "${DRY_RUN:-0}" = "1" ]; then
  say "DRY_RUN=1 : commande non exécutée"
  printf 'DRY_RUN — aurait exécuté :\n  %s -p <prompt> ...\ntravail détecté :\n%s\n' "$cli" "$work"
  exit 0
fi

"$cli" -p "$prompt" \
  --permission-mode acceptEdits \
  --allowedTools \
    "Skill" "Read" "Edit" "Write" "Glob" "Grep" \
    "Bash(git status:*)" "Bash(git add:*)" "Bash(git commit:*)" \
    "Bash(git push:*)" "Bash(git log:*)" "Bash(git ls-files:*)" \
    "Bash(node --check:*)" \
  >>"$log" 2>&1
status=$?

printf '\n' >>"$log"
if [ "$status" -eq 0 ]; then
  say "--- session terminée (succès) ---"
else
  say "--- session terminée EN ERREUR (code $status) ---"
fi

exit 0
