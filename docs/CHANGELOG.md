# Changelog

Suit la numérotation de `docs/ROADMAP.md`, pas de dates de release — chaque phase peut s'étaler sur plusieurs sessions. Rédigé à partir de l'historique git réel et des documents d'implémentation (`docs/REVIEW-V6.0-V6.1.md`, `docs/V6.2-C-IMPLEMENTATION.md`), pas d'une mémoire reconstruite.

## V6.6 — Consolidation et durcissement

- Audit complet du dépôt (`docs/V6.6-AUDIT.md`), puis correction directe des points 🔴/🟠 trouvés (`docs/V6.6-IMPLEMENTATION.md`).
- Écriture métier + historique rendues atomiques (`withHistoryTx()`, transaction Dexie commune) sur les 30 call sites des 6 modules — l'historique ne peut plus diverger silencieusement de l'état réel en cas d'échec partiel (risque documenté sans être corrigé en V6.2.c).
- Import JSON et effacement complet des données rendus atomiques (une transaction Dexie unique plutôt qu'une suite d'opérations indépendantes sur jusqu'à 7 tables).
- Verrous anti-double-clic/double-soumission (`withSubmitLock`/`withActionLock`) et confirmation avant d'abandonner un formulaire modifié non enregistré.
- Nouveau diagnostic d'intégrité des données (`js/diagnostics.js`, bouton Paramètres) : liens orphelins, valeurs hors vocabulaire, dates invalides, doublons probables — un rapport, jamais une correction automatique.
- Correction d'un risque de mélange de cache entre deux versions de l'app dans le service worker (`caches.match` restreint à `CACHE_NAME`).
- 6 fonctions sans aucune gestion d'erreur, corrigées ; une incohérence de journalisation (`console.error` brut) corrigée.
- 78 tests (67 → 78) ; README et ROADMAP mis à jour.
- V6.6 n'a nécessité aucune migration Dexie (aucun nouveau champ indexé).

## V6.5 — UX, accessibilité, tests, documentation

- « Enregistrer et créer une autre » généralisé aux formulaires Annonces/Clochers/Personnel (déjà présent sur Personnes/Intentions).
- Focus clavier programmatique sur le titre de la page après chaque navigation (`showPage()`), générique via la classe `.page-title` partagée par toutes les pages.
- `aria-describedby`/`aria-invalid` sur le champ Échéance (formulaire Demande), seul champ du projet à avoir un message d'erreur inline dédié.
- Recherche globale étendue aux Annonces (6ᵉ source dans `GLOBAL_SEARCH_SOURCES`).
- Tests : couverture déjà suffisante pour ce que demandait `docs/AUDIT.md` §8 (voir `docs/TESTS.md`) — pas d'ajout dédié nécessaire, au-delà de `detectBackupPayload` (V6.3).
- Documentation créée : `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/BACKUP.md`, `docs/SECURITY.md`, `docs/RGPD.md`, `docs/CHANGELOG.md` (ce document) ; `docs/TESTS.md` mis à jour.
- V6.4 (« Workflows paroissiaux ») explicitement **non implémenté** : la portée décrite dans `docs/ROADMAP.md` laissait ouverte la question de l'édition des étapes (`etapes`) sans réponse — plutôt que de trancher unilatéralement entre affichage seul et éditeur générique, la décision a été posée à l'utilisateur, qui a choisi de passer directement à V6.5.

## V6.3 — Sauvegarde (renforcement)

- Nouveau format de sauvegarde JSON structuré (`{ format: "gparoisse-backup", formatVersion: 1, appVersion, databaseVersion, createdAt, settings, data: {...} }`), remplaçant l'ancienne structure plate.
- La sauvegarde inclut désormais la table `history` (silencieusement absente de tous les exports jusqu'ici).
- Validation stricte à l'import (`js/core/backup.js` : `detectBackupPayload`) — rejette tout fichier qui ne correspond à aucun format reconnu, au lieu d'accepter n'importe quel JSON contenant par hasard un champ `requests`.
- Rétrocompatibilité de lecture conservée avec l'ancien format plat et le tout premier format « tableau brut ».
- Texte renforcé dans Paramètres sur la différence stockage local / copie externe.
- Voir `docs/BACKUP.md`.

## V6.2.c — Corbeille généralisée + historique généralisé

- `deletedAt` (mise à la corbeille, restauration, suppression définitive) sur les 6 tables métier ; `trashX()`/`restoreX()`/`purgeX()` remplacent les anciens `deleteX()`.
- Historique généralisé (`entityType`/`entityId`) à tous les modules, auparavant réservé aux demandes.
- Vue Corbeille unifiée (`js/trash.js`) agrégeant les 6 modules plutôt que 6 vues séparées.
- Distinction explicite, sur les fiches liées, entre une relation vers un enregistrement actif, en corbeille, ou définitivement supprimé (`findLinked`/`linkedRecordFieldHTML`).
- Deux bugs découverts et corrigés en cours d'implémentation : l'export JSON/CSV et `normalizeRequest()` auraient silencieusement perdu les éléments en corbeille sans le correctif dédié.
- Voir `docs/V6.2-C-DESIGN.md` (analyse préparatoire) et `docs/V6.2-C-IMPLEMENTATION.md` (résultat, limitations, décision sur les transactions Dexie).

## V6.2.a / V6.2.b — Avertissements de liens, rapport d'import détaillé

- Avant suppression d'une Personne/d'un Clocher/d'un Personnel, avertissement du nombre de demandes/intentions/annonces liées (`describeLinkedRecords`), sans jamais détacher automatiquement le lien.
- Rapport d'import CSV structuré (`buildImportReportHTML`) : nombre importé, lignes ignorées avec raison, dates non reconnues — au lieu d'un simple compteur agrégé.

## V6.1 — Fondations (architecture)

- Couche repository (`js/repositories/`) : une enveloppe par table Dexie, `list()`/`get()`/`put()`/`remove()`/`bulkPut()`/`clear()`.
- `js/core/errors.js` (`ValidationError`/`NotFoundError`) et `js/core/logger.js` (ne journalise jamais un enregistrement métier complet).
- Revu et corrigé en V6.0/V6.1 review (`docs/REVIEW-V6.0-V6.1.md`) : `ValidationError`/`NotFoundError` avaient été créées sans être utilisées ; corrigé (6 sites).

## V6.0 — Urgence confidentialité

- Retrait du suivi git de `membreParoisse.csv`/`.xlsx` (données réelles) et durcissement de `.gitignore`.
- **Décisions restées ouvertes**, appartenant au propriétaire du dépôt : rendre le dépôt privé, réécrire l'historique git pour purger les anciens commits qui contiennent encore ces fichiers. Voir `docs/SECURITY.md`.

## Antérieur à V6.0

Scaffold initial : demandes, personnes, agenda (schedule), clochers, personnel, intentions, export/import JSON et CSV, recherche globale, PWA — sans repository ni historique généralisé ni corbeille, ajoutés progressivement à partir de V6.1.
