"use strict";

/* ============================================================
   ANNUAIRE — FONDATIONS (V6.8.a)
   Voir docs/V6.7-ANNUAIRE-DESIGN.md pour la conception complète et
   docs/V6.8-A-ANNUAIRE-FONDATIONS.md pour ce qui a réellement été
   implémenté dans cette sous-phase.

   Ce fichier ne remplace ENCORE aucun écran : `people.js`/`personnel.js`
   restent les modules actifs, `directory` est construite en parallèle
   pour préparer V6.8.b (nouvelle interface Annuaire) et V6.8.c
   (bascule des références croisées, historique, corbeille, recherche,
   diagnostic, import/export).
============================================================ */

/* ============================================================
   TRANSFORMATION people -> directory
   Convention identité/rôle (V6.7 §5.3/5.4) : nom, prénom, coordonnées,
   état civil (naissance/décès/filiation) restent des données
   d'identité, indépendantes du rôle. Les champs sacramentaux et le
   consentement RGPD, eux, n'existent que parce que la personne porte
   le rôle "registre" — déplacés dans le rôle, jamais perdus.
============================================================ */
function personToDirectoryEntry(person) {
    const isParoissien = (person.profileType || "paroissien") === "paroissien";

    // Rôle unique déduit de profileType (V6.7 §9.1) : "paroissien" ->
    // registre (avec tous les champs sacramentaux existants, y compris
    // le champ people.registre lui-même — un nom de champ qui coïncide
    // avec le nom du rôle par hasard, ce n'est pas la même chose : ici
    // c'est le registre paroissial papier où la personne est inscrite,
    // conservé tel quel à l'intérieur du rôle "registre"), "contact" ->
    // contact (aucun champ propre, voir V6.7 §5.2).
    const roles = isParoissien
        ? [{
            type: "registre",
            active: true,
            rgpd: Boolean(person.rgpd),
            registre: person.registre || "",
            lieuBapteme: person.lieuBapteme || "",
            diocese: person.diocese || "",
            anneeBapteme: person.anneeBapteme || "",
            numeroBapteme: person.numeroBapteme || "",
            dateBapteme: person.dateBapteme || "",
            parrain: person.parrain || "",
            marraine: person.marraine || "",
            temoin: person.temoin || "",
            dateCommunion: person.dateCommunion || "",
            lieuCommunion: person.lieuCommunion || "",
            dateConfirmation: person.dateConfirmation || "",
            lieuConfirmation: person.lieuConfirmation || "",
            dateMariage: person.dateMariage || "",
            lieuMariage: person.lieuMariage || "",
            conjoint: person.conjoint || ""
        }]
        : [{ type: "contact", active: true }];

    // people.role / people.groupe (V6.2-antérieur, texte libre, jamais
    // structuré) : consigne explicite de ne PAS les interpréter comme
    // des rôles — conservés tels quels dans notes, clairement étiquetés,
    // pour ne perdre aucune information.
    const legacyNotes = [];
    if (person.role) legacyNotes.push(`Rôle (ancien champ libre) : ${person.role}`);
    if (person.groupe) legacyNotes.push(`Groupe (ancien champ libre) : ${person.groupe}`);
    const notes = [person.notes || "", ...legacyNotes].filter(Boolean).join("\n\n");

    return {
        id: person.id,
        entityType: "person",
        prenom: person.prenom || "",
        nom: person.nom || "",
        dateNaissance: person.dateNaissance || "",
        lieuNaissance: person.lieuNaissance || "",
        dateDeces: person.dateDeces || "",
        pere: person.pere || "",
        mere: person.mere || "",
        telephone: person.telephone || "",
        email: person.email || "",
        adresse: person.adresse || "",
        notes,
        roles,
        // Provenance temporaire (V6.7 §9, "si cela facilite fortement le
        // diagnostic") : utile pour distinguer, pendant V6.8.b/c, une
        // entrée migrée de people d'une entrée migrée de personnel sans
        // devoir deviner à partir des rôles. Pas un champ du modèle
        // fonctionnel final — à retirer si V6.9 confirme qu'il n'est
        // plus utile une fois la bascule stabilisée.
        migratedFrom: "people",
        createdAt: person.createdAt || nowISO(),
        updatedAt: person.updatedAt || nowISO(),
        deletedAt: person.deletedAt || null
    };
}

/* ============================================================
   TRANSFORMATION personnel -> directory
   Deux rôles indépendants peuvent naître d'un seul enregistrement
   personnel (ex. prêtre salarié -> "clerge" + "salarie"), chacun
   copiant dateDebut/dateFin/active tels quels : l'ancien modèle ne
   distinguait qu'un seul engagement par fiche, donc les deux rôles
   dérivés partagent nécessairement les mêmes dates faute de mieux —
   limite connue, documentée, pas une perte de données (rien de plus
   précis n'existait dans la donnée source).
============================================================ */
function personnelToDirectoryEntry(personnel) {
    const roles = [];
    const active = Boolean(personnel.active);

    if (personnel.typeEngagement === "Salarié") {
        roles.push({
            type: "salarie",
            active,
            dateDebut: personnel.dateDebut || "",
            dateFin: personnel.dateFin || "",
            fonction: personnel.fonction || ""
        });
    } else if (personnel.typeEngagement === "Bénévole") {
        roles.push({
            type: "benevole",
            active,
            dateDebut: personnel.dateDebut || "",
            dateFin: personnel.dateFin || "",
            // "domaine" plutôt que "fonction" : plus parlant pour un
            // engagement bénévole (V6.7 §5.5), même donnée source.
            domaine: personnel.fonction || ""
        });
    }

    // Jamais de rôle "clerge" pour "Laïc" — règle explicite, pas une
    // déduction. etatCanonique conserve la valeur telle quelle (Prêtre/
    // Diacre/Religieux(se)), aucune renormalisation.
    if (personnel.etat && personnel.etat !== "Laïc") {
        roles.push({
            type: "clerge",
            active,
            etatCanonique: personnel.etat,
            dateDebut: personnel.dateDebut || "",
            dateFin: personnel.dateFin || ""
        });
    }

    // Cas anomalie (V6.7 : "ne pas inventer de rôle... traiter le cas de
    // manière explicite plutôt que d'inventer arbitrairement un rôle") :
    // aucun typeEngagement reconnu ET etat "Laïc"/absent -> roles reste
    // vide. On ne fabrique PAS un rôle "contact" ou autre par défaut ;
    // le migrateur (computeDirectoryMigration ci-dessous) le signale
    // comme avertissement, et les données brutes non interprétées sont
    // conservées dans les notes pour qu'aucune information ne se perde.
    const notesParts = [personnel.notes || ""];
    if (!roles.length) {
        notesParts.push(`Donnée d'engagement non interprétée automatiquement lors de la migration : typeEngagement="${personnel.typeEngagement || ""}", etat="${personnel.etat || ""}", fonction="${personnel.fonction || ""}".`);
    }

    return {
        id: personnel.id,
        entityType: "person",
        prenom: personnel.prenom || "",
        nom: personnel.nom || "",
        telephone: personnel.telephone || "",
        email: personnel.email || "",
        adresse: personnel.adresse || "",
        notes: notesParts.filter(Boolean).join("\n\n"),
        roles,
        migratedFrom: "personnel",
        createdAt: personnel.createdAt || nowISO(),
        updatedAt: personnel.updatedAt || nowISO(),
        deletedAt: personnel.deletedAt || null
    };
}

/* ============================================================
   HELPERS DE LECTURE DES RÔLES
   roles est une liste d'objets, jamais un objet unique par type — une
   même personne peut porter plusieurs instances du même rôle (ex.
   deux engagements bénévoles dans des domaines différents, V6.7 et la
   mission V6.8.a). Ne jamais coder en supposant qu'un seul objet peut
   exister par type.
============================================================ */

// Présence d'AU MOINS UNE instance active du rôle demandé — "active"
// fait foi (V6.7/V6.8.a), pas une déduction à partir de dates. Une
// instance sans champ `active` explicite est considérée active par
// défaut (cohérent avec la valeur par défaut posée par les deux
// fonctions de transformation ci-dessus).
function hasRole(entry, roleType) {
    return (entry?.roles || []).some(r => r.type === roleType && r.active !== false);
}

// Toutes les instances d'un rôle donné (actives ou non) — utile dès
// qu'on a besoin du détail (ex. les deux engagements bénévoles d'une
// même personne), pas seulement de savoir si le rôle est présent.
function getRolesByType(entry, roleType) {
    return (entry?.roles || []).filter(r => r.type === roleType);
}

/* ============================================================
   MIGRATION people + personnel -> directory
   Additive et idempotente : ne modifie jamais people/personnel, ne
   régénère jamais un id, ne recrée jamais une entrée directory déjà
   présente (même si la fiche source a changé depuis) — voir
   docs/V6.8-A-ANNUAIRE-FONDATIONS.md pour la justification détaillée
   de ce choix (pas de transaction Dexie nécessaire : l'idempotence par
   id suffit à rendre une exécution partielle sans risque, elle se
   complète simplement au prochain démarrage).
============================================================ */

// Partie pure (sans Dexie) : calcule ce qu'il faut créer à partir de
// l'état déjà connu. Isolée pour rester testable sans mock Dexie —
// même principe que detectBackupPayload() (V6.3, js/core/backup.js).
function computeDirectoryMigration(existingDirectoryIds, peopleRecords, personnelRecords) {
    const toCreate = [];
    const report = { createdFromPeople: 0, createdFromPersonnel: 0, skipped: 0, warnings: [] };

    (peopleRecords || []).forEach(p => {
        if (existingDirectoryIds.has(p.id)) { report.skipped++; return; }
        toCreate.push(personToDirectoryEntry(p));
        report.createdFromPeople++;
    });

    (personnelRecords || []).forEach(p => {
        if (existingDirectoryIds.has(p.id)) { report.skipped++; return; }
        const entry = personnelToDirectoryEntry(p);
        if (!entry.roles.length) {
            report.warnings.push(`personnel ${p.id} (${p.prenom || ""} ${p.nom || ""}) migré sans rôle déterminable (typeEngagement="${p.typeEngagement || ""}", etat="${p.etat || ""}") — à vérifier manuellement.`);
        }
        toCreate.push(entry);
        report.createdFromPersonnel++;
    });

    return { toCreate, report };
}

// Enveloppe Dexie : lit l'existant, délègue le calcul à la fonction
// pure ci-dessus, écrit uniquement les entrées réellement nouvelles.
// Appelée à chaque démarrage (js/main.js) : sans effet une fois que
// tout est déjà migré, et reprend automatiquement toute nouvelle
// fiche people/personnel créée depuis (les deux modules restent actifs
// pendant V6.8.a/b).
async function migratePeopleAndPersonnelToDirectory() {
    const existingIds = new Set((await DirectoryRepository.list()).map(e => e.id));
    const people = await PeopleRepository.list();
    const personnel = await PersonnelRepository.list();

    const { toCreate, report } = computeDirectoryMigration(existingIds, people, personnel);

    if (toCreate.length) await DirectoryRepository.bulkPut(toCreate);
    report.warnings.forEach(w => Logger.warn("directory.migration", w));

    return report;
}

async function loadDirectoryData() {
    state.directory = await DirectoryRepository.listActive();
    state.directoryTrash = await DirectoryRepository.listDeleted();
}
