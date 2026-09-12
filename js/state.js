"use strict";

/* ============================================================
   ÉTAT PARTAGÉ
============================================================ */
const state = {
    requests: [],
    history: [],
    people: [],
    page: "dashboard",
    view: "active",
    selectedId: null,
    selectedPersonId: null,
    requestFormMode: "new",
    personFormMode: "new",
    importMode: "merge",
    lastFocused: null,
    settings: {
        parishName: "Secrétariat paroissial de Carmaux-Valence",
        lastBackup: null,
        theme: "light"
    }
};

/* ============================================================
   NAVIGATION PLEIN ÉCRAN (SIDEBAR + PAGES)
   Chaque page du module (liste, détail, formulaire) est un
   conteneur .view-page[data-page]. Un module ajouté plus tard n'a
   qu'à déclarer ses pages ici pour s'intégrer à la navigation.
============================================================ */
const PAGE_SECTION = {
    "dashboard": "dashboard",
    "request-detail": "dashboard",
    "request-form": "dashboard",
    "people": "people",
    "person-detail": "people",
    "person-form": "people"
};

function showPage(page) {
    state.page = page;
    $$(".view-page").forEach(el => { el.hidden = el.dataset.page !== page; });

    const section = PAGE_SECTION[page] || page;
    $$(".nav-item").forEach(btn => {
        const active = btn.dataset.page === section;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
    });

    closeSidebar();
    window.scrollTo(0, 0);
}

function pageBackTarget(page) {
    switch (page) {
        case "request-detail": return "dashboard";
        case "person-detail": return "people";
        case "request-form": return state.requestFormMode === "edit" ? "request-detail" : "dashboard";
        case "person-form": return state.personFormMode === "edit" ? "person-detail" : "people";
        default: return null;
    }
}

function goBack() {
    const target = pageBackTarget(state.page);
    if (target) showPage(target);
}

function openSidebar() {
    $("#sidebar").classList.add("open");
    $("#sidebarBackdrop").classList.add("open");
    $("#sidebarToggle").setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#sidebarBackdrop").classList.remove("open");
    $("#sidebarToggle").setAttribute("aria-expanded", "false");
}

/* ============================================================
   THEME
============================================================ */
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
    state.settings.theme = theme;
    $("#themeBtn").textContent = theme === "dark" ? "☀" : "☾";
}

async function toggleTheme() {
    const next = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    await saveSetting("theme", next);
}

/* ============================================================
   MODALES (réservées aux Paramètres)
============================================================ */
function getFocusable(container) {
    return Array.from(container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled && el.offsetParent !== null);
}

function openModal(id) {
    const backdrop = $("#" + id);
    state.lastFocused = document.activeElement;
    backdrop.classList.add("open");
    backdrop.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
        const focusables = getFocusable(backdrop);
        if (focusables.length) focusables[0].focus();
    }, 40);
}

function closeModal(id) {
    const backdrop = $("#" + id);
    backdrop.classList.remove("open");
    backdrop.setAttribute("hidden", "");
    if (!$$(".modal-backdrop.open").length) document.body.style.overflow = "";
    if (state.lastFocused?.focus) state.lastFocused.focus();
}

function closeAllModals() {
    $$(".modal-backdrop.open").forEach(m => {
        m.classList.remove("open");
        m.setAttribute("hidden", "");
    });
    document.body.style.overflow = "";
    if (state.lastFocused?.focus) state.lastFocused.focus();
}
