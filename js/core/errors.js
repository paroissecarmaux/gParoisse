"use strict";

/* ============================================================
   ERREURS MÉTIER
   Hiérarchie volontairement minimale : distinguer une erreur de
   validation (message déjà adapté à l'affichage utilisateur)
   d'une erreur inattendue (à journaliser, message générique à
   l'écran). Pas de code d'erreur ni de métadonnées superflues
   tant qu'aucun appelant n'en a besoin.
============================================================ */
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
    }
}
