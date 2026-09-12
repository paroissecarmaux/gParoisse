"use strict";

/* ============================================================
   ÉTAT PARTAGÉ
============================================================ */
const state = {
    requests: [],
    history: [],
    people: [],
    schedule: [],
    clochers: [],
    personnel: [],
    intentions: [],
    page: "overview",
    view: "active",
    quickFilter: null,
    peopleQuickFilter: null,
    scheduleQuickFilter: null,
    clocherQuickFilter: null,
    personnelQuickFilter: null,
    intentionQuickFilter: null,
    peoplePage: 1,
    requestsPage: 1,
    selectedId: null,
    selectedPersonId: null,
    selectedScheduleId: null,
    selectedClocherId: null,
    selectedPersonnelId: null,
    selectedIntentionId: null,
    requestFormMode: "new",
    personFormMode: "new",
    scheduleFormMode: "new",
    clocherFormMode: "new",
    personnelFormMode: "new",
    intentionFormMode: "new",
    agendaView: "week",
    agendaDate: todayISO(),
    agendaRangeStart: startOfWeekISO(todayISO()),
    agendaRangeEnd: addDays(startOfWeekISO(todayISO()), 6),
    importMode: "merge",
    csvImportModuleKey: "requests",
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
    "overview": "overview",
    "requests": "requests",
    "request-detail": "requests",
    "request-form": "requests",
    "people": "people",
    "person-detail": "people",
    "person-form": "people",
    "announcements": "announcements",
    "schedule-detail": "announcements",
    "schedule-form": "announcements",
    "clochers": "clochers",
    "clocher-detail": "clochers",
    "clocher-form": "clochers",
    "personnel": "personnel",
    "personnel-detail": "personnel",
    "personnel-form": "personnel",
    "intentions": "intentions",
    "intention-detail": "intentions",
    "intention-form": "intentions",
    "agenda": "agenda",
    "settings": "settings"
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
        case "request-detail": return "requests";
        case "person-detail": return "people";
        case "request-form": return state.requestFormMode === "edit" ? "request-detail" : "requests";
        case "person-form": return state.personFormMode === "edit" ? "person-detail" : "people";
        case "schedule-detail": return "announcements";
        case "schedule-form": return state.scheduleFormMode === "edit" ? "schedule-detail" : "announcements";
        case "clocher-detail": return "clochers";
        case "clocher-form": return state.clocherFormMode === "edit" ? "clocher-detail" : "clochers";
        case "personnel-detail": return "personnel";
        case "personnel-form": return state.personnelFormMode === "edit" ? "personnel-detail" : "personnel";
        case "intention-detail": return "intentions";
        case "intention-form": return state.intentionFormMode === "edit" ? "intention-detail" : "intentions";
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
    $("#themeBtn").innerHTML = icon(theme === "dark" ? "sun" : "moon");
}

async function toggleTheme() {
    const next = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    await saveSetting("theme", next);
}
