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

function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
