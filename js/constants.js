"use strict";

/* ============================================================
   CONSTANTES MÉTIER
   Vocabulaire et référentiels partagés entre modules (regroupés ici
   pour n'avoir qu'un seul endroit à modifier si la paroisse veut
   ajuster un type de demande, une catégorie d'annonce, etc.).
============================================================ */

/* --- Version applicative (V6.3) ---
   Suit la numérotation de la feuille de route (docs/ROADMAP.md), pas
   un numéro de build automatique — le projet n'a pas d'étape de build.
   Utilisée uniquement dans le format de sauvegarde JSON (appVersion),
   à titre indicatif pour le diagnostic, jamais comme critère de
   validation (databaseVersion, ci-dessous côté import, en est un). */
const APP_VERSION = "6.3.0";

/* --- Demandes --- */
const REQUEST_TYPES = [
    "Certificat de baptême", "Certificat de mariage", "Certificat de décès",
    "Demande de messe", "Baptême", "Mariage", "Confirmation", "Obsèques",
    "Concert", "Réunion paroissiale", "Rendez-vous", "Inscription",
    "Document administratif", "Autre"
];

const STATUS = ["En attente", "En cours", "Terminé", "Annulé"];
const PRIORITIES = ["Normale", "Urgente"];

// Toutes les demandes ne se gèrent pas pareil : un certificat est un
// document à délivrer, un événement a une date/heure/lieu de cérémonie
// à suivre (et alimente l'agenda). Cette catégorisation pilote
// l'affichage du formulaire et de la fiche (voir requestCategory()
// dans js/requests.js).
const REQUEST_TYPE_CATEGORY = {
    "Certificat de baptême": "certificate",
    "Certificat de mariage": "certificate",
    "Certificat de décès": "certificate",
    "Document administratif": "certificate",
    "Demande de messe": "event",
    "Baptême": "event",
    "Mariage": "event",
    "Confirmation": "event",
    "Obsèques": "event",
    "Concert": "event",
    "Réunion paroissiale": "event",
    "Rendez-vous": "event",
    "Inscription": "admin",
    "Autre": "admin"
};

/* --- Annonces (horaires paroissiaux) --- */
const SCHEDULE_CATEGORIES = ["Messe", "Confession", "Adoration", "Réunion", "Autre"];
const WEEKDAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/* --- Certificats & documents (fiche Personne) --- */
const CERTIFICATES = {
    bapteme: { label: "Certificat de baptême", requires: "dateBapteme" },
    communion: { label: "Certificat de communion", requires: "dateCommunion" },
    confirmation: { label: "Certificat de confirmation", requires: "dateConfirmation" },
    mariage: { label: "Certificat de mariage", requires: "dateMariage" }
};

/* --- Personnel (bénévoles, salariés, clergé) --- */
const PERSONNEL_TYPES = ["Bénévole", "Salarié"];
const PERSONNEL_ETATS = ["Laïc", "Prêtre", "Diacre", "Religieux(se)"];

/* --- Intentions de messe --- */
// « Neuvaine » = 9 messes sur 9 jours consécutifs à partir de dateDebut ;
// les autres types couvrent une messe unique (voir intentionDateRange()
// dans js/intentions.js).
const INTENTION_TYPES = ["Défunt", "Anniversaire", "Neuvaine", "Action de grâce", "Vivants", "Autre"];
const INTENTION_STATUS = ["À célébrer", "Célébrée", "Annulée"];

/* --- Historique & corbeille (V6.2.c) — vocabulaire contrôlé, jamais
   de texte libre, pour rester exploitable (ex. filtrer par action) --- */
const ENTITY_TYPES = ["request", "person", "schedule", "clocher", "personnel", "intention"];

// "restore" sert à la fois pour une demande désarchivée et pour un
// enregistrement restauré depuis la corbeille : un seul mot pour une
// seule idée ("remis en état actif"), pas de synonyme superflu.
// Liste purement descriptive (rien ne valide les entrées existantes
// contre elle) : "delete" a été utilisé par d'anciennes entrées, avant
// la corbeille (V6.2.c), quand la suppression était encore directe et
// définitive. Elles restent lisibles telles quelles, seul l'écriture
// de nouvelles entrées se limite désormais à cette liste.
const HISTORY_ACTIONS = ["create", "update", "archive", "restore", "complete", "trash", "purge"];

// Libellés humains par type d'entité, réutilisés par la Corbeille et
// les futures vues d'historique transverses.
const ENTITY_TYPE_LABELS = {
    request: "Demande",
    person: "Personne",
    schedule: "Annonce",
    clocher: "Clocher",
    personnel: "Personnel",
    intention: "Intention"
};
