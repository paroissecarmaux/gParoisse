"use strict";

/* ============================================================
   PARAMÈTRES & SAUVEGARDE (Dexie)
============================================================ */
async function loadSettings() {
    const items = await SettingsRepository.list();
    for (const item of items) {
        if (Object.prototype.hasOwnProperty.call(state.settings, item.key)) {
            state.settings[item.key] = item.value;
        }
    }
    $("#brandTitle").textContent = state.settings.parishName;
    $("#parishName").value = state.settings.parishName;
    applyTheme(state.settings.theme || "light");
}

async function saveSetting(key, value) {
    state.settings[key] = value;
    await SettingsRepository.put({ key, value });
}

async function saveSettings() {
    const name = $("#parishName").value.trim() || "Secrétariat paroissial de Carmaux-Valence";
    await saveSetting("parishName", name);
    $("#brandTitle").textContent = name;
    toast("Paramètres enregistrés.", "success");
}

/* ============================================================
   STATUT DE SAUVEGARDE
   Affiché à la fois sur le Tableau de bord (bannière) et dans
   Paramètres : au-delà de 7 jours sans export JSON, on bascule en
   style d'alerte pour inciter à sauvegarder.
============================================================ */
const BACKUP_STALE_DAYS = 7;

function backupStatus() {
    const last = state.settings.lastBackup;
    if (!last) {
        return { stale: true, text: "Aucune sauvegarde JSON n'a encore été faite." };
    }
    const diffDays = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    const relative = formatRelativeTime(last);
    return diffDays > BACKUP_STALE_DAYS
        ? { stale: true, text: `Dernière sauvegarde ${relative}.` }
        : { stale: false, text: `Dernière sauvegarde : ${relative}.` };
}

function renderBackupStatus() {
    const { stale, text } = backupStatus();

    const overviewEl = $("#overviewBackupNotice");
    if (overviewEl) {
        overviewEl.innerHTML = stale
            ? `<div class="local-notice">
                    <svg class="icon" aria-hidden="true"><use href="#i-alert-triangle"></use></svg>
                    <p>${escapeHTML(text)} Pensez à exporter une <strong>sauvegarde JSON</strong> régulièrement.</p>
                </div>`
            : `<p class="backup-discreet">${icon("check-circle", "icon-inline")}${escapeHTML(text)}</p>`;
    }

    const settingsEl = $("#settingsBackupStatus");
    if (settingsEl) {
        settingsEl.innerHTML = stale
            ? `<div class="local-notice">
                    <svg class="icon" aria-hidden="true"><use href="#i-alert-triangle"></use></svg>
                    <p>${escapeHTML(text)} Le stockage du navigateur n'est pas fiable : exportez une sauvegarde JSON régulièrement.</p>
                </div>`
            : `<p class="backup-discreet">${icon("check-circle", "icon-inline")}${escapeHTML(text)}</p>`;
    }
}

/* ============================================================
   EXPORT / IMPORT (toutes les bases)
   Registre déclaratif : ajouter un futur module (nouvelle base
   Dexie) ne demande qu'une entrée ici plutôt que de dupliquer la
   logique dans exportJSON/importFile/clearDatabase, et dans
   exportModuleCSV/importModuleCSVFile pour le CSV base par base.

   Champs de chaque entrée :
   - table/stateKey  : accès à la table Dexie et au tableau en mémoire
   - normalize       : (JSON) transforme un objet brut importé en
                       enregistrement valide (id garanti, valeurs par
                       défaut) — normalizeRequest() pour les demandes,
                       une version minimale pour les autres modules
   - isValid         : filtre les lignes/objets inexploitables
   - createDefault   : gabarit utilisé pour compléter une ligne CSV
                       qui ne renseigne pas toutes les colonnes
   - csvFields       : colonnes CSV, dans l'ordre d'export ; `type`
                       vaut "bool" (Oui/Non) ou "date" (tolère ISO,
                       jj/mm/aaaa, ou un numéro de série Excel), sinon
                       le texte est copié tel quel
   - requiredLabel   : (V6.2.b) description courte du champ qui rend
                       une ligne exploitable, utilisée dans le rapport
                       d'import pour expliquer pourquoi une ligne a
                       été ignorée (« <requiredLabel> manquant »)
============================================================ */
const DATA_MODULES = [
    {
        key: "requests",
        label: "demande(s)",
        table: () => RequestsRepository,
        stateKey: "requests",
        trashKey: "requestsTrash",
        normalize: normalizeRequest,
        isValid: r => Boolean(r && (r.name || r.description || r.contact)),
        requiredLabel: "Nom, description ou contact",
        load: loadRequestsData,
        render: () => { renderRequestsSummary(); renderRequests(); },
        createDefault: createDefaultRequest,
        csvFields: [
            { key: "id", header: "ID" },
            { key: "name", header: "Nom" },
            { key: "contact", header: "Contact" },
            { key: "type", header: "Type" },
            { key: "status", header: "Statut" },
            { key: "priority", header: "Priorité" },
            { key: "dateDemande", header: "Date demande", type: "date" },
            { key: "dateEvenement", header: "Date cérémonie", type: "date" },
            { key: "heureEvenement", header: "Heure" },
            { key: "lieuEvenement", header: "Lieu" },
            { key: "defunt", header: "Défunt" },
            { key: "deadline", header: "Échéance", type: "date" },
            { key: "contactMethod", header: "Moyen de contact" },
            { key: "description", header: "Description" },
            { key: "notes", header: "Notes" },
            { key: "archived", header: "Archivée", type: "bool" },
            { key: "personId", header: "ID personne" },
            { key: "clocherId", header: "ID clocher" },
            { key: "createdAt", header: "Créée le" },
            { key: "updatedAt", header: "Modifiée le" },
            { key: "deletedAt", header: "Supprimée le (corbeille)" }
        ]
    },
    {
        key: "people",
        label: "personne(s)",
        table: () => PeopleRepository,
        stateKey: "people",
        trashKey: "peopleTrash",
        normalize: p => ({ ...p, id: String(p.id || uid()) }),
        isValid: p => Boolean(p && (p.prenom || p.nom)),
        requiredLabel: "Prénom ou nom",
        load: loadPeopleData,
        render: () => { renderPeopleSummary(); renderPeopleList(); },
        createDefault: createDefaultPerson,
        csvFields: [
            { key: "id", header: "ID" },
            { key: "profileType", header: "Profil" },
            { key: "prenom", header: "Prénom" },
            { key: "nom", header: "Nom" },
            { key: "dateNaissance", header: "Date de naissance", type: "date" },
            { key: "lieuNaissance", header: "Lieu de naissance" },
            { key: "dateDeces", header: "Date de décès", type: "date" },
            { key: "telephone", header: "Téléphone" },
            { key: "email", header: "E-mail" },
            { key: "adresse", header: "Adresse" },
            { key: "pere", header: "Père" },
            { key: "mere", header: "Mère" },
            { key: "rgpd", header: "RGPD", type: "bool" },
            { key: "registre", header: "Registre" },
            { key: "lieuBapteme", header: "Lieu de baptême" },
            { key: "diocese", header: "Diocèse" },
            { key: "anneeBapteme", header: "Année baptême" },
            { key: "numeroBapteme", header: "N° baptême" },
            { key: "dateBapteme", header: "Date de baptême", type: "date" },
            { key: "parrain", header: "Parrain" },
            { key: "marraine", header: "Marraine" },
            { key: "temoin", header: "Témoin" },
            { key: "dateCommunion", header: "Date de communion", type: "date" },
            { key: "lieuCommunion", header: "Lieu de communion" },
            { key: "dateConfirmation", header: "Date de confirmation", type: "date" },
            { key: "lieuConfirmation", header: "Lieu de confirmation" },
            { key: "dateMariage", header: "Date de mariage", type: "date" },
            { key: "lieuMariage", header: "Lieu de mariage" },
            { key: "conjoint", header: "Conjoint(e)" },
            { key: "role", header: "Rôle" },
            { key: "groupe", header: "Groupe" },
            { key: "notes", header: "Notes" },
            { key: "deletedAt", header: "Supprimée le (corbeille)" }
        ]
    },
    {
        key: "schedule",
        label: "annonce(s)",
        table: () => ScheduleRepository,
        stateKey: "schedule",
        trashKey: "scheduleTrash",
        normalize: s => ({ ...s, id: String(s.id || uid()) }),
        isValid: s => Boolean(s && s.title),
        requiredLabel: "Titre",
        load: loadScheduleData,
        render: () => { renderScheduleSummary(); renderScheduleList(); },
        createDefault: createDefaultSchedule,
        csvFields: [
            { key: "id", header: "ID" },
            { key: "title", header: "Titre" },
            { key: "category", header: "Catégorie" },
            { key: "kind", header: "Récurrence" },
            { key: "dayOfWeek", header: "Jour de la semaine" },
            { key: "date", header: "Date", type: "date" },
            { key: "time", header: "Heure" },
            { key: "location", header: "Lieu" },
            { key: "clocherId", header: "ID clocher" },
            { key: "notes", header: "Notes" },
            { key: "active", header: "Active", type: "bool" },
            { key: "deletedAt", header: "Supprimée le (corbeille)" }
        ]
    },
    {
        key: "clochers",
        label: "clocher(s)",
        table: () => ClochersRepository,
        stateKey: "clochers",
        trashKey: "clochersTrash",
        normalize: c => ({ ...c, id: String(c.id || uid()) }),
        isValid: c => Boolean(c && c.nom),
        requiredLabel: "Nom",
        load: loadClochersData,
        render: () => { renderClochersSummary(); renderClochersList(); },
        createDefault: createDefaultClocher,
        csvFields: [
            { key: "id", header: "ID" },
            { key: "nom", header: "Nom" },
            { key: "commune", header: "Commune" },
            { key: "secteur", header: "Secteur" },
            { key: "adresse", header: "Adresse" },
            { key: "saintPatron", header: "Saint patron" },
            { key: "fetePatronale", header: "Fête patronale" },
            { key: "notes", header: "Notes" },
            { key: "active", header: "Active", type: "bool" }
        ]
    },
    {
        key: "personnel",
        label: "membre(s) du personnel",
        table: () => PersonnelRepository,
        stateKey: "personnel",
        trashKey: "personnelTrash",
        normalize: p => ({ ...p, id: String(p.id || uid()) }),
        isValid: p => Boolean(p && (p.prenom || p.nom)),
        requiredLabel: "Prénom ou nom",
        load: loadPersonnelData,
        render: () => { renderPersonnelSummary(); renderPersonnelList(); },
        createDefault: createDefaultPersonnel,
        csvFields: [
            { key: "id", header: "ID" },
            { key: "prenom", header: "Prénom" },
            { key: "nom", header: "Nom" },
            { key: "typeEngagement", header: "Type d'engagement" },
            { key: "etat", header: "Statut" },
            { key: "fonction", header: "Fonction" },
            { key: "telephone", header: "Téléphone" },
            { key: "email", header: "E-mail" },
            { key: "adresse", header: "Adresse" },
            { key: "dateDebut", header: "Début", type: "date" },
            { key: "dateFin", header: "Fin", type: "date" },
            { key: "notes", header: "Notes" },
            { key: "active", header: "Active", type: "bool" }
        ]
    },
    {
        key: "intentions",
        label: "intention(s) de messe",
        table: () => IntentionsRepository,
        stateKey: "intentions",
        trashKey: "intentionsTrash",
        normalize: i => ({ ...i, id: String(i.id || uid()) }),
        isValid: i => Boolean(i && i.intitule),
        requiredLabel: "Intitulé",
        load: loadIntentionsData,
        render: () => { renderIntentionsSummary(); renderIntentionsList(); },
        createDefault: createDefaultIntention,
        csvFields: [
            { key: "id", header: "ID" },
            { key: "type", header: "Type" },
            { key: "intitule", header: "Intitulé" },
            { key: "statut", header: "Statut" },
            { key: "dateDebut", header: "Date de début", type: "date" },
            { key: "nombreMesses", header: "Nombre de messes" },
            { key: "heure", header: "Heure" },
            { key: "offrande", header: "Offrande" },
            { key: "personId", header: "ID demandeur" },
            { key: "contact", header: "Contact" },
            { key: "clocherId", header: "ID clocher" },
            { key: "personnelId", header: "ID célébrant" },
            { key: "notes", header: "Notes" }
        ]
    }
];

// V6.2.c : une sauvegarde (JSON ou CSV) doit rester fidèle à la
// corbeille, pas seulement aux éléments actifs — state[m.stateKey] ne
// contient plus que les actifs depuis listActive(). trashKey est
// encore vide pour les modules qui n'ont pas encore leur corbeille
// (V6.2.c section 11), donc sans effet tant qu'ils ne l'ont pas.
function allRecordsFor(m) {
    return state[m.stateKey].concat(state[m.trashKey] || []);
}

async function exportJSON() {
    const payload = {
        app: "Paroisse · Secrétariat",
        version: 9,
        exportedAt: nowISO(),
        settings: state.settings
    };
    DATA_MODULES.forEach(m => { payload[m.key] = allRecordsFor(m); });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `paroisse-sauvegarde-${todayISO()}.json`);
    await saveSetting("lastBackup", nowISO());
    renderBackupStatus();
    toast("Sauvegarde JSON créée.", "success");
}

/* ============================================================
   EXPORT / IMPORT CSV, base par base
   Chaque base a ses propres colonnes (csvFields ci-dessus), mais
   passe par le même moteur générique — la colonne ID permet de
   mettre à jour un enregistrement existant lors d'une réimportation
   plutôt que de le dupliquer.
============================================================ */
function csvFieldToValue(item, field) {
    const v = item[field.key];
    if (field.type === "bool") return v ? "Oui" : "Non";
    return v ?? "";
}

function csvValueToField(raw, field) {
    const v = String(raw ?? "").trim();
    if (field.type === "bool") return /^(oui|yes|true|1|x)$/i.test(v);
    if (field.type === "date") return v ? (parseFrenchDate(v) || v) : "";
    return v;
}

function exportModuleCSV(key) {
    const m = DATA_MODULES.find(x => x.key === key);
    if (!m) return;
    const headers = m.csvFields.map(f => f.header);
    const rows = allRecordsFor(m).map(item => m.csvFields.map(f => csvFieldToValue(item, f)));
    const csv = "﻿" + [headers, ...rows].map(row => row.map(csvEscape).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `paroisse-${key}-${todayISO()}.csv`);
    toast(`Export CSV « ${m.label} » créé.`, "success");
}

function selectCsvImportFile(key) {
    state.csvImportModuleKey = key;
    $("#importCsvFile").value = "";
    $("#importCsvFile").click();
}

async function importModuleCSVFile(file) {
    if (!file) return;
    const m = DATA_MODULES.find(x => x.key === state.csvImportModuleKey);
    if (!m) return;
    try {
        const rows = parseCSV(await file.text());
        if (rows.length < 2) throw new ValidationError("Le fichier ne contient aucune ligne de données.");

        const fieldForCol = rows[0].map(h => {
            const norm = normalizeHeaderKey(h);
            return m.csvFields.find(f => normalizeHeaderKey(f.header) === norm) || null;
        });
        if (!fieldForCol.some(Boolean)) throw new ValidationError("Aucune colonne reconnue dans l'en-tête du fichier.");

        const now = nowISO();
        const records = [];
        const skippedLines = [];
        const dateWarnings = [];

        for (let i = 1; i < rows.length; i++) {
            const line = i + 1; // ligne 1 = en-tête
            const raw = {};
            fieldForCol.forEach((f, idx) => {
                if (!f) return;
                const cell = rows[i][idx];
                raw[f.key] = csvValueToField(cell, f);
                if (f.type === "date") {
                    const trimmed = String(cell ?? "").trim();
                    if (trimmed && !parseFrenchDate(trimmed)) {
                        dateWarnings.push({ line, field: f.header, value: trimmed });
                    }
                }
            });

            const existing = raw.id ? allRecordsFor(m).find(x => x.id === raw.id) : null;
            const record = m.normalize({ ...(existing || m.createDefault()), ...raw });
            if (existing) record.id = existing.id;
            record.updatedAt = now;
            if (!record.createdAt) record.createdAt = now;

            if (!m.isValid(record)) {
                skippedLines.push({ line, reason: `${m.requiredLabel} manquant` });
                continue;
            }
            records.push(record);
        }

        if (!records.length) throw new ValidationError("Aucune ligne exploitable dans ce fichier.");

        await m.table().bulkPut(records);
        await m.load();
        m.render();
        renderOverview();
        renderAgenda();
        toast(`${records.length} ${m.label} importé(s) depuis le CSV${skippedLines.length ? ` · ${skippedLines.length} ligne(s) ignorée(s)` : ""}.`, "success");
        renderImportReport({
            importedCount: records.length,
            label: m.label,
            skipped: skippedLines,
            warnings: dateWarnings
        });
    } catch (err) {
        Logger.error("settings.importModuleCSVFile", err);
        toast("Import CSV impossible : " + err.message, "error");
        renderImportReport({ error: err.message });
    }
}

function selectImportFile(mode) {
    state.importMode = mode;
    $("#importFile").value = "";
    $("#importFile").click();
}

async function importFile(file) {
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());

        // Rétrocompatibilité : une ancienne sauvegarde pouvait être un
        // simple tableau de demandes plutôt qu'un objet { requests, ... }.
        const imported = {};
        DATA_MODULES.forEach(m => {
            const raw = Array.isArray(parsed) ? (m.key === "requests" ? parsed : []) : (parsed[m.key] || []);
            imported[m.key] = raw.filter(m.isValid).map(m.normalize);
        });

        const totalCount = DATA_MODULES.reduce((sum, m) => sum + imported[m.key].length, 0);
        if (!totalCount) throw new ValidationError("Le fichier ne contient aucune donnée exploitable.");

        const summary = DATA_MODULES.map(m => `${imported[m.key].length} ${m.label}`).join(", ");

        if (state.importMode === "replace") {
            if (!window.confirm(`Remplacer toutes les données actuelles par ${summary} ?`)) return;
            for (const m of DATA_MODULES) await m.table().clear();
        }

        // Écritures groupées (bulkPut) plutôt qu'un put() par élément, et
        // recherche des doublons via Set (O(1)) plutôt que .some() (O(n))
        // dans la boucle : indispensable pour des sauvegardes de plusieurs
        // milliers d'enregistrements.
        if (state.importMode === "merge") {
            DATA_MODULES.forEach(m => {
                const existingIds = new Set(allRecordsFor(m).map(e => e.id));
                imported[m.key].forEach(item => { if (existingIds.has(item.id)) item.id = uid(); });
            });
        }

        for (const m of DATA_MODULES) {
            if (imported[m.key].length) await m.table().bulkPut(imported[m.key]);
        }

        state.peoplePage = 1;
        state.requestsPage = 1;
        for (const m of DATA_MODULES) await m.load();
        DATA_MODULES.forEach(m => m.render());
        renderOverview();
        renderAgenda();
        toast(`Import terminé : ${summary}.`, "success");
    } catch (err) {
        Logger.error("settings.importFile", err);
        toast("Import impossible : " + err.message, "error");
    }
}

async function clearDatabase() {
    if (window.prompt("Pour confirmer l'effacement complet, tapez : EFFACER") !== "EFFACER") {
        toast("Effacement annulé.");
        return;
    }
    await HistoryRepository.clear();
    for (const m of DATA_MODULES) await m.table().clear();
    for (const m of DATA_MODULES) await m.load();
    DATA_MODULES.forEach(m => m.render());
    renderOverview();
    renderAgenda();
    toast("Toutes les données ont été supprimées.", "success");
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initSettingsEvents() {
    $("#exportJsonBtn").addEventListener("click", exportJSON);
    $("#settingsExportJson").addEventListener("click", exportJSON);
    $("#settingsBackupNowBtn").addEventListener("click", exportJSON);
    $("#saveSettingsBtn").addEventListener("click", saveSettings);
    $("#clearDataBtn").addEventListener("click", clearDatabase);
    $("#mergeImportBtn").addEventListener("click", () => selectImportFile("merge"));
    $("#replaceImportBtn").addEventListener("click", () => selectImportFile("replace"));
    $("#importBtn").addEventListener("click", () => selectImportFile("merge"));
    $("#importFile").addEventListener("change", e => importFile(e.target.files[0]));
    $("#themeBtn").addEventListener("click", toggleTheme);
    $("#settingsThemeBtn").addEventListener("click", toggleTheme);

    $("#importCsvFile").addEventListener("change", e => importModuleCSVFile(e.target.files[0]));
}
