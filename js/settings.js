"use strict";

/* ============================================================
   PARAMÈTRES & SAUVEGARDE (Dexie)
============================================================ */
async function loadSettings() {
    const items = await db.settings.toArray();
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
    await db.settings.put({ key, value });
}

async function saveSettings() {
    const name = $("#parishName").value.trim() || "Secrétariat paroissial de Carmaux-Valence";
    await saveSetting("parishName", name);
    $("#brandTitle").textContent = name;
    toast("Paramètres enregistrés.", "success");
}

/* ============================================================
   EXPORT / IMPORT (demandes)
============================================================ */
async function exportJSON() {
    const payload = {
        app: "Paroisse · Secrétariat",
        version: 6,
        exportedAt: nowISO(),
        settings: state.settings,
        requests: state.requests
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `paroisse-sauvegarde-${todayISO()}.json`);
    await saveSetting("lastBackup", nowISO());
    toast("Sauvegarde JSON créée.", "success");
}

function exportCSV() {
    const headers = ["Nom","Contact","Type","Date demande","Date de la cérémonie","Statut","Priorité","Échéance","Moyen contact","Description","Notes","Archivée","Créée le","Modifiée le"];
    const rows = state.requests.map(r => [
        r.name, r.contact, r.type, r.dateDemande, r.dateEvenement, r.status, r.priority,
        r.deadline, r.contactMethod, r.description, r.notes,
        r.archived ? "Oui" : "Non", r.createdAt, r.updatedAt
    ]);
    const csv = "﻿" + [headers, ...rows].map(row => row.map(csvEscape).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `paroisse-demandes-${todayISO()}.csv`);
    toast("Export CSV créé.", "success");
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
        const raw = Array.isArray(parsed) ? parsed : parsed.requests;
        if (!Array.isArray(raw)) throw new Error("Format JSON non reconnu.");

        const imported = raw.map(normalizeRequest).filter(r => r.name || r.description || r.contact);
        if (!imported.length) throw new Error("Le fichier ne contient aucune demande exploitable.");

        if (state.importMode === "replace") {
            if (!window.confirm(`Remplacer toutes les données actuelles par ${imported.length} demande(s) ?`)) return;
            await db.requests.clear();
        }

        let added = 0;
        for (const req of imported) {
            if (state.importMode === "merge" && state.requests.some(e => e.id === req.id)) {
                req.id = uid();
            }
            await db.requests.put(req);
            added++;
        }
        await loadRequestsData();
        renderRequestsSummary();
        renderRequests();
        renderOverview();
        toast(`${added} demande(s) importée(s).`, "success");
    } catch (err) {
        console.error(err);
        toast("Import impossible : " + err.message, "error");
    }
}

async function clearDatabase() {
    if (window.prompt("Pour confirmer l'effacement complet, tapez : EFFACER") !== "EFFACER") {
        toast("Effacement annulé.");
        return;
    }
    await db.requests.clear();
    await db.history.clear();
    await loadRequestsData();
    renderRequestsSummary();
    renderRequests();
    renderOverview();
    toast("Toutes les demandes ont été supprimées.", "success");
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initSettingsEvents() {
    $("#exportJsonBtn").addEventListener("click", exportJSON);
    $("#settingsExportJson").addEventListener("click", exportJSON);
    $("#settingsExportCsv").addEventListener("click", exportCSV);
    $("#saveSettingsBtn").addEventListener("click", saveSettings);
    $("#clearDataBtn").addEventListener("click", clearDatabase);
    $("#mergeImportBtn").addEventListener("click", () => selectImportFile("merge"));
    $("#replaceImportBtn").addEventListener("click", () => selectImportFile("replace"));
    $("#importBtn").addEventListener("click", () => selectImportFile("merge"));
    $("#importFile").addEventListener("change", e => importFile(e.target.files[0]));
    $("#themeBtn").addEventListener("click", toggleTheme);
    $("#settingsThemeBtn").addEventListener("click", toggleTheme);
}
