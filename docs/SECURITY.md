# Sécurité

## Modèle de menace : application locale, mono-utilisateur

gParoisse n'a ni serveur ni compte utilisateur ni réseau — tout vit dans IndexedDB, dans le navigateur, sur l'appareil du secrétariat. Il n'y a donc pas d'authentification, pas de session, pas de surface d'attaque réseau côté application elle-même. Les risques réels sont ailleurs :

- **Accès physique/logique à l'appareil** : n'importe qui utilisant ce navigateur sur cet appareil voit toutes les données (pas de verrouillage applicatif). La protection est celle de l'appareil (session utilisateur, verrouillage d'écran), pas de gParoisse.
- **Fichiers exportés** (sauvegarde JSON, exports CSV) : contiennent des données personnelles en clair une fois hors de l'application (voir `docs/RGPD.md`) — leur protection dépend entièrement de l'endroit où ils sont stockés ensuite (clé USB, cloud…).
- **Dépôt de code source** : voir « Confidentialité du dépôt GitHub » ci-dessous — c'est un risque distinct des données elles-mêmes, mais qui a concerné ce projet directement.

## Confidentialité du dépôt GitHub

**Historique de l'incident (V6.0, traité)** : des fichiers de données réelles (`membreParoisse.csv`/`.xlsx`) avaient été committés dans le dépôt. Actions de code effectuées et poussées :

- `git rm --cached` sur ces fichiers (retrait du suivi, sans toucher aux copies locales).
- `.gitignore` étendu pour exclure tout `*.csv`/`*.xlsx` et toute sauvegarde JSON exportée (`paroisse-sauvegarde-*.json`) — empêche une réintroduction accidentelle future.

**Décisions restées ouvertes, appartenant au propriétaire du dépôt** (jamais tranchées unilatéralement par l'assistant, et non retranchées depuis) :

1. **Rendre le dépôt privé** — au moment de la revue V6.0/V6.1 (vérifié via l'API GitHub à cette date), le dépôt était encore **public**.
2. **Réécrire l'historique git** pour purger les commits antérieurs (`bf14e1b`, `628bd2d` notamment) qui contiennent encore les fichiers de données — une opération destructive (force-push), à ne déclencher que sur demande explicite.

**Ce statut doit être revérifié périodiquement** — ce document n'affirme pas l'état actuel, seulement celui constaté à la dernière vérification documentée (voir `docs/REVIEW-V6.0-V6.1.md`).

## Journalisation (`js/core/logger.js`)

`Logger.error(context, err)`/`Logger.warn(context, message)` ne journalisent jamais un enregistrement métier complet — uniquement un contexte (ex. `"people.savePerson"`) et le message technique de l'erreur. Remplace les `console.error(err)` bruts d'avant V6.1, qui pouvaient exposer un objet contenant des champs personnels dans la console/les journaux du navigateur.

## Validation des entrées

- **Import CSV/JSON** : `ValidationError` (`js/core/errors.js`) pour toute donnée mal formée, avec un rapport d'import détaillé (`buildImportReportHTML`, V6.2.b) plutôt qu'un échec silencieux ou un import partiel non signalé.
- **Format de sauvegarde** : validation stricte du format/version avant tout import (voir `docs/BACKUP.md`) — rejette un fichier qui ne correspond à aucun format reconnu plutôt que de tenter de l'interpréter à l'aveugle.
- **Injection HTML** : tout contenu utilisateur inséré dans le DOM passe par `escapeHTML()` (`js/utils.js`) avant interpolation dans un template `innerHTML` — vérifié explicitement par un test (`buildImportReportHTML: échappe le contenu utilisateur`, `tests/pure-functions.test.js`).

## Ce qui n'est pas fait (et pourquoi, pour l'instant)

- **Pas de chiffrement au repos** dans IndexedDB — le navigateur ne le fait pas nativement, et l'ajouter demanderait de gérer une clé/mot de passe (expérience utilisateur et récupération en cas d'oubli non triviales) ; non fait tant qu'un besoin réel n'a pas été exprimé.
- **Pas de verrouillage applicatif** (mot de passe, PIN) — cohérent avec le modèle « un secrétariat, un appareil, un navigateur » ; à revisiter si l'usage change (plusieurs personnes sur le même appareil, appareil partagé).
- **Pas de purge automatique** de données anciennes — la corbeille (V6.2.c) est une suppression *manuelle en deux temps* (mise à la corbeille puis suppression définitive), jamais une expiration automatique.
