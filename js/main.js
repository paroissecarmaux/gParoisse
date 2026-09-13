"use strict";

/* ============================================================
   NAVIGATION GLOBALE (sidebar)
============================================================ */
function initGlobalEvents() {
    $$(".nav-item").forEach(btn => btn.addEventListener("click", () => {
        if (state.formSubmitting || !confirmDiscardIfDirty()) return;
        showPage(btn.dataset.page);
    }));

    // V6.6 : marque state.formDirty dès qu'un champ change sur une page
    // "-form" — délégué au document plutôt qu'un écouteur par champ par
    // module. showPage() le remet à false à chaque navigation (voir
    // js/state.js), donc seule une page "-form" actuellement affichée
    // peut le poser.
    const markFormDirty = e => {
        if (e.target.closest('.view-page[data-page$="-form"]')) state.formDirty = true;
    };
    document.addEventListener("input", markFormDirty);
    document.addEventListener("change", markFormDirty);

    $("#sidebarToggle").addEventListener("click", () => {
        $("#sidebar").classList.contains("open") ? closeSidebar() : openSidebar();
    });
    $("#sidebarBackdrop").addEventListener("click", closeSidebar);

    $("#importReportCloseBtn").addEventListener("click", () => { $("#importReportPanel").hidden = true; });

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
        // Le panneau de recherche globale gère ses propres touches
        // (flèches, Entrée, Échap) tant qu'il est ouvert.
        if (isGlobalSearchOpen()) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            openGlobalSearch();
            return;
        }

        const tag = document.activeElement?.tagName;
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

        if (e.key === "Escape") { goBack(); return; }

        const section = PAGE_SECTION[state.page];

        if (e.key === "/" && !typing) {
            e.preventDefault();
            if (section === "requests") { $("#searchInput").focus(); }
            else if (section === "people") { $("#peopleSearchInput").focus(); }
            else { openGlobalSearch(); }
            return;
        }

        if (e.key.toLowerCase() === "n" && !typing && !e.ctrlKey && !e.metaKey) {
            if (state.formSubmitting || !confirmDiscardIfDirty()) return;
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
    initTrashEvents();
    initOverviewEvents();
    initAgendaEvents();
    initSettingsEvents();
    initDiagnosticsEvents();
    initGlobalSearchEvents();
    initGlobalEvents();

    try {
        await db.open();
        renderTypeFilters();
        renderTypeFormOptions();
        renderScheduleCategoryOptions();
        renderPersonnelFormOptions();
        renderIntentionFormOptions();
        await loadSettings();
        renderBackupStatus();
        await loadRequestsData();
        await loadPeopleData();
        await loadScheduleData();
        await loadClochersData();
        await loadPersonnelData();
        await loadIntentionsData();
        // V6.8.a : fondations de l'Annuaire (docs/V6.7-ANNUAIRE-DESIGN.md).
        // Migration additive et idempotente people/personnel -> directory
        // (aucun écran ne lit encore state.directory) — voir
        // js/core/directory.js. Exécutée à chaque démarrage : sans effet
        // une fois tout migré, reprend toute fiche people/personnel créée
        // depuis (les deux modules restent actifs pendant cette phase).
        await migratePeopleAndPersonnelToDirectory();
        await loadDirectoryData();
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
        renderTrash();
        renderOverview();
        renderAgenda();
        toast("Secrétariat prêt.", "success");
    } catch (err) {
        Logger.error("main.init", err);
        toast("Impossible d'ouvrir la base : " + err.message, "error");
    }
}

init();
registerServiceWorker();
