"use strict";

/* ============================================================
   FABRIQUE DE REPOSITORIES
   Chaque repository est une fine enveloppe autour d'une table
   Dexie : centraliser l'accès ici permet de changer un jour de
   moteur de stockage (ou d'ajouter une règle transverse, ex. un
   log) sans toucher aux modules métier qui l'utilisent.

   Volontairement minimal pour l'instant (V6.1) : aucune logique
   métier n'est déplacée ici, seulement l'accès Dexie déjà fait
   directement dans chaque module. `listFn` permet de conserver
   l'ordre de tri déjà en place (ex. par updatedAt décroissant)
   plutôt que d'imposer un ordre générique.
============================================================ */
function createRepository(table, listFn) {
    return {
        list: listFn || (() => table.toArray()),
        get: id => table.get(id),
        put: record => table.put(record),
        remove: id => table.delete(id),
        bulkPut: records => table.bulkPut(records),
        clear: () => table.clear()
    };
}
