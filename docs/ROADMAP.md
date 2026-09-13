# Feuille de route gParoisse v6

Fondée sur les constats de `docs/AUDIT.md`. Chaque phase est autonome (peut être livrée seule) et n'introduit que des changements **additifs** côté IndexedDB — jamais de modification rétroactive d'une version `db.version(N)` existante.

Ordre de priorité global, rappelé de la mission : **fiabilité des données > sécurité/confidentialité > maintenabilité > UX > esthétique.** La numérotation ci-dessous suit cet ordre plutôt qu'un ordre arbitraire.

---

## V6.0 — Urgence confidentialité (hors code)

**Statut : 🟡 PARTIEL, par conception** (revu le 2026-09-13, voir `docs/REVIEW-V6.0-V6.1.md`). Les deux actions de code ci-dessous sont faites et déjà poussées sur `origin/main`. Les deux décisions qui vous appartiennent (dépôt privé / réécriture d'historique) restent explicitement ouvertes — ce n'est pas un défaut d'implémentation.

Ne dépend d'aucun développement. À traiter en premier, avec votre validation explicite à chaque étape.

- Rendre le dépôt GitHub privé (ou décider consciemment de le laisser public en connaissance de cause).
- Retirer `membreParoisse.csv`/`.xlsx` du suivi git (`git rm --cached`), commit dédié.
- Décider si une purge d'historique est nécessaire (action destructive, force-push — votre décision).
- Étendre `.gitignore` : fichiers de sauvegarde/export (`*.csv`, `*.xlsx`, `paroisse-sauvegarde-*.json`).

## V6.1 — Fondations (architecture, sans changement de comportement visible)

**Statut : ✅ COMPLET** (revu et corrigé le 2026-09-13, voir `docs/REVIEW-V6.0-V6.1.md`). `ValidationError`/`NotFoundError` avaient été créées sans jamais être utilisées — corrigé pendant la revue (6 sites dans `people.js`/`settings.js`). Tout le reste était déjà conforme, vérifié par un diff exhaustif (aucune ligne modifiée en dehors des substitutions attendues) et 31 tests réels (`tests/pure-functions.test.js`) tous réussis. `settingsRepository.js` et `repositoryFactory.js` ont été ajoutés en plus de la liste ci-dessous (non prévus explicitement, mais nécessaires/justifiés — voir la revue).

Objectif : rendre le code maintenable **avant** d'ajouter des fonctionnalités, sans rien changer pour l'utilisateur final.

- Créer `js/repositories/` : un repository par table (`peopleRepository.js`, `requestsRepository.js`, `scheduleRepository.js`, `clochersRepository.js`, `personnelRepository.js`, `intentionsRepository.js`, `historyRepository.js`), chacun exposant `list()`, `get(id)`, `put(record)`, `remove(id)`, `bulkPut(records)` — de simples enveloppes autour de `db.<table>` pour commencer (pas de logique métier déplacée dans un premier temps, pour limiter le risque de régression).
- Remplacer, module par module, les appels directs `db.<table>.xxx` par `XRepository.xxx` — un commit par module (`refactor: use PeopleRepository in people.js`, etc.), jamais un commit unique pour tout le dépôt.
- Créer `js/core/errors.js` : une petite hiérarchie d'erreurs (`ValidationError`, `NotFoundError`) pour remplacer les `throw new Error("texte")` génériques actuels, sans changer les messages affichés à l'utilisateur.
- Créer `js/core/logger.js` : wrapper autour de `console.error`/`console.warn` qui **ne loggue jamais un champ personnel en clair** (nom, téléphone, email) — seulement des identifiants et des noms de champ. Remplacer les `console.error(err)` existants (`requests.js`, `people.js`, `schedule.js`, `clochers.js`, `personnel.js`, `intentions.js`, `settings.js`) par ce wrapper.
- **Ne pas** créer `js/core/events.js`/`js/services/` tant qu'aucun besoin concret ne les justifie (cf. règle « ne pas créer d'abstraction inutile ») — à réévaluer après V6.1.

Risque : faible (refactor mécanique, testable manuellement page par page). Ne touche pas au schéma Dexie (vérifié : diff vide sur `js/db.js`).

## V6.2 — Données et intégrité

- **Nettoyage de références à la suppression** (le point CRITIQUE #2 de l'audit) : avant `deletePerson`/`deleteClocher`/`deletePersonnel`, rechercher les enregistrements liés (`requests.personId`, `intentions.personId/clocherId/personnelId`, `schedule.clocherId`) et soit (a) avertir l'utilisateur du nombre de liens qui deviendront orphelins et laisser le champ vide comme aujourd'hui pour `personId` (comportement déjà géré), soit (b) les détacher explicitement (`personId: ""`) au moment de la suppression. Décision à valider avec vous : détacher silencieusement change un enregistrement qui n'est pas celui qu'on supprime, ce qui est sensible — proposition par défaut : **avertir dans la confirmation de suppression** (« 3 demandes et 1 intention sont liées à cette personne ; le lien sera perdu ») sans modifier les enregistrements liés, pour rester la plus conservatrice possible.
- **Historique générique** : extraire `addHistory(entityType, entityId, action, description)` (généralisation de l'actuel `addHistory` de `requests.js`) et l'appeler depuis `savePerson`, `saveClocher`, `savePersonnel`, `saveIntention`, `saveSchedule` en plus de `saveRequest`. Nouvelle table `db.version(10)` : `history: "id, entityType, entityId, createdAt"` (additive, l'ancienne table `history` sans `entityType` reste lisible — les entrées historiques déjà existantes pour les demandes seront traitées comme `entityType: "request"` par défaut au chargement plutôt que migrées en base).
- **Corbeille générique** : champ `deletedAt` (nullable) ajouté à chaque table plutôt qu'une suppression Dexie immédiate ; `deleteX()` devient `trashX()` (met `deletedAt`), une nouvelle vue « Corbeille » par module liste les éléments avec `deletedAt` renseigné et propose Restaurer / Supprimer définitivement (celle-ci seule fait un vrai `db.table.delete()`, avec confirmation textuelle explicite comme aujourd'hui). Additif : `deletedAt` absent = actif, aucune migration de données requise.
- **Rapport d'import CSV détaillé** : `importModuleCSVFile`/`importPeopleCSV` collectent `{ligne, raison}` pour chaque ligne ignorée plutôt qu'un simple compteur, et affichent un résumé structuré (nombre importé / mis à jour / ignoré + le détail des lignes ignorées) au lieu du toast agrégé actuel.

Risque : moyen (nouvelle version Dexie, nouveaux champs) — additif, réversible, à tester avec un jeu de données réel avant diffusion.

## V6.3 — Sauvegarde (renforcement, priorité très élevée selon la mission)

**Statut : ✅ COMPLET** (implémenté le 2026-09-13). Aucun test manuel en navigateur n'a été effectué (pas d'environnement navigateur disponible) — à valider manuellement avant mise en production : export d'une sauvegarde, réimport de cette même sauvegarde, réimport d'une ancienne sauvegarde plate (V6.2.c et avant), réimport d'un JSON quelconque sans rapport (doit être rejeté avec un message clair).

- Format de sauvegarde structuré explicite : `{ format: "gparoisse-backup", formatVersion: 1, appVersion, databaseVersion: db.verno, createdAt, data: { requests: [...], ... } }` — remplace la structure plate actuelle (`{app, version, exportedAt, ...}` avec les tables au premier niveau) par un objet dédié `data`, plus facile à valider.
- Validation stricte à l'import : vérifier `format === "gparoisse-backup"`, `formatVersion` connu, présence de `data`, et rejeter (avec message clair) tout fichier qui ne correspond pas — au lieu d'accepter silencieusement n'importe quel JSON qui contient par hasard un champ `requests`.
- Garder la rétrocompatibilité de lecture avec l'ancien format plat (déjà partiellement fait pour le très ancien format « tableau brut ») : `importFile()` détecte le format et s'adapte, jamais l'inverse.
- Texte explicite dans Paramètres : « Une sauvegarde IndexedDB locale n'est pas une copie de sécurité — seul un export JSON stocké ailleurs (clé USB, autre disque) protège contre la perte de l'appareil. » (renforce ce qui existe déjà, en étant plus explicite sur la différence stockage-local vs copie externe, demandée point 14).

Risque : faible à moyen — le format change, mais la conversion est un simple changement de forme de l'objet exporté, testable par export puis réimport immédiat.

## V6.4 — Workflows paroissiaux (structure générique, pas de workflow figé)

**Statut : ⏸️ NON IMPLÉMENTÉ — arrêté à la demande explicite (2026-09-13).** La portée ci-dessous ne précise pas comment l'utilisateur renseignerait `etapes` depuis l'UI (affichage seul vs. éditeur générique) ; posé comme question avant de commencer, l'utilisateur a choisi de ne pas trancher maintenant et de passer directement à V6.5. Cette section reste donc la portée envisagée, pas un travail commencé.

- Ajouter un champ générique optionnel `etapes: [{cle, label, fait: bool, date}]` sur `requests` (nouvelle version Dexie additive), initialement vide/absent pour les demandes existantes. Une demande **peut** avoir des étapes configurables (baptême, mariage…) sans que cela soit obligatoire — évite d'imposer un workflow rigide non demandé par un vrai besoin observé.
- Affichage : si `etapes` est renseigné, la fiche Demande affiche une petite frise à cocher ; sinon, comportement identique à aujourd'hui. Zéro régression pour les demandes qui n'utilisent pas cette fonctionnalité.
- Ne pas coder de workflow spécifique par type de cérémonie tant qu'un besoin réel et précis n'a pas été exprimé (conforme à la consigne de la mission).

## V6.5 — UX, accessibilité, tests, documentation

**Statut : ✅ COMPLET** (implémenté le 2026-09-13). Comme pour les phases précédentes, aucun test manuel en navigateur n'a été effectué (pas d'environnement navigateur disponible) — à valider manuellement : navigation clavier (focus sur le titre de page), lecteur d'écran sur le champ Échéance, recherche globale sur une annonce, formulaires Annonces/Clochers/Personnel avec « Enregistrer et créer une autre ».

- Généraliser « Enregistrer et créer une autre » aux formulaires Annonces/Clochers/Personnel (actuellement seulement Personnes/Intentions).
- Focus programmatique sur le titre de page après `showPage()` (`tabindex="-1"` + `.focus()`) pour l'accessibilité clavier/lecteur d'écran.
- Associer les messages d'erreur de formulaire à leur champ via `aria-describedby`.
- Étendre `js/search.js` aux Annonces (déjà dans `GLOBAL_SEARCH_SOURCES`, un ajout mécanique).
- Ajouter les premiers tests (voir §I de l'audit pour la liste des fonctions pures déjà testables sans changement d'architecture) : `utils.js`, `csv.js`, logique de dates récurrentes, `normalizeRequest`. Choix d'outil à discuter (le projet n'a aujourd'hui aucune dépendance de build ; un test runner sans bundler, ex. exécuté via Node directement sur les fonctions pures exportées, resterait cohérent avec l'esprit « zéro build »).
- Documentation : `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/BACKUP.md`, `docs/SECURITY.md`, `docs/RGPD.md`, `docs/TESTS.md`, `docs/CHANGELOG.md` — rédigés au fil de l'implémentation de chaque phase ci-dessus, pas d'un coup.

## V6.6 — Consolidation et durcissement

**Statut : ✅ COMPLET** (implémenté le 2026-09-13, voir `docs/V6.6-AUDIT.md` et `docs/V6.6-IMPLEMENTATION.md`). Audit complet du dépôt puis correction directe des points 🔴/🟠 trouvés — pas de nouvelle fonctionnalité au sens produit, uniquement de la fiabilité/robustesse :

- Écriture métier + historique désormais atomiques (transaction Dexie commune, `withHistoryTx()`) sur les 30 call sites des 6 modules — l'historique ne peut plus diverger silencieusement de l'état réel en cas d'échec partiel.
- Import JSON et effacement complet des données rendus atomiques (une seule transaction Dexie plutôt qu'une suite d'opérations indépendantes).
- Verrous anti-double-clic/double-soumission (`withSubmitLock`/`withActionLock`) et avertissement avant d'abandonner un formulaire modifié sans enregistrer.
- Nouveau diagnostic d'intégrité des données (Paramètres), à la demande : liens orphelins, valeurs hors vocabulaire, dates invalides, doublons probables — un rapport, jamais une correction automatique.
- Correction d'un risque de mélange de cache entre deux versions de l'app dans le service worker.
- 6 fonctions sans aucune gestion d'erreur, corrigées. 78 tests (67 → 78), README à jour.
- Comme pour les phases précédentes, aucun test manuel en navigateur n'a été effectué (pas d'environnement navigateur disponible) — à valider manuellement avant mise en production (voir `docs/V6.6-IMPLEMENTATION.md` §7).

## V6.7 — Conception de l'Annuaire (Personnes & Organisations)

**Statut : ✅ COMPLET** (conception uniquement, 2026-09-13, voir `docs/V6.7-ANNUAIRE-DESIGN.md`). Aucun code modifié. Remplace le concept actuel « Membres »/« Personnel » (deux tables Dexie disjointes, rôles non cumulables) par un modèle d'Annuaire unique (`directory`, `entityType: person|organization`, `roles` cumulables).

## V6.8 — Implémentation de l'Annuaire (sous-phasée)

- **V6.8.a — Fondations et migration** : **✅ COMPLET** (2026-09-13, voir `docs/V6.8-A-ANNUAIRE-FONDATIONS.md`). `db.version(11)` (table `directory`, additive), `personToDirectoryEntry()`/`personnelToDirectoryEntry()`, `hasRole()`/`getRolesByType()`, migration idempotente exécutée au démarrage (id conservés, aucune fusion automatique, `people`/`personnel` intactes et toujours actives). 108 tests (78 → 108).
- **V6.8.b — Module Annuaire** : **✅ COMPLET** (2026-09-13, voir `docs/V6.8-B-ANNUAIRE-INTERFACE.md`). Nouvel écran `js/annuaire.js` : liste/recherche/filtres par rôle, fiche détail, formulaire identité, gestion complète des rôles (ajout/modification/désactivation/suppression d'instance, plusieurs instances du même type conservées), corbeille (réutilise `js/trash.js`), historique (`entityType: "directory"`). `people.js`/`personnel.js` inchangés. 120 tests (108 → 120). Aucun test manuel en navigateur (pas d'environnement disponible).
- **V6.8.c — Intégration transverse** : non commencé. Bascule de `requests.personId`/`intentions.personId`/`intentions.personnelId`, historique, corbeille, recherche globale, diagnostic d'intégrité étendu, import/export, retrait des raccourcis pointant encore vers `people.js`/`personnel.js`.

## V6.9 — Stabilisation de l'Annuaire (proposé, non commencé)

Validation manuelle en navigateur de la migration sur des données réelles, outil de fusion manuelle des doublons people/personnel détectés, nettoyage éventuel du code devenu mort une fois le nouveau modèle confirmé stable.

## TypeScript — position (pas de migration automatique)

Étudié comme demandé, sans décision de migration :

- **Avantages** : détecterait immédiatement les incohérences de champs déjà repérées dans l'audit (`status` vs `statut`, `active` à trois sens différents), sécuriserait la future couche repository.
- **Inconvénients** : nécessite une étape de compilation (`tsc`) — actuellement le projet s'ouvre en double-cliquant `index.html` sans aucune étape de build ; TypeScript casserait ce fonctionnement à moins de committer le JS compilé en plus des sources, ce qui complexifie le dépôt.
- **Coût/risque** : faible si limité aux futurs repositories/services (fichiers neufs, aucun existant à convertir de force) ; élevé si on cherchait à tout convertir d'un coup.
- **Recommandation** : ne pas migrer maintenant. Si la couche repository (V6.1) est un jour réécrite, envisager de l'écrire directement en `.ts` compilé en `.js` simple (sans bundler, juste `tsc --outDir`), en gardant tout le reste (HTML, modules d'UI) en JS tel quel. Décision à reprendre après V6.1, pas avant.

---

## Ce que cette feuille de route ne fait PAS

- Ne migre pas vers React/Vue/Next.js/un backend.
- Ne casse aucune donnée existante : chaque étape ajoute des champs/versions, n'en retire ni n'en modifie aucun rétroactivement.
- Ne code pas de workflow paroissial figé par type de cérémonie sans validation préalable du besoin réel.
- Ne migre pas tout le projet vers TypeScript.
- Ne construit pas de compte utilisateur, de synchronisation, ni de dépendance à un serveur.
