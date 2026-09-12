"use strict";

/* ============================================================
   MODULE DEMANDES
   Vocabulaire (types, statuts, priorités, catégorisation) déplacé
   dans js/constants.js pour rester le référentiel unique partagé.
============================================================ */
function requestCategory(type) {
    return REQUEST_TYPE_CATEGORY[type] || "admin";
}

function requestIsEvent(r) {
    return requestCategory(r.type) === "event";
}

async function loadRequestsData() {
    state.requests = await db.requests.orderBy("updatedAt").reverse().toArray();
    state.history = await db.history.toArray();
}

function createDefaultRequest() {
    const now = nowISO();
    return {
        id: uid(),
        name: "",
        personId: "",
        contact: "",
        type: REQUEST_TYPES[0],
        dateDemande: todayISO(),
        dateEvenement: "",
        heureEvenement: "",
        lieuEvenement: "",
        clocherId: "",
        defunt: "",
        status: "En attente",
        priority: "Normale",
        deadline: "",
        contactMethod: "",
        description: "",
        notes: "",
        archived: false,
        createdAt: now,
        updatedAt: now,
        completedAt: null
    };
}

function normalizeRequest(raw) {
    const now = nowISO();
    return {
        id: String(raw.id || uid()),
        name: String(raw.name || raw.nom || "").trim(),
        personId: String(raw.personId || ""),
        contact: String(raw.contact || raw.telephone || raw.email || "").trim(),
        type: REQUEST_TYPES.includes(raw.type) ? raw.type : "Autre",
        dateDemande: raw.dateDemande || raw.date || todayISO(),
        dateEvenement: raw.dateEvenement || raw.dateCeremonie || "",
        heureEvenement: raw.heureEvenement || "",
        lieuEvenement: raw.lieuEvenement || "",
        clocherId: String(raw.clocherId || ""),
        defunt: raw.defunt || "",
        status: STATUS.includes(raw.status) ? raw.status
            : (STATUS.includes(raw.statut) ? raw.statut : "En attente"),
        priority: PRIORITIES.includes(raw.priority) ? raw.priority
            : (PRIORITIES.includes(raw.priorite) ? raw.priorite : "Normale"),
        deadline: raw.deadline || raw.echeance || "",
        contactMethod: raw.contactMethod || "",
        description: String(raw.description || raw.details || ""),
        notes: String(raw.notes || raw.notesInternes || ""),
        archived: Boolean(raw.archived),
        createdAt: raw.createdAt || raw.dateCreation || now,
        updatedAt: raw.updatedAt || raw.dateModification || now,
        completedAt: raw.completedAt || null
    };
}

async function addHistory(requestId, action, description) {
    await db.history.put({
        id: uid(),
        requestId,
        action,
        description,
        createdAt: nowISO()
    });
}

function isOverdue(r) {
    if (!r.deadline || r.status === "Terminé" || r.status === "Annulé" || r.archived) return false;
    return r.deadline < todayISO();
}

function formatDeadline(r) {
    if (!r.deadline) return { text: "", overdue: false };
    const overdue = isOverdue(r);
    const days = daysBetween(todayISO(), r.deadline);
    let relative = "";
    if (overdue) {
        const lag = Math.abs(days);
        relative = lag === 0 ? "aujourd'hui" : `en retard de ${lag} jour${lag > 1 ? "s" : ""}`;
    } else if (days === 0) relative = "aujourd'hui";
    else if (days === 1) relative = "demain";
    else if (days > 1) relative = `dans ${days} jours`;
    return {
        text: `${overdue ? icon("alert-triangle", "icon-inline") : ""}${formatDate(r.deadline)}${relative ? " · " + relative : ""}`,
        overdue
    };
}

function statusClass(s) {
    return ({ "En attente":"pending", "En cours":"progress", "Terminé":"done", "Annulé":"cancelled" })[s] || "normal";
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
function filteredRequests() {
    const query = normalize($("#searchInput").value);
    const status = $("#statusFilter").value;
    const type = $("#typeFilter").value;

    let result = state.requests.filter(r => {
        if (state.view === "active" && r.archived) return false;
        if (state.view === "archived" && !r.archived) return false;
        if (status && r.status !== status) return false;
        if (type && r.type !== type) return false;
        if (state.quickFilter === "alert" && !(r.priority === "Urgente" || isOverdue(r))) return false;
        if (query) {
            const hay = normalize([r.name, r.contact, r.type, r.status, r.description, r.notes].join(" "));
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    const sort = $("#sortFilter").value;
    if (sort === "name") result = sortByKey(result, r => normalize(r.name));
    else if (sort === "deadline") result = sortByKey(result, r => r.deadline || "9999-12-31");
    else if (sort === "created") result = sortByKey(result, r => r.createdAt).reverse();
    else result = sortByKey(result, r => r.updatedAt).reverse();
    return result;
}

function renderTypeFilters() {
    const select = $("#typeFilter");
    const current = select.value;
    select.innerHTML = `<option value="">Tous les types</option>` +
        REQUEST_TYPES.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
    select.value = current;
}

function renderTypeFormOptions() {
    $("#type").innerHTML = REQUEST_TYPES
        .map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
}

const REQUESTS_PAGE_SIZE = 60;

function renderRequests() {
    const container = $("#requestList");
    const requests = filteredRequests();
    const countEl = $("#resultCount");

    if (!requests.length) {
        countEl.textContent = "";
        let msg = "Aucune demande ne correspond aux critères.";
        if (state.view === "archived") msg = "Aucune demande archivée.";
        else if (state.view === "active" && !state.requests.some(r => !r.archived)) {
            msg = "Aucune demande active. Créez-en une avec « Nouvelle demande ».";
        }
        container.innerHTML = `<div class="empty">${msg}</div>`;
        $("#requestPagination").innerHTML = "";
        return;
    }

    const { pageItems, page, totalPages } = paginate(requests, state.requestsPage, REQUESTS_PAGE_SIZE);
    state.requestsPage = page;

    countEl.textContent = `${requests.length} demande${requests.length > 1 ? "s" : ""}`;
    container.innerHTML = pageItems.map(renderRequestCard).join("");
    $("#requestPagination").innerHTML = paginationControlsHTML(page, totalPages);
}

function renderRequestCard(r) {
    const overdue = isOverdue(r);
    const urgent = r.priority === "Urgente";
    const dl = formatDeadline(r);
    const canComplete = !r.archived && r.status !== "Terminé" && r.status !== "Annulé";

    return `
        <article class="request-card ${urgent ? "urgent" : ""} ${overdue ? "overdue" : ""}"
                 data-request-id="${escapeHTML(r.id)}" role="listitem">
            <div class="avatar" aria-hidden="true">${escapeHTML(initials(r.name))}</div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(r.name || "Sans nom")}</div>
                <div class="request-contact">${escapeHTML(r.contact || "Aucun contact")}</div>
            </div>
            <div>
                <div class="request-type">${escapeHTML(r.type)}</div>
                <div class="request-date">${requestIsEvent(r) && r.dateEvenement
                    ? `${r.type === "Obsèques" && r.defunt ? "Obsèques de " + escapeHTML(r.defunt) + " · " : ""}${formatDate(r.dateEvenement)}${r.heureEvenement ? " à " + escapeHTML(r.heureEvenement) : ""}`
                    : `Demandée le ${formatDate(r.dateDemande)}`}</div>
            </div>
            <div>
                <div class="badge-row">
                    <span class="badge ${statusClass(r.status)}">${escapeHTML(r.status)}</span>
                    ${urgent ? `<span class="badge urgent">${icon("alert-triangle", "icon-inline")}Urgente</span>` : ""}
                    ${r.archived ? `<span class="badge normal">Archivée</span>` : ""}
                </div>
                ${r.deadline ? `<div class="deadline ${dl.overdue ? "overdue" : ""}">${dl.text}</div>` : ""}
            </div>
            <div class="request-actions">
                ${canComplete ? `<button class="icon-btn" data-action="complete" title="Marquer terminé" aria-label="Terminer">${icon("check")}</button>` : ""}
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">${icon("edit")}</button>
                ${!r.archived
                    ? `<button class="icon-btn" data-action="archive" title="Archiver" aria-label="Archiver">${icon("archive")}</button>`
                    : `<button class="icon-btn" data-action="restore" title="Restaurer" aria-label="Restaurer">${icon("restore")}</button>`}
            </div>
        </article>
    `;
}

function renderRequestsSummary() {
    const active = state.requests.filter(r => !r.archived);
    $("#statPending").textContent = active.filter(r => r.status === "En attente").length;
    $("#statProgress").textContent = active.filter(r => r.status === "En cours").length;
    $("#statDone").textContent = active.filter(r => r.status === "Terminé").length;
    $("#statAlerts").textContent = active.filter(r => r.priority === "Urgente" || isOverdue(r)).length;
    $("#statTotal").textContent = state.requests.length;
    $("#statArchived").textContent = state.requests.filter(r => r.archived).length;
}

function filterRequestsByKpi(kpi) {
    $("#searchInput").value = "";
    $("#typeFilter").value = "";
    $("#statusFilter").value = "";
    state.quickFilter = null;
    state.requestsPage = 1;

    if (kpi === "all") {
        state.view = "all";
    } else if (kpi === "archived") {
        state.view = "archived";
    } else if (kpi === "alert") {
        state.view = "active";
        state.quickFilter = "alert";
    } else {
        state.view = "active";
        $("#statusFilter").value = kpi;
    }

    renderRequests();
    $("#requestList").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
/* ============================================================
   RECHERCHE DE PERSONNE (lie la demande à une fiche existante)
============================================================ */
function personSuggestionLabel(p) {
    const contact = [p.telephone, p.email].filter(Boolean).join(" · ");
    return `${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}${contact ? " — " + escapeHTML(contact) : ""}`;
}

function linkRequestToPerson(person) {
    $("#name").value = `${person.prenom} ${person.nom}`.trim();
    $("#requestPersonId").value = person.id;
    if (!$("#contact").value.trim()) {
        $("#contact").value = person.telephone || person.email || "";
    }
}

function fillRequestForm(r) {
    $("#requestId").value = r.id || "";
    $("#name").value = r.name || "";
    $("#requestPersonId").value = r.personId || "";
    $("#nameAutocompleteMenu").hidden = true;
    $("#contact").value = r.contact || "";
    $("#type").value = r.type || REQUEST_TYPES[0];
    $("#dateDemande").value = r.dateDemande || todayISO();
    $("#dateEvenement").value = r.dateEvenement || "";
    $("#heureEvenement").value = r.heureEvenement || "";
    $("#lieuEvenement").value = r.lieuEvenement || "";
    $("#requestClocherId").value = r.clocherId || "";
    $("#lieuEvenementAutocompleteMenu").hidden = true;
    $("#defunt").value = r.defunt || "";
    $("#status").value = r.status || "En attente";
    $("#priority").value = r.priority || "Normale";
    $("#deadline").value = r.deadline || "";
    $("#contactMethod").value = r.contactMethod || "";
    $("#description").value = r.description || "";
    $("#notes").value = r.notes || "";
    updateRequestFormFields();
}

function updateRequestFormFields() {
    const type = $("#type").value;
    const isEvent = requestCategory(type) === "event";
    $("#eventSectionTitle").hidden = !isEvent;
    $("#fieldDateEvenement").hidden = !isEvent;
    $("#fieldHeureEvenement").hidden = !isEvent;
    $("#fieldLieuEvenement").hidden = !isEvent;
    $("#fieldDefunt").hidden = !(isEvent && type === "Obsèques");
}

function showRequestForm(id) {
    const existing = id ? state.requests.find(r => r.id === id) : null;
    state.requestFormMode = existing ? "edit" : "new";
    fillRequestForm(existing || createDefaultRequest());
    $("#requestFormTitle").textContent = existing ? "Modifier la demande" : "Nouvelle demande";
    $("#deadlineError").hidden = true;
    showPage("request-form");
    setTimeout(() => $("#name").focus(), 50);
}

async function saveRequest(e) {
    e.preventDefault();
    const name = $("#name").value.trim();
    if (!name) {
        toast("Le nom est obligatoire.", "error");
        $("#name").focus();
        return;
    }

    const dateDemande = $("#dateDemande").value;
    const deadline = $("#deadline").value;
    const errorEl = $("#deadlineError");
    if (deadline && dateDemande && deadline < dateDemande) {
        errorEl.textContent = "L'échéance ne peut pas être antérieure à la date de la demande.";
        errorEl.hidden = false;
        $("#deadline").focus();
        return;
    }
    errorEl.hidden = true;

    const id = $("#requestId").value.trim();
    const existing = state.requests.find(r => r.id === id);
    const now = nowISO();

    const type = $("#type").value;
    const isEvent = requestCategory(type) === "event";
    const dateEvenement = isEvent ? $("#dateEvenement").value : "";
    const heureEvenement = isEvent ? $("#heureEvenement").value.trim() : "";
    const lieuEvenement = isEvent ? $("#lieuEvenement").value.trim() : "";
    const clocherId = isEvent ? $("#requestClocherId").value.trim() : "";
    const defunt = (isEvent && type === "Obsèques") ? $("#defunt").value.trim() : "";

    const personId = $("#requestPersonId").value.trim();

    const request = existing ? {
        ...existing,
        name,
        personId,
        contact: $("#contact").value.trim(),
        type,
        dateDemande,
        dateEvenement,
        heureEvenement,
        lieuEvenement,
        clocherId,
        defunt,
        status: $("#status").value,
        priority: $("#priority").value,
        deadline,
        contactMethod: $("#contactMethod").value,
        description: $("#description").value.trim(),
        notes: $("#notes").value.trim(),
        updatedAt: now
    } : {
        ...createDefaultRequest(),
        id: id || uid(),
        name,
        personId,
        contact: $("#contact").value.trim(),
        type,
        dateDemande,
        dateEvenement,
        heureEvenement,
        lieuEvenement,
        clocherId,
        defunt,
        status: $("#status").value,
        priority: $("#priority").value,
        deadline,
        contactMethod: $("#contactMethod").value,
        description: $("#description").value.trim(),
        notes: $("#notes").value.trim(),
        createdAt: now,
        updatedAt: now
    };

    if (request.status === "Terminé" && !request.completedAt) request.completedAt = now;
    if (request.status !== "Terminé") request.completedAt = null;

    try {
        await db.requests.put(request);
        await addHistory(request.id, existing ? "update" : "create",
            existing ? "Demande modifiée" : "Demande créée");
        await loadRequestsData();
        renderRequestsSummary();
        renderRequests();
        renderOverview();
        renderAgenda();
        toast(existing ? "Demande modifiée." : "Demande créée.", "success");
        showRequestDetail(request.id);
    } catch (err) {
        console.error(err);
        toast("Impossible d'enregistrer la demande.", "error");
    }
}

function showRequestDetail(id) {
    const r = state.requests.find(x => x.id === id);
    if (!r) return;
    state.selectedId = id;

    const linkedPerson = r.personId ? state.people.find(p => p.id === r.personId) : null;
    const linkedClocher = r.clocherId ? state.clochers.find(c => c.id === r.clocherId) : null;

    $("#requestDetailTitle").textContent = r.name || "Demande sans nom";
    $("#requestDetailSubtitle").textContent = `${r.type} · ${formatDate(r.dateDemande)}`;

    const history = state.history
        .filter(h => h.requestId === id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    const dl = formatDeadline(r);

    $("#requestDetailBody").innerHTML = `
        <div class="fiche-header">
            <div class="fiche-avatar" aria-hidden="true">${escapeHTML(initials(r.name))}</div>
            <div class="fiche-heading">
                <h3 class="fiche-name">${escapeHTML(r.name || "Demande sans nom")}</h3>
                <p class="fiche-meta">${escapeHTML(r.type)} · demandée le ${formatDate(r.dateDemande)}</p>
                <div class="fiche-chips">
                    <span class="badge ${statusClass(r.status)}">${escapeHTML(r.status)}</span>
                    <span class="badge ${r.priority === "Urgente" ? "urgent" : "normal"}">${r.priority === "Urgente" ? icon("alert-triangle", "icon-inline") : ""}${escapeHTML(r.priority)}</span>
                    ${r.archived ? `<span class="badge normal">Archivée</span>` : ""}
                    ${history.length ? `<span class="badge normal">${icon("clock", "icon-inline")}${history.length} suivi${history.length > 1 ? "s" : ""}</span>` : ""}
                </div>
            </div>
        </div>

        <div class="fiche-section">
            <h4 class="fiche-section-title">Historique${history.length ? ` (${history.length})` : ""}</h4>
            <div class="history">
                ${history.length
                    ? history.map(h => `
                        <div class="history-item">
                            <div class="history-dot"></div>
                            <div>
                                <div class="history-text">${escapeHTML(h.description)}</div>
                                <div class="history-date">${formatDateTime(h.createdAt)}</div>
                            </div>
                        </div>`).join("")
                    : `<div class="empty">Aucun historique pour l'instant : les changements de statut et actions seront journalisés ici.</div>`}
            </div>
        </div>

        <div class="fiche-section">
            <h4 class="fiche-section-title">Suivi</h4>
            <dl class="fiche-grid">
                ${ficheField("Date de la demande", formatDate(r.dateDemande))}
                ${ficheField("Échéance", r.deadline ? `<span class="${dl.overdue ? "deadline overdue" : "deadline"}">${dl.text}</span>` : "")}
            </dl>
        </div>

        ${requestIsEvent(r) ? `
        <div class="fiche-section">
            <h4 class="fiche-section-title">Cérémonie</h4>
            <dl class="fiche-grid">
                ${ficheField("Date", formatDate(r.dateEvenement))}
                ${ficheField("Heure", escapeHTML(r.heureEvenement))}
                ${ficheField("Lieu", linkedClocher
                    ? `<button type="button" class="link-btn" data-goto-clocher="${escapeHTML(linkedClocher.id)}">${escapeHTML(linkedClocher.nom)}</button>`
                    : escapeHTML(r.lieuEvenement), true)}
                ${r.type === "Obsèques" ? ficheField("Défunt", escapeHTML(r.defunt), true) : ""}
            </dl>
        </div>` : ""}

        <div class="fiche-section">
            <h4 class="fiche-section-title">Contact</h4>
            <dl class="fiche-grid">
                ${ficheField("Contact", escapeHTML(r.contact))}
                ${ficheField("Moyen de contact", escapeHTML(r.contactMethod))}
                ${ficheField("Personne liée", linkedPerson
                    ? `<button type="button" class="link-btn" data-goto-person="${escapeHTML(linkedPerson.id)}">${escapeHTML(linkedPerson.prenom)} ${escapeHTML(linkedPerson.nom)}</button>`
                    : (r.personId ? "Personne introuvable (supprimée)" : ""), true)}
            </dl>
        </div>

        <div class="fiche-section">
            <h4 class="fiche-section-title">Contenu</h4>
            <dl class="fiche-grid">
                ${ficheField("Description", escapeHTML(r.description) || "Aucune description.", true)}
                ${ficheField("Notes internes", escapeHTML(r.notes) || "Aucune note.", true)}
            </dl>
        </div>

        <div class="fiche-section">
            <h4 class="fiche-section-title">Journal</h4>
            <dl class="fiche-grid">
                ${ficheField("Créée le", formatDateTime(r.createdAt))}
                ${ficheField("Modifiée le", formatDateTime(r.updatedAt))}
                ${r.completedAt ? ficheField("Terminée le", formatDateTime(r.completedAt)) : ""}
            </dl>
        </div>
    `;

    $("#requestDetailArchiveBtn").innerHTML = r.archived
        ? `${icon("restore")} Restaurer`
        : `${icon("archive")} Archiver`;
    showPage("request-detail");
}

async function toggleArchive(id) {
    const r = state.requests.find(x => x.id === id);
    if (!r) return;
    const archive = !r.archived;

    if (archive && !window.confirm(`Archiver la demande de ${r.name || "cette personne"} ?`)) return;

    r.archived = archive;
    r.updatedAt = nowISO();
    await db.requests.put(r);
    await addHistory(id, archive ? "archive" : "restore", archive ? "Demande archivée" : "Demande restaurée");
    await loadRequestsData();
    renderRequestsSummary();
    renderRequests();
    renderOverview();
    renderAgenda();
    toast(archive ? "Demande archivée." : "Demande restaurée.", "success");
    showPage("requests");
}

async function markComplete(id) {
    const r = state.requests.find(x => x.id === id);
    if (!r || r.status === "Terminé") return;

    r.status = "Terminé";
    r.completedAt = nowISO();
    r.updatedAt = nowISO();
    await db.requests.put(r);
    await addHistory(id, "complete", "Marquée comme terminée");
    await loadRequestsData();
    renderRequestsSummary();
    renderRequests();
    renderOverview();
    toast("Demande terminée.", "success");
}

async function deleteRequest(id) {
    const r = state.requests.find(x => x.id === id);
    if (!r) return;
    if (!window.confirm(`Supprimer définitivement la demande de ${r.name || "cette personne"} ?\n\nCette action est irréversible.`)) return;

    try {
        await db.requests.delete(id);
        await addHistory(id, "delete", "Demande supprimée définitivement");
        await loadRequestsData();
        renderRequestsSummary();
        renderRequests();
        renderOverview();
        renderAgenda();
        toast("Demande supprimée.", "success");
        showPage("requests");
    } catch (err) {
        console.error(err);
        toast("Impossible de supprimer la demande.", "error");
    }
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initRequestsEvents() {
    $("#requestList").addEventListener("click", async e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-request-id]");
        if (!card) return;
        const id = card.dataset.requestId;

        if (!btn) { showRequestDetail(id); return; }

        switch (btn.dataset.action) {
            case "open": showRequestDetail(id); break;
            case "edit": showRequestForm(id); break;
            case "archive":
            case "restore": await toggleArchive(id); break;
            case "complete": await markComplete(id); break;
        }
    });

    $("#requestKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) filterRequestsByKpi(btn.dataset.kpi);
    });

    $("#requestForm").addEventListener("submit", saveRequest);
    $("#type").addEventListener("change", updateRequestFormFields);

    $("#name").addEventListener("input", () => { $("#requestPersonId").value = ""; });
    setupAutocomplete($("#name"), $("#nameAutocompleteMenu"), {
        search: personSuggestions,
        renderLabel: personSuggestionLabel,
        onSelect: linkRequestToPerson
    });

    $("#lieuEvenement").addEventListener("input", () => { $("#requestClocherId").value = ""; });
    setupAutocomplete($("#lieuEvenement"), $("#lieuEvenementAutocompleteMenu"), {
        search: clocherSuggestions,
        renderLabel: clocherSuggestionLabel,
        onSelect: c => { $("#lieuEvenement").value = c.nom; $("#requestClocherId").value = c.id; }
    });

    $("#newRequestBtn").addEventListener("click", () => showRequestForm(null));
    $("#requestFormBackBtn").addEventListener("click", goBack);
    $("#requestFormCancelBtn").addEventListener("click", goBack);

    $("#requestDetailBackBtn").addEventListener("click", goBack);
    $("#requestDetailEditBtn").addEventListener("click", () => state.selectedId && showRequestForm(state.selectedId));
    $("#requestDetailArchiveBtn").addEventListener("click", () => state.selectedId && toggleArchive(state.selectedId));
    $("#requestDetailDeleteBtn").addEventListener("click", () => state.selectedId && deleteRequest(state.selectedId));

    $("#requestDetailBody").addEventListener("click", e => {
        const personBtn = e.target.closest("[data-goto-person]");
        if (personBtn) { showPersonDetail(personBtn.dataset.gotoPerson); return; }
        const clocherBtn = e.target.closest("[data-goto-clocher]");
        if (clocherBtn) showClocherDetail(clocherBtn.dataset.gotoClocher);
    });

    const debouncedRender = debounce(() => { state.quickFilter = null; state.requestsPage = 1; renderRequests(); }, 200);
    $("#searchInput").addEventListener("input", debouncedRender);
    $("#statusFilter").addEventListener("change", () => { state.quickFilter = null; state.requestsPage = 1; renderRequests(); });
    $("#typeFilter").addEventListener("change", () => { state.quickFilter = null; state.requestsPage = 1; renderRequests(); });
    $("#sortFilter").addEventListener("change", () => { state.requestsPage = 1; renderRequests(); });

    $("#requestPagination").addEventListener("click", e => {
        const btn = e.target.closest("[data-page-nav]");
        if (!btn || btn.disabled) return;
        state.requestsPage += btn.dataset.pageNav === "next" ? 1 : -1;
        renderRequests();
        $("#requestList").scrollIntoView({ behavior: "smooth", block: "start" });
    });
}
