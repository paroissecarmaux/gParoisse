"use strict";

/* ============================================================
   HISTORIQUE GÉNÉRALISÉ (V6.2.c)
   Avant cette version, seul js/requests.js écrivait dans `history`
   (avec un champ requestId). Généralisé ici à toutes les entités :
   entityType/entityId remplacent requestId pour les nouvelles
   entrées. Les anciennes entrées (sans entityType) restent en base
   telles quelles — jamais réécrites — et sont interprétées à la
   lecture comme entityType="request", entityId=requestId.
============================================================ */
async function addHistory(entityType, entityId, action, description) {
    await HistoryRepository.put({
        id: uid(),
        entityType,
        entityId,
        action,
        description,
        createdAt: nowISO()
    });
}

// V6.6 : jusqu'ici, chaque saveX()/trashX()/restoreX()/purgeX() faisait
// deux écritures Dexie indépendantes (l'enregistrement métier, puis
// addHistory()) — si la seconde échouait après le succès de la
// première, l'état réel divergeait silencieusement de son journal
// d'audit (voir docs/V6.2-C-IMPLEMENTATION.md §6, qui documentait ce
// risque comme acceptable mais non traité). withHistoryTx() regroupe
// les deux dans une transaction Dexie commune : si l'une échoue,
// Dexie annule (rollback) l'autre — l'enregistrement métier ne peut
// plus jamais être "orphelin" de sa propre trace d'audit.
// `tables` : les tables Dexie (pas les repositories) écrites par
// `fn`, en plus de `db.history` toujours incluse.
function withHistoryTx(tables, fn) {
    return db.transaction("rw", ...tables, db.history, fn);
}

// Normalise une entrée history quelle que soit sa version (voir le
// commentaire d'en-tête) sans jamais modifier l'enregistrement stocké.
function historyEntityType(h) {
    return h.entityType || "request";
}

function historyEntityId(h) {
    return h.entityId || h.requestId || "";
}

function relatedHistoryFor(entityType, entityId) {
    return state.history
        .filter(h => historyEntityType(h) === entityType && historyEntityId(h) === entityId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Bloc HTML « Historique » réutilisé à l'identique par tous les
// modules (fiches Demande, Personne, Annonce, Clocher, Personnel,
// Intention) plutôt que de dupliquer ce gabarit six fois.
function historySectionHTML(entityType, entityId) {
    const history = relatedHistoryFor(entityType, entityId);
    return `
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
                    : `<div class="empty">Aucun historique pour l'instant : les changements seront journalisés ici.</div>`}
            </div>
        </div>
    `;
}
