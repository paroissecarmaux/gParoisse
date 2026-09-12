"use strict";

/* ============================================================
   BASE DEXIE (IndexedDB)
   Schéma partagé par tous les modules. Une nouvelle version doit
   être ajoutée (jamais modifiée rétroactivement) à chaque évolution
   de la structure, pour préserver les données déjà enregistrées.
============================================================ */
const db = new Dexie("paroisse_secretariat");

db.version(5).stores({
    requests: "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name",
    history: "id, requestId, createdAt",
    settings: "key"
});

db.version(6).stores({
    requests: "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name",
    history: "id, requestId, createdAt",
    settings: "key",
    people: "id, nom, prenom, updatedAt"
});

// v7 : ajout de l'agenda paroissial (horaires récurrents et annonces
// ponctuelles), qui alimente le module Agenda aux côtés des demandes.
db.version(7).stores({
    requests: "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name",
    history: "id, requestId, createdAt",
    settings: "key",
    people: "id, nom, prenom, updatedAt",
    schedule: "id, kind, dayOfWeek, date, updatedAt"
});
