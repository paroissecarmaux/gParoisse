# Sauvegarde et restauration

## Ce que le stockage local n'est pas

Les données vivent **uniquement dans IndexedDB, dans ce navigateur, sur cet appareil**. Ce n'est pas une sauvegarde : perdre ou réinitialiser l'appareil, changer de navigateur, ou vider les données du navigateur perd tout, sans recours. Seul un **export JSON enregistré ailleurs** (clé USB, autre ordinateur, cloud) protège contre cette perte. Ce message est affiché explicitement dans Paramètres (renforcé en V6.5).

## Format de sauvegarde JSON (V6.3)

```js
{
  "format": "gparoisse-backup",
  "formatVersion": 1,
  "appVersion": "6.3.0",
  "databaseVersion": 10,
  "createdAt": "2026-09-13T10:00:00.000Z",
  "settings": { "parishName": "...", "lastBackup": "...", "theme": "light" },
  "data": {
    "requests": [ /* ... */ ],
    "people": [ /* ... */ ],
    "schedule": [ /* ... */ ],
    "clochers": [ /* ... */ ],
    "personnel": [ /* ... */ ],
    "intentions": [ /* ... */ ],
    "history": [ /* ... */ ]
  }
}
```

Écrit par `exportJSON()` (`js/settings.js`). Chaque tableau sous `data` contient **actifs et corbeille confondus** (`allRecordsFor()` — sinon un export perdrait silencieusement tout ce qui est en corbeille). `history` est l'intégralité du journal d'audit (V6.2.c) — sans lui, une restauration perdrait tout l'historique.

`appVersion`/`databaseVersion` sont indicatifs (diagnostic humain), **jamais utilisés comme critère de validation** — seuls `format` et `formatVersion` le sont.

## Validation stricte à l'import

`detectBackupPayload(parsed, moduleKeys)` (`js/core/backup.js`) reconnaît trois formes et rejette tout le reste avec un message explicite (`ValidationError`) :

1. **Format structuré actuel** (V6.3+) : `parsed.format === "gparoisse-backup"` et `parsed.formatVersion === 1` obligatoires ; `parsed.data` doit être un objet. Toute autre valeur de `format` ou `formatVersion` est rejetée avec un message nommant la valeur reçue.
2. **Ancien format plat** (V6.0 à V6.2.c) : les tables étaient directement au premier niveau de l'objet (`{ app, version, exportedAt, requests: [...], ... }`, sans `format`/`formatVersion`). Reconnu **seulement** s'il porte au moins une des clés de module attendues (`requests`, `people`, …) sous forme de tableau — pas n'importe quel JSON qui contiendrait par hasard un champ du même nom.
3. **Tout premier format** (avant V6.0) : un tableau JSON brut, interprété comme une liste de demandes.

Un fichier qui ne correspond à aucune de ces trois formes est rejeté avec « Fichier de sauvegarde invalide : aucune donnée reconnue dans ce fichier. » plutôt qu'importé silencieusement à moitié.

## Import : fusionner ou remplacer

`importFile()` (`js/settings.js`), deux modes choisis par l'utilisateur :

- **Fusionner** : les enregistrements importés dont l'id existe déjà (actif ou en corbeille) reçoivent un nouvel id (`uid()`) pour ne rien écraser — sauf pour `history`, dont les entrées sont réécrites à l'identique en cas de collision (ré-importer deux fois la même sauvegarde est sans effet, pas une duplication).
- **Remplacer** : confirmation explicite, vide entièrement les 6 tables métier et `history` avant d'écrire les données importées.

Dans les deux cas, un fichier sans `deletedAt` sur un enregistrement (toute sauvegarde antérieure à V6.2.c) l'importe comme **actif** — comportement par défaut raisonnable, jamais un rejet.

## Export/import CSV (par module)

Indépendant du format de sauvegarde JSON ci-dessus : `exportModuleCSV(key)`/`importModuleCSVFile(file)` (`js/settings.js`) travaillent un module à la fois, colonnes déclarées dans `DATA_MODULES[i].csvFields`. Les modules ayant leur corbeille implémentée (tous depuis V6.2.c) portent une colonne `deletedAt` — une cellule vide ou une colonne absente (ancien CSV) est traitée comme actif.

Le module Personnes a en plus un import CSV **spécifique** (`importPeopleCSV()`, bouton dédié sur la page Personnes) pour ingérer un registre paroissial existant avec ses propres intitulés de colonnes (`CSV_FIELD_MAP`) — un import unidirectionnel de création, sans rapport avec le mécanisme générique `DATA_MODULES`.

## Ce qui n'est pas fait

- Pas de sauvegarde automatique périodique ni de synchronisation — chaque export est une action manuelle.
- Pas de chiffrement du fichier exporté : un export JSON/CSV contient des données personnelles en clair (voir `docs/RGPD.md`, `docs/SECURITY.md`) — à protéger comme tel une fois hors de l'application.
- Aucun test manuel en navigateur du cycle export → réimport n'a été exécuté au moment de l'implémentation de V6.3 (pas d'environnement navigateur disponible) — à faire avant mise en production (voir `docs/V6.2-C-IMPLEMENTATION.md` et `docs/ROADMAP.md`).
