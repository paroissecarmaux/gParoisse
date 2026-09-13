# Revue V6.0 / V6.1

Date : 2026-09-13. Méthode : lecture du code réel (pas de la roadmap seule), comparaison `git diff` ligne par ligne entre le dernier commit distant et l'état local, exécution réelle d'une suite de tests Node sur les fonctions pures concernées, vérifications croisées automatisées (ids, icônes, précache, équilibre des balises/accolades). Rien ci-dessous n'est une extrapolation de ce que la roadmap *dit* avoir été fait : chaque verdict est appuyé sur une preuve reproductible (commande exécutée, sortie observée).

## Résumé

V6.0 (nettoyage git) est **partiellement réalisée par conception** : les deux actions de code sont faites et déjà poussées sur `origin/main` ; les deux décisions qui vous appartiennent (dépôt privé, réécriture d'historique) restent explicitement en attente — ce n'est pas un défaut d'implémentation, la roadmap les avait sciemment laissées comme « votre décision ».

V6.1 (couche repository) était **incomplète** au moment où cette revue a commencé : un des quatre livrables prévus (`js/core/errors.js`) était créé mais jamais utilisé nulle part — les 6 `throw new Error(...)` génériques qu'il devait remplacer étaient toujours en place. **Corrigé pendant cette revue** (voir « Corrections effectuées »). Après correction, les quatre livrables de V6.1 sont vérifiés complets, et aucune régression n'a été trouvée : le diff exact entre l'ancien code et le nouveau ne contient que des substitutions mécaniques (`db.X.y()` → `XRepository.y()`, `console.error(err)` → `Logger.error(...)`), rien d'autre n'a changé.

Aucune donnée n'est en jeu dans ces deux phases : `js/db.js` (schéma Dexie) a un diff **strictement vide** entre le dernier commit distant et maintenant — vérifié par `git diff f497c73..HEAD -- js/db.js`. V6.0/V6.1 ne touchent ni aux tables, ni aux index, ni aux migrations.

## État Git

- Dernier commit sur `origin/main` (dépôt distant) : `f497c73 "supp csv"`.
- HEAD local : `8d1d1d9 "refactor: use repositories/Logger in settings.js"`, **8 commits d'avance**, aucun poussé.
- Les deux commits de nettoyage git (`8a0faa8`, `a08f60e`) qui composent le code de V6.0 sont **déjà sur `origin/main`** (poussés avant cette session, par vous ou une session précédente — hors de mon contrôle, simplement constaté).
- Les 8 commits locaux non poussés sont exactement les 8 commits de V6.1 (1 commit fondation + 1 commit par module migré), plus 2 commits ajoutés pendant cette revue (voir plus bas).
- Un changement non commité était présent en entrant dans cette session : `docs/AUDIT.md` (une mise à jour rédigée lors d'une session précédente, jamais commitée). Committé pendant cette revue sous `docs:`.
- Aucune commande destructive (`reset`, `checkout --`, `clean`) n'a été utilisée.

## V6.0

### Objectifs (d'après `docs/ROADMAP.md`)
1. Rendre le dépôt GitHub privé (ou décision consciente de le laisser public).
2. Retirer `membreParoisse.csv`/`.xlsx` du suivi git, commit dédié.
3. Décider si une purge d'historique est nécessaire.
4. Étendre `.gitignore`.

### Implémentation
- **#2 (retrait du suivi)** : vérifié — `git ls-files | grep membre` ne retourne plus rien ; les fichiers restent présents sur disque (`ls membreParoisse.csv` confirme leur existence locale, non supprimés par erreur).
- **#4 (.gitignore)** : vérifié — contient désormais `membreParoisse.csv`, `membreParoisse.xlsx`, `*.csv`, `*.xlsx`, `paroisse-sauvegarde-*.json`, `paroisse-*-*.csv`.
- **#1 et #3** : non faits, **et ce n'est pas une anomalie** — la roadmap les avait explicitement identifiés comme des décisions à votre charge, pas des tâches de développement. Revérifié à l'instant via l'API GitHub : le dépôt est toujours public (`"private": false`).

### Tests
- `git ls-files` (absence de suivi) : exécuté, confirmé.
- Contenu de `.gitignore` : lu directement, confirmé.
- Visibilité du dépôt : requête `GET /repos/paroissecarmaux/gParoisse` exécutée à l'instant, confirmé public.

### Problèmes
- Le dépôt distant contient toujours `membreParoisse.csv`/`.xlsx` dans son historique plus ancien (commits `bf14e1b`, `628bd2d`, toujours sur `origin/main` puisqu'aucune réécriture n'a eu lieu). Ce n'est pas un problème d'implémentation de V6.0 : c'est le point #3, resté volontairement en attente de votre décision.

### Verdict
**🟡 PARTIEL — par conception.** Les deux actions de code sont complètes et vérifiées. Les deux décisions qui vous appartiennent restent ouvertes ; tant qu'elles ne sont pas tranchées, le risque de confidentialité initial (historique public) n'est que partiellement réduit.

## V6.1

### Objectifs (d'après `docs/ROADMAP.md`)
1. Créer `js/repositories/` (un repository par table, méthodes `list/get/put/remove/bulkPut`).
2. Remplacer les appels directs `db.<table>.xxx` par `XRepository.xxx`, module par module, un commit par module.
3. Créer `js/core/errors.js` (`ValidationError`, `NotFoundError`) **pour remplacer les `throw new Error("texte")` génériques actuels**.
4. Créer `js/core/logger.js` et remplacer tous les `console.error(err)` existants.
5. Ne pas créer `js/core/events.js`/`js/services/` sans besoin concret.

### Implémentation
- **#1** : vérifié — `js/repositories/` contient `repositoryFactory.js` + 8 repositories (les 7 prévus par la roadmap, plus `settingsRepository.js` ajouté pour couvrir `db.settings`, qui était resté oublié dans le libellé de la roadmap alors que `loadSettings`/`saveSetting` y accédaient directement). Chacun expose bien `list/get/put/remove/bulkPut/clear`.
- **#2** : vérifié par recherche exhaustive — `grep -rn "\bdb\.[a-zA-Z]" js/` ne retourne plus aucun accès direct à une table en dehors de `js/db.js` et `js/repositories/*.js` ; seul `db.open()` subsiste dans `main.js` (légitime : ouverture de connexion, pas accès table). 8 commits, un par module, aucun ne mélange autre chose.
- **#3** : ⚠️ **incomplet au démarrage de cette revue.** `js/core/errors.js` existait, mais `grep -rn "ValidationError|NotFoundError" js/` (hors `errors.js` lui-même) ne retournait **aucun résultat** — la classe n'était utilisée nulle part, et les 6 `throw new Error("texte")` génériques dans `people.js`/`settings.js` (import CSV/JSON) étaient toujours en place. **Corrigé pendant cette revue.**
- **#4** : vérifié — `grep -n "console\.\(error\|warn\)" ` sur les 7 modules migrés ne retourne plus rien ; tous remplacés par `Logger.error("module.fonction", err)`.
- **#5** : vérifié — ni `js/core/events.js` ni `js/services/` n'existent. Bonne retenue, conforme.

### Tests
- **Exécutés réellement** (`node tests/pure-functions.test.js`, nouvellement créé pendant cette revue) : 31 assertions sur `computeAge`, `normalize`, `escapeHTML`, `addDays`/`daysBetween`, `sortByKey`, `paginate`, `parseCSV` (délimiteurs, guillemets, BOM, lignes vides), `parseFrenchDate` (jj/mm/aaaa, ISO, série Excel), `normalizeRequest` (id conservé, type/statut/priorité par défaut, rétrocompatibilité des anciens noms de champs), `scheduleOccursOn`, `intentionEndDate`/`intentionOccursOn` (neuvaine). **Résultat : 31/31 réussis** après correction d'un artefact du harnais de test lui-même (comparaison d'égalité stricte entre tableaux de deux « realms » JS différents à cause de `vm.createContext` — pas un bug du code source ; corrigé dans le test, documenté en commentaire dans le fichier).
- **Diff ligne à ligne** (`git diff f497c73..HEAD -- <les 7 fichiers>`, lignes filtrées pour ne garder que ce qui n'est ni un remplacement `Logger`/`Repository`/`ValidationError`) : **résultat vide** — chaque ligne supprimée est un appel `db.X.y()` ou un `console.error(err)` brut, chaque ligne ajoutée son équivalent repository/logger. Aucune autre modification n'a pu se glisser dans le refactor.
- **Non exécuté** : aucun test dans un vrai navigateur (pas d'outil de navigation disponible dans cet environnement). Les parcours UI (créer/modifier/supprimer une fiche via l'interface) n'ont donc pas été rejoués manuellement — à faire de votre côté avant de pousser.

### Problèmes
- (Résolu pendant cette revue) `ValidationError`/`NotFoundError` non utilisées.
- `js/repositories/settingsRepository.js` et le facteur partagé `repositoryFactory.js` ne figurent pas explicitement dans la liste de fichiers de `ROADMAP.md` (qui n'énumérait que 7 repositories sans `settings`, et ne mentionnait pas de fabrique commune). Ce n'est pas une erreur — `db.settings` avait bien besoin d'un repository et une fabrique de 10 lignes évite de dupliquer la même enveloppe 8 fois — mais la roadmap devrait être mise à jour pour refléter ce qui existe réellement (fait, voir plus bas).

### Verdict
**✅ COMPLET** (après les corrections apportées pendant cette revue). Les 5 objectifs de V6.1 sont désormais vérifiés implémentés, sans régression détectée par les moyens disponibles dans cet environnement (tests exécutés + diff exhaustif + cross-références statiques).

## Régressions

Aucune détectée. Preuves :
- 31/31 tests exécutés avec succès sur les fonctions les plus sensibles (dates, CSV, normalisation des demandes, récurrence).
- Diff exhaustif des 7 modules migrés : uniquement des substitutions attendues.
- Cross-référence automatique de tous les `id` HTML utilisés par `$("#...")` dans le JS : aucun manquant.
- Cross-référence de toutes les icônes appelées par `icon("...")` contre les symboles SVG déclarés : aucune manquante.
- Liste des `<script>` de `index.html` (29) comparée à `PRECACHE_URLS` de `sw.js` (29) : identiques des deux côtés.
- Équilibre des balises HTML (`div`/`section`/`form`/`select`/`label`/`button`/`script`) et des accolades CSS : tous équilibrés.
- `js/db.js` : diff strictement vide entre le dernier commit distant et maintenant.

## Sécurité

- Aucun `eval`/`Function()`/`localStorage`/`sessionStorage` introduit par V6.0/V6.1 (les fichiers ajoutés — `core/`, `repositories/` — ne touchent ni au DOM ni au stockage local ; ce sont de simples enveloppes autour de Dexie).
- `Logger.error(context, err)` ne journalise que `err?.message || err` : pour toutes les erreurs réellement interceptées dans le code (échecs Dexie, `ValidationError`), c'est un message technique, jamais un enregistrement métier complet (nom, téléphone, adresse) — vérifié en relisant chaque site d'appel : aucun `catch` ne passe l'objet `person`/`request`/etc. à `Logger.error`, uniquement `err`.
- Pas de nouveau flux réseau : les repositories et le logger n'appellent jamais `fetch`.

## Données

### Migration
`js/db.js` n'a **pas été modifié** par V6.0/V6.1 (diff vide, vérifié). Le schéma reste v5→v9, additif, inchangé. **Il n'y a donc rigoureusement aucune migration à tester pour ces deux phases** — pas de nouvelle version Dexie, pas de nouveau champ, pas de renommage. Un test de migration avec un jeu de données représentatif (10 personnes, 5 demandes, etc.) n'a pas été construit car il n'y a rien à migrer ; le construire maintenant aurait simulé un problème qui n'existe pas dans ce périmètre.

### Sauvegarde / restauration
Le format d'export JSON et son schéma (`DATA_MODULES`) sont inchangés par V6.0/V6.1 : `table: () => db.X` est devenu `table: () => XRepository`, et comme chaque repository expose `bulkPut`/`clear` avec exactement la même signature que la table Dexie sous-jacente, `exportJSON()`/`importFile()`/`importModuleCSVFile()`/`clearDatabase()` n'ont nécessité aucun autre changement — vérifié en relisant ces quatre fonctions en entier après le refactor. Un test réel d'export → suppression → réimport → comparaison n'a **pas été exécuté** dans cet environnement (nécessiterait un navigateur avec IndexedDB ; aucun outil de ce type n'est disponible ici). C'est une limite documentée, pas une affirmation de succès non vérifiée.

## IndexedDB

- Versions (5 à 9), clés primaires et index : inchangés, revérifiés dans `js/db.js`.
- Opérations bulk (`bulkPut`) : toujours utilisées aux mêmes endroits (import CSV/JSON), désormais via les repositories qui les exposent à l'identique.
- Transactions explicites Dexie (`db.transaction(...)`) : **aucune n'existe, ni avant ni après V6.0/V6.1** — une opération composite comme « enregistrer une demande + ajouter une entrée d'historique » reste deux écritures séparées, non atomiques. C'est un constat pré-existant, hors du périmètre de cette revue (ni introduit ni aggravé par V6.0/V6.1), à traiter séparément si jugé utile.

## PWA

- `sw.js` : `CACHE_NAME` passé de `v3` à `v4` en cohérence avec les nouveaux fichiers (`core/`, `repositories/`) ajoutés à `PRECACHE_URLS` — vérifié : les 29 scripts de `index.html` correspondent exactement aux 29 entrées `js/...` de `PRECACHE_URLS`.
- La logique d'activation (suppression de tout cache dont le nom diffère de `CACHE_NAME`) garantit qu'une ancienne version ne reste pas servie indéfiniment : à chaque nouveau déploiement, `cache.addAll(PRECACHE_URLS)` construit un cache neuf sous le nouveau nom pendant l'installation, puis l'activation supprime l'ancien — pas de mélange possible entre un ancien et un nouveau fichier au sein d'une même version active.
- **Non testé en conditions réelles** (pas de navigateur disponible ici) : le scénario « ancienne version installée → rechargement → nouvelle version active » n'a été vérifié que par lecture de code, pas par exécution.

## UX / Accessibilité / Performance

V6.0 et V6.1 ne modifient ni HTML ni CSS ni aucun comportement d'interface (uniquement des balises `<script>` ajoutées et l'accès aux données réorganisé en interne) : **aucun changement UX/accessibilité/performance n'est attendu, et aucun n'a été constaté.** Les parcours utilisateurs (créer/modifier/rechercher/supprimer une Personne, une Demande, une Intention…) passent tous par les mêmes fonctions qu'avant, seul leur accès aux données a changé de chemin interne.

## Dette technique

- Constat pré-existant, non lié à V6.0/V6.1 : aucune transaction Dexie explicite pour les opérations composites (voir « IndexedDB » ci-dessus).
- `js/repositories/settingsRepository.js` et `repositoryFactory.js` : ajouts non explicitement prévus par la roadmap initiale mais nécessaires/justifiés (voir « V6.1 › Problèmes »).

## Corrections effectuées

1. **`js/people.js`, `js/settings.js`** : les 6 `throw new Error("texte")` génériques dans les fonctions d'import CSV/JSON (`importPeopleCSV`, `importModuleCSVFile`, `importFile`) remplacés par `throw new ValidationError("texte")` — ces erreurs sont bien des rejets de validation (fichier vide, colonnes non reconnues, aucune donnée exploitable), exactement l'usage prévu par `ValidationError`. Aucun changement de comportement observable (le message affiché à l'utilisateur est identique ; seul le type de l'objet erreur change, pour un futur tri par type si besoin). Vérifié : `node --check` sur les deux fichiers, suite de tests rejouée (31/31), aucun autre `throw new Error` restant dans `js/`.
2. **Ajout de `tests/pure-functions.test.js`** : 31 tests réels, exécutables sans dépendance (`node tests/pure-functions.test.js`), couvrant les fonctions les plus sensibles à la fiabilité des données.
3. **`docs/AUDIT.md`** : la mise à jour rédigée lors d'une session précédente (non commitée) a été commitée telle quelle.
4. **`docs/ROADMAP.md`** : statuts de V6.0 et V6.1 corrigés (voir section dédiée du fichier) pour refléter les verdicts ci-dessus plutôt qu'un simple « fait ».
5. **`docs/TESTS.md`** créé : documente la suite de tests ajoutée et comment l'exécuter.

## Corrections reportées

- Décisions V6.0 #1/#3 (dépôt privé, réécriture d'historique) : vous appartiennent, non traitées ici.
- Transactions Dexie explicites pour les écritures composites : pré-existant, hors périmètre de cette revue, à évaluer séparément si jugé utile (risque réel mais faible en usage mono-utilisateur local).
- Tests réels d'export/import JSON et de migration IndexedDB en conditions live : non exécutables dans cet environnement (pas de navigateur) ; à faire manuellement avant de pousser, ou à automatiser plus tard avec un polyfill IndexedDB (`fake-indexeddb`) si des tests d'intégration sont un jour souhaités — decision à prendre séparément, pas dans cette revue.

## Verdict final

V6.0 : 🟡 PARTIEL par conception (décisions utilisateur en attente, code correct). V6.1 : ✅ COMPLET après correction du point `ValidationError`/`NotFoundError`. Aucune régression détectée par les moyens disponibles. Aucune donnée réelle n'est en jeu (schéma Dexie non touché). La base est jugée stable pour envisager V6.2, sous réserve des tests manuels en navigateur que je ne peux pas exécuter ici (voir « Recommandation pour V6.2 »).

## Recommandation pour V6.2

Prête à être planifiée (voir `docs/V6.2-PLAN.md`), à une condition : faites, de votre côté, un tour rapide de l'application dans un navigateur (créer/modifier/supprimer une Personne et une Demande, un export JSON suivi d'un import) avant de pousser les 8 commits locaux — je n'ai pas pu le faire moi-même dans cet environnement, et c'est la seule vérification qui manque à ce stade pour une confiance complète.
