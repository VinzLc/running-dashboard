#!/usr/bin/env bash
# Source de vérité pour la liste des coureurs du dashboard, partagée par le hook
# de détection, le watcher launchd et son installateur. Ajouter un coureur =
# ajouter une ligne ici, rien d'autre côté scripts.
#
# Une ligne par coureur : <clé>|<glob du dossier>
#   clé  — préfixe utilisé dans .claude/captures-integrees.txt. Volontairement en
#          ASCII : le dossier « Anaïs » peut être encodé en NFC ou NFD selon la
#          machine, et une comparaison sur le nom réel échouerait de façon
#          intermittente.
#   glob — motif du dossier, résolu à l'exécution. C'est ce qui permet de
#          retrouver « Anaïs » sans dépendre de son encodage.
#
# Ce fichier est destiné à être sourcé, pas exécuté.

RUNNERS_SPEC='Vincent|Vincent
Anais|Ana*
Didi|Didi
Ju|Ju'

# Imprime « clé<TAB>dossier » pour chaque dossier de coureur réellement présent.
# $1 : racine du dépôt (défaut : répertoire courant).
#
# Le motif est résolu par `find -name` plutôt que par un glob du shell : zsh
# n'applique pas l'expansion de chemin au contenu d'une variable non quotée, là
# où bash le fait. Un simple `for d in $glob` marcherait donc dans les scripts
# (tous en bash) mais renverrait le motif littéral dès qu'on source ce fichier
# depuis un shell interactif zsh — un piège inutile.
runner_dirs() {
  local root="${1:-.}" key glob d
  while IFS='|' read -r key glob; do
    [ -n "$key" ] || continue
    while IFS= read -r d; do
      [ -n "$d" ] && printf '%s\t%s\n' "$key" "$d"
    done <<DIRS
$(find "$root" -maxdepth 1 -type d -name "$glob" 2>/dev/null | sort)
DIRS
  done <<SPEC
$RUNNERS_SPEC
SPEC
}
