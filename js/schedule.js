"use strict";

/* ============================================================
   MODULE ANNONCES (horaires paroissiaux)
   Deux types d'entrées :
   - récurrente : se répète chaque semaine sur un jour donné
     (ex. « Messe dominicale », tous les dimanches à 10h30)
   - ponctuelle : une seule date (ex. « Pèlerinage », le 15 mars)
   Ces annonces alimentent l'agenda aux côtés des demandes.
   Catégories et noms de jours : voir js/constants.js.
============================================================ */
async function loadScheduleData() {
    state.schedule = await ScheduleRepository.listActive();
    state.scheduleTrash = await ScheduleRepository.listDeleted();
}

function renderScheduleCategoryOptions() {
    $("#scheduleCategory").innerHTML = SCHEDULE_CATEGORIES
        .map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
}

function createDefaultSchedule() {
    const now = nowISO();
    return {
        id: uid(),
        title: "",
        category: SCHEDULE_CATEGORIES[0],
        kind: "recurring",
        dayOfWeek: 0,
        date: todayISO(),
        time: "",
        location: "",
        clocherId: "",
        notes: "",
        active: true,
        createdAt: now,
        updatedAt: now
    };
}

function describeRecurrence(s) {
    if (s.kind === "once") {
        return `Le ${formatDate(s.date)}${s.time ? " à " + s.time : ""}`;
    }
    return `Tous les ${WEEKDAY_NAMES[s.dayOfWeek]}s${s.time ? " à " + s.time : ""}`;
}

function scheduleOccursOn(s, iso) {
    if (!s.active) return false;
    if (s.kind === "once") return s.date === iso;
    return weekdayOf(iso) === Number(s.dayOfWeek);
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
function sortedSchedule() {
    return state.schedule.slice().sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "recurring" ? -1 : 1;
        if (a.kind === "recurring") return a.dayOfWeek - b.dayOfWeek || (a.time || "").localeCompare(b.time || "");
        return (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || "");
    });
}

function filteredSchedule() {
    let items = sortedSchedule();
    if (state.scheduleQuickFilter === "recurring") items = items.filter(s => s.kind === "recurring");
    else if (state.scheduleQuickFilter === "once") items = items.filter(s => s.kind === "once");
    else if (state.scheduleQuickFilter === "inactive") items = items.filter(s => !s.active);
    return items;
}

function renderScheduleSummary() {
    $("#scheduleStatTotal").textContent = state.schedule.length;
    $("#scheduleStatRecurring").textContent = state.schedule.filter(s => s.kind === "recurring").length;
    $("#scheduleStatOnce").textContent = state.schedule.filter(s => s.kind === "once").length;
    $("#scheduleStatInactive").textContent = state.schedule.filter(s => !s.active).length;
}

function filterScheduleByKpi(kpi) {
    state.scheduleQuickFilter = kpi === "all" ? null : kpi;
    renderScheduleList();
    $("#scheduleList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderScheduleCard(s) {
    return `
        <article class="schedule-card ${!s.active ? "inactive" : ""}" data-schedule-id="${escapeHTML(s.id)}" role="listitem">
            <div class="avatar" aria-hidden="true"><svg class="icon"><use href="#i-bell"></use></svg></div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(s.title || "Sans titre")}</div>
                <div class="request-contact">${escapeHTML(s.location || "Aucun lieu renseigné")}</div>
            </div>
            <div>
                <div class="request-type">${escapeHTML(s.category || "Autre")}</div>
                <div class="request-date">${escapeHTML(describeRecurrence(s))}</div>
            </div>
            <div class="badge-row">
                <span class="badge ${s.kind === "recurring" ? "progress" : "normal"}">${s.kind === "recurring" ? "Récurrente" : "Ponctuelle"}</span>
                ${!s.active ? `<span class="badge cancelled">Suspendue</span>` : ""}
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">${icon("edit")}</button>
                <button class="icon-btn" data-action="delete" title="Mettre à la corbeille" aria-label="Mettre à la corbeille">${icon("trash")}</button>
            </div>
        </article>
    `;
}

function renderScheduleList() {
    const container = $("#scheduleList");
    const items = filteredSchedule();
    const countEl = $("#scheduleResultCount");

    if (!items.length) {
        countEl.textContent = "";
        container.innerHTML = `<div class="empty">${state.schedule.length ? "Aucune annonce ne correspond à ce filtre." : "Aucune annonce enregistrée. Ajoutez l'horaire des messes, une confession, un événement…"}</div>`;
        return;
    }

    countEl.textContent = `${items.length} annonce${items.length > 1 ? "s" : ""}`;
    container.innerHTML = items.map(renderScheduleCard).join("");
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
function fillScheduleForm(s) {
    $("#scheduleId").value = s.id || "";
    $("#scheduleTitle").value = s.title || "";
    $("#scheduleCategory").value = s.category || SCHEDULE_CATEGORIES[0];
    $("#scheduleKind").value = s.kind || "recurring";
    $("#scheduleDayOfWeek").value = String(s.dayOfWeek ?? 0);
    $("#scheduleDate").value = s.date || todayISO();
    $("#scheduleTime").value = s.time || "";
    $("#scheduleLocation").value = s.location || "";
    $("#scheduleClocherId").value = s.clocherId || "";
    $("#scheduleLocationAutocompleteMenu").hidden = true;
    $("#scheduleNotes").value = s.notes || "";
    $("#scheduleActive").checked = s.active !== false;
    updateScheduleFormFields();
}

function updateScheduleFormFields() {
    const isRecurring = $("#scheduleKind").value === "recurring";
    $("#fieldDayOfWeek").hidden = !isRecurring;
    $("#fieldScheduleDate").hidden = isRecurring;
}

function showScheduleForm(id) {
    const existing = id ? state.schedule.find(x => x.id === id) : null;
    state.scheduleFormMode = existing ? "edit" : "new";
    fillScheduleForm(existing || createDefaultSchedule());
    $("#scheduleFormTitle").textContent = existing ? "Modifier l'annonce" : "Nouvelle annonce";
    showPage("schedule-form");
    setTimeout(() => $("#scheduleTitle").focus(), 50);
}

async function saveSchedule(e) {
    e.preventDefault();
    const title = $("#scheduleTitle").value.trim();
    if (!title) {
        toast("Le titre est obligatoire.", "error");
        $("#scheduleTitle").focus();
        return;
    }

    const id = $("#scheduleId").value.trim();
    const existing = state.schedule.find(s => s.id === id);
    const now = nowISO();
    const kind = $("#scheduleKind").value;

    const entry = {
        id: id || uid(),
        title,
        category: $("#scheduleCategory").value,
        kind,
        dayOfWeek: kind === "recurring" ? Number($("#scheduleDayOfWeek").value) : null,
        date: kind === "once" ? $("#scheduleDate").value : "",
        time: $("#scheduleTime").value.trim(),
        location: $("#scheduleLocation").value.trim(),
        clocherId: $("#scheduleClocherId").value.trim(),
        notes: $("#scheduleNotes").value.trim(),
        active: $("#scheduleActive").checked,
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    await withSubmitLock(e.target, async () => {
        try {
            await withHistoryTx([db.schedule], async () => {
                await ScheduleRepository.put(entry);
                await addHistory("schedule", entry.id, existing ? "update" : "create", existing ? "Annonce modifiée" : "Annonce créée");
            });
            await loadScheduleData();
            renderScheduleList();
            renderScheduleSummary();
            renderOverview();
            renderAgenda();
            toast(existing ? "Annonce modifiée." : "Annonce ajoutée.", "success");
            if (e.submitter?.dataset.action === "save-and-new") showScheduleForm(null);
            else showScheduleDetail(entry.id);
        } catch (err) {
            Logger.error("schedule.saveSchedule", err);
            toast("Impossible d'enregistrer cette annonce.", "error");
        }
    });
}

function showScheduleDetail(id) {
    const s = state.schedule.find(x => x.id === id);
    if (!s) return;
    state.selectedScheduleId = id;

    const clocherLink = findLinked(state.clochers, state.clochersTrash, s.clocherId);

    $("#scheduleDetailTitle").textContent = `Annonces › ${s.title || "Annonce"}`;

    $("#scheduleDetailBody").innerHTML = `
        <div class="fiche-header">
            <div class="fiche-avatar" aria-hidden="true"><svg class="icon"><use href="#i-bell"></use></svg></div>
            <div class="fiche-heading">
                <h3 class="fiche-name">${escapeHTML(s.title)}</h3>
                <p class="fiche-meta">${escapeHTML(describeRecurrence(s))}</p>
                <div class="fiche-chips">
                    <span class="badge ${s.kind === "recurring" ? "progress" : "normal"}">${s.kind === "recurring" ? "Récurrente" : "Ponctuelle"}</span>
                    <span class="badge normal">${escapeHTML(s.category || "Autre")}</span>
                    ${!s.active ? `<span class="badge cancelled">Suspendue</span>` : ""}
                </div>
            </div>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Détails</h4>
            <dl class="fiche-grid">
                ${ficheField("Récurrence", s.kind === "recurring" ? capitalize(WEEKDAY_NAMES[s.dayOfWeek]) : formatDate(s.date))}
                ${ficheField("Heure", escapeHTML(s.time))}
                ${ficheField("Lieu", clocherLink.status !== "none"
                    ? linkedRecordFieldHTML(clocherLink, "data-goto-clocher", c => `${icon("church", "icon-inline")}${escapeHTML(c.nom)}`)
                    : escapeHTML(s.location), true)}
                ${ficheField("Notes", escapeHTML(s.notes) || "Aucune note.", true)}
            </dl>
        </div>
        ${historySectionHTML("schedule", id)}
    `;

    $("#scheduleDetailToggleBtn").innerHTML = s.active
        ? `${icon("archive")} Suspendre`
        : `${icon("restore")} Réactiver`;
    showPage("schedule-detail");
}

async function toggleScheduleActive(id) {
    const s = state.schedule.find(x => x.id === id);
    if (!s) return;

    await withActionLock(`schedule:active:${id}`, async () => {
        try {
            await withHistoryTx([db.schedule], async () => {
                s.active = !s.active;
                s.updatedAt = nowISO();
                await ScheduleRepository.put(s);
                await addHistory("schedule", id, s.active ? "restore" : "archive", s.active ? "Annonce réactivée" : "Annonce suspendue");
            });
            await loadScheduleData();
            renderScheduleList();
            renderScheduleSummary();
            renderOverview();
            renderAgenda();
            showScheduleDetail(id);
            toast(s.active ? "Annonce réactivée." : "Annonce suspendue.", "success");
        } catch (err) {
            Logger.error("schedule.toggleScheduleActive", err);
            toast("Impossible de modifier cette annonce.", "error");
        }
    });
}

/* ============================================================
   CORBEILLE (V6.2.c) — même principe que js/requests.js.
============================================================ */
async function trashSchedule(id) {
    const s = state.schedule.find(x => x.id === id);
    if (!s) return;
    if (!window.confirm(`Mettre à la corbeille « ${s.title} » ?\n\nElle pourra être restaurée depuis la Corbeille.`)) return;

    await withActionLock(`schedule:trash:${id}`, async () => {
        try {
            await withHistoryTx([db.schedule], async () => {
                s.deletedAt = nowISO();
                s.updatedAt = nowISO();
                await ScheduleRepository.put(s);
                await addHistory("schedule", id, "trash", "Annonce mise à la corbeille");
            });
            await loadScheduleData();
            renderScheduleList();
            renderScheduleSummary();
            renderOverview();
            renderAgenda();
            renderTrash();
            toast("Annonce mise à la corbeille.", "success");
            showPage("announcements");
        } catch (err) {
            Logger.error("schedule.trashSchedule", err);
            toast("Impossible de mettre cette annonce à la corbeille.", "error");
        }
    });
}

async function restoreSchedule(id) {
    const s = state.scheduleTrash.find(x => x.id === id);
    if (!s) return;

    await withActionLock(`schedule:restore:${id}`, async () => {
        try {
            await withHistoryTx([db.schedule], async () => {
                s.deletedAt = null;
                s.updatedAt = nowISO();
                await ScheduleRepository.put(s);
                await addHistory("schedule", id, "restore", "Annonce restaurée depuis la corbeille");
            });
            await loadScheduleData();
            renderScheduleList();
            renderScheduleSummary();
            renderOverview();
            renderAgenda();
            renderTrash();
            toast("Annonce restaurée.", "success");
        } catch (err) {
            Logger.error("schedule.restoreSchedule", err);
            toast("Impossible de restaurer cette annonce.", "error");
        }
    });
}

async function purgeSchedule(id) {
    const s = state.scheduleTrash.find(x => x.id === id);
    if (!s) return;
    if (!window.confirm(`Supprimer définitivement « ${s.title} » ?\n\nCette action est IRRÉVERSIBLE : la fiche ne pourra plus être restaurée.`)) return;

    await withActionLock(`schedule:purge:${id}`, async () => {
        try {
            await withHistoryTx([db.schedule], async () => {
                await ScheduleRepository.remove(id);
                await addHistory("schedule", id, "purge", "Annonce supprimée définitivement");
            });
            await loadScheduleData();
            renderScheduleList();
            renderScheduleSummary();
            renderOverview();
            renderAgenda();
            renderTrash();
            toast("Annonce supprimée définitivement.", "success");
        } catch (err) {
            Logger.error("schedule.purgeSchedule", err);
            toast("Impossible de supprimer définitivement cette annonce.", "error");
        }
    });
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initScheduleEvents() {
    $("#newScheduleBtn").addEventListener("click", () => showScheduleForm(null));
    $("#scheduleForm").addEventListener("submit", saveSchedule);

    $("#scheduleKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) filterScheduleByKpi(btn.dataset.kpi);
    });
    $("#scheduleKind").addEventListener("change", updateScheduleFormFields);
    $("#scheduleFormBackBtn").addEventListener("click", goBack);
    $("#scheduleFormCancelBtn").addEventListener("click", goBack);

    $("#scheduleLocation").addEventListener("input", () => { $("#scheduleClocherId").value = ""; });
    setupAutocomplete($("#scheduleLocation"), $("#scheduleLocationAutocompleteMenu"), {
        search: clocherSuggestions,
        renderLabel: clocherSuggestionLabel,
        onSelect: c => { $("#scheduleLocation").value = c.nom; $("#scheduleClocherId").value = c.id; }
    });

    $("#scheduleDetailBackBtn").addEventListener("click", goBack);
    $("#scheduleEditBtn").addEventListener("click", () => state.selectedScheduleId && showScheduleForm(state.selectedScheduleId));
    $("#scheduleDetailToggleBtn").addEventListener("click", () => state.selectedScheduleId && toggleScheduleActive(state.selectedScheduleId));
    $("#scheduleDeleteBtn").addEventListener("click", () => state.selectedScheduleId && trashSchedule(state.selectedScheduleId));

    $("#scheduleDetailBody").addEventListener("click", e => {
        const clocherBtn = e.target.closest("[data-goto-clocher]");
        if (clocherBtn) showClocherDetail(clocherBtn.dataset.gotoClocher);
    });

    $("#scheduleList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-schedule-id]");
        if (!card) return;
        const id = card.dataset.scheduleId;

        if (!btn) { showScheduleDetail(id); return; }

        switch (btn.dataset.action) {
            case "edit": showScheduleForm(id); break;
            case "delete": trashSchedule(id); break;
        }
    });
}
