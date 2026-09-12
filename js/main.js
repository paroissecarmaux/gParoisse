"use strict";

/* ============================================================
   NAVIGATION GLOBALE (sidebar, modale Paramètres)
============================================================ */
function initGlobalEvents() {
    $$(".nav-item").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));

    $("#sidebarToggle").addEventListener("click", () => {
        $("#sidebar").classList.contains("open") ? closeSidebar() : openSidebar();
    });
    $("#sidebarBackdrop").addEventListener("click", closeSidebar);

    $$("[data-close-modal]").forEach(btn => {
        btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });

    $$(".modal-backdrop").forEach(b => {
        b.addEventListener("mousedown", e => { if (e.target === b) closeModal(b.id); });
    });

    document.addEventListener("keydown", e => {
        const tag = document.activeElement?.tagName;
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

        if (e.key === "Escape") {
            if ($(".modal-backdrop.open")) closeAllModals();
            else goBack();
            return;
        }

        if (e.key === "Tab") {
            const open = $(".modal-backdrop.open");
            if (open) {
                const f = getFocusable(open);
                if (!f.length) return;
                if (e.shiftKey && document.activeElement === f[0]) {
                    e.preventDefault(); f[f.length - 1].focus();
                } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
                    e.preventDefault(); f[0].focus();
                }
            }
        }

        if (e.key === "/" && !typing) {
            const section = PAGE_SECTION[state.page];
            if (section === "dashboard") { e.preventDefault(); $("#searchInput").focus(); }
            else if (section === "people") { e.preventDefault(); $("#peopleSearchInput").focus(); }
        }

        if (e.key.toLowerCase() === "n" && !typing && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const section = PAGE_SECTION[state.page];
            if (section === "people") showPersonForm(null);
            else showRequestForm(null);
        }
    });
}

/* ============================================================
   INITIALISATION
============================================================ */
async function init() {
    initDashboardEvents();
    initPeopleEvents();
    initSettingsEvents();
    initGlobalEvents();

    try {
        await db.open();
        renderTypeFilters();
        renderTypeFormOptions();
        await loadSettings();
        await loadRequestsData();
        await loadPeopleData();
        renderDashboard();
        renderRequests();
        renderPeopleList();
        $("#storageStatus").textContent = "✓ Dexie prêt";
        toast("Secrétariat prêt.", "success");
    } catch (err) {
        console.error(err);
        $("#storageStatus").textContent = "Erreur";
        toast("Impossible d'ouvrir la base : " + err.message, "error");
    }
}

init();
