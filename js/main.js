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
        }
    });
}

/* ============================================================
   INITIALISATION
============================================================ */
async function init() {
    initRequestsEvents();
    initPeopleEvents();
    initOverviewEvents();
    initSettingsEvents();
    initGlobalEvents();

    try {
        await db.open();
        renderTypeFilters();
        renderTypeFormOptions();
        await loadSettings();
        await loadRequestsData();
        await loadPeopleData();
        renderRequestsSummary();
        renderRequests();
        renderPeopleList();
        renderOverview();
        toast("Secrétariat prêt.", "success");
    } catch (err) {
        console.error(err);
        toast("Impossible d'ouvrir la base : " + err.message, "error");
    }
}

init();
