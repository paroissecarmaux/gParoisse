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

// Une entrée sans aucun rôle est valide techniquement (ex. tout juste
// créée, ou héritée d'une migration V6.8.a qui n'a pas pu en déduire
// un) mais reste une anomalie à corriger — jamais supprimée
// automatiquement, seulement signalée (V6.8.b §5).
function hasNoRole(entry) {
    return !(entry?.roles?.length);
}

// Nom affichable d'une entrée, quel que soit son entityType — utilisé
// par js/annuaire.js, js/search.js et js/diagnostics.js (V6.8.c) :
// centralisé ici plutôt que dupliqué dans chacun.
function directoryDisplayName(entry) {
    if (entry.entityType === "organization") return entry.nom || "Organisation sans nom";
    return `${entry.prenom || ""} ${entry.nom || ""}`.trim() || "Sans nom";
}

/* ============================================================
   CRÉATION / MODIFICATION (V6.8.b) — fonctions pures, testables sans
   DOM ni Dexie. Chacune renvoie une NOUVELLE entrée (l'original n'est
   jamais muté) ; c'est ce qui évite le piège "entry.roles = [x]" qui
   écraserait les autres rôles au lieu de n'en modifier qu'un.
============================================================ */
function createDefaultDirectoryEntry(entityType) {
    const now = nowISO();
    return {
        id: uid(),
        entityType: entityType || "person",
        prenom: "", nom: "",
        dateNaissance: "", lieuNaissance: "", dateDeces: "", pere: "", mere: "",
        telephone: "", email: "", adresse: "", notes: "",
        // Volontairement vide : ne jamais ajouter un rôle par défaut
        // (ex. "contact") sans demande explicite de l'utilisateur.
        roles: [],
        createdAt: now, updatedAt: now, deletedAt: null
    };
}

// Modifie uniquement les champs d'identité fournis ; `roles` est
// recopié tel quel (même contenu, jamais recalculé ni vidé) — la
// fiche identité ne doit jamais pouvoir toucher aux rôles.
function updateDirectoryIdentity(entry, identityFields) {
    return { ...entry, ...identityFields, roles: entry.roles, updatedAt: nowISO() };
}

// Construit un objet rôle à partir de valeurs déjà extraites d'un
// formulaire (readRoleFieldsFromForm(), js/annuaire.js) — reste pure
// en recevant des valeurs déjà lues plutôt que d'aller chercher le DOM.
function buildRoleInstance(roleType, fieldValues, active) {
    return { type: roleType, active: active !== false, ...(fieldValues || {}) };
}

// Ajoute (roleIndex null/undefined) ou remplace (roleIndex) un rôle,
// tous les autres restant inchangés à leur place — jamais
// `roles = [roleObject]`.
function upsertRole(entry, roleIndex, roleObject) {
    const roles = (entry.roles || []).slice();
    if (roleIndex === null || roleIndex === undefined) roles.push(roleObject);
    else roles[roleIndex] = roleObject;
    return { ...entry, roles, updatedAt: nowISO() };
}

// Retire uniquement l'instance à roleIndex, les autres sont conservées.
function removeRoleAt(entry, roleIndex) {
    return { ...entry, roles: (entry.roles || []).filter((_, i) => i !== roleIndex), updatedAt: nowISO() };
}

// Bascule active/inactive sur une seule instance, les autres (même du
// même type) restent inchangées.
function setRoleActive(entry, roleIndex, active) {
    const roles = (entry.roles || []).map((r, i) => (i === roleIndex ? { ...r, active } : r));
    return { ...entry, roles, updatedAt: nowISO() };
}

/* ============================================================
   RECHERCHE & FILTRAGE (V6.8.b) — fonctions pures réutilisées par
   js/annuaire.js pour la liste principale.
============================================================ */
function directoryMatchesQuery(entry, normalizedQuery) {
    if (!normalizedQuery) return true;
    const haystack = normalize([entry.prenom, entry.nom, entry.telephone, entry.email, entry.adresse].join(" "));
    return haystack.includes(normalizedQuery);
}

// roleFilter "all"/vide -> tout ; "no_role" -> uniquement les entrées
// sans aucun rôle (voir hasNoRole) ; sinon -> hasRole() sur ce type
// (au moins une instance active suffit, cf. §5.2/§7 de la conception).
function directoryMatchesRoleFilter(entry, roleFilter) {
    if (!roleFilter || roleFilter === "all") return true;
    if (roleFilter === "no_role") return hasNoRole(entry);
    return hasRole(entry, roleFilter);
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

/* ============================================================
   RÉSOLUTION D'IDENTITÉ (V6.8.c)
   requests.personId / intentions.personId / intentions.personnelId
   gardent leur nom et leur contenu tels quels — seule la source
   utilisée pour AFFICHER l'identité correspondante change : `directory`
   en priorité, avec repli vers les anciennes tables people/personnel
   pour compatibilité (jamais l'inverse, jamais de création automatique
   d'une entrée directory manquante — voir
   docs/V6.8-C-ANNUAIRE-INTEGRATION.md §"Compatibilité legacy").

   Pourquoi un repli est nécessaire malgré la migration id-préservante
   de V6.8.a : cette migration tourne une fois par démarrage
   (js/main.js). Une fiche people/personnel créée depuis les écrans
   historiques (toujours actifs) PENDANT la session n'a pas encore
   d'équivalent dans `directory` tant que l'app n'a pas redémarré — le
   repli couvre exactement cette fenêtre, en plus des sauvegardes
   anciennes déjà rencontrées. Aucune écriture n'a lieu ici : une
   résolution ne doit jamais modifier la base.
============================================================ */

// Cœur pur (ne lit jamais `state`) : testable avec des tableaux
// construits à la main. `options.expectRoles`, si fourni, ne rejette
// pas le lien mais signale `roleMismatch` (utilisé par le diagnostic,
// V6.8.c) — uniquement pertinent quand la résolution vient de
// `directory` : un enregistrement legacy `personnel` n'a pas de
// `roles`, la notion ne s'y applique pas.
function resolveDirectoryEntity(id, directoryActive, directoryTrash, legacyActive, legacyTrash, options) {
    options = options || {};
    if (!id) return { record: null, status: "none", source: null, legacy: false, roleMismatch: false };

    const link = findLinked(directoryActive, directoryTrash, id);
    if (link.status === "active" || link.status === "trashed") {
        const roleMismatch = Boolean(options.expectRoles) && !options.expectRoles.some(r => hasRole(link.record, r));
        return { ...link, source: "directory", legacy: false, roleMismatch };
    }
    if (link.status === "none") return { ...link, source: null, legacy: false, roleMismatch: false };

    // status === "missing" côté directory : repli legacy, jamais de
    // création automatique.
    const legacyLink = findLinked(legacyActive || [], legacyTrash || [], id);
    if (legacyLink.status === "active" || legacyLink.status === "trashed") {
        return { ...legacyLink, source: options.legacySourceLabel || "legacy", legacy: true, roleMismatch: false };
    }
    return { record: null, status: "missing", source: null, legacy: false, roleMismatch: false };
}

// Enveloppes lisant l'état global — utilisées par les modules UI
// (js/requests.js, js/intentions.js) et le diagnostic (js/diagnostics.js).
function resolveDirectoryPerson(id) {
    return resolveDirectoryEntity(id, state.directory, state.directoryTrash, state.people, state.peopleTrash, {
        legacySourceLabel: "people"
    });
}

function resolveDirectoryPersonnel(id) {
    return resolveDirectoryEntity(id, state.directory, state.directoryTrash, state.personnel, state.personnelTrash, {
        legacySourceLabel: "personnel",
        expectRoles: ["clerge", "salarie", "benevole"]
    });
}
