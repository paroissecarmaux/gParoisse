"use strict";

/* ============================================================
   FORMAT DE SAUVEGARDE (V6.3)
   Structure écrite par exportJSON() (js/settings.js) :

   { format: "gparoisse-backup", formatVersion: 1, appVersion,
     databaseVersion, createdAt, settings, data: { requests: [...],
     ..., history: [...] } }

   detectBackupPayload() est isolée ici (plutôt que dans settings.js)
   pour rester une fonction pure testable sans charger tout le reste
   de l'application (DATA_MODULES référence les 6 modules métier) —
   même esprit que js/core/history.js.
============================================================ */
const BACKUP_FORMAT = "gparoisse-backup";
const BACKUP_FORMAT_VERSION = 1;

// Reconnaît la forme du fichier importé et renvoie { data, history } où
// `data` porte les mêmes clés que moduleKeys (comme avant V6.3, quand les
// tables étaient directement au premier niveau de l'objet). Rejette
// (ValidationError, message explicite) tout fichier qui ne correspond à
// aucun format connu, plutôt que d'accepter silencieusement n'importe
// quel JSON qui contiendrait par hasard un champ "requests".
function detectBackupPayload(parsed, moduleKeys) {
    // Tout premier format (pré-V6.0) : un tableau brut de demandes.
    if (Array.isArray(parsed)) {
        return { data: { requests: parsed }, history: [] };
    }
    if (!parsed || typeof parsed !== "object") {
        throw new ValidationError("Fichier de sauvegarde invalide : ce n'est pas un JSON exploitable.");
    }

    // Format structuré (V6.3+) : { format, formatVersion, data: {...} }.
    if (parsed.format !== undefined || parsed.formatVersion !== undefined) {
        if (parsed.format !== BACKUP_FORMAT) {
            throw new ValidationError(`Ce fichier n'est pas une sauvegarde gParoisse reconnue (format « ${parsed.format} »).`);
        }
        if (parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
            throw new ValidationError(`Version de sauvegarde non prise en charge (formatVersion ${parsed.formatVersion}).`);
        }
        if (!parsed.data || typeof parsed.data !== "object") {
            throw new ValidationError("Fichier de sauvegarde invalide : aucune donnée trouvée (« data » manquant).");
        }
        return { data: parsed.data, history: Array.isArray(parsed.data.history) ? parsed.data.history : [] };
    }

    // Ancien format plat (V6.0 à V6.2.c) : les tables sont directement au
    // premier niveau de l'objet. Reconnu seulement s'il porte au moins une
    // des clés de modules attendues, pour ne pas accepter n'importe quel
    // JSON sans rapport.
    if (moduleKeys.some(key => Array.isArray(parsed[key]))) {
        return { data: parsed, history: [] };
    }

    throw new ValidationError("Fichier de sauvegarde invalide : aucune donnée reconnue dans ce fichier.");
}
