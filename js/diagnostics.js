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
// l'ensemble des 6 modules en un seul endroit, plutôt que d'obliger à
// ouvrir chaque fiche une par une pour le découvrir.
function checkReferenceIntegrity() {
    const findings = [];

    function checkLink(entityType, entityLabel, records, field, targetActive, targetTrash) {
        records.forEach(r => {
            if (!r[field]) return;
            const link = findLinked(targetActive, targetTrash, r[field]);
            if (link.status === "missing") {
                findings.push({
                    entityType,
                    entityId: r.id,
                    message: `${entityLabel} « ${escapeHTML(r.name || r.title || r.intitule || r.id)} » référence un(e) ${field.replace("Id", "")} introuvable (définitivement supprimé(e)).`
                });
            }
        });
    }

    checkLink("request", "Demande", state.requests, "personId", state.people, state.peopleTrash);
    checkLink("request", "Demande", state.requests, "clocherId", state.clochers, state.clochersTrash);
    checkLink("schedule", "Annonce", state.schedule, "clocherId", state.clochers, state.clochersTrash);
    checkLink("intention", "Intention", state.intentions, "personId", state.people, state.peopleTrash);
    checkLink("intention", "Intention", state.intentions, "clocherId", state.clochers, state.clochersTrash);
    checkLink("intention", "Intention", state.intentions, "personnelId", state.personnel, state.personnelTrash);

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
        ...checkPossibleDuplicates()
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
