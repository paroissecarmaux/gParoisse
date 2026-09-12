"use strict";

/* ============================================================
   OUTILS D'IMPORT CSV (génériques, réutilisables par tout module)
============================================================ */
function normalizeHeaderKey(h) {
    return normalize(h).replace(/[^a-z0-9]/g, "");
}

function excelSerialToISO(n) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + n * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseFrenchDate(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    let m = s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{4})$/);
    if (m) {
        const [, d, mo, y] = m;
        return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Fichiers exportés depuis Excel : une cellule date mal formatée peut
    // apparaître comme un numéro de série (jours depuis le 30/12/1899).
    if (/^\d{4,6}$/.test(s)) return excelSerialToISO(Number(s));
    return "";
}

function parseCSV(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const delimiter = (firstLine.split(";").length >= firstLine.split(",").length) ? ";" : ",";

    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === delimiter) {
            row.push(field);
            field = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            field = "";
            rows.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }

    return rows.filter(r => r.some(v => v.trim() !== ""));
}
