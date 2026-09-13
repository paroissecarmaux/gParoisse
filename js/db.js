"use strict";

/* ============================================================
   BASE DEXIE (IndexedDB)
   Schéma partagé par tous les modules. Une nouvelle version doit
   être ajoutée (jamais modifiée rétroactivement) à chaque évolution
   de la structure, pour préserver les données déjà enregistrées.

   Chaque appel à .version(N).stores({...}) doit lister l'intégralité
   des tables (pas seulement celles qui changent) : c'est ainsi que
   Dexie fonctionne — la liste la plus récente décrit l'état courant,
   les précédentes ne servent qu'à migrer les bases existantes.
   La chaîne de caractères par table n'énumère que les champs
   indexés (recherchables/triables) ; un enregistrement peut avoir
   d'autres champs non listés ici (ex. toutes les colonnes du
   formulaire Personne), stockés normalement mais non indexés.
============================================================ */
const db = new Dexie("paroisse_secretariat");

// v5 : version initiale (demandes + historique + paramètres).
db.version(5).stores({
    requests: "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name",
    history: "id, requestId, createdAt",
    settings: "key"
});

// v6 : ajout de l'annuaire des personnes.
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

// v8 : ajout du référentiel des clochers de la paroisse, recherchable
// depuis les demandes, annonces et fiches personnes pour lier un lieu
// de cérémonie à une fiche précise plutôt qu'à du texte libre.
db.version(8).stores({
    requests: "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name",
    history: "id, requestId, createdAt",
    settings: "key",
    people: "id, nom, prenom, updatedAt",
    schedule: "id, kind, dayOfWeek, date, updatedAt",
    clochers: "id, nom, commune, updatedAt"
});

// v9 : ajout du Personnel (bénévoles, salariés, clergé) et des
// Intentions de messe, qui alimentent aussi l'agenda et se lient au
// Personnel (célébrant), aux Personnes (demandeur) et aux Clochers (lieu).
db.version(9).stores({
    requests: "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name",
    history: "id, requestId, createdAt",
    settings: "key",
    people: "id, nom, prenom, updatedAt",
    schedule: "id, kind, dayOfWeek, date, updatedAt",
    clochers: "id, nom, commune, updatedAt",
    personnel: "id, nom, prenom, typeEngagement, active, updatedAt",
    intentions: "id, type, statut, dateDebut, updatedAt"
});

// v10 : corbeille + historique généralisé (V6.2.c).
// - deletedAt (toutes les tables métier) : volontairement NON indexé
//   (peu de bases dépassent quelques milliers d'enregistrements, un
//   filtre en mémoire sur listActive()/listDeleted() suffit — voir
//   js/repositories/repositoryFactory.js). Les chaînes d'index ci-
//   dessous sont donc identiques à la v9 pour ces tables : Dexie
//   exige de toutes les relister, mais rien n'y change réellement.
// - history gagne entityType/entityId (indexés, remplacent l'usage
//   futur de requestId) pour couvrir tous les modules et pas
//   seulement les demandes ; requestId reste indexé pour ne pas
//   perdre l'accès aux entrées déjà enregistrées avant cette version
//   (lues comme entityType="request", entityId=requestId — voir
//   js/core/history.js).
db.version(10).stores({
    requests: "id, status, type, priority, dateDemande, deadline, updatedAt, archived, name",
    history: "id, requestId, entityType, entityId, createdAt",
    settings: "key",
    people: "id, nom, prenom, updatedAt",
    schedule: "id, kind, dayOfWeek, date, updatedAt",
    clochers: "id, nom, commune, updatedAt",
    personnel: "id, nom, prenom, typeEngagement, active, updatedAt",
    intentions: "id, type, statut, dateDebut, updatedAt"
});
