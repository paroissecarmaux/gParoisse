"use strict";

/* ============================================================
   RECHERCHE GLOBALE
   Palette de commandes façon Ctrl+K : interroge en direct les
   bases déjà chargées en mémoire (state.*) plutôt que Dexie, pour
   rester instantané. Chaque source sait chercher, afficher un
   titre/sous-texte et ouvrir la fiche correspondante.
============================================================ */
const GLOBAL_SEARCH_SOURCES = [
    {
        key: "people",
        label: "Membres",
        icon: "person",
        search: q => state.people
            .filter(p => normalize(`${p.prenom} ${p.nom} ${p.telephone} ${p.email}`).includes(q))
            .slice(0, 8),
        title: p => `${p.prenom} ${p.nom}`.trim() || "Sans nom",
        subtitle: p => p.dateDeces
            ? `Décédé(e) le ${formatDate(p.dateDeces)}`
            : ([p.telephone, p.email].filter(Boolean).join(" · ") || "Aucun contact renseigné"),
        open: p => showPersonDetail(p.id)
    },
    {
        key: "requests",
        label: "Demandes",
        icon: "file",
        search: q => state.requests
            .filter(r => normalize(`${r.name} ${r.type} ${r.description} ${r.notes}`).includes(q))
            .slice(0, 8),
        title: r => r.name || r.type,
        subtitle: r => `${r.type} · ${r.status}`,
        open: r => showRequestDetail(r.id)
    },
    {
        key: "intentions",
        label: "Intentions de messe",
        icon: "candle",
        search: q => state.intentions
            .filter(i => normalize(`${i.intitule} ${i.type}`).includes(q))
            .slice(0, 8),
        title: i => i.intitule || i.type,
        subtitle: i => `${i.type} · ${formatDate(i.dateDebut)}`,
        open: i => showIntentionDetail(i.id)
    },
    {
        key: "personnel",
        label: "Personnel",
        icon: "badge",
        search: q => state.personnel
            .filter(p => normalize(`${p.prenom} ${p.nom} ${p.fonction}`).includes(q))
            .slice(0, 8),
        title: p => `${p.prenom} ${p.nom}`.trim() || "Sans nom",
        subtitle: p => p.fonction || p.typeEngagement || "",
        open: p => showPersonnelDetail(p.id)
    },
    {
        key: "clochers",
        label: "Clochers",
        icon: "church",
        search: q => state.clochers
            .filter(c => normalize(`${c.nom} ${c.commune}`).includes(q))
            .slice(0, 8),
        title: c => c.nom || "Sans nom",
        subtitle: c => c.commune || "",
        open: c => showClocherDetail(c.id)
    }
];

// Résultats aplatis (toutes catégories confondues) pour la navigation au
// clavier ; recalculés à chaque frappe dans renderGlobalSearchResults().
let globalSearchFlatResults = [];
let globalSearchSelected = -1;

function isGlobalSearchOpen() {
    return !$("#globalSearchOverlay").hidden;
}

function openGlobalSearch() {
    $("#globalSearchOverlay").hidden = false;
    $("#globalSearchInput").value = "";
    renderGlobalSearchResults("");
    setTimeout(() => $("#globalSearchInput").focus(), 30);
}

function closeGlobalSearch() {
    $("#globalSearchOverlay").hidden = true;
}

function globalSearchResultHTML(source, item, idx) {
    return `
        <button type="button" class="global-search-result" data-idx="${idx}">
            <span class="global-search-result-icon" aria-hidden="true">${icon(source.icon)}</span>
            <span class="global-search-result-text">
                <span class="global-search-result-title">${escapeHTML(source.title(item))}</span>
                <span class="global-search-result-subtitle">${escapeHTML(source.subtitle(item))}</span>
            </span>
        </button>
    `;
}

function renderGlobalSearchResults(rawQuery) {
    const q = normalize(rawQuery.trim());
    const container = $("#globalSearchResults");

    if (q.length < 2) {
        globalSearchFlatResults = [];
        globalSearchSelected = -1;
        container.innerHTML = `<div class="empty">Tapez au moins 2 lettres pour rechercher dans toutes les bases…</div>`;
        return;
    }

    globalSearchFlatResults = [];
    let html = "";

    GLOBAL_SEARCH_SOURCES.forEach(source => {
        const matches = source.search(q);
        if (!matches.length) return;
        html += `<div class="global-search-group-title">${escapeHTML(source.label)}</div>`;
        matches.forEach(item => {
            const idx = globalSearchFlatResults.length;
            globalSearchFlatResults.push({ source, item });
            html += globalSearchResultHTML(source, item, idx);
        });
    });

    if (!globalSearchFlatResults.length) {
        globalSearchSelected = -1;
        container.innerHTML = `<div class="empty">Aucun résultat pour « ${escapeHTML(rawQuery)} ».</div>`;
        return;
    }

    globalSearchSelected = 0;
    container.innerHTML = html;
    highlightGlobalSearchSelection();
}

function highlightGlobalSearchSelection() {
    $$("#globalSearchResults .global-search-result").forEach(el => {
        const active = Number(el.dataset.idx) === globalSearchSelected;
        el.classList.toggle("active", active);
        if (active) el.scrollIntoView({ block: "nearest" });
    });
}

function moveGlobalSearchSelection(delta) {
    if (!globalSearchFlatResults.length) return;
    const n = globalSearchFlatResults.length;
    globalSearchSelected = (globalSearchSelected + delta + n) % n;
    highlightGlobalSearchSelection();
}

function openGlobalSearchResult(idx) {
    const entry = globalSearchFlatResults[idx];
    if (!entry) return;
    closeGlobalSearch();
    entry.source.open(entry.item);
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initGlobalSearchEvents() {
    $("#globalSearchTrigger").addEventListener("click", openGlobalSearch);
    $("#globalSearchBackdrop").addEventListener("click", closeGlobalSearch);

    const debouncedRender = debounce(() => renderGlobalSearchResults($("#globalSearchInput").value), 120);
    $("#globalSearchInput").addEventListener("input", debouncedRender);

    $("#globalSearchResults").addEventListener("click", e => {
        const btn = e.target.closest("[data-idx]");
        if (btn) openGlobalSearchResult(Number(btn.dataset.idx));
    });

    // Ce gestionnaire ne s'occupe que des touches utiles pendant que le
    // panneau est ouvert ; js/main.js ignore ces mêmes touches tant que
    // isGlobalSearchOpen() est vrai, pour éviter tout conflit (Échap, etc.).
    document.addEventListener("keydown", e => {
        if (!isGlobalSearchOpen()) return;
        if (e.key === "Escape") { e.preventDefault(); closeGlobalSearch(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); moveGlobalSearchSelection(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); moveGlobalSearchSelection(-1); }
        else if (e.key === "Enter") { e.preventDefault(); openGlobalSearchResult(globalSearchSelected); }
    });
}
