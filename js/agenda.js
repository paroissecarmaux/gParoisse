"use strict";

/* ============================================================
   MODULE AGENDA
   Agrège deux sources en lecture seule : les demandes de
   catégorie « événement » (date de cérémonie) et les annonces
   paroissiales (récurrentes ou ponctuelles).
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

function renderAgenda() {
    if (state.agendaView === "week") {
        $("#agendaWeekView").hidden = false;
        $("#agendaDayView").hidden = true;
        renderAgendaWeek();
    } else {
        $("#agendaWeekView").hidden = true;
        $("#agendaDayView").hidden = false;
        renderAgendaDay();
    }
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
        state.agendaDate = addDays(state.agendaDate, state.agendaView === "week" ? -7 : -1);
        renderAgenda();
    });
    $("#agendaNextBtn").addEventListener("click", () => {
        state.agendaDate = addDays(state.agendaDate, state.agendaView === "week" ? 7 : 1);
        renderAgenda();
    });
    $("#agendaTodayBtn").addEventListener("click", () => {
        state.agendaDate = todayISO();
        renderAgenda();
    });

    const handleEventClick = e => {
        const item = e.target.closest("[data-kind]");
        if (!item) return;
        if (item.dataset.kind === "request") showRequestDetail(item.dataset.id);
        else showScheduleDetail(item.dataset.id);
    };
    $("#agendaWeekView").addEventListener("click", handleEventClick);
    $("#agendaDayView").addEventListener("click", handleEventClick);
}
