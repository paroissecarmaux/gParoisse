"use strict";

/* ============================================================
   LOGGER
   Fine couche au-dessus de console.error/warn : centralise la
   journalisation pour qu'aucun appelant ne soit tenté d'y faire
   passer un enregistrement complet (nom, téléphone, adresse…).
   On ne journalise qu'un contexte (ex. "people.savePerson") et
   le message technique de l'erreur — jamais l'objet métier.
============================================================ */
const Logger = {
    error(context, err) {
        console.error(`[${context}]`, err?.message || err);
    },
    warn(context, message) {
        console.warn(`[${context}]`, message);
    }
};
