# Audit gParoisse — état des lieux (v5)

Date de l'audit : 2026-09-13
Portée : dépôt complet (`index.html`, `css/style.css`, `js/*.js`, `sw.js`, `manifest.json`, `scripts/push.ps1`, données présentes dans le dépôt).
Méthode : lecture intégrale de chaque fichier JS listé dans la mission, lecture de l'historique git, vérifications ciblées (`grep`) pour les risques XSS/sécurité, vérification en direct de la visibilité du dépôt GitHub.

Aucune affirmation de ce document n'est déduite du README ou de la mémoire de conversations précédentes : chaque point cité a été vérifié dans le code ou dans l'état réel du dépôt au moment de l'audit.

---

## 🔴 Constat n°1 — à traiter avant toute autre chose

**Des données personnelles réelles de paroissiens sont commitées dans un dépôt GitHub public.**

- `membreParoisse.csv` (2,1 Mo) et `membreParoisse.xlsx` (6,4 Ko) sont présents à la racine du dépôt et **suivis par git** (`git ls-files` les liste), ajoutés dans les commits `bf14e1b` (« split ») et `628bd2d` (« GROK PROMT »).
- Le fichier CSV est le registre paroissial réel : son en-tête contient `REGISTRE;EGLISES;DIOCESE;ANNEE;N° BAPTEMES;DATE BAPTEME;PRENOMS;NOMS;PERE;MERE;DATE NAISSANCE;LIEU NAISSANCE;PARRAIN;MARRAINE;TEMOIN;...` — ce sont des données à caractère personnel (identité, filiation, dates de sacrements) au sens du RGPD.
- Vérification en direct via l'API GitHub (`GET /repos/paroissecarmaux/gParoisse`) : **`"private": false`, `"visibility": "public"`.** Le dépôt est donc consultable et cloneable par n'importe qui, avec l'historique complet.
- `.gitignore` ne contient que `.DS_Store` et `Thumbs.db` : rien n'empêche que ces fichiers (ou d'autres exports similaires) soient re-commités à l'avenir.
- `scripts/push.ps1` utilise `git add -A`, qui stage aveuglément tout fichier présent dans le dossier — y compris un futur export JSON de sauvegarde ou un nouveau CSV déposé par erreur à la racine.

**Action recommandée (à valider avec vous avant exécution, ce sont des opérations sensibles) :**
1. Rendre le dépôt **privé** immédiatement (action la plus rapide et la plus sûre — ne nécessite aucune réécriture d'historique).
2. Décider si une purge d'historique (`git filter-repo` ou BFG Repo-Cleaner) est nécessaire en plus — cela réécrit les hachages de commits et nécessite un force-push, donc une décision explicite de votre part.
3. Ajouter au `.gitignore` : `*.csv`, `*.xlsx`, et tout motif de sauvegarde (`paroisse-sauvegarde-*.json`, `paroisse-*-*.csv`) pour empêcher toute réintroduction accidentelle.
4. Retirer `membreParoisse.csv`/`.xlsx` du suivi (`git rm --cached`) dans un commit dédié, séparé de toute autre modification.

Je n'ai pris aucune de ces actions moi-même : ce sont des décisions à fort impact (visibilité du dépôt, réécriture d'historique) qui vous appartiennent.

---

## A. Architecture actuelle

**Démarrage.** `index.html` est un unique document contenant : le sprite SVG d'icônes (`<symbol>` dans un `<svg>` masqué), la sidebar, un `<header>`, puis un conteneur `<main>` listant **tous** les `.view-page[data-page="…"]` de tous les modules (overview, requests × 3 pages, people × 3, schedule × 3, clochers × 3, personnel × 3, intentions × 3, agenda, settings), et enfin la recherche globale en overlay. 17 fichiers `<script>` classiques (pas de modules ES, volontairement, pour rester compatible `file://`) sont chargés dans un ordre fixe : `db.js → constants.js → utils.js → icons.js → csv.js → state.js → requests.js → people.js → schedule.js → clochers.js → personnel.js → intentions.js → overview.js → agenda.js → settings.js → search.js → main.js`. `js/main.js` appelle `init()` en bas de fichier, qui enchaîne synchronement tous les `init<Module>Events()` puis, dans un bloc `try`, `db.open()` et tous les `load<Module>Data()`/`render<Module>()`.

**État.** Un unique objet global `state` (`js/state.js`) porte toutes les données en mémoire (`state.requests`, `state.people`, …), les filtres de recherche/KPI par module, les identifiants sélectionnés, la page courante, les paramètres. Aucune encapsulation : n'importe quel fichier lit/écrit `state.xxx` directement. `PAGE_SECTION` (table statique) fait le lien entre une page (`request-detail`) et sa section de sidebar (`requests`) ; `showPage()`/`goBack()`/`pageBackTarget()` gèrent la navigation plein écran (pas de routeur, pas d'historique navigateur — le bouton « retour » du navigateur ne fonctionne pas comme un retour applicatif, seul le bouton « Retour » in-app le fait).

**Communication entre modules.** Il n'y a pas de bus d'événements ni de pub/sub : les modules s'appellent **directement par nom de fonction global** (ex. `people.js` appelle `showIntentionForm()` défini dans `intentions.js`, `requests.js` appelle `showPersonDetail()` défini dans `people.js`). Cela fonctionne uniquement parce que (a) tous les scripts sont chargés avant qu'aucune fonction ne soit réellement invoquée (les gestionnaires d'événements ne s'exécutent qu'après le chargement complet), et (b) aucune vérification d'existence n'est faite. C'est fragile : renommer une fonction dans un fichier casse silencieusement un autre fichier sans erreur au chargement (l'erreur n'apparaît qu'à l'exécution, dans la console).

**IndexedDB.** `js/db.js` déclare un unique objet `Dexie` (`db`), avec un schéma versionné de 5 à 9 (voir section B). **Chaque module accède directement** à `db.<table>.get/put/delete/bulkPut/orderBy/clear` — il n'existe aucune couche d'accès centralisée (pas de repository). Le mot `db.` apparaît directement dans `requests.js`, `people.js`, `schedule.js`, `clochers.js`, `personnel.js`, `intentions.js` et `settings.js`.

**Service worker.** `sw.js` est un cache d'app-shell classique (install → `cache.addAll(PRECACHE_URLS)`, activate → suppression des caches dont le nom diffère de `CACHE_NAME`, fetch → stale-while-revalidate). Il ne touche jamais IndexedDB. Le nom de cache (`paroisse-secretariat-v3`) doit être incrémenté manuellement à chaque changement de fichiers précachés — c'est actuellement fait à la main (aucune automatisation, aucun hash de contenu), donc un oubli est possible mais sans conséquence grave (l'ancien cache expire dès que `CACHE_NAME` change).

**Import/export.** `js/settings.js` définit un registre déclaratif `DATA_MODULES` (une entrée par table métier : requests, people, schedule, clochers, personnel, intentions) avec, pour chacune, l'accès à la table Dexie, une fonction de normalisation, un validateur, un gabarit par défaut et la liste des colonnes CSV. `exportJSON()`/`importFile()`/`clearDatabase()` et `exportModuleCSV()`/`importModuleCSVFile()` itèrent sur ce registre plutôt que de dupliquer la logique par module — c'est un point positif de l'architecture actuelle.

## B. Modèle de données (schéma Dexie réel, `js/db.js`)

Le nom de la base est `paroisse_secretariat`. Les chaînes d'index Dexie ne listent que les champs indexés ; chaque enregistrement porte en réalité beaucoup plus de champs (non indexés, donc non recherchables/triables nativement par Dexie — le tri/filtre se fait alors en mémoire côté JS).

| Table | Introduite | Clé/index Dexie | Champs principaux (hors index) | Relations | Risques observés |
|---|---|---|---|---|---|
| `requests` | v5 | `id, status, type, priority, dateDemande, deadline, updatedAt, archived, name` | `contact, dateEvenement, heureEvenement, lieuEvenement, defunt, contactMethod, description, notes, completedAt, personId, clocherId` | `personId` → `people.id` ; `clocherId` → `clochers.id` (les deux ajoutés après coup, non indexés) | Aucune contrainte d'intégrité référentielle (Dexie n'en a pas nativement) ; suppression d'une personne/d'un clocher ne nettoie pas `personId`/`clocherId` orphelins dans `requests` (voir §D). |
| `history` | v5 | `id, requestId, createdAt` | `action, description` | `requestId` → `requests.id` | Table d'historique **réservée aux seules demandes** (`addHistory()` n'est appelé que par `requests.js`) ; aucune trace d'audit pour People/Personnel/Clochers/Intentions/Schedule malgré la demande explicite « historique/audit » du point 11. Entrées `history` orphelines si la demande est supprimée (jamais purgées). |
| `settings` | v5 | `key` | `value` (paire clé/valeur libre) | — | Aucune validation de schéma : `value` peut être n'importe quoi. |
| `people` | v6 | `id, nom, prenom, updatedAt` | ~30 champs (identité, sacrements, RGPD, décès, notes…) | Référencée par `requests.personId`, `intentions.personId` | Champ `rgpd` = simple booléen « consentement obtenu », sans date ni preuve ; pas de traçabilité de ce consentement (voir §G). |
| `schedule` | v7 | `id, kind, dayOfWeek, date, updatedAt` | `title, category, time, location, clocherId, notes, active` | `clocherId` → `clochers.id` | — |
| `clochers` | v8 | `id, nom, commune, updatedAt` | `secteur, adresse, saintPatron, fetePatronale, notes, active` | Référencé par `requests.clocherId`, `schedule.clocherId`, `intentions.clocherId` | — |
| `personnel` | v9 | `id, nom, prenom, typeEngagement, active, updatedAt` | `etat, fonction, telephone, email, adresse, dateDebut, dateFin, notes` | Référencé par `intentions.personnelId` | — |
| `intentions` | v9 | `id, type, statut, dateDebut, updatedAt` | `intitule, contact, nombreMesses, heure, offrande, notes, personId, clocherId, personnelId` | `personId`, `clocherId`, `personnelId` | Aucun index sur `personId`/`clocherId`/`personnelId` (recherche de liens en `Array.find` côté JS, acceptable au volume actuel). |

**Migrations.** Chaque `db.version(N).stores({...})` re-déclare l'intégralité des tables (conforme à Dexie), et les commentaires expliquent correctement ce qu'ajoute chaque version. **Aucune version n'a été modifiée rétroactivement** — c'est vérifié en lisant `db.js` de bout en bout : v5 à v9 sont strictement additives. C'est le point le plus solide de tout l'audit.

**Absence de `db.version(N).upgrade()`.** Aucune migration n'utilise le second argument de Dexie (`.upgrade(tx => …)`) pour transformer des données existantes (ex. renommer un champ, corriger un format). Ce n'est pas un problème aujourd'hui (toutes les évolutions ont été des ajouts de tables/champs, jamais des renommages), mais le jour où un renommage de champ sera nécessaire, il faudra écrire une vraie fonction de migration plutôt que de laisser les anciens enregistrements avec l'ancien nom de champ.

## C. Qualité du code — classement par gravité

### CRITIQUE

1. **Données personnelles réelles dans un dépôt public** (détaillé plus haut). C'est un problème de fuite de données, pas seulement de code.
2. **Aucune cascade/nettoyage de références à la suppression.** `deletePerson`, `deleteClocher`, `deletePersonnel` (vérifié dans `people.js:570`, `clochers.js:227`, `personnel.js:273`) suppriment l'enregistrement sans jamais parcourir `requests`/`schedule`/`intentions` pour nettoyer les `personId`/`clocherId`/`personnelId` qui pointent vers lui. Conséquence concrète : après suppression d'une personne, ses demandes affichent correctement « Personne introuvable (supprimée) » (`requests.js:488`, `intentions.js:270` — bon réflexe défensif), **mais** une intention liée à un clocher ou un célébrant supprimé affiche silencieusement un champ vide (`intentions.js:256-261`, pas de message équivalent). Ce n'est pas une perte de données, mais une incohérence silencieuse.
3. **Aucun test automatisé.** Confirmé : aucun fichier de test, aucun `package.json`, aucun outil de test dans le dépôt. Toute non-régression repose sur la relecture manuelle. Pour un logiciel qui gère de vraies données paroissiales (baptêmes, mariages, obsèques), l'absence totale de test sur l'export/import/migration est un risque réel de perte de données lors d'une évolution future.

### IMPORTANT

4. **Aucune couche repository : accès Dexie dispersé dans 7 fichiers.** Conforme à ce que la mission décrit comme le problème central à corriger. Concrètement, un renommage de table ou un changement de moteur de stockage obligerait à modifier `requests.js`, `people.js`, `schedule.js`, `clochers.js`, `personnel.js`, `intentions.js` et `settings.js` séparément.
5. **`history` ne couvre qu'un seul module.** La demande explicite (« historique/audit ») n'est réellement implémentée que pour les demandes. Personnes, Personnel, Clochers, Intentions, Annonces n'ont aucune traçabilité des modifications (qui a changé quoi, quand) — pour une personne, on ne sait pas si son numéro de téléphone a été corrigé hier ou il y a un an, ni par qui (il n'y a d'ailleurs aucune notion d'utilisateur/session, donc « par qui » ne pourrait de toute façon pas être répondu avec l'architecture actuelle mono-utilisateur locale).
6. **Aucune « corbeille ».** Toutes les suppressions (`deleteRequest`, `deletePerson`, `deleteClocher`, `deletePersonnel`, `deleteSchedule`, `deleteIntention`) sont définitives immédiatement après un unique `window.confirm()`. Le point 12 de la mission demande explicitement un cycle Actif → Corbeille → Restauration → Suppression définitive : cela n'existe pas du tout aujourd'hui. `requests.archived`/`personnel.active`/`clochers.active`/`schedule.active` existent bien comme statut « inactif », mais c'est un statut métier (« Suspendue », « Inactif »), pas une corbeille générique, et il n'existe pas pour `people` ni `intentions`.
7. **Rapport d'import CSV non détaillé.** La mission demande un rapport ligne par ligne (« Ligne 47 : date invalide »). Le code actuel (`importPeopleCSV` dans `people.js`, `importModuleCSVFile` dans `settings.js`) ne fait qu'un comptage global : `X importé(s) · Y ligne(s) ignorée(s)`, sans indiquer quelle ligne ni pourquoi. Une ligne invalide n'interrompt pas tout l'import (bon point), mais le diagnostic est trop pauvre pour un secrétariat qui doit corriger un fichier source.
8. **Pas de gestion de conflit de fusion CSV/JSON au niveau champ.** En mode « fusion », un import qui trouve un `id` déjà existant régénère un **nouvel** id (`item.id = uid()`) plutôt que de fusionner/écraser le contenu — cela peut dupliquer un enregistrement plutôt que le mettre à jour si l'utilisateur s'attendait à un « update ». Comportement cohérent et documenté par les commentaires du code, mais potentiellement surprenant pour l'utilisateur (aucune option « mettre à jour si l'ID existe » n'est proposée à l'écran, uniquement « fusionner » vs « remplacer »).
9. **Couplage fort par variables globales entre modules.** Toute fonction (`showPersonDetail`, `showIntentionForm`, `renderOverview`, `renderAgenda`, …) est un global implicite. Un simple faute de frappe dans un nom de fonction ne casse rien au chargement (pas d'erreur immédiate) mais provoque une `ReferenceError` silencieuse en pleine utilisation, uniquement visible dans la console.

### MOYEN

10. **Fonctions longues avec logique métier + DOM mêlées.** `showPersonDetail()` (~160 lignes), `showIntentionDetail()`, `savePerson()` mélangent construction de règles métier (ex. vider les champs paroissiaux si `profileType === "contact"`) et construction de gros blocs HTML en template litéral. Lisible aujourd'hui grâce aux commentaires, mais coûteux à faire évoluer (toute modification de champ oblige à toucher la même fonction géante).
11. **Incohérence de champs entre modules similaires.** `active` (schedule/clochers/personnel) désigne trois statuts différents (suspendue/inactif/inactif) sans vocabulaire commun ; `statut` (intentions) est une chaîne libre parmi 3 valeurs alors que `status` (requests) en a 4 — nommage anglais/français mélangé (`status` vs `statut`) au sein du même projet.
12. **Recherche de personnes en `O(n)` répétée.** `personSuggestions`, `clocherSuggestions`, `personnelSuggestions` refont un `state.X.filter(normalize(...))` à chaque frappe clavier (avec debounce, donc acceptable en pratique) — pas d'index de recherche précalculé comme cela a été fait pour `people._search`/`people._sortKey` (bon réflexe **partiel** : seul `people.js` précalcule un index de recherche à `loadPeopleData()` ; `requests.js`, `clochers.js`, `personnel.js`, `intentions.js` recalculent `normalize()` à chaque rendu/recherche).
13. **`js/search.js` ne recherche pas dans Annonces/Agenda/Dossiers.** La mission (point 15) demande explicitement une recherche globale couvrant « agenda, dossiers ». Le code actuel (`GLOBAL_SEARCH_SOURCES`) couvre seulement Personnes, Demandes, Intentions, Personnel, Clochers — pas les Annonces (`schedule`), et il n'existe pas de notion de « dossier » distincte d'une demande.
14. **`sw.js` : versionnage manuel du cache.** Fonctionne, mais une modification de fichier JS sans bump de `CACHE_NAME` resterait indéfiniment servie depuis l'ancien cache pour un utilisateur qui a déjà installé la PWA — aucun garde-fou automatique.

### MINEUR

15. **`document.write()` dans `openPrintWindow()` (`people.js:530`)** — API dépréciée mais utilisée sur une fenêtre créée par l'application elle-même avec du contenu déjà échappé (`escapeHTML`) ; fonctionnellement correct, sans risque XSS avéré, mais à remplacer par `win.document.body.innerHTML = ...` si l'occasion se présente.
16. **Vocabulaire "personnes" vs "membres" résiduel.** Le module `people.js`/la table `people` s'appellent encore ainsi en interne alors que l'UI affiche désormais « Membres » — cohérent pour l'utilisateur, mais peut dérouter un futur développeur qui chercherait `js/membres.js`.
17. **`js/agenda.js` et `js/overview.js` dupliquent une logique de libellé** (`Obsèques de ${defunt}` calculé indépendamment à deux endroits) plutôt que de réutiliser une fonction commune.

## D. Dette technique (refactors probables)

- Extraction d'une **couche repository** (`peopleRepository.js`, etc.) centralisant `db.<table>.get/put/delete/bulkPut` — c'est le refactor le plus structurant et le moins risqué (aucun changement de comportement visible, uniquement un déplacement de code).
- Extraction d'un **module d'historique générique** (`historyService.js`) utilisable par tous les modules plutôt que le seul `addHistory()` de `requests.js`.
- **`index.html` (1598 lignes) et `css/style.css` (1618 lignes)** sont des fichiers uniques qui contiennent la totalité des pages/styles de tous les modules ; ils grossissent linéairement avec chaque nouveau module. Un découpage n'est pas urgent tant que l'app reste dans cet ordre de grandeur, mais à surveiller.
- Les fonctions `showXDetail()` de chaque module (6 occurrences quasi identiques dans leur structure : en-tête + badges + sections `fiche-grid`) pourraient converger vers un petit gabarit commun (`renderFicheHeader()`, etc.) — actuellement dupliqué 6 fois avec de légères variations.

## E. UX — parcours à trop de clics ou trop complexes

- **Créer une demande liée à une personne existante** : bon (autocomplete + préremplissage du contact). ✅
- **Créer une intention depuis une fiche Personne** : bon (`createIntentionForPerson`). ✅
- **« Enregistrer et créer une autre »** n'existe que sur Personnes et Intentions (vérifié : aucun `data-action="save-and-new"` dans les formulaires Demandes/Annonces/Clochers/Personnel). Un secrétariat qui saisit une série d'annonces de messes ou une série de clochers doit rouvrir le formulaire manuellement à chaque fois.
- **Suppression = un seul `window.confirm()` texte brut**, identique partout ; pas de récapitulatif de ce qui sera perdu (ex. « cette personne a 4 demandes liées »).
- **Aucun raccourci clavier pour valider un formulaire** (`Ctrl+Entrée` par exemple) — l'utilisateur doit toujours cliquer sur le bouton Enregistrer ou appuyer sur Entrée dans un champ texte (fonctionne, mais pas dans un `<textarea>`, où Entrée insère une nouvelle ligne).
- **La Corbeille absente** (voir C.6) oblige à une extrême prudence avant chaque suppression, ce qui ralentit le travail quotidien (le secrétariat doit être sûr à 100 % avant de supprimer, faute de filet de rattrapage).

## F. Accessibilité — vérifié dans le code, pas testé avec un lecteur d'écran réel

Ce qui est **vérifié présent** :
- Les champs de formulaire utilisent systématiquement `<label for="…">` associé à un `id` (motif constant dans tous les formulaires vus).
- `aria-label`/`title` sont présents sur les boutons icône seuls (`icon-btn`).
- Le conteneur de toasts porte `aria-live="polite"`.
- `showPage()` gère `aria-selected` sur les items de sidebar.
- Les accordéons de la fiche Personne utilisent `<details>/<summary>` natifs (clavier/lecteur d'écran gérés nativement par le navigateur, sans JS custom).

Ce qui est **une lacune vérifiée** :
- Aucun déplacement de focus programmatique après `showPage()` vers le titre de la nouvelle page — un utilisateur clavier/lecteur d'écran qui navigue entre pages n'a aucune annonce du changement de contexte (le focus reste où il était, potentiellement sur un bouton qui a disparu visuellement mais reste dans le DOM d'une autre page masquée par `hidden`).
- Les messages toast disparaissent après 3,4 s sans persistance ni moyen de les rouvrir — un utilisateur de lecteur d'écran lent peut manquer l'information.
- Les erreurs de formulaire (ex. `#deadlineError` dans Demandes) ne sont reliées à leur champ par aucun `aria-describedby` — l'erreur est visuellement à côté du champ mais pas programmatiquement associée.

Ce qui **n'a pas été vérifié** (nécessite un test réel, je ne l'invente pas) : contrastes de couleurs exacts de la palette (`--accent`, `--muted`, etc.) contre le fond dans les deux thèmes, comportement réel avec un lecteur d'écran (NVDA/VoiceOver), taille des zones tactiles sur mobile.

## G. Sécurité / confidentialité

- **Pas d'injection XSS trouvée.** Vérification systématique : toute valeur utilisateur insérée via `innerHTML` passe par `escapeHTML()` (motif vérifié dans `requests.js`, `people.js`, `schedule.js`, `clochers.js`, `personnel.js`, `intentions.js`, `search.js`). Les quelques occurrences de champs « bruts » repérées par recherche automatique se sont toutes révélées être soit des affectations `.value`/`.textContent` (intrinsèquement sûres), soit des arguments internes à un appel `escapeHTML(...)`/`normalize(...)` englobant, soit du texte affiché dans un `window.confirm()` (rendu en texte brut par le navigateur, jamais interprété comme HTML).
- **Pas d'`eval`, pas de `Function()`, pas de `localStorage`/`sessionStorage`.** Confirmé par recherche exhaustive.
- **`document.write()`** utilisé une fois (impression de certificat) — voir C.15, sans risque XSS avéré mais API dépréciée.
- **RGPD — le champ `rgpd` est un simple booléen sans preuve ni date.** Aucun horodatage de consentement, aucune trace de qui/quand a coché la case. Pour un usage strictement local par un secrétariat (pas de transfert de données), le risque réel est plus faible qu'une application en ligne, mais si ce logiciel doit un jour démontrer sa conformité, l'absence de traçabilité du consentement est une lacune réelle.
- **Export JSON = texte clair, non chiffré.** N'importe qui ayant accès au fichier exporté (clé USB perdue, dossier partagé) a accès à toutes les données en clair. C'est cohérent avec l'esprit « simple, hors-ligne » du projet, mais mérite d'être **dit explicitement** à l'utilisateur (actuellement le texte des Paramètres dit que les données restent « uniquement dans ce navigateur », ce qui est vrai pour IndexedDB mais ne prévient pas que le fichier exporté, une fois sur une clé USB, n'a plus cette protection).
- **`membreParoisse.csv`/`.xlsx` dans le dépôt public** — voir Constat n°1, c'est le point le plus grave de tout l'audit.

## H. Sauvegarde — évaluation de robustesse actuelle

- Export : un objet JSON `{ app, version, exportedAt, settings, requests, people, schedule, clochers, personnel, intentions }`. Le champ `version` (actuellement `9`) correspond au numéro de version Dexie au moment de l'export, mais **rien ne le vérifie à l'import** — `importFile()` ne lit jamais `parsed.version`, ne compare à aucune version attendue, et n'a aucune notion de compatibilité ascendante/descendante. Un fichier corrompu, tronqué, ou d'un format totalement différent (mais JSON valide) sera accepté tant qu'il expose au moins un des champs `requests`/`people`/etc. avec des objets qui satisfont le validateur `isValid` très permissif de chaque module.
- Pas de somme de contrôle, pas de signature, pas de détection de fichier tronqué autrement que par l'échec de `JSON.parse()` (attrapé et affiché en toast).
- Le remplacement complet (`importMode === "replace"`) demande une confirmation `window.confirm()` avec un résumé chiffré (« Remplacer toutes les données actuelles par X demande(s), Y personne(s)… ») — **c'est un bon point**, déjà conforme à l'esprit du point 13 de la mission (afficher le nombre d'éléments concernés, confirmer avant remplacement).
- La fusion (`importMode === "merge"`) ne permet aucune prévisualisation avant application — les données sont déjà écrites en base au moment où l'utilisateur voit le résultat.
- `backupStatus()`/`renderBackupStatus()` (déjà en place) calculent correctement une alerte au-delà de 7 jours sans sauvegarde, affichée à la fois sur le Tableau de bord et dans Paramètres — bon point, déjà conforme à une partie du point 14 de la mission. Il n'existe en revanche aucun rappel programmé (notification), uniquement un texte visible quand l'utilisateur ouvre l'application.

## I. Tests — ce qui est testable et ce qui ne l'est pas actuellement

**Ce qui serait testable aujourd'hui sans aucune modification de l'architecture** (tests « boîte noire » sur des fonctions pures déjà isolées) :
- `computeAge`, `formatDate`, `daysBetween`, `addDays`, `weekdayOf`, `normalize`, `escapeHTML`, `sortByKey`, `paginate` (`js/utils.js`) — fonctions pures, aucune dépendance au DOM ni à Dexie.
- `parseCSV`, `parseFrenchDate`, `excelSerialToISO`, `normalizeHeaderKey` (`js/csv.js`) — idem, fonctions pures.
- `intentionEndDate`, `intentionOccursOn`, `scheduleOccursOn` (logique de dates récurrentes) — fonctions pures.
- `normalizeRequest` (`js/requests.js`) — fonction pure de normalisation.

**Ce qui n'est pas testable sans un minimum d'adaptation :**
- Tout ce qui touche Dexie/IndexedDB directement dans les modules (`db.requests.put(...)`) nécessite soit un environnement de test avec `fake-indexeddb`, soit d'introduire la couche repository proposée en section D (ce qui permettrait de mocker le repository plutôt que Dexie lui-même).
- Tout ce qui manipule le DOM via `$()`/`innerHTML` (quasiment toutes les fonctions `render*`/`show*Detail`) nécessite soit `jsdom`, soit de séparer strictement le calcul (données → objet) du rendu (objet → HTML), ce qui n'est pas fait aujourd'hui.

**Aucun test n'existe actuellement** : ni unitaire, ni d'intégration, ni end-to-end. Aucun outil de test n'est installé (pas de `package.json`).

---

## Note de méthode

Ce document a été produit en lisant intégralement les fichiers suivants : `index.html` (structure/sections), `css/style.css` (tokens/composants), `js/db.js`, `js/constants.js`, `js/utils.js`, `js/state.js`, `js/main.js`, `js/search.js`, `js/settings.js`, `js/overview.js`, `js/requests.js`, `js/people.js`, `js/schedule.js`, `js/clochers.js`, `js/personnel.js`, `js/intentions.js`, `js/agenda.js`, `js/csv.js`, `js/icons.js`, `sw.js`, `manifest.json`, `scripts/push.ps1`, ainsi que l'historique et la configuration git du dépôt (`git log`, `git ls-files`, `git remote -v`, `.gitignore`, requête à l'API GitHub pour la visibilité du dépôt). Aucun comportement n'a été supposé sans lecture du code correspondant.
