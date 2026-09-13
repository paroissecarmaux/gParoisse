"use strict";

/* ============================================================
   TESTS — fonctions pures
   Exécutés directement par Node (`node tests/pure-functions.test.js`),
   sans framework ni dépendance : charge les vrais fichiers source
   dans un contexte vm et exerce les fonctions qui ne touchent ni le
   DOM ni Dexie (dates, texte, CSV, règles de récurrence). Ce sont
   les fonctions les plus critiques pour la fiabilité des données
   (calcul d'âge, parsing CSV/dates, normalisation des demandes) et
   les seules testables sans navigateur ni base IndexedDB.
============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.join(__dirname, "..");

function loadScripts(context, files) {
    files.forEach(file => {
        const code = fs.readFileSync(path.join(ROOT, file), "utf8");
        vm.runInContext(code, context, { filename: file });
    });
}

const context = vm.createContext({ console, crypto, Intl, Date, Math });
loadScripts(context, [
    "js/constants.js",
    "js/utils.js",
    "js/csv.js",
    "js/requests.js",
    "js/schedule.js",
    "js/intentions.js"
]);

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ok   ${name}`);
    } catch (err) {
        failed++;
        console.error(`  FAIL ${name}`);
        console.error(`       ${err.message}`);
    }
}

// Les valeurs retournées par le contexte vm (autre "realm") ne sont pas
// des Array/Object du realm courant au sens strict : deepStrictEqual les
// jugerait différentes malgré un contenu identique. On compare donc leur
// structure via JSON plutôt que leur identité de prototype.
function assertSameStructure(actual, expected, message) {
    assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

/* ---------- js/utils.js ---------- */

test("computeAge: âge simple entre deux dates", () => {
    assert.strictEqual(context.computeAge("2000-06-15", "2020-06-15"), 20);
});
test("computeAge: veille de l'anniversaire (pas encore eu l'âge)", () => {
    assert.strictEqual(context.computeAge("2000-06-15", "2020-06-14"), 19);
});
test("computeAge: naissance un 29 février (année bissextile)", () => {
    assert.strictEqual(context.computeAge("2000-02-29", "2021-03-01"), 21);
});
test("computeAge: date de naissance absente -> null", () => {
    assert.strictEqual(context.computeAge(""), null);
});

test("normalize: accents et casse ignorés", () => {
    assert.strictEqual(context.normalize("Éléonore Ürgente"), "eleonore urgente");
});
test("normalize: permet de retrouver 'Marie DUPONT' via 'dupont marie'", () => {
    const haystack = context.normalize("Marie DUPONT");
    assert.ok(haystack.includes(context.normalize("dupont")));
    assert.ok(haystack.includes(context.normalize("marie")));
});

test("escapeHTML: neutralise une balise script", () => {
    assert.strictEqual(
        context.escapeHTML("<script>alert(1)</script>"),
        "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
});
test("escapeHTML: échappe guillemets et apostrophes", () => {
    assert.strictEqual(context.escapeHTML(`"'&`), "&quot;&#039;&amp;");
});

test("addDays / daysBetween: cohérents entre eux, y compris à cheval sur un mois", () => {
    const a = "2026-01-31";
    const b = context.addDays(a, 10);
    assert.strictEqual(b, "2026-02-10");
    assert.strictEqual(context.daysBetween(a, b), 10);
});

test("sortByKey: trie par clé précalculée sans muter l'ordre attendu", () => {
    const items = [{ n: "Zoé" }, { n: "Adèle" }, { n: "Marc" }];
    const sorted = context.sortByKey(items, x => context.normalize(x.n));
    assert.deepStrictEqual(sorted.map(x => x.n), ["Adèle", "Marc", "Zoé"]);
});

test("paginate: découpe correctement une liste de 25 en pages de 10", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const p1 = context.paginate(items, 1, 10);
    assert.strictEqual(p1.pageItems.length, 10);
    assert.strictEqual(p1.totalPages, 3);
    const p3 = context.paginate(items, 3, 10);
    assert.strictEqual(p3.pageItems.length, 5);
});

/* ---------- js/csv.js ---------- */

test("parseCSV: détecte le délimiteur point-virgule", () => {
    const rows = context.parseCSV("a;b;c\n1;2;3");
    assertSameStructure(rows, [["a", "b", "c"], ["1", "2", "3"]]);
});
test("parseCSV: détecte le délimiteur virgule", () => {
    const rows = context.parseCSV("a,b,c\n1,2,3");
    assertSameStructure(rows, [["a", "b", "c"], ["1", "2", "3"]]);
});
test("parseCSV: champ entre guillemets contenant le délimiteur et des guillemets échappés", () => {
    const rows = context.parseCSV('a;b\n"Dupont; Jean";"Il dit ""bonjour"""');
    assertSameStructure(rows[1], ["Dupont; Jean", 'Il dit "bonjour"']);
});
test("parseCSV: BOM UTF-8 en tête de fichier n'empêche pas de reconnaître l'en-tête", () => {
    const rows = context.parseCSV("﻿nom;prenom\nDupont;Jean");
    assert.strictEqual(context.normalizeHeaderKey(rows[0][0]), "nom");
});
test("parseCSV: lignes entièrement vides ignorées", () => {
    const rows = context.parseCSV("a;b\n1;2\n\n;\n3;4");
    assert.strictEqual(rows.length, 3);
});

test("parseFrenchDate: format jj/mm/aaaa", () => {
    assert.strictEqual(context.parseFrenchDate("06/06/1992"), "1992-06-06");
});
test("parseFrenchDate: format ISO déjà correct passe tel quel", () => {
    assert.strictEqual(context.parseFrenchDate("1992-06-06"), "1992-06-06");
});
test("parseFrenchDate: numéro de série Excel", () => {
    assert.strictEqual(context.parseFrenchDate("33761"), "1992-06-06");
});
test("parseFrenchDate: valeur vide ou invalide -> chaîne vide", () => {
    assert.strictEqual(context.parseFrenchDate(""), "");
    assert.strictEqual(context.parseFrenchDate("pas une date"), "");
});

/* ---------- js/requests.js : normalizeRequest ---------- */

test("normalizeRequest: garde l'id fourni (round-trip JSON/CSV)", () => {
    const r = context.normalizeRequest({ id: "abc123", name: "Jean Dupont" });
    assert.strictEqual(r.id, "abc123");
    assert.strictEqual(r.name, "Jean Dupont");
});
test("normalizeRequest: type inconnu retombe sur 'Autre'", () => {
    const r = context.normalizeRequest({ name: "X", type: "Type qui n'existe pas" });
    assert.strictEqual(r.type, "Autre");
});
test("normalizeRequest: statut/priorité par défaut si absents", () => {
    const r = context.normalizeRequest({ name: "X" });
    assert.strictEqual(r.status, "En attente");
    assert.strictEqual(r.priority, "Normale");
});
test("normalizeRequest: accepte les anciens noms de champs français (rétrocompatibilité)", () => {
    const r = context.normalizeRequest({ nom: "Ancien format", statut: "En cours", priorite: "Urgente" });
    assert.strictEqual(r.name, "Ancien format");
    assert.strictEqual(r.status, "En cours");
    assert.strictEqual(r.priority, "Urgente");
});

/* ---------- js/schedule.js : scheduleOccursOn ---------- */

test("scheduleOccursOn: annonce récurrente déclenchée le bon jour de semaine", () => {
    const s = { active: true, kind: "recurring", dayOfWeek: 0 }; // dimanche
    assert.strictEqual(context.scheduleOccursOn(s, "2026-09-13"), true); // un dimanche
    assert.strictEqual(context.scheduleOccursOn(s, "2026-09-14"), false); // un lundi
});
test("scheduleOccursOn: annonce ponctuelle uniquement à sa date", () => {
    const s = { active: true, kind: "once", date: "2026-12-25" };
    assert.strictEqual(context.scheduleOccursOn(s, "2026-12-25"), true);
    assert.strictEqual(context.scheduleOccursOn(s, "2026-12-24"), false);
});
test("scheduleOccursOn: une annonce suspendue ne se déclenche jamais", () => {
    const s = { active: false, kind: "once", date: "2026-12-25" };
    assert.strictEqual(context.scheduleOccursOn(s, "2026-12-25"), false);
});

/* ---------- js/intentions.js : neuvaine ---------- */

test("intentionEndDate: messe unique -> date de fin = date de début", () => {
    const i = { dateDebut: "2026-03-01", nombreMesses: 1 };
    assert.strictEqual(context.intentionEndDate(i), "2026-03-01");
});
test("intentionEndDate: neuvaine de 9 messes couvre 9 jours consécutifs", () => {
    const i = { dateDebut: "2026-03-01", nombreMesses: 9 };
    assert.strictEqual(context.intentionEndDate(i), "2026-03-09");
});
test("intentionOccursOn: neuvaine active un jour au milieu de la plage", () => {
    const i = { dateDebut: "2026-03-01", nombreMesses: 9, statut: "À célébrer" };
    assert.strictEqual(context.intentionOccursOn(i, "2026-03-05"), true);
    assert.strictEqual(context.intentionOccursOn(i, "2026-03-10"), false);
});
test("intentionOccursOn: une intention annulée n'occupe plus l'agenda", () => {
    const i = { dateDebut: "2026-03-01", nombreMesses: 9, statut: "Annulée" };
    assert.strictEqual(context.intentionOccursOn(i, "2026-03-05"), false);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
