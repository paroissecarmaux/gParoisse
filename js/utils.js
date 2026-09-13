"use strict";

/* ============================================================
   DOM
============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ============================================================
   IDENTIFIANTS & DATES
============================================================ */
function uid() {
    return crypto.randomUUID ? crypto.randomUUID() :
        Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function todayISO() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

function nowISO() { return new Date().toISOString(); }

function formatDate(v) {
    if (!v) return "—";
    const p = String(v).split("-");
    if (p.length !== 3) return v;
    return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"})
        .format(new Date(+p[0], +p[1]-1, +p[2]));
}

function formatDateTime(v) {
    if (!v) return "—";
    return new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));
}

function daysBetween(a, b) {
    const d1 = new Date(a + "T12:00:00");
    const d2 = new Date(b + "T12:00:00");
    return Math.round((d2 - d1) / 86400000);
}

function addDays(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function weekdayOf(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
}

function startOfWeekISO(iso) {
    const day = weekdayOf(iso);
    return addDays(iso, day === 0 ? -6 : 1 - day);
}

function formatWeekdayShort(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(y, m - 1, d)).replace(".", "");
}

function formatWeekdayLong(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(new Date(y, m - 1, d));
}

function formatDayMonth(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}

function capitalize(s) {
    return s ? s[0].toLocaleUpperCase("fr-FR") + s.slice(1) : s;
}

// Relatif lisible ("il y a 3 jours") utilisé pour la date de dernière
// sauvegarde (Tableau de bord et Paramètres).
function formatRelativeTime(iso) {
    if (!iso) return null;
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return "à l'instant";
    if (diffH < 24) return `il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
    const diffD = Math.floor(diffH / 24);
    return `il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
}

// asOfStr permet de calculer un âge à une date donnée (ex. âge au décès)
// plutôt qu'à aujourd'hui, qui reste le comportement par défaut.
function computeAge(dateStr, asOfStr) {
    if (!dateStr) return null;
    const [y, m, d] = String(dateStr).split("-").map(Number);
    if (!y || !m || !d) return null;
    const birth = new Date(y, m - 1, d);

    let asOf = new Date();
    if (asOfStr) {
        const [ay, am, ad] = String(asOfStr).split("-").map(Number);
        if (!ay || !am || !ad) return null;
        asOf = new Date(ay, am - 1, ad);
    }

    let age = asOf.getFullYear() - birth.getFullYear();
    const hadBirthdayThisYear =
        asOf.getMonth() > birth.getMonth() ||
        (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
    if (!hadBirthdayThisYear) age--;
    return age;
}

/* ============================================================
   TEXTE
============================================================ */
function normalize(v) {
    return String(v ?? "").toLocaleLowerCase("fr-FR")
        .normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function escapeHTML(v) {
    return String(v ?? "")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function debounce(fn, delay = 200) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

// Tri "décore-trie-dévoile" : calcule la clé de tri une seule fois par
// élément (au lieu de la recalculer à chaque comparaison, ce qui coûte
// O(n log n) appels à normalize()/localeCompare() au lieu de O(n) —
// déterminant sur de grandes listes, ex. plusieurs milliers de personnes.
function sortByKey(arr, keyFn) {
    return arr
        .map(item => ({ item, key: keyFn(item) }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map(x => x.item);
}

/* ============================================================
   AVERTISSEMENT DE SUPPRESSION (V6.2.a)
   Avant de supprimer une Personne/un Clocher/un Personnel, on
   avertit des enregistrements qui la/le référencent ailleurs (ex.
   requests.personId) sans jamais y toucher : le lien restera tel
   quel, simplement orphelin (comportement déjà géré à l'affichage,
   ex. « Personne introuvable (supprimée) »). `countByField` prend le
   tableau en paramètre plutôt que de lire `state` directement, pour
   rester une fonction pure et testable indépendamment du reste.
============================================================ */
function countByField(array, field, id) {
    return (array || []).filter(item => item[field] === id).length;
}

/* ============================================================
   CORBEILLE (V6.2.c)
   Convention centralisée : un enregistrement est actif tant que
   deletedAt est absent. Le filtrage a lieu une seule fois, au
   chargement (repositories `listActive`/`listDeleted`) — ces deux
   fonctions ne sont qu'un vocabulaire partagé pour ce filtrage,
   volontairement triviales pour rester pures et évidentes.
============================================================ */
function isDeleted(record) {
    return Boolean(record?.deletedAt);
}

function isActive(record) {
    return !isDeleted(record);
}

// Résout un lien (ex. requests.personId) sur deux listes déjà chargées
// (actifs, corbeille) pour distinguer trois cas à l'affichage :
// « active » (fiche existante, lien cliquable), « trashed » (fiche
// existante mais en corbeille, restaurable), « missing » (fiche
// supprimée définitivement ou id vide).
function findLinked(activeList, trashList, id) {
    if (!id) return { record: null, status: "none" };
    const active = (activeList || []).find(x => x.id === id);
    if (active) return { record: active, status: "active" };
    const trashed = (trashList || []).find(x => x.id === id);
    if (trashed) return { record: trashed, status: "trashed" };
    return { record: null, status: "missing" };
}

// Rendu d'un champ fiche pour un lien résolu par findLinked() : actif =
// bouton cliquable (comme avant la corbeille) ; en corbeille = affiché
// mais non cliquable, avec un mot clair (restaurable, pas perdu) ;
// définitivement supprimé = message neutre. `dataAttr` est l'attribut
// complet ("data-goto-person", …), `labelFn` reçoit le record trouvé et
// doit renvoyer du HTML déjà échappé.
function linkedRecordFieldHTML(link, dataAttr, labelFn) {
    if (link.status === "active") {
        return `<button type="button" class="link-btn" ${dataAttr}="${escapeHTML(link.record.id)}">${labelFn(link.record)}</button>`;
    }
    if (link.status === "trashed") {
        return `<span class="badge cancelled">${labelFn(link.record)} — dans la corbeille</span>`;
    }
    if (link.status === "missing") {
        return "Introuvable (supprimé définitivement)";
    }
    return "";
}

// Assemble ["3 demandes", "1 intention"] -> "3 demandes et 1 intention"
// ou ["3 demandes", "2 annonces", "1 intention"] -> "3 demandes, 2 annonces et 1 intention".
function joinFrenchList(items) {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

// parts: [{ label: "demande", count: 3 }, ...] -> phrase complète prête à
// insérer dans un window.confirm(), y compris quand rien n'est lié.
function describeLinkedRecords(parts) {
    const active = parts.filter(p => p.count > 0);
    if (!active.length) return "Aucune donnée liée à cette fiche.";
    const phrases = active.map(p => `${p.count} ${p.label}${p.count > 1 ? "s" : ""}`);
    return `Cette fiche est liée à ${joinFrenchList(phrases)}. Si vous continuez, ces liens seront conservés mais ne pointeront plus vers une fiche existante.`;
}

/* ============================================================
   FICHE (pages détail) : bloc label/valeur réutilisé par tous
   les modules pour afficher un champ dans une section .fiche-grid
============================================================ */
function ficheField(label, value, full) {
    return `
        <div class="fiche-field${full ? " full" : ""}">
            <dt>${escapeHTML(label)}</dt>
            <dd>${value || "—"}</dd>
        </div>
    `;
}

function truncate(str, n) {
    const s = String(str || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ============================================================
   PAGINATION (listes potentiellement très longues : personnes,
   demandes…) — n'affiche qu'une page de cartes à la fois pour que
   le DOM reste léger quel que soit le nombre d'enregistrements.
============================================================ */
function paginate(items, page, pageSize) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(Math.max(1, page), totalPages);
    const start = (current - 1) * pageSize;
    return { pageItems: items.slice(start, start + pageSize), page: current, totalPages };
}

function paginationControlsHTML(page, totalPages) {
    if (totalPages <= 1) return "";
    return `
        <button type="button" class="btn" data-page-nav="prev" ${page <= 1 ? "disabled" : ""}>${icon("arrow-left")} Précédent</button>
        <span class="pagination-label">Page ${page} / ${totalPages}</span>
        <button type="button" class="btn" data-page-nav="next" ${page >= totalPages ? "disabled" : ""}>Suivant ${icon("arrow-left", "icon-flip")}</button>
    `;
}

/* ============================================================
   RECHERCHE AVEC SUGGESTIONS (lie un champ texte à un enregistrement
   d'une autre base — personne, clocher… — réutilisable par tous les
   formulaires plutôt que de dupliquer la mécanique à chaque champ).
============================================================ */
function setupAutocomplete(inputEl, menuEl, { search, renderLabel, onSelect, minLength = 2 }) {
    let lastMatches = [];

    function render() {
        const query = inputEl.value.trim();
        lastMatches = query.length >= minLength ? search(query) : [];
        if (!lastMatches.length) {
            menuEl.hidden = true;
            menuEl.innerHTML = "";
            return;
        }
        menuEl.innerHTML = lastMatches
            .map((item, i) => `<button type="button" class="dropdown-item" data-idx="${i}">${renderLabel(item)}</button>`)
            .join("");
        menuEl.hidden = false;
    }

    inputEl.addEventListener("input", render);
    inputEl.addEventListener("focus", render);
    menuEl.addEventListener("click", e => {
        const btn = e.target.closest("[data-idx]");
        if (!btn) return;
        const item = lastMatches[Number(btn.dataset.idx)];
        menuEl.hidden = true;
        if (item) onSelect(item);
    });
    document.addEventListener("click", e => {
        if (e.target !== inputEl && !menuEl.contains(e.target)) menuEl.hidden = true;
    });
}

/* ============================================================
   FICHIERS
============================================================ */
function csvEscape(v) {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   TOAST
============================================================ */
function toast(msg, type = "") {
    const iconName = type === "success" ? "check-circle" : type === "error" ? "alert-triangle" : "bell";
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(iconName, "icon-inline")}<span>${escapeHTML(msg)}</span>`;
    $("#toastContainer").appendChild(el);
    setTimeout(() => {
        el.classList.add("toast-out");
        setTimeout(() => el.remove(), 200);
    }, 3400);
}

/* ============================================================
   RAPPORT D'IMPORT CSV (V6.2.b)
   Le toast garde le résumé bref habituel ; ce panneau (fermable,
   pas une modale) donne le détail ligne par ligne quand une ligne a
   été ignorée ou qu'une date n'a pas pu être reconnue — sans changer
   quelles lignes réussissent ou échouent, seulement en expliquant
   pourquoi. `report` : { importedCount, label, skipped: [{line,
   reason}], warnings: [{line, field, value}] } ou { error } en cas
   d'échec complet de l'import.
============================================================ */
function buildImportReportHTML(report) {
    if (report.error) {
        return `<div class="import-report-error">${icon("alert-triangle", "icon-inline")}${escapeHTML(report.error)}</div>`;
    }

    const skipped = report.skipped || [];
    const warnings = report.warnings || [];
    const parts = [
        `<div class="import-report-summary">${icon("check-circle", "icon-inline")}${report.importedCount} ${escapeHTML(report.label || "ligne(s)")} importée(s)${skipped.length ? ` · ${skipped.length} ignorée(s)` : ""}${warnings.length ? ` · ${warnings.length} date(s) non reconnue(s)` : ""}</div>`
    ];

    if (skipped.length) {
        parts.push(`
            <details class="import-report-details">
                <summary>Voir le détail des lignes ignorées (${skipped.length})</summary>
                <ul class="import-report-list">
                    ${skipped.map(s => `<li><strong>Ligne ${s.line}</strong> — ${escapeHTML(s.reason)}</li>`).join("")}
                </ul>
            </details>
        `);
    }

    if (warnings.length) {
        parts.push(`
            <details class="import-report-details">
                <summary>Voir le détail des dates non reconnues (${warnings.length})</summary>
                <ul class="import-report-list">
                    ${warnings.map(w => `<li><strong>Ligne ${w.line}</strong> — ${escapeHTML(w.field)} : « ${escapeHTML(w.value)} » non reconnue comme une date</li>`).join("")}
                </ul>
            </details>
        `);
    }

    return parts.join("");
}

function renderImportReport(report) {
    const panel = $("#importReportPanel");
    if (!panel) return;
    $("#importReportBody").innerHTML = buildImportReportHTML(report);
    panel.hidden = false;
}

/* ============================================================
   VERROU DE SOUMISSION (V6.6)
   Un double-clic (ou un clic pendant qu'un enregistrement précédent
   est encore en cours) sur un bouton submit peut déclencher deux
   exécutions concurrentes de saveX() — chacune générant son propre
   uid() pour une nouvelle fiche : deux enregistrements dupliqués au
   lieu d'un. withSubmitLock() désactive les boutons submit du
   formulaire pour la durée de l'opération et pose state.formSubmitting
   (lu par goBack()/la navigation globale, js/state.js et js/main.js)
   pour empêcher aussi de quitter la page pendant l'enregistrement.
   Ignore silencieusement un appel réentrant (déjà en cours) plutôt que
   de l'empiler.
============================================================ */
// Même problème que withSubmitLock() ci-dessus, mais pour les actions à
// un clic (archiver, terminer, mettre à la corbeille, restaurer,
// purger…) qui n'ont pas de <form> à désactiver : un double-clic ou un
// second déclenchement (raccourci clavier + clic, deux onglets/fenêtres
// de la même page) avant la fin du premier appel peut dupliquer une
// écriture Dexie et son entrée d'historique. `key` identifie l'action
// précise (ex. "request:trash:abc123") : une action déjà en cours sur
// la même clé est ignorée, mais deux clés différentes s'exécutent
// normalement en parallèle (pas de verrou global inutile).
const _actionLocks = new Set();
async function withActionLock(key, run) {
    if (_actionLocks.has(key)) return;
    _actionLocks.add(key);
    try {
        await run();
    } finally {
        _actionLocks.delete(key);
    }
}

async function withSubmitLock(form, run) {
    if (state.formSubmitting) return;
    const buttons = $$('button[type="submit"]', form);
    state.formSubmitting = true;
    buttons.forEach(b => { b.disabled = true; });
    try {
        await run();
    } finally {
        state.formSubmitting = false;
        buttons.forEach(b => { b.disabled = false; });
    }
}
