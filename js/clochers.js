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
    state.clochers = await ClochersRepository.listActive();
    state.clochersTrash = await ClochersRepository.listDeleted();
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
                <button class="icon-btn" data-action="delete" title="Mettre à la corbeille" aria-label="Mettre à la corbeille">${icon("trash")}</button>
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
        await ClochersRepository.put(clocher);
        await addHistory("clocher", clocher.id, existing ? "update" : "create", existing ? "Clocher modifié" : "Clocher créé");
        await loadClochersData();
        renderClochersList();
        renderClochersSummary();
        toast(existing ? "Clocher modifié." : "Clocher ajouté.", "success");
        showClocherDetail(clocher.id);
    } catch (err) {
        Logger.error("clochers.saveClocher", err);
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
        ${historySectionHTML("clocher", id)}
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
    await ClochersRepository.put(c);
    await addHistory("clocher", id, c.active ? "restore" : "archive", c.active ? "Clocher réactivé" : "Clocher désactivé");
    await loadClochersData();
    renderClochersList();
    renderClochersSummary();
    showClocherDetail(id);
    toast(c.active ? "Clocher réactivé." : "Clocher désactivé.", "success");
}

// Compte les demandes/annonces/intentions qui référencent ce clocher
// (V6.2.a) : on n'y touche pas, on avertit seulement avant suppression.
function clocherLinkedRecordsWarning(c) {
    return describeLinkedRecords([
        { label: "demande", count: countByField(state.requests, "clocherId", c.id) },
        { label: "annonce", count: countByField(state.schedule, "clocherId", c.id) },
        { label: "intention", count: countByField(state.intentions, "clocherId", c.id) }
    ]);
}

/* ============================================================
   CORBEILLE (V6.2.c) — même principe que js/requests.js. Les demandes/
   annonces/intentions qui référencent ce clocher gardent leur
   clocherId intact (voir findLinked() dans js/utils.js).
============================================================ */
async function trashClocher(id) {
    const c = state.clochers.find(x => x.id === id);
    if (!c) return;
    const warning = clocherLinkedRecordsWarning(c);
    if (!window.confirm(`${warning}\n\nMettre à la corbeille « ${c.nom} » ?\n\nIl pourra être restauré depuis la Corbeille.`)) return;

    try {
        c.deletedAt = nowISO();
        c.updatedAt = nowISO();
        await ClochersRepository.put(c);
        await addHistory("clocher", id, "trash", "Clocher mis à la corbeille");
        await loadClochersData();
        renderClochersList();
        renderClochersSummary();
        renderTrash();
        toast("Clocher mis à la corbeille.", "success");
        showPage("clochers");
    } catch (err) {
        Logger.error("clochers.trashClocher", err);
        toast("Impossible de mettre ce clocher à la corbeille.", "error");
    }
}

async function restoreClocher(id) {
    const c = state.clochersTrash.find(x => x.id === id);
    if (!c) return;

    try {
        c.deletedAt = null;
        c.updatedAt = nowISO();
        await ClochersRepository.put(c);
        await addHistory("clocher", id, "restore", "Clocher restauré depuis la corbeille");
        await loadClochersData();
        renderClochersList();
        renderClochersSummary();
        renderTrash();
        toast("Clocher restauré.", "success");
    } catch (err) {
        Logger.error("clochers.restoreClocher", err);
        toast("Impossible de restaurer ce clocher.", "error");
    }
}

async function purgeClocher(id) {
    const c = state.clochersTrash.find(x => x.id === id);
    if (!c) return;
    if (!window.confirm(`Supprimer définitivement « ${c.nom} » ?\n\nCette action est IRRÉVERSIBLE : la fiche ne pourra plus être restaurée.`)) return;

    try {
        await ClochersRepository.remove(id);
        await addHistory("clocher", id, "purge", "Clocher supprimé définitivement");
        await loadClochersData();
        renderClochersList();
        renderClochersSummary();
        renderTrash();
        toast("Clocher supprimé définitivement.", "success");
    } catch (err) {
        Logger.error("clochers.purgeClocher", err);
        toast("Impossible de supprimer définitivement ce clocher.", "error");
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
    $("#clocherDeleteBtn").addEventListener("click", () => state.selectedClocherId && trashClocher(state.selectedClocherId));

    $("#clocherList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-clocher-id]");
        if (!card) return;
        const id = card.dataset.clocherId;

        if (!btn) { showClocherDetail(id); return; }

        switch (btn.dataset.action) {
            case "edit": showClocherForm(id); break;
            case "delete": trashClocher(id); break;
        }
    });
}
