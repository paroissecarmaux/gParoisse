"use strict";

/* ============================================================
   MODULE DEMANDES / TABLEAU DE BORD
============================================================ */
const REQUEST_TYPES = [
    "Certificat de baptême", "Certificat de mariage", "Certificat de décès",
    "Demande de messe", "Baptême", "Mariage", "Confirmation", "Obsèques",
    "Rendez-vous", "Inscription", "Document administratif", "Autre"
];

const STATUS = ["En attente", "En cours", "Terminé", "Annulé"];
const PRIORITIES = ["Normale", "Urgente"];

async function loadRequestsData() {
    state.requests = await db.requests.orderBy("updatedAt").reverse().toArray();
    state.history = await db.history.toArray();
}

function createDefaultRequest() {
    const now = nowISO();
    return {
        id: uid(),
        name: "",
        contact: "",
        type: REQUEST_TYPES[0],
        dateDemande: todayISO(),
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
        contact: String(raw.contact || raw.telephone || raw.email || "").trim(),
        type: REQUEST_TYPES.includes(raw.type) ? raw.type : "Autre",
        dateDemande: raw.dateDemande || raw.date || todayISO(),
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
        text: `${overdue ? "⚠ " : ""}${formatDate(r.deadline)}${relative ? " · " + relative : ""}`,
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
        if (query) {
            const hay = normalize([r.name, r.contact, r.type, r.status, r.description, r.notes].join(" "));
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    const sort = $("#sortFilter").value;
    result.sort((a, b) => {
        if (sort === "name") return normalize(a.name).localeCompare(normalize(b.name), "fr");
        if (sort === "deadline") return (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31");
        if (sort === "created") return String(b.createdAt).localeCompare(String(a.createdAt));
        return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
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
        return;
    }

    countEl.textContent = `${requests.length} demande${requests.length > 1 ? "s" : ""}`;
    container.innerHTML = requests.map(renderRequestCard).join("");
}

function renderRequestCard(r) {
    const overdue = isOverdue(r);
    const urgent = r.priority === "Urgente";
    const dl = formatDeadline(r);
    const canComplete = !r.archived && r.status !== "Terminé" && r.status !== "Annulé";

    return `
        <article class="request-card ${urgent ? "urgent" : ""} ${overdue ? "overdue" : ""}"
                 data-request-id="${escapeHTML(r.id)}" role="listitem">
            <div class="request-person">
                <div class="request-name">${escapeHTML(r.name || "Sans nom")}</div>
                <div class="request-contact">${escapeHTML(r.contact || "Aucun contact")}</div>
            </div>
            <div>
                <div class="request-type">${escapeHTML(r.type)}</div>
                <div class="request-date">Demandée le ${formatDate(r.dateDemande)}</div>
            </div>
            <div>
                <span class="badge ${statusClass(r.status)}">${escapeHTML(r.status)}</span>
                ${urgent ? `<span class="badge urgent">Urgente</span>` : ""}
                ${r.deadline ? `<div class="deadline ${dl.overdue ? "overdue" : ""}">${dl.text}</div>` : ""}
            </div>
            <div>
                ${r.archived ? `<span class="badge normal">Archivée</span>` : ""}
            </div>
            <div class="request-actions">
                ${canComplete ? `<button class="icon-btn" data-action="complete" title="Marquer terminé" aria-label="Terminer">✓</button>` : ""}
                <button class="icon-btn" data-action="open" title="Ouvrir" aria-label="Ouvrir">↗</button>
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">✎</button>
                ${!r.archived
                    ? `<button class="icon-btn" data-action="archive" title="Archiver" aria-label="Archiver">▣</button>`
                    : `<button class="icon-btn" data-action="restore" title="Restaurer" aria-label="Restaurer">↶</button>`}
            </div>
        </article>
    `;
}

function renderDashboard() {
    const active = state.requests.filter(r => !r.archived);
    $("#statPending").textContent = active.filter(r => r.status === "En attente").length;
    $("#statProgress").textContent = active.filter(r => r.status === "En cours").length;
    $("#statDone").textContent = active.filter(r => r.status === "Terminé").length;
    $("#statAlerts").textContent = active.filter(r => r.priority === "Urgente" || isOverdue(r)).length;
    $("#storageCount").textContent = state.requests.length;

    const priority = active
        .filter(r => r.priority === "Urgente" || isOverdue(r))
        .sort((a, b) => {
            if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
            return String(b.updatedAt).localeCompare(String(a.updatedAt));
        })
        .slice(0, 6);

    if (!priority.length) {
        $("#priorityList").innerHTML = `<div class="empty">Rien de particulier à signaler.</div>`;
        return;
    }

    $("#priorityList").innerHTML = priority.map(r => `
        <div class="alert-item" data-priority-id="${escapeHTML(r.id)}" role="listitem">
            <div class="alert-marker"></div>
            <div class="alert-main">
                <div class="alert-name">${escapeHTML(r.name)}</div>
                <div class="alert-detail">
                    ${isOverdue(r) ? "Échéance dépassée" : "Demande urgente"} · ${escapeHTML(r.type)}
                </div>
            </div>
        </div>
    `).join("");
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
function fillRequestForm(r) {
    $("#requestId").value = r.id || "";
    $("#name").value = r.name || "";
    $("#contact").value = r.contact || "";
    $("#type").value = r.type || REQUEST_TYPES[0];
    $("#dateDemande").value = r.dateDemande || todayISO();
    $("#status").value = r.status || "En attente";
    $("#priority").value = r.priority || "Normale";
    $("#deadline").value = r.deadline || "";
    $("#contactMethod").value = r.contactMethod || "";
    $("#description").value = r.description || "";
    $("#notes").value = r.notes || "";
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

    const request = existing ? {
        ...existing,
        name,
        contact: $("#contact").value.trim(),
        type: $("#type").value,
        dateDemande,
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
        contact: $("#contact").value.trim(),
        type: $("#type").value,
        dateDemande,
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
        renderDashboard();
        renderRequests();
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

    $("#requestDetailTitle").textContent = r.name || "Demande sans nom";
    $("#requestDetailSubtitle").textContent = `${r.type} · ${formatDate(r.dateDemande)}`;

    const history = state.history
        .filter(h => h.requestId === id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    const dl = formatDeadline(r);

    $("#requestDetailBody").innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Statut</div>
                <div class="detail-value"><span class="badge ${statusClass(r.status)}">${escapeHTML(r.status)}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Priorité</div>
                <div class="detail-value">
                    <span class="badge ${r.priority === "Urgente" ? "urgent" : "normal"}">${escapeHTML(r.priority)}</span>
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Contact</div>
                <div class="detail-value">${escapeHTML(r.contact || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Moyen de contact</div>
                <div class="detail-value">${escapeHTML(r.contactMethod || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date de la demande</div>
                <div class="detail-value">${formatDate(r.dateDemande)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Échéance</div>
                <div class="detail-value">
                    ${r.deadline ? `<span class="${dl.overdue ? "deadline overdue" : "deadline"}">${dl.text}</span>` : "—"}
                </div>
            </div>
            <div class="detail-item full">
                <div class="detail-label">Demande</div>
                <div class="detail-value">${escapeHTML(r.description || "Aucune description.")}</div>
            </div>
            <div class="detail-item full">
                <div class="detail-label">Notes internes</div>
                <div class="detail-value">${escapeHTML(r.notes || "Aucune note.")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Créée le</div>
                <div class="detail-value">${formatDateTime(r.createdAt)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Modifiée le</div>
                <div class="detail-value">${formatDateTime(r.updatedAt)}</div>
            </div>
            ${r.completedAt ? `
            <div class="detail-item">
                <div class="detail-label">Terminée le</div>
                <div class="detail-value">${formatDateTime(r.completedAt)}</div>
            </div>` : ""}
        </div>
        <div class="history">
            <div class="history-title">Historique</div>
            ${history.length
                ? history.map(h => `
                    <div class="history-item">
                        <div class="history-dot"></div>
                        <div>
                            <div class="history-text">${escapeHTML(h.description)}</div>
                            <div class="history-date">${formatDateTime(h.createdAt)}</div>
                        </div>
                    </div>`).join("")
                : `<div class="empty">Aucun historique.</div>`}
        </div>
    `;

    $("#requestDetailArchiveBtn").textContent = r.archived ? "↶ Restaurer" : "▣ Archiver";
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
    renderDashboard();
    renderRequests();
    toast(archive ? "Demande archivée." : "Demande restaurée.", "success");
    showPage("dashboard");
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
    renderDashboard();
    renderRequests();
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
        renderDashboard();
        renderRequests();
        toast("Demande supprimée.", "success");
        showPage("dashboard");
    } catch (err) {
        console.error(err);
        toast("Impossible de supprimer la demande.", "error");
    }
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initDashboardEvents() {
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

    $("#priorityList").addEventListener("click", e => {
        const item = e.target.closest("[data-priority-id]");
        if (item) showRequestDetail(item.dataset.priorityId);
    });

    $("#requestForm").addEventListener("submit", saveRequest);
    $("#newRequestBtn").addEventListener("click", () => showRequestForm(null));
    $("#requestFormBackBtn").addEventListener("click", goBack);
    $("#requestFormCancelBtn").addEventListener("click", goBack);

    $("#requestDetailBackBtn").addEventListener("click", goBack);
    $("#requestDetailEditBtn").addEventListener("click", () => state.selectedId && showRequestForm(state.selectedId));
    $("#requestDetailArchiveBtn").addEventListener("click", () => state.selectedId && toggleArchive(state.selectedId));
    $("#requestDetailDeleteBtn").addEventListener("click", () => state.selectedId && deleteRequest(state.selectedId));

    const debouncedRender = debounce(renderRequests, 200);
    $("#searchInput").addEventListener("input", debouncedRender);
    $("#statusFilter").addEventListener("change", renderRequests);
    $("#typeFilter").addEventListener("change", renderRequests);
    $("#sortFilter").addEventListener("change", renderRequests);

    $$(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            $$(".tab").forEach(t => {
                t.classList.remove("active");
                t.setAttribute("aria-selected", "false");
            });
            tab.classList.add("active");
            tab.setAttribute("aria-selected", "true");
            state.view = tab.dataset.view;
            renderRequests();
        });
    });
}
