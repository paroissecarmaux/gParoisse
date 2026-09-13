# Base de données (IndexedDB via Dexie)

## Règle absolue : additif uniquement

Chaque évolution du schéma ajoute un nouveau `db.version(N).stores({...})` dans `js/db.js` — **jamais de modification rétroactive d'une version existante**. Dexie exige que chaque bloc `version()` liste l'intégralité des tables (pas seulement celles qui changent), mais cela ne veut pas dire que tout change : une table peut réapparaître à l'identique d'une version à l'autre simplement parce qu'une *autre* table du même bloc a changé.

La chaîne de caractères par table n'énumère que les champs **indexés** (recherchables/triables via Dexie). Un enregistrement peut porter n'importe quel autre champ non listé — stocké normalement, simplement non indexable par une requête Dexie. C'est ce qui permet d'ajouter des champs (`deletedAt`, etc.) sans jamais changer de version quand aucune requête indexée n'en a besoin.

## Historique des versions

| Version | Ajout |
|---|---|
| 5 | Version initiale : `requests`, `history` (avec `requestId`), `settings`. |
| 6 | `people` (annuaire des personnes). |
| 7 | `schedule` (horaires récurrents et annonces ponctuelles de l'agenda). |
| 8 | `clochers` (référentiel des lieux/églises de la paroisse). |
| 9 | `personnel` (bénévoles/salariés/clergé) et `intentions` (intentions de messe). |
| 10 | Corbeille + historique généralisé (V6.2.c) : `history` gagne `entityType`/`entityId` (indexés). `deletedAt` existe désormais sur les 6 tables métier mais **n'est pas indexé** — aucune chaîne d'index n'a donc changé pour ces tables à cette version. |

Aucune version n'a jamais retiré ou renommé un champ existant.

## Tables actuelles (v10)

```js
requests:   "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name"
history:    "id, requestId, entityType, entityId, createdAt"
settings:   "key"
people:     "id, nom, prenom, updatedAt"
schedule:   "id, kind, dayOfWeek, date, updatedAt"
clochers:   "id, nom, commune, updatedAt"
personnel:  "id, nom, prenom, typeEngagement, active, updatedAt"
intentions: "id, type, statut, dateDebut, updatedAt"
```

## Convention `deletedAt` (corbeille, V6.2.c)

Champ optionnel sur les 6 tables métier (`requests`, `people`, `schedule`, `clochers`, `personnel`, `intentions`) : absent ou `null` = actif ; une date ISO = mis à la corbeille à cette date. **Volontairement non indexé** — le volume de données réel d'un secrétariat paroissial (quelques milliers d'enregistrements au plus) rend un filtre en mémoire suffisant, et ajouter un index par table n'est pas justifié pour ce volume.

Filtrage : `XRepository.listActive()`/`listDeleted()` (dans `js/repositories/repositoryFactory.js`) filtrent en mémoire le résultat de `list()` — pas une requête Dexie séparée. `js/utils.js` fournit les fonctions pures `isActive(record)`/`isDeleted(record)` qui font le test lui-même (`Boolean(record?.deletedAt)`).

Cycle de vie d'un enregistrement :

1. **Actif → Corbeille** (`trashX(id)`) : `deletedAt = nowISO()`, `put()`. Jamais de suppression Dexie réelle.
2. **Corbeille → Restauré** (`restoreX(id)`) : `deletedAt = null`, `put()` sur le **même enregistrement, même id** — aucune recréation.
3. **Corbeille → Supprimé définitivement** (`purgeX(id)`) : seule étape qui appelle réellement `XRepository.remove(id)` (`db.table.delete()`). Uniquement accessible depuis la vue Corbeille (`js/trash.js`), jamais depuis une fiche active.

Voir `docs/V6.2-C-IMPLEMENTATION.md` pour le détail par module et la gestion des relations croisées (ex. une Demande qui référence une Personne mise à la corbeille).

## Table `history`

Journal d'audit généralisé (V6.2.c) : `{ id, entityType, entityId, action, description, createdAt }`, plus l'ancien champ `requestId` (conservé, indexé, non réécrit). Les entrées écrites avant V6.2.c (uniquement pour les demandes) n'ont pas `entityType`/`entityId` — elles restent en base telles quelles et sont interprétées **à la lecture seulement** (`js/core/history.js` : `historyEntityType`/`historyEntityId`) comme `entityType: "request"`, `entityId: requestId`. Jamais de migration rétroactive des entrées existantes.

`action` est un vocabulaire fermé par convention (pas une contrainte technique — voir `HISTORY_ACTIONS` dans `js/constants.js`) : `create`, `update`, `archive`, `restore`, `complete`, `trash`, `purge`. L'ancienne valeur `delete` (écrite avant la corbeille) reste lisible telle quelle.

Une entrée `history` **n'est jamais supprimée quand l'entité qu'elle décrit est purgée** — c'est le rôle d'un journal d'audit de survivre à l'entité qu'il décrit (décision documentée dans `docs/V6.2-C-DESIGN.md`).

## Relations entre tables

Aucune contrainte de clé étrangère Dexie (IndexedDB n'en a pas nativement) — les relations sont de simples champs id, vérifiées côté application :

| Champ | Table porteuse | Pointe vers |
|---|---|---|
| `personId` | `requests`, `intentions` | `people.id` |
| `clocherId` | `requests`, `schedule`, `intentions` | `clochers.id` |
| `personnelId` | `intentions` | `personnel.id` |

Mettre à la corbeille l'entité référencée **ne modifie jamais** l'enregistrement qui la référence (le champ id reste tel quel) — voir `findLinked()`/`linkedRecordFieldHTML()` dans `js/utils.js` pour l'affichage qui en résulte (actif/en corbeille/introuvable).

## Migration et sauvegarde

Une évolution de schéma Dexie n'a aucun rapport avec le format de sauvegarde JSON (voir `docs/BACKUP.md`) — l'un décrit la structure interne d'IndexedDB, l'autre un fichier exporté/importé par l'utilisateur. Le champ `databaseVersion` du format de sauvegarde (`db.verno`) est indicatif (diagnostic), jamais utilisé comme critère de validation à l'import.
