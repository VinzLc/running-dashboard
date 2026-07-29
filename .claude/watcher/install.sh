#!/usr/bin/env bash
# Installe (ou désinstalle) l'agent launchd qui surveille Vincent/ et Anaïs/.
#
#   ./install.sh            installe et charge l'agent
#   ./install.sh --uninstall  décharge et supprime l'agent
#   ./install.sh --status     état de l'agent
#
# Le plist est généré ici plutôt que committé tel quel, pour que les chemins
# absolus correspondent à l'emplacement réel du dépôt sur la machine.

set -euo pipefail

label="com.vinz.running-dashboard.watch"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
plist="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"

case "${1:-}" in
  --status)
    if launchctl print "$domain/$label" >/dev/null 2>&1; then
      echo "Agent chargé."
      launchctl print "$domain/$label" | grep -E '^[[:space:]]+(state|program) =' \
        | sed 's/^[[:space:]]*/  /'
      echo "  chemins surveillés :"
      /usr/libexec/PlistBuddy -c "Print :WatchPaths" "$plist" 2>/dev/null \
        | sed -n 's|^ *\(/.*\)$|    \1|p'
    else
      echo "Agent non chargé."
    fi
    exit 0
    ;;
  --uninstall)
    launchctl bootout "$domain/$label" 2>/dev/null || true
    rm -f "$plist"
    echo "Agent déchargé et $plist supprimé."
    exit 0
    ;;
esac

# Dossiers à surveiller : Vincent + le dossier d'Anaïs retrouvé par glob, pour
# ne pas dépendre de l'encodage du « ï » (NFC vs NFD).
watch_entries=""
add_watch() { watch_entries="${watch_entries}    <string>${1}</string>"$'\n'; }
[ -d "$root/Vincent" ] && add_watch "$root/Vincent"
for d in "$root"/Ana*/; do [ -d "$d" ] && add_watch "${d%/}"; done

if [ -z "$watch_entries" ]; then
  echo "Aucun dossier de coureur trouvé dans $root — rien à surveiller." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat >"$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>

  <key>ProgramArguments</key>
  <array>
    <string>$root/.claude/watcher/run-watcher.sh</string>
  </array>

  <key>WatchPaths</key>
  <array>
$watch_entries  </array>

  <!-- Pas de lancement au chargement : on ne veut réagir qu'à un dépôt réel.
       Le hook SessionStart couvre déjà le cas « capture en attente au début ». -->
  <key>RunAtLoad</key>
  <false/>

  <!-- launchd n'autorise pas plus d'un lancement par tranche de 30 s. -->
  <key>ThrottleInterval</key>
  <integer>30</integer>

  <key>ProcessType</key>
  <string>Background</string>

  <key>StandardOutPath</key>
  <string>$root/.claude/watcher/launchd.log</string>
  <key>StandardErrorPath</key>
  <string>$root/.claude/watcher/launchd.log</string>
</dict>
</plist>
PLIST

plutil -lint "$plist" >/dev/null
chmod +x "$root/.claude/watcher/run-watcher.sh"

# bootout avant bootstrap : recharge propre si une version tournait déjà.
launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$plist"

echo "Agent installé : $plist"
echo "Dossiers surveillés :"
printf '%s' "$watch_entries" | sed 's/.*<string>/  /; s/<\/string>//'
echo
echo "Log : $root/.claude/watcher/watcher.log"
