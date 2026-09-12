"use strict";

/* ============================================================
   MODULE AGENDA
   Agrège trois sources en lecture seule : les demandes de
   catégorie « événement » (date de cérémonie), les annonces
   paroissiales (récurrentes ou ponctuelles) et les intentions de
   messe (une neuvaine occupe plusieurs jours consécutifs).
============================================================ */
function agendaEventsForDate(iso) {
    const events = [];

    state.requests.forEach(r => {
        if (r.archived || r.status === "Annulé") return;
        if (requestCategory(r.type) !== "event" || r.dateEvenement !== iso) return;
        events.push({
            time: r.heureEvenement || "",
            title: r.type === "Obsèques" && r.defunt ? `Obsèques de ${r.defunt}` : (r.name || r.type),
            subtitle: r.type,
            location: r.lieuEvenement || "",
            kind: "request",
            id: r.id
        });
    });

    state.schedule.forEach(s => {
        if (!scheduleOccursOn(s, iso)) return;
        events.push({
            time: s.time || "",
            title: s.title,
            subtitle: s.category || "Annonce",
            location: s.location || "",
            kind: "schedule",
            id: s.id
        });
    });

    state.intentions.forEach(i => {
        if (!intentionOccursOn(i, iso)) return;
        const clocher = i.clocherId ? state.clochers.find(c => c.id === i.clocherId) : null;
        events.push({
            time: i.heure || "",
            title: i.intitule || i.type,
            subtitle: i.type,
            location: clocher ? clocher.nom : "",
            kind: "intention",
            id: i.id
        });
    });

    events.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    return events;
}

/* ============================================================
   RENDU
============================================================ */
function renderAgendaEventChip(ev) {
    return `
        <div class="agenda-event agenda-event-${ev.kind}" data-kind="${ev.kind}" data-id="${escapeHTML(ev.id)}" role="listitem">
            ${ev.time ? `<div class="agenda-event-time">${escapeHTML(ev.time)}</div>` : ""}
            <div class="agenda-event-title">${escapeHTML(ev.title)}</div>
        </div>
    `;
}

function renderAgendaWeek() {
    const start = startOfWeekISO(state.agendaDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    $("#agendaRangeLabel").textContent = `Semaine du ${formatDayMonth(days[0])} au ${formatDayMonth(days[6])}`;

    $("#agendaWeekView").innerHTML = days.map(iso => {
        const events = agendaEventsForDate(iso);
        const isToday = iso === todayISO();
        return `
            <div class="agenda-day-col ${isToday ? "today" : ""}">
                <div class="agenda-day-header">${formatWeekdayShort(iso)} <span class="day-number">${Number(iso.split("-")[2])}</span></div>
                ${events.length ? events.map(renderAgendaEventChip).join("") : `<div class="agenda-empty-day">—</div>`}
            </div>
        `;
    }).join("");
}

function renderAgendaDayItem(ev) {
    return `
        <div class="agenda-day-item" data-kind="${ev.kind}" data-id="${escapeHTML(ev.id)}" role="listitem">
            <div class="agenda-day-time">${escapeHTML(ev.time || "—")}</div>
            <div class="agenda-day-body">
                <div class="agenda-event-title">${escapeHTML(ev.title)}</div>
                <div class="agenda-day-meta">${escapeHTML([ev.subtitle, ev.location].filter(Boolean).join(" · "))}</div>
            </div>
        </div>
    `;
}

function renderAgendaDay() {
    const iso = state.agendaDate;
    $("#agendaRangeLabel").textContent = `${capitalize(formatWeekdayLong(iso))} ${formatDayMonth(iso)}`;

    const events = agendaEventsForDate(iso);
    $("#agendaDayView").innerHTML = events.length
        ? `<div class="agenda-day-list" role="list">${events.map(renderAgendaDayItem).join("")}</div>`
        : `<div class="empty">Rien de prévu ce jour-là.</div>`;
}

// Une plage arbitraire (ex. un mois) est rendue comme une liste de jours,
// contrairement à la semaine (toujours 7 colonnes) : chaque jour affiche
// son propre en-tête, même sans événement, pour ne rien laisser deviner.
const AGENDA_RANGE_MAX_DAYS = 92;

function renderAgendaRangeDay(iso) {
    const events = agendaEventsForDate(iso);
    const isToday = iso === todayISO();
    return `
        <div class="agenda-range-day ${isToday ? "today" : ""}">
            <div class="agenda-range-day-header">${capitalize(formatWeekdayLong(iso))} ${formatDayMonth(iso)}</div>
            ${events.length
                ? `<div class="agenda-day-list" role="list">${events.map(renderAgendaDayItem).join("")}</div>`
                : `<div class="agenda-empty-day">Rien de prévu.</div>`}
        </div>
    `;
}

function renderAgendaRange() {
    let start = state.agendaRangeStart;
    let end = state.agendaRangeEnd;
    if (end < start) { [start, end] = [end, start]; }
    if (daysBetween(start, end) > AGENDA_RANGE_MAX_DAYS) {
        end = addDays(start, AGENDA_RANGE_MAX_DAYS);
        state.agendaRangeEnd = end;
    }

    $("#agendaRangeStart").value = start;
    $("#agendaRangeEnd").value = end;
    $("#agendaRangeLabel").textContent = `Du ${formatDayMonth(start)} au ${formatDayMonth(end)}`;

    const days = [];
    for (let iso = start; iso <= end; iso = addDays(iso, 1)) days.push(iso);
    $("#agendaRangeView").innerHTML = days.map(renderAgendaRangeDay).join("");
}

function shiftAgendaRange(direction) {
    const span = daysBetween(state.agendaRangeStart, state.agendaRangeEnd) + 1;
    state.agendaRangeStart = addDays(state.agendaRangeStart, direction * span);
    state.agendaRangeEnd = addDays(state.agendaRangeEnd, direction * span);
}

function renderAgenda() {
    $("#agendaWeekView").hidden = state.agendaView !== "week";
    $("#agendaDayView").hidden = state.agendaView !== "day";
    $("#agendaRangeView").hidden = state.agendaView !== "range";
    $("#agendaRangePicker").hidden = state.agendaView !== "range";

    if (state.agendaView === "week") renderAgendaWeek();
    else if (state.agendaView === "day") renderAgendaDay();
    else renderAgendaRange();
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initAgendaEvents() {
    $("#agendaViewToggle").addEventListener("click", e => {
        const btn = e.target.closest("[data-agenda-view]");
        if (!btn) return;
        state.agendaView = btn.dataset.agendaView;
        $$("#agendaViewToggle .segmented-btn").forEach(b => b.classList.toggle("active", b === btn));
        renderAgenda();
    });

    $("#agendaPrevBtn").addEventListener("click", () => {
        if (state.agendaView === "range") shiftAgendaRange(-1);
        else state.agendaDate = addDays(state.agendaDate, state.agendaView === "week" ? -7 : -1);
        renderAgenda();
    });
    $("#agendaNextBtn").addEventListener("click", () => {
        if (state.agendaView === "range") shiftAgendaRange(1);
        else state.agendaDate = addDays(state.agendaDate, state.agendaView === "week" ? 7 : 1);
        renderAgenda();
    });
    $("#agendaTodayBtn").addEventListener("click", () => {
        if (state.agendaView === "range") {
            const span = daysBetween(state.agendaRangeStart, state.agendaRangeEnd);
            state.agendaRangeStart = todayISO();
            state.agendaRangeEnd = addDays(state.agendaRangeStart, span);
        } else {
            state.agendaDate = todayISO();
        }
        renderAgenda();
    });

    $("#agendaRangeStart").addEventListener("change", () => {
        state.agendaRangeStart = $("#agendaRangeStart").value || state.agendaRangeStart;
        renderAgenda();
    });
    $("#agendaRangeEnd").addEventListener("change", () => {
        state.agendaRangeEnd = $("#agendaRangeEnd").value || state.agendaRangeEnd;
        renderAgenda();
    });

    const handleEventClick = e => {
        const item = e.target.closest("[data-kind]");
        if (!item) return;
        if (item.dataset.kind === "request") showRequestDetail(item.dataset.id);
        else if (item.dataset.kind === "intention") showIntentionDetail(item.dataset.id);
        else showScheduleDetail(item.dataset.id);
    };
    $("#agendaWeekView").addEventListener("click", handleEventClick);
    $("#agendaDayView").addEventListener("click", handleEventClick);
    $("#agendaRangeView").addEventListener("click", handleEventClick);
}
