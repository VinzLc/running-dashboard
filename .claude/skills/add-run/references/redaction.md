# Rédiger l'analyse et attribuer le Pokémon

Le savoir-faire d'écriture du dashboard. À lire **avant** d'écrire quoi que ce
soit dans `ANALYSES` — la procédure d'intégration, elle, est dans `SKILL.md`.

Une analyse réussie tient en deux qualités : elle est **juste** (chaque chiffre
est vérifiable dans `RUNS`, chaque conseil découle des données) et elle est
**lue** (paragraphes courts, ton adapté à la personne, une vanne pour finir).

## 1. La forme : des paragraphes titrés, jamais un pavé

`text` est un **tableau** de `{ titre, texte }` — une entrée = un intertitre et
son paragraphe :

```js
text: [
  { titre: "Sorti de la boucle des 5 km", texte: "Le constat chiffré du jour…" },
  { titre: "Le départ payé sur quatre kilomètres", texte: "Ce que disent les splits…" },
  { titre: "La sortie lente, troisième rappel", texte: "Le conseil pour la prochaine…" },
],
```

- **Une idée par paragraphe**, 2 à 4 phrases. Deux paragraphes pour une séance
  ordinaire, 4 à 6 pour une grosse séance à commenter. Au-delà de ~700
  caractères, `verifier.js` réclame une coupe — et il a raison.
- **L'ordre naturel** : constat → explication → conseil. Le lecteur qui
  s'arrête au premier paragraphe doit déjà savoir ce qui s'est passé.
- Une analyse de deux phrases reste un tableau à un seul élément — titré quand
  même.

### Écrire les titres

Le titre est ce qu'on lit en diagonale : il doit **dire quelque chose**, pas
étiqueter. « Le point à surveiller » vaut mieux que « Analyse » ; « 45 secondes
en quatre jours » vaut mieux que « Progression ».

- **Court** : 2 à 6 mots, 45 caractères maximum (au-delà il passe sur deux
  lignes et perd son rôle de repère).
- **Concret** : un chiffre ou un fait de la séance quand c'est possible —
  « 157 bpm, le prix payé », « 17 s/km en dix-sept jours ».
- **Jamais le verdict recopié** : le verdict s'affiche déjà juste au-dessus, en
  vert. Le titre apporte un autre angle. `verifier.js` signale le doublon.
- **Pas de guillemets droits** (`"`), comme partout ailleurs dans `data.js`.

## 2. Le fond : n'affirme que ce qui est mesuré

- **Compare uniquement aux séances précédentes du MÊME coureur.** Jamais Vincent
  contre Anaïs : ce dashboard n'est pas un classement.
- **Cite des chiffres réels** et les écarts. « 9 s/km de mieux que le 1er août »
  vaut mieux que « belle progression ».
- **Sans FC ni cadence** (Didi, sur adidas Running), l'adaptation aérobie n'est
  pas observable : appuie-toi sur l'allure, la régularité d'une sortie à l'autre,
  le temps de pause, la vitesse de pointe. Quand le parcours est identique à
  chaque fois, le chrono devient la mesure la plus honnête qui soit — dis-le.
- **N'invente aucun contexte personnel.** Pour quelqu'un dont on ne connaît ni
  l'âge ni le passé sportif, tiens-t'en aux chiffres. Évite aussi les accords
  qui présument du genre (« ton allure est passée de… » plutôt que
  « tu es passé·e de… ») tant que la personne ne l'a pas indiqué.
- Les écarts vs séance précédente, les badges « Record » et le graphique des
  splits sont **générés en JS** : inutile de les recopier, tu peux les commenter.

### Les splits, c'est là que tout se joue

Les moyennes cachent l'essentiel. Une séance avec splits se commente sur :

- **la gestion de l'effort** — écart entre le 1er et le dernier kilomètre
  complet. Le positive split marqué (départ trop rapide, fin qui s'écroule) est
  le défaut n°1 du débutant, et le conseil le plus utile qu'on puisse donner ;
- **la dérive cardiaque** — la FC monte-t-elle à allure constante ?
- **la tenue de la foulée** — la cadence s'effondre-t-elle sur la fin ?
- **le suivi** — compare aux splits des séances précédentes : le conseil déjà
  donné a-t-il été appliqué ? Le redire une troisième fois, en le disant, a plus
  d'effet que de le formuler à neuf.

## 3. Le ton : il change selon qui lit

| Coureur | Ce qu'il faut viser |
|---|---|
| **Vincent** | L'auteur du dashboard : il lit tout, y compris les analyses des autres. Franchise sur les points à corriger. |
| **Anaïs** | Veut des **axes d'amélioration concrets** et aime les analyses poussées : creuse les splits, la dérive cardiaque, la tenue de cadence. Termine toujours par la consigne suivante, précise. Elle ne court jamais seule — ses séances sont celles de Vincent. |
| **Didi** | **A besoin d'encouragement.** Son objectif est de retrouver son niveau d'avant, et c'est atteignable : dis-le, chiffres à l'appui. Insiste sur ce qui remonte. |
| **Ju** | Le grand frère, compétiteur : il donnera tout dès qu'il sentira le duel. Joue là-dessus, et surtout **fais-le rire**. |

Les éléments personnels qui nourrissent les vannes (surnoms, animaux, goûts
musicaux, références de jeux) sont dans **`.claude/profils-coureurs.local.md`** —
non commité, **parce que ce dépôt est public**. Lis-le s'il est là.

> ⚠️ Ce qui est écrit dans `data.js` **devient public**. Une référence complice à
> un chat ou à un groupe de metal passe très bien ; nommer un conjoint, un
> employeur ou une adresse, non — sauf accord explicite de Vincent.

## 4. Le Pokémon : une section 100 % humoristique

Le dashboard affiche le sprite, le nom, l'adjectif et la vanne. **Aucun rang,
aucune statistique** : le lecteur n'a pas besoin d'un classement pour comprendre
la blague. **Le gag prime sur tout le reste.**

**Commence par lancer l'outil** — il donne les Pokémon déjà pris, les adjectifs
libres et la zone de vitesse du jour :

```
node .claude/tools/pokedex.js Vincent
```

1. **Cherche la blague d'abord.** Une chaîne d'évolution qui suit la progression
   (Chenipan → Papilusion pour le premier 5 km, Goupix → Feunard), un trait de
   caractère qui colle à la séance (Ronflex pour une sortie volontairement lente,
   Psykokwak pour un coup de mou, Kicklee qui n'est littéralement que deux
   jambes, Canarticho pour 4 minutes de pause au milieu d'un 5 km).

2. **La zone de vitesse n'est qu'un repère.** Électrode, le plus rapide des 151,
   a été attribué à une séance partie trop vite et explosée en vol : son attaque
   signature s'appelle Explosion. Un bon gag justifie n'importe quel écart.

3. **Un Pokémon ne sert qu'une fois par coureur** — chacun se constitue son
   propre Pokédex, et une évolution ne peut donc pas revenir en arrière. En
   revanche **le même Pokémon peut servir à plusieurs personnes** : les Pokédex
   sont indépendants.

4. **L'adjectif** (`pokemonAdj`) personnalise la créature : « Persian Impérial »,
   « Canarticho Distrait ». Palette dans `POKEMON_ADJECTIFS` (`pokemon.js`), mais
   en inventer un est encouragé s'il fait mieux rire — ajoute-le alors à la
   palette. **Toujours au masculin** (on dit « le Pokémon »), **jamais deux fois
   le même chez un coureur**.

5. **`pokemonPhrase`** : une à trois phrases qui relient le Pokémon à la
   performance du jour avec un chiffre réel, **et qui justifient l'adjectif**.

### Le piège : la justification qui se répète

L'erreur classique est de rejouer la même formule dans la phrase et dans la
justification. `verifier.js` la signale, mais autant l'éviter d'emblée :

> ❌ Persian : […] Troisième record d'affilée **sans jamais dépasser 11,2 km/h**,
> c'est la classe à la Persian. Impérial, parce que trois records d'affilée
> **sans jamais dépasser 11,2 km/h**, c'est la démarche de quelqu'un qui…

> ✅ Persian : rapide, silencieux, et absolument pas du genre à se donner en
> spectacle. Troisième record d'affilée sans jamais dépasser 11,2 km/h, c'est la
> classe à la Persian. Impérial, parce que **gagner sans même avoir besoin
> d'accélérer**, c'est la démarche de quelqu'un qui sait qu'on le regarde.

La justification apporte un **angle neuf** sur la même séance : si elle ne peut
que paraphraser, c'est l'adjectif qu'il faut changer.

### Contrainte technique

**Pas de guillemets droits** dans les chaînes (`"`) — ils cassent le littéral JS.
Utilise « » ou rien. Les apostrophes droites, elles, ne posent aucun problème.
