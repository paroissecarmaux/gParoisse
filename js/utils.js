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

function computeAge(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = String(dateStr).split("-").map(Number);
    if (!y || !m || !d) return null;
    const birth = new Date(y, m - 1, d);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const hadBirthdayThisYear =
        now.getMonth() > birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
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
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    $("#toastContainer").appendChild(el);
    setTimeout(() => el.remove(), 3400);
}
