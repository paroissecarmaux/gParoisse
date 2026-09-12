"use strict";

/* ============================================================
   MODULE CLOCHERS
   Une paroisse regroupe souvent plusieurs clochers (églises de
   différentes communes). Cette base sert de référentiel des lieux,
   recherchable depuis les autres modules (demandes, annonces,
   personnes) pour lier un lieu de cérémonie à une fiche précise
   plutôt que de ressaisir le nom en texte libre à chaque fois.
============================================================ */
async function loadClochersData() {
    state.clochers = await db.clochers.orderBy("updatedAt").reverse().toArray();
}

function createDefaultClocher() {
    const now = nowISO();
    return {
        id: uid(),
        nom: "",
        commune: "",
        secteur: "Carmaux",
        adresse: "",
        saintPatron: "",
        fetePatronale: "",
        notes: "",
        active: true,
        createdAt: now,
        updatedAt: now
    };
}

// Recherche générique réutilisée par les autres modules via
// setupAutocomplete() pour lier un champ « lieu » à un clocher.
function clocherSuggestions(query) {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return state.clochers
        .filter(c => normalize(`${c.nom} ${c.commune} ${c.secteur}`).includes(q))
        .slice(0, 8);
}

function clocherSuggestionLabel(c) {
    return `${escapeHTML(c.nom)}${c.commune ? " — " + escapeHTML(c.commune) : ""}${c.secteur ? " (" + escapeHTML(c.secteur) + ")" : ""}`;
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
function sortedClochers() {
    return sortByKey(state.clochers, c => normalize(c.nom));
}

function filteredClochers() {
    let items = sortedClochers();
    if (state.clocherQuickFilter === "Carmaux") items = items.filter(c => c.secteur === "Carmaux");
    else if (state.clocherQuickFilter === "Valence") items = items.filter(c => c.secteur === "Valence");
    else if (state.clocherQuickFilter === "inactive") items = items.filter(c => !c.active);
    return items;
}

function renderClochersSummary() {
    $("#clocherStatTotal").textContent = state.clochers.length;
    $("#clocherStatCarmaux").textContent = state.clochers.filter(c => c.secteur === "Carmaux").length;
    $("#clocherStatValence").textContent = state.clochers.filter(c => c.secteur === "Valence").length;
    $("#clocherStatInactive").textContent = state.clochers.filter(c => !c.active).length;
}

function filterClochersByKpi(kpi) {
    state.clocherQuickFilter = kpi === "all" ? null : kpi;
    renderClochersList();
    $("#clocherList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderClocherCard(c) {
    return `
        <article class="schedule-card ${!c.active ? "inactive" : ""}" data-clocher-id="${escapeHTML(c.id)}" role="listitem">
            <div class="avatar" aria-hidden="true">${icon("church")}</div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(c.nom || "Sans nom")}</div>
                <div class="request-contact">${escapeHTML(c.commune || "Commune non renseignée")}</div>
            </div>
            <div>
                <div class="request-type">${escapeHTML(c.saintPatron ? "Saint patron : " + c.saintPatron : "")}</div>
                <div class="request-date">${escapeHTML(c.fetePatronale ? "Fête le " + c.fetePatronale : "")}</div>
            </div>
            <div class="badge-row">
                ${c.secteur ? `<span class="badge normal">${escapeHTML(c.secteur)}</span>` : ""}
                ${!c.active ? `<span class="badge cancelled">Inactif</span>` : `<span class="badge done">${icon("check-circle", "icon-inline")}Actif</span>`}
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">${icon("edit")}</button>
                <button class="icon-btn" data-action="delete" title="Supprimer" aria-label="Supprimer">${icon("trash")}</button>
            </div>
        </article>
    `;
}

function renderClochersList() {
    const container = $("#clocherList");
    const items = filteredClochers();
    const countEl = $("#clocherResultCount");

    if (!items.length) {
        countEl.textContent = "";
        container.innerHTML = `<div class="empty">${state.clochers.length ? "Aucun clocher ne correspond à ce filtre." : "Aucun clocher enregistré. Ajoutez les églises de la paroisse pour pouvoir les rechercher depuis les autres modules."}</div>`;
        return;
    }

    countEl.textContent = `${items.length} clocher${items.length > 1 ? "s" : ""}`;
    container.innerHTML = items.map(renderClocherCard).join("");
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
function fillClocherForm(c) {
    $("#clocherId").value = c.id || "";
    $("#clocherNom").value = c.nom || "";
    $("#clocherCommune").value = c.commune || "";
    $("#clocherSecteur").value = c.secteur || "Carmaux";
    $("#clocherAdresse").value = c.adresse || "";
    $("#clocherSaintPatron").value = c.saintPatron || "";
    $("#clocherFetePatronale").value = c.fetePatronale || "";
    $("#clocherNotes").value = c.notes || "";
    $("#clocherActive").checked = c.active !== false;
}

function showClocherForm(id) {
    const existing = id ? state.clochers.find(x => x.id === id) : null;
    state.clocherFormMode = existing ? "edit" : "new";
    fillClocherForm(existing || createDefaultClocher());
    $("#clocherFormTitle").textContent = existing ? "Modifier le clocher" : "Nouveau clocher";
    showPage("clocher-form");
    setTimeout(() => $("#clocherNom").focus(), 50);
}

async function saveClocher(e) {
    e.preventDefault();
    const nom = $("#clocherNom").value.trim();
    if (!nom) {
        toast("Le nom du clocher est obligatoire.", "error");
        $("#clocherNom").focus();
        return;
    }

    const id = $("#clocherId").value.trim();
    const existing = state.clochers.find(c => c.id === id);
    const now = nowISO();

    const clocher = {
        id: id || uid(),
        nom,
        commune: $("#clocherCommune").value.trim(),
        secteur: $("#clocherSecteur").value,
        adresse: $("#clocherAdresse").value.trim(),
        saintPatron: $("#clocherSaintPatron").value.trim(),
        fetePatronale: $("#clocherFetePatronale").value.trim(),
        notes: $("#clocherNotes").value.trim(),
        active: $("#clocherActive").checked,
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    try {
        await db.clochers.put(clocher);
        await loadClochersData();
        renderClochersList();
        renderClochersSummary();
        toast(existing ? "Clocher modifié." : "Clocher ajouté.", "success");
        showClocherDetail(clocher.id);
    } catch (err) {
        console.error(err);
        toast("Impossible d'enregistrer ce clocher.", "error");
    }
}

function showClocherDetail(id) {
    const c = state.clochers.find(x => x.id === id);
    if (!c) return;
    state.selectedClocherId = id;

    $("#clocherDetailTitle").textContent = `Clochers › ${c.nom || "Clocher"}`;

    $("#clocherDetailBody").innerHTML = `
        <div class="fiche-header">
            <div class="fiche-avatar" aria-hidden="true">${icon("church")}</div>
            <div class="fiche-heading">
                <h3 class="fiche-name">${escapeHTML(c.nom)}</h3>
                <p class="fiche-meta">${escapeHTML(c.commune || "Commune non renseignée")}</p>
                <div class="fiche-chips">
                    ${c.secteur ? `<span class="badge normal">${escapeHTML(c.secteur)}</span>` : ""}
                    ${!c.active ? `<span class="badge cancelled">Inactif</span>` : `<span class="badge done">${icon("check-circle", "icon-inline")}Actif</span>`}
                </div>
            </div>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Détails</h4>
            <dl class="fiche-grid">
                ${ficheField("Secteur", escapeHTML(c.secteur))}
                ${ficheField("Saint patron", escapeHTML(c.saintPatron))}
                ${ficheField("Fête patronale", escapeHTML(c.fetePatronale))}
                ${ficheField("Adresse", escapeHTML(c.adresse), true)}
                ${ficheField("Notes", escapeHTML(c.notes) || "Aucune note.", true)}
            </dl>
        </div>
    `;

    $("#clocherDetailToggleBtn").innerHTML = c.active
        ? `${icon("archive")} Désactiver`
        : `${icon("restore")} Réactiver`;
    showPage("clocher-detail");
}

async function toggleClocherActive(id) {
    const c = state.clochers.find(x => x.id === id);
    if (!c) return;
    c.active = !c.active;
    c.updatedAt = nowISO();
    await db.clochers.put(c);
    await loadClochersData();
    renderClochersList();
    renderClochersSummary();
    showClocherDetail(id);
    toast(c.active ? "Clocher réactivé." : "Clocher désactivé.", "success");
}

async function deleteClocher(id) {
    const c = state.clochers.find(x => x.id === id);
    if (!c) return;
    if (!window.confirm(`Supprimer définitivement « ${c.nom} » ?\n\nCette action est irréversible.`)) return;

    try {
        await db.clochers.delete(id);
        await loadClochersData();
        renderClochersList();
        renderClochersSummary();
        toast("Clocher supprimé.", "success");
        showPage("clochers");
    } catch (err) {
        console.error(err);
        toast("Impossible de supprimer ce clocher.", "error");
    }
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initClochersEvents() {
    $("#newClocherBtn").addEventListener("click", () => showClocherForm(null));
    $("#clocherForm").addEventListener("submit", saveClocher);

    $("#clocherKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) filterClochersByKpi(btn.dataset.kpi);
    });
    $("#clocherFormBackBtn").addEventListener("click", goBack);
    $("#clocherFormCancelBtn").addEventListener("click", goBack);

    $("#clocherDetailBackBtn").addEventListener("click", goBack);
    $("#clocherEditBtn").addEventListener("click", () => state.selectedClocherId && showClocherForm(state.selectedClocherId));
    $("#clocherDetailToggleBtn").addEventListener("click", () => state.selectedClocherId && toggleClocherActive(state.selectedClocherId));
    $("#clocherDeleteBtn").addEventListener("click", () => state.selectedClocherId && deleteClocher(state.selectedClocherId));

    $("#clocherList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-clocher-id]");
        if (!card) return;
        const id = card.dataset.clocherId;

        if (!btn) { showClocherDetail(id); return; }

        switch (btn.dataset.action) {
            case "edit": showClocherForm(id); break;
            case "delete": deleteClocher(id); break;
        }
    });
}
