"use strict";

/* ============================================================
   DIAGNOSTIC D'INTÉGRITÉ (V6.6)
   Vérification à la demande (bouton Paramètres), jamais automatique
   et jamais correctrice : parcourt les données déjà chargées en
   mémoire (state.*, actifs et corbeille confondus) pour repérer des
   incohérences que l'application ne provoque normalement jamais
   elle-même (import manuel d'un fichier externe, ancienne sauvegarde,
   édition directe de la base via les DevTools…). Un outil d'aide au
   repérage, pas une garantie de conformité ni une correction
   automatique — chaque point relevé reste à vérifier manuellement.
============================================================ */

// Un lien "manquant" ici est exactement ce que findLinked() (js/utils.js)
// affiche déjà comme "Introuvable (supprimé définitivement)" sur une
// fiche isolée — ce diagnostic ne fait qu'agréger ce même repérage sur
// l'ensemble des modules en un seul endroit, plutôt que d'obliger à
// ouvrir chaque fiche une par une pour le découvrir.
//
// V6.8.c : personId/personnelId (requests, intentions) passent par
// resolveDirectoryPerson()/resolveDirectoryPersonnel() (js/core/directory.js)
// plutôt que par un findLinked() direct sur people/personnel — cela
// détecte, en plus du lien cassé, deux cas nouveaux : une référence
// encore résolue uniquement via l'ancien registre ("legacy" — sera
// reprise dans l'Annuaire au prochain démarrage) et un célébrant dont
// l'entrée Annuaire n'a aucun rôle clerge/salarie/benevole. clocherId
// n'est pas concerné (les clochers ne font pas partie de l'Annuaire) et
// continue de passer par findLinked() directement.
function checkReferenceIntegrity() {
    const findings = [];

    function checkClocherLink(entityType, entityLabel, records, field) {
        records.forEach(r => {
            if (!r[field]) return;
            const link = findLinked(state.clochers, state.clochersTrash, r[field]);
            if (link.status === "missing") {
                findings.push({
                    entityType,
                    entityId: r.id,
                    message: `${entityLabel} « ${escapeHTML(r.name || r.title || r.intitule || r.id)} » référence un(e) clocher introuvable (définitivement supprimé(e)).`
                });
            }
        });
    }

    function checkDirectoryLink(entityType, entityLabel, records, field, resolver) {
        records.forEach(r => {
            if (!r[field]) return;
            const link = resolver(r[field]);
            const name = escapeHTML(r.name || r.title || r.intitule || r.id);
            const what = field.replace("Id", "");
            if (link.status === "missing") {
                findings.push({
                    entityType,
                    entityId: r.id,
                    message: `${entityLabel} « ${name} » référence un(e) ${what} introuvable (définitivement supprimé(e), même dans l'ancien registre).`
                });
            } else if (link.legacy) {
                findings.push({
                    entityType,
                    entityId: r.id,
                    message: `${entityLabel} « ${name} » référence une fiche pas encore présente dans l'Annuaire (résolue via l'ancien registre « ${escapeHTML(link.source)} ») — sera reprise automatiquement au prochain démarrage.`
                });
            } else if (link.roleMismatch) {
                findings.push({
                    entityType,
                    entityId: r.id,
                    message: `${entityLabel} « ${name} » référence une entrée de l'Annuaire sans rôle clergé/salarié/bénévole alors qu'un célébrant était attendu.`
                });
            }
        });
    }

    checkDirectoryLink("request", "Demande", state.requests, "personId", resolveDirectoryPerson);
    checkClocherLink("request", "Demande", state.requests, "clocherId");
    checkClocherLink("schedule", "Annonce", state.schedule, "clocherId");
    checkDirectoryLink("intention", "Intention", state.intentions, "personId", resolveDirectoryPerson);
    checkClocherLink("intention", "Intention", state.intentions, "clocherId");
    checkDirectoryLink("intention", "Intention", state.intentions, "personnelId", resolveDirectoryPersonnel);

    return findings;
}

// V6.8.c : cohérence structurelle des entrées `directory` elles-mêmes
// (entityType connu, roles est bien un tableau, chaque rôle a un type
// connu et un `active` booléen s'il est renseigné).
function checkDirectoryStructure() {
    const findings = [];

    state.directory.forEach(e => {
        const name = escapeHTML(directoryDisplayName(e));

        if (!DIRECTORY_ENTITY_TYPES.includes(e.entityType)) {
            findings.push({ entityType: "directory", entityId: e.id, message: `« ${name} » a un entityType inconnu : « ${escapeHTML(String(e.entityType))} ».` });
        }

        if (!Array.isArray(e.roles)) {
            findings.push({ entityType: "directory", entityId: e.id, message: `« ${name} » a un champ roles invalide (devrait être une liste).` });
            return;
        }

        e.roles.forEach((r, i) => {
            if (!DIRECTORY_ROLE_TYPES.includes(r.type)) {
                findings.push({ entityType: "directory", entityId: e.id, message: `« ${name} » a un rôle inconnu à la position ${i} : « ${escapeHTML(String(r.type))} ».` });
            }
            if (r.active !== undefined && typeof r.active !== "boolean") {
                findings.push({ entityType: "directory", entityId: e.id, message: `« ${name} » a un rôle « ${escapeHTML(String(r.type))} » avec un champ active non booléen.` });
            }
        });
    });

    return findings;
}

// Signale les entrées sans aucun rôle (roles: []) — anomalie valide
// techniquement mais à corriger manuellement (voir js/annuaire.js,
// V6.8.b), jamais corrigée automatiquement ici.
function checkDirectoryNoRole() {
    return state.directory.filter(hasNoRole).map(e => ({
        entityType: "directory",
        entityId: e.id,
        message: `« ${escapeHTML(directoryDisplayName(e))} » n'a aucun rôle déterminé — à corriger depuis sa fiche.`
    }));
}

// V6.8.c : la migration V6.8.a n'a jamais fusionné une entrée issue de
// `people` avec une entrée issue de `personnel`, même homonyme — signale
// un DOUBLON POTENTIEL (jamais confirmé, jamais fusionné) quand deux
// entrées `directory` de provenances différentes partagent nom/prénom.
// Heuristique nom seul (pas nom+date de naissance comme
// checkPossibleDuplicates() ci-dessous) : une entrée issue de
// `personnel` n'a jamais de date de naissance, l'exiger empêcherait ce
// contrôle de détecter précisément le cas qu'il vise.
function checkDirectoryPossibleDuplicates() {
    const findings = [];
    const seenByName = new Map();

    state.directory.forEach(e => {
        if (e.entityType !== "person") return;
        const key = normalize(`${e.prenom} ${e.nom}`).trim();
        if (!key) return;

        const other = seenByName.get(key);
        if (other && other.migratedFrom !== e.migratedFrom) {
            findings.push({
                entityType: "directory",
                entityId: e.id,
                message: `Doublon potentiel : « ${escapeHTML(directoryDisplayName(e))} » existe à la fois comme entrée issue de « ${escapeHTML(other.migratedFrom || "?")} » (${escapeHTML(other.id)}) et de « ${escapeHTML(e.migratedFrom || "?")} » (${escapeHTML(e.id)}) — à vérifier et fusionner manuellement si nécessaire, jamais automatiquement.`
            });
        } else if (!other) {
            seenByName.set(key, e);
        }
    });

    return findings;
}

// Valeurs qui devraient rester dans le vocabulaire contrôlé de
// js/constants.js — rien ne l'impose techniquement (pas de contrainte
// Dexie sur le contenu d'un champ non-clé), donc un import externe ou
// une ancienne version du vocabulaire peut en introduire une autre.
function checkEnumValues() {
    const findings = [];

    function checkField(entityType, label, records, field, allowed, fieldLabel) {
        records.forEach(r => {
            if (r[field] && !allowed.includes(r[field])) {
                findings.push({
                    entityType,
                    entityId: r.id,
                    message: `${label} « ${escapeHTML(r.name || r.title || r.intitule || `${r.prenom || ""} ${r.nom || ""}`.trim() || r.id)} » a un(e) ${fieldLabel} inconnu(e) : « ${escapeHTML(String(r[field]))} ».`
                });
            }
        });
    }

    checkField("request", "Demande", state.requests, "type", REQUEST_TYPES, "type");
    checkField("request", "Demande", state.requests, "status", STATUS, "statut");
    checkField("request", "Demande", state.requests, "priority", PRIORITIES, "priorité");
    checkField("intention", "Intention", state.intentions, "type", INTENTION_TYPES, "type");
    checkField("intention", "Intention", state.intentions, "statut", INTENTION_STATUS, "statut");
    checkField("personnel", "Personnel", state.personnel, "typeEngagement", PERSONNEL_TYPES, "type d'engagement");
    checkField("personnel", "Personnel", state.personnel, "etat", PERSONNEL_ETATS, "statut");

    return findings;
}

// Un champ vide n'est pas invalide (non renseigné) ; un champ rempli
// mais qui n'est pas une date ISO valide, si.
function isInvalidDateValue(v) {
    if (!v) return false;
    return !(/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime()));
}

function checkInvalidDates() {
    const findings = [];

    function checkField(entityType, label, records, field, fieldLabel) {
        records.forEach(r => {
            if (isInvalidDateValue(r[field])) {
                findings.push({
                    entityType,
                    entityId: r.id,
                    message: `${label} « ${escapeHTML(r.name || r.title || r.intitule || `${r.prenom || ""} ${r.nom || ""}`.trim() || r.id)} » a un(e) ${fieldLabel} invalide : « ${escapeHTML(String(r[field]))} ».`
                });
            }
        });
    }

    checkField("request", "Demande", state.requests, "dateDemande", "date de demande");
    checkField("request", "Demande", state.requests, "dateEvenement", "date de cérémonie");
    checkField("request", "Demande", state.requests, "deadline", "échéance");
    checkField("person", "Personne", state.people, "dateNaissance", "date de naissance");
    checkField("person", "Personne", state.people, "dateDeces", "date de décès");
    checkField("schedule", "Annonce", state.schedule, "date", "date");
    checkField("intention", "Intention", state.intentions, "dateDebut", "date de début");
    checkField("personnel", "Personnel", state.personnel, "dateDebut", "date de début");
    checkField("personnel", "Personnel", state.personnel, "dateFin", "date de fin");

    return findings;
}

// Heuristique volontairement simple (nom + prénom + date de naissance
// normalisés) : un vrai doublon de saisie a de très bonnes chances de
// les partager, mais deux personnes différentes pourraient aussi
// coïncider (homonymes) — signalé comme "à vérifier", jamais fusionné
// automatiquement.
function checkPossibleDuplicates() {
    const findings = [];
    const seen = new Map();

    state.people.forEach(p => {
        const key = normalize(`${p.prenom} ${p.nom} ${p.dateNaissance || ""}`).trim();
        if (!key || key === normalize(`${p.dateNaissance || ""}`).trim()) return;
        if (seen.has(key)) {
            findings.push({
                entityType: "person",
                entityId: p.id,
                message: `Doublon possible entre les fiches « ${escapeHTML(`${p.prenom} ${p.nom}`.trim())} » (mêmes nom/prénom${p.dateNaissance ? "/date de naissance" : ""} qu'une autre fiche) — à vérifier manuellement, non fusionné automatiquement.`
            });
        } else {
            seen.set(key, p.id);
        }
    });

    return findings;
}

function runIntegrityCheck() {
    return [
        ...checkReferenceIntegrity(),
        ...checkEnumValues(),
        ...checkInvalidDates(),
        ...checkPossibleDuplicates(),
        ...checkDirectoryStructure(),
        ...checkDirectoryNoRole(),
        ...checkDirectoryPossibleDuplicates()
    ];
}

function buildIntegrityReportHTML(findings) {
    if (!findings.length) {
        return `<div class="empty">${icon("check-circle", "icon-inline")}Aucune incohérence détectée.</div>`;
    }
    return `
        <div class="alert-list" role="list">
            ${findings.map(f => `
                <div class="alert-item" role="listitem">
                    <div class="alert-marker"></div>
                    <div class="alert-main">
                        <div class="alert-name">${escapeHTML(ENTITY_TYPE_LABELS[f.entityType] || f.entityType)}</div>
                        <div class="alert-detail">${f.message}</div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderIntegrityReport() {
    const findings = runIntegrityCheck();
    $("#integrityReportBody").innerHTML = `
        <h4 class="fiche-section-title">Diagnostic d'intégrité${findings.length ? ` (${findings.length})` : ""}</h4>
        ${buildIntegrityReportHTML(findings)}
    `;
    $("#integrityReportPanel").hidden = false;
    toast(findings.length ? `${findings.length} point(s) à vérifier.` : "Aucune incohérence détectée.", findings.length ? "error" : "success");
}

function initDiagnosticsEvents() {
    $("#runIntegrityCheckBtn").addEventListener("click", renderIntegrityReport);
    $("#integrityReportCloseBtn").addEventListener("click", () => { $("#integrityReportPanel").hidden = true; });
}
