# Tests

## Philosophie

gParoisse n'a aucune dépendance de build ; les tests suivent la même logique : **aucun framework, aucun `package.json`, exécution directe via Node.** Ce n'est pas un choix provisoire — tant que le projet reste « zéro build », les tests doivent pouvoir tourner de la même façon.

## Ce qui est testé aujourd'hui

`tests/pure-functions.test.js` — 67 assertions sur les fonctions **pures** (aucune dépendance au DOM ni à Dexie), chargées directement depuis les vrais fichiers source via le module `vm` de Node (pas de réimplémentation parallèle : on exécute le code réel) :

- `js/utils.js` : `computeAge` (dont années bissextiles, veille d'anniversaire), `normalize`, `escapeHTML`, `addDays`/`daysBetween`, `sortByKey`, `paginate`, `countByField`/`joinFrenchList`/`describeLinkedRecords` (V6.2.a), `buildImportReportHTML` (V6.2.b), `isDeleted`/`isActive`/`findLinked` (V6.2.c).
- `js/csv.js` : `parseCSV` (délimiteur `;`/`,`, guillemets échappés, BOM UTF-8, lignes vides), `parseFrenchDate` (jj/mm/aaaa, ISO, numéro de série Excel).
- `js/requests.js` : `normalizeRequest` (conservation de l'id, valeurs par défaut, rétrocompatibilité des anciens noms de champs français).
- `js/schedule.js` : `scheduleOccursOn` (récurrence hebdomadaire, date unique, annonce suspendue).
- `js/intentions.js` : `intentionEndDate`/`intentionOccursOn` (neuvaine de 9 messes consécutifs, intention annulée).
- `js/core/history.js` : `historyEntityType`/`historyEntityId` (compatibilité des entrées d'historique antérieures à V6.2.c, sans `entityType`/`entityId`).
- `js/core/backup.js` : `detectBackupPayload` (V6.3 — format structuré valide, `formatVersion`/`format` inconnus, `data` manquant, ancien format plat reconnu, JSON sans rapport rejeté).

Cette liste couvre déjà, et dépasse, les fonctions identifiées comme testables dans `docs/AUDIT.md` §8 (`utils.js`, `csv.js`, logique de dates récurrentes, `normalizeRequest`) — ce point de la feuille de route (V6.5) est donc satisfait par le travail déjà accompli en V6.1/V6.2/V6.3, pas par un ajout dédié en V6.5.

## Exécuter les tests

```
node tests/pure-functions.test.js
```

Sortie : une ligne par test (`ok`/`FAIL`), puis un total. Code de sortie non nul si un test échoue (utilisable dans un script ou un hook).

## Ce qui n'est pas testé (et pourquoi)

- **Tout ce qui touche le DOM** (`$()`, `innerHTML`, `showXDetail()`…) : nécessiterait `jsdom` ou une séparation calcul/rendu qui n'existe pas encore.
- **Tout ce qui touche Dexie/IndexedDB directement** (`RequestsRepository.put()`, l'export/import réel, une migration de schéma) : nécessiterait soit un navigateur réel, soit un polyfill (`fake-indexeddb`). Aucun des deux n'est présent dans le projet aujourd'hui. Un test manuel dans un navigateur (créer/modifier/supprimer une fiche, exporter puis réimporter une sauvegarde JSON) reste nécessaire avant de pousser un changement sensible, tant que ce polyfill n'est pas ajouté.
- **Les parcours UI complets** (ouvrir l'app → rechercher → ouvrir une fiche → modifier → enregistrer → revenir) : à tester manuellement dans un navigateur.

**Statut factuel des tests manuels** : aucun test manuel en navigateur n'a été exécuté pendant l'implémentation de V6.2.c, V6.3 et V6.5 — ces sessions n'avaient pas d'environnement navigateur disponible. Ce n'est pas documenté comme fait ailleurs par erreur ; chaque document d'implémentation le rappelle explicitement (`docs/V6.2-C-IMPLEMENTATION.md` §7). Les scénarios de validation manuelle restent à exécuter avant toute mise en production.

## Note technique : `vm.createContext` et les « realms »

Le harnais charge chaque fichier source dans un contexte `vm` séparé du contexte Node principal. Une conséquence : un tableau/objet **créé à l'intérieur** de ce contexte n'est pas `instanceof Array`/`Object` au sens du contexte appelant (deux « realms » JS différents), même si son contenu est identique. `assert.deepStrictEqual` échoue alors à tort sur ce genre de valeur. Le fichier de test compare ces cas via `JSON.stringify` plutôt que `deepStrictEqual` — voir la fonction `assertSameStructure` dans `tests/pure-functions.test.js`. Ce n'est pas un bug du code source, uniquement une particularité du harnais de test.
