---
name: mii
description: Reporte dans le dashboard un Mii créé dans l'Atelier Mii — un lien contenant « #mii?nom=… » que quelqu'un a envoyé. À utiliser quand l'utilisateur colle un tel lien, dit « nouveau Mii », « mets à jour le Mii de … », ou /mii.
---

# Reporter un Mii de l'Atelier dans le dashboard

L'Atelier Mii du dashboard enregistre les retouches sur l'appareil de la
personne, et c'est tout ce qu'il peut faire : le site est statique. Pour que
tout le monde voie le nouveau Mii, il faut l'écrire dans `RUNNER_MII` de
`data.js`. La personne a envoyé un lien ; ce lien contient tout.

1. **Reporter le lien** — l'outil valide chaque option contre ce que `app.js`
   sait dessiner et réécrit la seule ligne concernée :

   ```bash
   node .claude/tools/mii.js '<le lien, entre apostrophes>'
   ```

   Il affiche la ligne avant / après. `=` veut dire que ce Mii est déjà en
   place : rien à commiter. Un `✗` (option inconnue, coureur absent) : le lien
   est abîmé ou tronqué — redemande-le plutôt que de deviner la valeur.

2. **Bumper le cache-busting** — `?v=N` → `N+1` sur les quatre références de
   `index.html`, sinon personne ne verra le changement.

3. **Vérifier** — `node .claude/tools/verifier.js`, qui contrôle aussi chaque
   Mii (couleurs, coupe, lunettes, barbe). Sortie 1 = ne commite pas.

4. **Commit & push**, sans demander :

   ```bash
   git add -A && git commit -m "Update <Coureur>'s Mii" && git push
   ```

Plusieurs liens à la fois : lance l'outil pour chacun, puis un seul bump, une
seule vérification et un seul commit.

Le dépôt est public, mais un Mii ne dit rien de plus que ce que la personne a
choisi de montrer sur le dashboard : pas de précaution particulière.
