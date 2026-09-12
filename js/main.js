"use strict";

/* ============================================================
   NAVIGATION GLOBALE (sidebar)
============================================================ */
function initGlobalEvents() {
    $$(".nav-item").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));

    $("#sidebarToggle").addEventListener("click", () => {
        $("#sidebar").classList.contains("open") ? closeSidebar() : openSidebar();
    });
    $("#sidebarBackdrop").addEventListener("click", closeSidebar);

    // Boutons export/import CSV par base : présents à la fois dans les
    // Paramètres et directement dans l'en-tête de chaque module, d'où un
    // seul gestionnaire délégué sur le document plutôt qu'un par page.
    document.addEventListener("click", e => {
        const exportBtn = e.target.closest("[data-csv-export]");
        if (exportBtn) { exportModuleCSV(exportBtn.dataset.csvExport); return; }
        const importBtn = e.target.closest("[data-csv-import]");
        if (importBtn) selectCsvImportFile(importBtn.dataset.csvImport);
    });

    document.addEventListener("keydown", e => {
        const tag = document.activeElement?.tagName;
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

        if (e.key === "Escape") { goBack(); return; }

        const section = PAGE_SECTION[state.page];

        if (e.key === "/" && !typing) {
            if (section === "requests") { e.preventDefault(); $("#searchInput").focus(); }
            else if (section === "people") { e.preventDefault(); $("#peopleSearchInput").focus(); }
        }

        if (e.key.toLowerCase() === "n" && !typing && !e.ctrlKey && !e.metaKey) {
            if (section === "people") { e.preventDefault(); showPersonForm(null); }
            else if (section === "requests") { e.preventDefault(); showRequestForm(null); }
            else if (section === "announcements") { e.preventDefault(); showScheduleForm(null); }
            else if (section === "clochers") { e.preventDefault(); showClocherForm(null); }
            else if (section === "personnel") { e.preventDefault(); showPersonnelForm(null); }
            else if (section === "intentions") { e.preventDefault(); showIntentionForm(null); }
        }
    });
}

/* ============================================================
   SERVICE WORKER (PWA)
   Purement additif : l'app fonctionne sans lui (toutes les données
   vivent dans IndexedDB). Les navigateurs refusent les service
   workers sur file:// — c'est le mode d'usage normal en local — on
   ne tente donc l'enregistrement que lorsque l'app est servie en
   http(s), et on avale silencieusement tout échec.
============================================================ */
function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").catch(() => { /* mode hors-ligne local : rien à faire */ });
}

/* ============================================================
   INITIALISATION
============================================================ */
async function init() {
    initRequestsEvents();
    initPeopleEvents();
    initScheduleEvents();
    initClochersEvents();
    initPersonnelEvents();
    initIntentionsEvents();
    initOverviewEvents();
    initAgendaEvents();
    initSettingsEvents();
    initGlobalEvents();

    try {
        await db.open();
        renderTypeFilters();
        renderTypeFormOptions();
        renderScheduleCategoryOptions();
        renderPersonnelFormOptions();
        renderIntentionFormOptions();
        await loadSettings();
        await loadRequestsData();
        await loadPeopleData();
        await loadScheduleData();
        await loadClochersData();
        await loadPersonnelData();
        await loadIntentionsData();
        renderRequestsSummary();
        renderRequests();
        renderPeopleList();
        renderPeopleSummary();
        renderScheduleList();
        renderScheduleSummary();
        renderClochersList();
        renderClochersSummary();
        renderPersonnelList();
        renderPersonnelSummary();
        renderIntentionsList();
        renderIntentionsSummary();
        renderOverview();
        renderAgenda();
        toast("Secrétariat prêt.", "success");
    } catch (err) {
        console.error(err);
        toast("Impossible d'ouvrir la base : " + err.message, "error");
    }
}

init();
registerServiceWorker();
