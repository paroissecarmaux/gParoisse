"use strict";

/* ============================================================
   CORBEILLE (V6.2.c)
   Une vue unique plutôt que 6 pages de corbeille séparées : le seul
   point commun entre une demande, une personne ou une annonce mise à
   la corbeille est justement leur type, ce qui n'a de sens à afficher
   que dans une liste mixte (voir docs/V6.2-C-DESIGN.md). Chaque ligne
   délègue restaurer/purger à la fonction du module propriétaire
   (restoreX/purgeX), qui garde ses propres confirmations et son
   historique — trash.js ne fait qu'agréger et afficher.

   TRASH_ENTITY_CONFIG est étendu module par module, en même temps que
   chaque module reçoit ses trashX/restoreX/purgeX (V6.2.c, section 11) :
   un type qui n'a pas encore ces fonctions n'a pas d'entrée ici.
============================================================ */
const TRASH_ENTITY_CONFIG = [
    {
        type: "request",
        stateKey: "requestsTrash",
        titleOf: r => r.name || r.type || "Demande",
        restore: id => restoreRequest(id),
        purge: id => purgeRequest(id)
    },
    {
        type: "person",
        stateKey: "peopleTrash",
        titleOf: p => `${p.prenom} ${p.nom}`.trim() || "Personne",
        restore: id => restorePerson(id),
        purge: id => purgePerson(id)
    },
    {
        type: "schedule",
        stateKey: "scheduleTrash",
        titleOf: s => s.title || "Annonce",
        restore: id => restoreSchedule(id),
        purge: id => purgeSchedule(id)
    }
];

function trashEntries() {
    const entries = [];
    TRASH_ENTITY_CONFIG.forEach(cfg => {
        (state[cfg.stateKey] || []).forEach(record => entries.push({ cfg, record }));
    });
    entries.sort((a, b) => String(b.record.deletedAt).localeCompare(String(a.record.deletedAt)));
    return entries;
}

function renderTrashCard({ cfg, record }) {
    const title = cfg.titleOf(record);
    return `
        <article class="person-card" data-entity-type="${escapeHTML(cfg.type)}" data-entity-id="${escapeHTML(record.id)}" role="listitem">
            <div class="avatar" aria-hidden="true">${icon("trash")}</div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(title)}</div>
                <div class="request-contact">${escapeHTML(ENTITY_TYPE_LABELS[cfg.type] || cfg.type)}</div>
            </div>
            <div>
                <div class="request-date">Mis à la corbeille le ${formatDateTime(record.deletedAt)}</div>
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="restore" title="Restaurer" aria-label="Restaurer">${icon("restore")}</button>
                <button class="icon-btn" data-action="purge" title="Supprimer définitivement" aria-label="Supprimer définitivement">${icon("trash")}</button>
            </div>
        </article>
    `;
}

function renderTrash() {
    const container = $("#trashList");
    if (!container) return;
    const entries = trashEntries();
    $("#trashResultCount").textContent = entries.length ? `${entries.length} élément${entries.length > 1 ? "s" : ""}` : "";
    container.innerHTML = entries.length
        ? entries.map(renderTrashCard).join("")
        : `<div class="empty">La corbeille est vide.</div>`;
}

async function restoreTrashEntry(type, id) {
    const cfg = TRASH_ENTITY_CONFIG.find(c => c.type === type);
    if (!cfg) return;
    await cfg.restore(id);
    renderTrash();
}

async function purgeTrashEntry(type, id) {
    const cfg = TRASH_ENTITY_CONFIG.find(c => c.type === type);
    if (!cfg) return;
    await cfg.purge(id);
    renderTrash();
}

function initTrashEvents() {
    $("#trashList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-entity-type]");
        if (!btn || !card) return;
        const { entityType, entityId } = card.dataset;
        if (btn.dataset.action === "restore") restoreTrashEntry(entityType, entityId);
        else if (btn.dataset.action === "purge") purgeTrashEntry(entityType, entityId);
    });
}
