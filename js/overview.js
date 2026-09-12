"use strict";

/* ============================================================
   MODULE TABLEAU DE BORD
   Vue d'ensemble transversale : quelques indicateurs et les
   annonces du jour (obsèques, messes, anniversaires), croisant
   la base des personnes et celle des demandes.
============================================================ */
function peopleWithBirthdayToday() {
    const now = new Date();
    const mm = now.getMonth();
    const dd = now.getDate();

    return state.people
        .filter(p => {
            if (!p.dateNaissance) return false;
            const [, m, d] = p.dateNaissance.split("-").map(Number);
            return m - 1 === mm && d === dd;
        })
        .sort((a, b) => normalize(a.nom + a.prenom).localeCompare(normalize(b.nom + b.prenom), "fr"));
}

function requestsForTodayByType(type) {
    const today = todayISO();
    return state.requests
        .filter(r => !r.archived && r.type === type && r.dateEvenement === today)
        .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), "fr"));
}

function renderAnnounceList(selector, items, renderItem, emptyText) {
    $(selector).innerHTML = items.length
        ? items.map(renderItem).join("")
        : `<p class="announce-empty">${emptyText}</p>`;
}

function renderObsequesItem(r) {
    return `
        <div class="alert-item" data-request-id="${escapeHTML(r.id)}" role="listitem">
            <div class="alert-marker"></div>
            <div class="alert-main">
                <div class="alert-name">${escapeHTML(r.name || "Sans nom")}</div>
                <div class="alert-detail">${escapeHTML(r.contact || "Aucun contact renseigné")}</div>
            </div>
        </div>
    `;
}

function renderMesseItem(r) {
    const detail = r.description ? truncate(r.description, 60) : (r.contact || "Aucun détail renseigné");
    return `
        <div class="alert-item" data-request-id="${escapeHTML(r.id)}" role="listitem">
            <div class="alert-marker"></div>
            <div class="alert-main">
                <div class="alert-name">${escapeHTML(r.name || "Sans nom")}</div>
                <div class="alert-detail">${escapeHTML(detail)}</div>
            </div>
        </div>
    `;
}

function renderAnniversaireItem(p) {
    const age = computeAge(p.dateNaissance);
    return `
        <div class="alert-item" data-person-id="${escapeHTML(p.id)}" role="listitem">
            <div class="alert-marker"></div>
            <div class="alert-main">
                <div class="alert-name">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</div>
                <div class="alert-detail">${age !== null ? `Fête ses ${age} an${age > 1 ? "s" : ""} aujourd'hui` : "Anniversaire aujourd'hui"}</div>
            </div>
        </div>
    `;
}

function scheduleForToday() {
    const today = todayISO();
    return state.schedule
        .filter(s => scheduleOccursOn(s, today))
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function renderHoraireItem(s) {
    return `
        <div class="alert-item" data-schedule-id="${escapeHTML(s.id)}" role="listitem">
            <div class="alert-marker"></div>
            <div class="alert-main">
                <div class="alert-name">${escapeHTML(s.title)}</div>
                <div class="alert-detail">${escapeHTML([s.time, s.location].filter(Boolean).join(" · ") || s.category || "Annonce")}</div>
            </div>
        </div>
    `;
}

function renderOverview() {
    $("#overviewTodayLabel").textContent =
        new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

    const obseques = requestsForTodayByType("Obsèques");
    const messes = requestsForTodayByType("Demande de messe");
    const anniversaires = peopleWithBirthdayToday();
    const horaires = scheduleForToday();

    renderAnnounceList("#announceObseques", obseques, renderObsequesItem, "Aucune obsèque aujourd'hui.");
    renderAnnounceList("#announceMesses", messes, renderMesseItem, "Aucune messe programmée aujourd'hui.");
    renderAnnounceList("#announceHoraires", horaires, renderHoraireItem, "Aucun horaire paroissial aujourd'hui.");
    renderAnnounceList("#announceAnniversaires", anniversaires, renderAnniversaireItem, "Aucun anniversaire aujourd'hui.");

    $("#overviewPeopleCount").textContent = state.people.length;
    $("#overviewPendingCount").textContent = state.requests.filter(r => !r.archived && r.status === "En attente").length;
    $("#overviewAlertCount").textContent = state.requests.filter(r => !r.archived && (r.priority === "Urgente" || isOverdue(r))).length;
    $("#overviewAnnounceCount").textContent = obseques.length + messes.length + horaires.length + anniversaires.length;
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function handleOverviewKpiClick(kind) {
    if (kind === "people") { showPage("people"); return; }
    if (kind === "pending") { showPage("requests"); filterRequestsByKpi("En attente"); return; }
    if (kind === "alert") { showPage("requests"); filterRequestsByKpi("alert"); return; }
    if (kind === "announce") {
        state.agendaView = "day";
        state.agendaDate = todayISO();
        $$("#agendaViewToggle .segmented-btn").forEach(b => b.classList.toggle("active", b.dataset.agendaView === "day"));
        showPage("agenda");
        renderAgenda();
    }
}

function initOverviewEvents() {
    $("#overviewKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) handleOverviewKpiClick(btn.dataset.kpi);
    });

    $("#announceObseques").addEventListener("click", e => {
        const item = e.target.closest("[data-request-id]");
        if (item) showRequestDetail(item.dataset.requestId);
    });
    $("#announceMesses").addEventListener("click", e => {
        const item = e.target.closest("[data-request-id]");
        if (item) showRequestDetail(item.dataset.requestId);
    });
    $("#announceHoraires").addEventListener("click", e => {
        const item = e.target.closest("[data-schedule-id]");
        if (item) showScheduleDetail(item.dataset.scheduleId);
    });
    $("#announceAnniversaires").addEventListener("click", e => {
        const item = e.target.closest("[data-person-id]");
        if (item) showPersonDetail(item.dataset.personId);
    });
}
