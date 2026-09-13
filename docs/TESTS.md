# Tests

## Philosophie

gParoisse n'a aucune dépendance de build ; les tests suivent la même logique : **aucun framework, aucun `package.json`, exécution directe via Node.** Ce n'est pas un choix provisoire — tant que le projet reste « zéro build », les tests doivent pouvoir tourner de la même façon.

## Ce qui est testé aujourd'hui

`tests/pure-functions.test.js` — 31 assertions sur les fonctions **pures** (aucune dépendance au DOM ni à Dexie), chargées directement depuis les vrais fichiers source via le module `vm` de Node (pas de réimplémentation parallèle : on exécute le code réel) :

- `js/utils.js` : `computeAge` (dont années bissextiles, veille d'anniversaire), `normalize`, `escapeHTML`, `addDays`/`daysBetween`, `sortByKey`, `paginate`.
- `js/csv.js` : `parseCSV` (délimiteur `;`/`,`, guillemets échappés, BOM UTF-8, lignes vides), `parseFrenchDate` (jj/mm/aaaa, ISO, numéro de série Excel).
- `js/requests.js` : `normalizeRequest` (conservation de l'id, valeurs par défaut, rétrocompatibilité des anciens noms de champs français).
- `js/schedule.js` : `scheduleOccursOn` (récurrence hebdomadaire, date unique, annonce suspendue).
- `js/intentions.js` : `intentionEndDate`/`intentionOccursOn` (neuvaine de 9 messes consécutifs, intention annulée).

## Exécuter les tests

```
node tests/pure-functions.test.js
```

Sortie : une ligne par test (`ok`/`FAIL`), puis un total. Code de sortie non nul si un test échoue (utilisable dans un script ou un hook).

## Ce qui n'est pas testé (et pourquoi)

- **Tout ce qui touche le DOM** (`$()`, `innerHTML`, `showXDetail()`…) : nécessiterait `jsdom` ou une séparation calcul/rendu qui n'existe pas encore.
- **Tout ce qui touche Dexie/IndexedDB directement** (`RequestsRepository.put()`, l'export/import réel, une migration de schéma) : nécessiterait soit un navigateur réel, soit un polyfill (`fake-indexeddb`). Aucun des deux n'est présent dans le projet aujourd'hui. Un test manuel dans un navigateur (créer/modifier/supprimer une fiche, exporter puis réimporter une sauvegarde JSON) reste nécessaire avant de pousser un changement sensible, tant que ce polyfill n'est pas ajouté.
- **Les parcours UI complets** (ouvrir l'app → rechercher → ouvrir une fiche → modifier → enregistrer → revenir) : à tester manuellement dans un navigateur.

## Note technique : `vm.createContext` et les « realms »

Le harnais charge chaque fichier source dans un contexte `vm` séparé du contexte Node principal. Une conséquence : un tableau/objet **créé à l'intérieur** de ce contexte n'est pas `instanceof Array`/`Object` au sens du contexte appelant (deux « realms » JS différents), même si son contenu est identique. `assert.deepStrictEqual` échoue alors à tort sur ce genre de valeur. Le fichier de test compare ces cas via `JSON.stringify` plutôt que `deepStrictEqual` — voir la fonction `assertSameStructure` dans `tests/pure-functions.test.js`. Ce n'est pas un bug du code source, uniquement une particularité du harnais de test.
