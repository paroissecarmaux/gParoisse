# Audit gParoisse — état des lieux (v2, après V6.0/V6.1)

Date : 2026-09-13 (mise à jour du premier audit, après exécution de V6.0 — nettoyage git — et V6.1 — couche repository/logger).
Portée et méthode identiques au premier audit : lecture du code réel, vérifications `grep` ciblées, vérification en direct de l'état git/GitHub. Rien n'est supposé sans être vérifié dans le code ou dans l'état réel du dépôt à l'instant de l'audit.

Ce document ne traite d'aucune question de migration technologique (TypeScript ou autre) : uniquement l'état du code existant, ses points d'amélioration et les évolutions envisageables sur cette même base HTML/CSS/JS vanille.

---

## Ce qui a changé depuis le premier audit

- **`membreParoisse.csv`/`.xlsx` ne sont plus suivis par git** et ne sont plus présents dans le commit `HEAD` du dépôt distant (vérifié : `origin/main` contient bien les commits qui les retirent). **Mais** ils restent lisibles dans l'historique plus ancien du dépôt (commits `bf14e1b`, `628bd2d`), et **le dépôt GitHub est toujours public** (revérifié à l'instant via l'API GitHub : `"private": false`). Le risque est donc réduit (plus de nouvelle fuite à chaque futur commit) mais pas éliminé (l'historique reste consultable par quiconque clone le dépôt).
- **Une couche repository existe désormais** (`js/repositories/*.js`) et les 7 modules métier (`requests`, `people`, `schedule`, `clochers`, `personnel`, `intentions`, `settings`) l'utilisent systématiquement — plus aucun appel direct `db.<table>.xxx` en dehors de cette couche (vérifié par recherche exhaustive ; seul `db.open()` reste dans `main.js`, ce qui est normal, c'est l'ouverture de connexion, pas un accès table).
- **Un logger centralisé existe** (`js/core/logger.js`) et remplace tous les `console.error(err)` bruts dans les 7 modules.
- **`js/core/errors.js`** (`ValidationError`, `NotFoundError`) existe mais n'est encore utilisé nulle part — préparation pour une validation plus formelle, sans effet aujourd'hui.

Tout le reste ci-dessous a été revérifié dans le code à l'instant présent, pas recopié du premier audit.

---

## Points critiques restants

1. **Historique git public contenant des données réelles.** Toujours vrai (voir plus haut). Seule une réécriture d'historique (ou le passage du dépôt en privé) referme complètement ce risque — ni l'un ni l'autre n'a été fait.
2. **Suppression sans nettoyage de références.** Revérifié : `deletePerson`, `deleteClocher`, `deletePersonnel` (dans `people.js`, `clochers.js`, `personnel.js`) suppriment l'enregistrement sans jamais parcourir `requests`/`schedule`/`intentions` pour détacher les `personId`/`clocherId`/`personnelId` qui pointent vers lui. Une intention liée à un clocher supprimé affiche un champ « Lieu » vide sans explication (`intentions.js`, `ficheField("Lieu", linkedClocher ? … : "")`).
3. **Aucun test automatisé.** Toujours aucun fichier de test, aucun outil de test, dans le dépôt.

## Points importants restants

4. **Historique/audit limité aux Demandes.** `addHistory()`/`HistoryRepository` ne sont appelés que depuis `requests.js`. Aucune trace de qui a modifié une Personne, un Clocher, une Intention, une fiche Personnel, ni quand.
5. **Aucune corbeille.** Toute suppression (6 fonctions `deleteX`) est définitive immédiatement après un `window.confirm()` texte. `archived`/`active` existent comme statuts métier mais pas comme mécanisme générique de corbeille, et n'existent pas du tout sur `people`/`intentions`.
6. **Rapport d'import CSV toujours agrégé.** `importPeopleCSV` et `importModuleCSVFile` ne renvoient qu'un compteur global (« X importé(s) · Y ligne(s) ignorée(s) »), sans indiquer quelle ligne ni pourquoi — vérifié inchangé.
7. **Format de sauvegarde JSON non versionné/validé à l'import.** `exportJSON()` écrit `{app, version, exportedAt, settings, requests, …}` mais `importFile()` ne lit ni ne vérifie jamais ce champ `version` à la réimportation — un fichier corrompu ou d'un format totalement différent est accepté tant qu'il expose par hasard un champ `requests`/`people`/etc.
8. **Recherche globale incomplète.** `js/search.js` couvre Personnes, Demandes, Intentions, Personnel, Clochers — toujours pas les Annonces (`schedule`) ni l'Agenda.
9. **Merge d'import = nouvel ID plutôt que mise à jour.** En mode fusion, un `id` déjà existant est régénéré (`item.id = uid()`) au lieu d'écraser/fusionner l'enregistrement existant — comportement inchangé, potentiellement surprenant.

## Points moyens / mineurs (inchangés, revérifiés)

- Nommage incohérent entre modules similaires : `status` (Demandes, anglais) vs `statut` (Intentions, français) ; `active` désigne trois statuts métier différents selon le module (Annonces/Clochers/Personnel) sans vocabulaire commun.
- Fonctions `showXDetail()` longues (~100-160 lignes), mélangeant règles métier et gros blocs HTML — dupliquées de façon quasi identique dans 6 fichiers.
- Recherche en `O(n)` recalculée à chaque frappe dans `clocherSuggestions`/`personnelSuggestions` (avec debounce, donc sans impact perceptible au volume actuel) — seul `people.js` précalcule un index de recherche (`_search`/`_sortKey`) à `loadPeopleData()`.
- `document.write()` dans `openPrintWindow()` (`people.js`) — API dépréciée, sans risque XSS avéré (contenu déjà échappé), mais à moderniser un jour.
- `sw.js` : versionnage du cache toujours manuel (`CACHE_NAME`), pas d'automatisation, mais fonctionne correctement (revérifié : `PRECACHE_URLS` inclut bien tous les nouveaux fichiers `core/`/`repositories/` ajoutés en V6.1).

## Sécurité — reconfirmé

- Aucune faille XSS trouvée : toute valeur utilisateur insérée via `innerHTML` passe par `escapeHTML()` (revérifié sur les 7 modules métier). Pas d'`eval`, pas de `Function()`, pas de `localStorage`/`sessionStorage`.
- L'export JSON reste un fichier texte clair, non chiffré — cohérent avec l'esprit « simple, local », mais à rappeler clairement à l'utilisateur (déjà fait dans les Paramètres via la bannière de sauvegarde).

---

## Points d'amélioration (par ordre de priorité)

1. **Décider du sort de l'historique git public** (dépôt privé, ou réécriture d'historique) — la seule action qui referme réellement le risque de fuite de données.
2. **Nettoyer/avertir sur les références orphelines à la suppression** — au minimum, avertir l'utilisateur (« 3 demandes et 1 intention sont liées ») avant de supprimer une Personne/un Clocher/un Personnel.
3. **Généraliser l'historique** à Personnes, Clochers, Personnel, Intentions, Annonces via `HistoryRepository` (déjà en place, il suffit d'appeler `addHistory`-équivalent depuis chaque `saveX`/`deleteX`).
4. **Ajouter une corbeille générique** (`deletedAt` par table) plutôt qu'une suppression immédiate partout.
5. **Détailler le rapport d'import CSV** ligne par ligne (numéro de ligne + raison de l'échec) plutôt qu'un compteur agrégé.
6. **Valider le format de sauvegarde JSON à l'import** (vérifier un champ de version explicite, rejeter un fichier qui ne correspond pas, plutôt que d'accepter silencieusement n'importe quel JSON).
7. **Étendre la recherche globale** aux Annonces (ajout mécanique à `GLOBAL_SEARCH_SOURCES`).
8. **Premiers tests automatisés** sur les fonctions déjà pures et isolées (`utils.js`, `csv.js`, logique de dates récurrentes, `normalizeRequest`) — aucune architecture supplémentaire requise pour commencer.
9. **Utiliser `ValidationError`/`NotFoundError`** (déjà créées, encore inutilisées) dans les fonctions `saveX`/`deleteX` pour distinguer un rejet de validation d'une erreur technique inattendue.
10. **Uniformiser le vocabulaire** `status`/`statut` et le sens du champ `active` selon un même schéma dans les prochains modules.

## Évolutions possibles (fonctionnelles, au-delà du nettoyage)

- **Dossiers/étapes configurables** sur une Demande (ex. baptême : premier contact → documents → date confirmée → célébration → certificat), sans imposer un workflow figé — un champ optionnel `etapes[]` suffirait, absent = comportement actuel inchangé.
- **Rappels de sauvegarde plus actifs** : au-delà de la bannière déjà en place (>7 jours), une invite plus visible ou périodique tant qu'aucune sauvegarde récente n'existe.
- **Export chiffré optionnel** (mot de passe) pour le fichier JSON, si le transport de la sauvegarde sur clé USB/cloud personnel est jugé sensible.
- **« Enregistrer et créer une autre »** (déjà présent sur Personnes/Intentions) étendu à Annonces/Clochers/Personnel pour la saisie en série.
- **Rapprochement de doublons** dans l'annuaire Personnes (import CSV notamment) : détection de noms très proches pour proposer une fusion plutôt que deux fiches.
- **Vue « dossiers incomplets »** sur le Tableau de bord si des étapes configurables (ci-dessus) sont introduites.
- **Association bidirectionnelle plus riche** : actuellement une Intention/Demande référence une Personne, mais une fiche Personne ne montre que les Demandes liées (pas encore les Intentions, alors que `intentions.personId` existe déjà) — petit ajout d'affichage, aucune nouvelle donnée nécessaire.
