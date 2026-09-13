# Architecture

## Principe fondateur : zéro build, zéro serveur

gParoisse est une application HTML/CSS/JS **vanilla**, sans framework, sans bundler, sans étape de compilation. `index.html` peut s'ouvrir directement dans un navigateur (double-clic, `file://`) ou être servi statiquement — les deux fonctionnent, avec une nuance : les Service Workers (voir `sw.js`) ne s'activent que sur `http(s)://`, jamais sur `file://` (limitation du navigateur, pas de l'application — `js/main.js` le détecte et n'essaie pas de s'enregistrer sur `file://`).

Aucune donnée ne quitte l'appareil : pas de backend, pas d'API distante, pas de télémétrie. Toutes les données vivent dans IndexedDB, via [Dexie.js](https://dexie.org/) (vendored dans `js/vendor/dexie.min.js`, jamais installé via npm — il n'y a pas de `package.json`).

Cette contrainte « zéro build » est délibérée et structure toutes les décisions ci-dessous (pas de modules ES importés dynamiquement, pas de TypeScript compilé, chaque fichier chargé via une balise `<script>` classique dans un ordre précis).

## Ordre de chargement des scripts

`index.html` charge les scripts dans cet ordre (chacun définit des globales lues par les suivants — pas de modules ES, l'ordre est significatif) :

1. `js/vendor/dexie.min.js` — la librairie IndexedDB.
2. `js/db.js` — schéma Dexie (voir `docs/DATABASE.md`).
3. `js/constants.js` — vocabulaire métier partagé (types de demande, statuts, libellés…).
4. `js/utils.js` — fonctions pures partagées (`$`/`$$`, dates, `normalize`/`escapeHTML`, pagination, autocomplete, corbeille — `isActive`/`isDeleted`/`findLinked`/`linkedRecordFieldHTML`).
5. `js/icons.js` — helper `icon(name)` référençant le sprite SVG défini en tête de `index.html`.
6. `js/csv.js` — parsing CSV et dates (générique, réutilisé par tous les imports CSV).
7. `js/core/errors.js`, `js/core/logger.js`, `js/core/backup.js` — petites briques transverses, indépendantes des modules métier (voir sections dédiées ci-dessous).
8. `js/repositories/*.js` — une fine enveloppe par table Dexie (voir « Couche repository »).
9. `js/core/history.js` — historique généralisé, dépend des repositories.
10. `js/state.js` — état partagé en mémoire (`state`) et navigation (`showPage`).
11. Un fichier par module métier : `requests.js`, `people.js`, `schedule.js`, `clochers.js`, `personnel.js`, `intentions.js`, puis `trash.js` (vue Corbeille agrégée).
12. `overview.js`, `agenda.js` — vues transverses qui lisent l'état déjà chargé par les modules précédents.
13. `settings.js` — paramètres, sauvegarde/restauration, export/import CSV.
14. `search.js` — recherche globale (palette de commandes).
15. `main.js` — point d'entrée : câble les événements de chaque module puis charge les données (`init()`).

`sw.js` maintient sa propre liste `PRECACHE_URLS`, tenue manuellement synchronisée avec cette liste de balises `<script>` (vérifié par recoupement à chaque changement de fichier chargé).

## État partagé (`js/state.js`)

Un unique objet `state` tient toutes les données en mémoire : `state.requests`, `state.people`, etc. (actifs) et leurs pendants `state.XTrash` (corbeille, depuis V6.2.c), plus l'état de navigation/UI (page courante, filtres, pagination). Chaque module métier a son `loadXData()` qui peuple `state.X`/`state.XTrash` depuis Dexie au démarrage et après chaque écriture — le reste du code (rendu de liste, KPI, autocomplete, recherche globale, agenda) **lit uniquement `state.X`**, jamais Dexie directement. C'est le point de centralisation qui garantit qu'un élément en corbeille disparaît automatiquement de partout sans logique dispersée (voir `docs/V6.2-C-IMPLEMENTATION.md`).

`showPage(page)` gère la navigation plein-écran entre les `.view-page` (bascule `hidden`, met à jour la sidebar active, referme la sidebar mobile, et depuis V6.5 déplace le focus clavier sur le titre de la page affichée — accessibilité).

## Couche repository (`js/repositories/`)

Une enveloppe par table Dexie (`RequestsRepository`, `PeopleRepository`, …), créée par la factory commune `repositoryFactory.js` : `list()`, `get(id)`, `put(record)`, `remove(id)`, `bulkPut(records)`, `clear()`, plus (depuis V6.2.c) `listActive()`/`listDeleted()` — un filtre en mémoire sur `list()`, pas une requête Dexie indexée (voir `docs/DATABASE.md`). Introduite en V6.1 pour isoler les appels `db.<table>.xxx` du reste du code ; aucune logique métier n'y vit, seulement de la persistance.

## `js/core/` — briques transverses

- **`errors.js`** : `ValidationError`/`NotFoundError`, une hiérarchie minimale pour distinguer une erreur de validation (message déjà présentable à l'utilisateur) d'une erreur inattendue.
- **`logger.js`** : `Logger.error(context, err)`/`Logger.warn(context, message)` — ne journalise jamais un enregistrement métier complet, seulement un contexte et un message technique (voir `docs/SECURITY.md`).
- **`history.js`** : historique généralisé (`addHistory`, `relatedHistoryFor`, `historySectionHTML`) partagé par les 6 modules métier depuis V6.2.c.
- **`backup.js`** : détection/validation du format de sauvegarde JSON (`detectBackupPayload`), isolé de `settings.js` pour rester testable sans charger les 6 modules métier (voir `docs/BACKUP.md`).

## Modules métier

Chaque module (`requests.js`, `people.js`, `schedule.js`, `clochers.js`, `personnel.js`, `intentions.js`) suit le même schéma :

- `loadXData()` — charge `state.X`/`state.XTrash` depuis le repository.
- `renderXList()`/`renderXSummary()` — rendu de liste et KPI, à partir de `state.X` uniquement.
- `showXDetail(id)`/`showXForm(id)` — pages plein-écran (fiche, formulaire), avec un `historySectionHTML()` sur les fiches détail.
- `saveX(e)` — création/modification, journalise dans l'historique.
- `trashX(id)`/`restoreX(id)`/`purgeX(id)` — corbeille (V6.2.c) : jamais de suppression Dexie réelle hors `purgeX`.
- `initXEvents()` — câblage des écouteurs DOM du module, appelé une fois depuis `main.js`.

`trash.js` agrège les 6 `state.XTrash` dans une vue Corbeille unique plutôt que 6 vues séparées (voir `docs/V6.2-C-IMPLEMENTATION.md` pour la justification).

## PWA (`sw.js`, `manifest.json`)

Un Service Worker minimal (cache-first sur les assets précachés, réseau sinon) permet l'installation en PWA et un fonctionnement hors-ligne une fois l'app chargée au moins une fois via `http(s)`. `CACHE_NAME` est incrémenté à chaque changement de la liste de fichiers précachés, pour forcer le renouvellement du cache.

## Ce que cette architecture ne fait pas (délibérément)

- Pas de couche « service »/« events » séparée des modules UI tant qu'aucun besoin concret ne l'a justifiée.
- Pas de validation de schéma runtime (ex. JSON Schema) — la validation reste ad hoc par fonction (`isValid`, `ValidationError`).
- Pas de transaction Dexie explicite (voir `docs/V6.2-C-IMPLEMENTATION.md` §6 pour la décision et sa justification détaillée).
- Pas de TypeScript (voir `docs/ROADMAP.md`, section dédiée : position documentée, pas une migration).
