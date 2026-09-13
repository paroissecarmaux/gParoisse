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
    "js/icons.js",
    "js/csv.js",
    "js/requests.js",
    "js/schedule.js",
    "js/intentions.js",
    // Charger js/core/history.js ici ne fait qu'ajouter des déclarations
    // de fonctions (aucune exécutée au chargement) : certaines d'entre
    // elles (relatedHistoryFor, historySectionHTML) référencent `state`/
    // `HistoryRepository`, absents de ce contexte, mais ce n'est un
    // problème que si on les *appelle* — les tests ci-dessous n'exercent
    // que historyEntityType/historyEntityId, réellement pures.
    "js/core/history.js",
    "js/core/errors.js",
    // js/core/backup.js (V6.3) a été isolé de js/settings.js justement
    // pour rester testable ici sans charger les 6 modules métier que
    // référence DATA_MODULES — detectBackupPayload() prend sa liste de
    // clés en paramètre plutôt que de lire DATA_MODULES directement.
    "js/core/backup.js"
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

/* ---------- js/utils.js : avertissement de suppression (V6.2.a) ---------- */

test("countByField: 0 relation", () => {
    const requests = [{ personId: "autre" }, { personId: "" }];
    assert.strictEqual(context.countByField(requests, "personId", "p1"), 0);
});
test("countByField: 1 relation", () => {
    const requests = [{ personId: "p1" }, { personId: "autre" }];
    assert.strictEqual(context.countByField(requests, "personId", "p1"), 1);
});
test("countByField: plusieurs relations du même type", () => {
    const requests = [{ personId: "p1" }, { personId: "p1" }, { personId: "p1" }, { personId: "autre" }];
    assert.strictEqual(context.countByField(requests, "personId", "p1"), 3);
});
test("countByField: ID inexistant -> 0, jamais d'erreur", () => {
    const requests = [{ personId: "p1" }];
    assert.strictEqual(context.countByField(requests, "personId", "id-qui-n-existe-pas"), 0);
});
test("countByField: tableau vide ou absent -> 0, jamais d'erreur", () => {
    assert.strictEqual(context.countByField([], "personId", "p1"), 0);
    assert.strictEqual(context.countByField(undefined, "personId", "p1"), 0);
});

test("joinFrenchList: un seul élément", () => {
    assert.strictEqual(context.joinFrenchList(["3 demandes"]), "3 demandes");
});
test("joinFrenchList: deux éléments joints par 'et'", () => {
    assert.strictEqual(context.joinFrenchList(["3 demandes", "1 intention"]), "3 demandes et 1 intention");
});
test("joinFrenchList: trois éléments -> virgules puis 'et' avant le dernier", () => {
    assert.strictEqual(
        context.joinFrenchList(["3 demandes", "2 annonces", "1 intention"]),
        "3 demandes, 2 annonces et 1 intention"
    );
});

test("describeLinkedRecords: aucune relation (cas 1)", () => {
    const text = context.describeLinkedRecords([{ label: "demande", count: 0 }, { label: "intention", count: 0 }]);
    assert.strictEqual(text, "Aucune donnée liée à cette fiche.");
});
test("describeLinkedRecords: une seule relation (cas 2)", () => {
    const text = context.describeLinkedRecords([{ label: "demande", count: 1 }, { label: "intention", count: 0 }]);
    assert.ok(text.includes("1 demande"), "devrait mentionner '1 demande' au singulier");
    assert.ok(!text.includes("intention"), "ne devrait pas mentionner un type de relation à 0");
});
test("describeLinkedRecords: plusieurs types de relations (cas 3, personne)", () => {
    const text = context.describeLinkedRecords([{ label: "demande", count: 3 }, { label: "intention", count: 1 }]);
    assert.ok(text.includes("3 demandes"));
    assert.ok(text.includes("1 intention"));
    assert.ok(text.includes("ne pointeront plus vers une fiche existante"));
});
test("describeLinkedRecords: plusieurs types de relations (cas 4, clocher)", () => {
    const text = context.describeLinkedRecords([
        { label: "demande", count: 2 },
        { label: "annonce", count: 4 },
        { label: "intention", count: 1 }
    ]);
    assert.ok(text.includes("2 demandes"));
    assert.ok(text.includes("4 annonces"));
    assert.ok(text.includes("1 intention"));
});
test("describeLinkedRecords: une seule relation (cas 5, personnel/intentions)", () => {
    const text = context.describeLinkedRecords([{ label: "intention", count: 2 }]);
    assert.ok(text.includes("2 intentions"));
});

/* ---------- js/utils.js : rapport d'import CSV (V6.2.b) ---------- */

test("buildImportReportHTML: erreur complète d'import", () => {
    const html = context.buildImportReportHTML({ error: "Le fichier ne contient aucune ligne de données." });
    assert.ok(html.includes("Le fichier ne contient aucune ligne de données."));
    assert.ok(html.includes("import-report-error"));
});
test("buildImportReportHTML: import réussi sans ligne ignorée -> pas de détail affiché", () => {
    const html = context.buildImportReportHTML({ importedCount: 42, label: "personne(s)", skipped: [], warnings: [] });
    assert.ok(html.includes("42 personne(s) importée(s)"));
    assert.ok(!html.includes("import-report-details"));
});
test("buildImportReportHTML: lignes ignorées avec numéro et raison compréhensible", () => {
    const html = context.buildImportReportHTML({
        importedCount: 42,
        label: "personne(s)",
        skipped: [
            { line: 18, reason: "Date invalide" },
            { line: 27, reason: "Prénom ou nom manquant" }
        ],
        warnings: []
    });
    assert.ok(html.includes("2 ignorée(s)"));
    assert.ok(html.includes("Ligne 18"));
    assert.ok(html.includes("Date invalide"));
    assert.ok(html.includes("Ligne 27"));
    assert.ok(html.includes("Prénom ou nom manquant"));
    // les raisons doivent être compréhensibles, pas des messages techniques
    assert.ok(!html.includes("TypeError"));
    assert.ok(!html.includes("undefined"));
});
test("buildImportReportHTML: échappe le contenu utilisateur (pas d'injection HTML)", () => {
    const html = context.buildImportReportHTML({
        importedCount: 1,
        label: "personne(s)",
        skipped: [{ line: 5, reason: "<script>alert(1)</script>" }],
        warnings: []
    });
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
});
test("buildImportReportHTML: dates non reconnues listées séparément des lignes ignorées", () => {
    const html = context.buildImportReportHTML({
        importedCount: 10,
        label: "demande(s)",
        skipped: [],
        warnings: [{ line: 18, field: "Date demande", value: "31/02/2026" }]
    });
    assert.ok(html.includes("1 date(s) non reconnue(s)"));
    assert.ok(html.includes("Ligne 18"));
    assert.ok(html.includes("31/02/2026"));
});

/* ---------- js/utils.js : corbeille (V6.2.c) ---------- */

test("isDeleted: absent -> false", () => {
    assert.strictEqual(context.isDeleted({}), false);
    assert.strictEqual(context.isDeleted({ deletedAt: "" }), false);
    assert.strictEqual(context.isDeleted({ deletedAt: null }), false);
});
test("isDeleted: renseigné -> true", () => {
    assert.strictEqual(context.isDeleted({ deletedAt: "2026-09-13T10:00:00.000Z" }), true);
});
test("isActive: strictement l'inverse d'isDeleted", () => {
    assert.strictEqual(context.isActive({}), true);
    assert.strictEqual(context.isActive({ deletedAt: "2026-09-13T10:00:00.000Z" }), false);
});

test("findLinked: id vide -> status 'none'", () => {
    const result = context.findLinked([{ id: "p1" }], [], "");
    assert.strictEqual(result.status, "none");
    assert.strictEqual(result.record, null);
});
test("findLinked: trouvé actif -> status 'active'", () => {
    const active = [{ id: "p1", nom: "Dupont" }];
    const result = context.findLinked(active, [], "p1");
    assert.strictEqual(result.status, "active");
    assert.strictEqual(result.record.nom, "Dupont");
});
test("findLinked: trouvé seulement dans la corbeille -> status 'trashed'", () => {
    const active = [{ id: "p2" }];
    const trash = [{ id: "p1", nom: "Dupont" }];
    const result = context.findLinked(active, trash, "p1");
    assert.strictEqual(result.status, "trashed");
    assert.strictEqual(result.record.nom, "Dupont");
});
test("findLinked: introuvable dans les deux -> status 'missing'", () => {
    const result = context.findLinked([{ id: "p2" }], [{ id: "p3" }], "p1");
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.record, null);
});

/* ---------- js/core/history.js : compatibilité anciennes entrées ---------- */

test("historyEntityType: entrée récente -> son propre entityType", () => {
    assert.strictEqual(context.historyEntityType({ entityType: "person" }), "person");
});
test("historyEntityType: ancienne entrée (sans entityType) -> 'request' par défaut", () => {
    assert.strictEqual(context.historyEntityType({ requestId: "r1" }), "request");
});
test("historyEntityId: entrée récente -> son propre entityId", () => {
    assert.strictEqual(context.historyEntityId({ entityId: "p1", requestId: "r1" }), "p1");
});
test("historyEntityId: ancienne entrée -> repli sur requestId", () => {
    assert.strictEqual(context.historyEntityId({ requestId: "r1" }), "r1");
});

/* ---------- js/core/backup.js : détection du format de sauvegarde (V6.3) ---------- */

function expectValidationError(fn) {
    try {
        fn();
    } catch (err) {
        assert.strictEqual(err.name, "ValidationError", `attendu ValidationError, reçu ${err.name}: ${err.message}`);
        return;
    }
    assert.fail("aucune erreur levée alors qu'une ValidationError était attendue");
}

test("detectBackupPayload: tout premier format (tableau brut) -> requests", () => {
    const result = context.detectBackupPayload([{ id: "r1" }], ["requests", "people"]);
    assert.strictEqual(result.data.requests.length, 1);
    assertSameStructure(result.history, []);
});
test("detectBackupPayload: format structuré V6.3 valide", () => {
    const parsed = {
        format: "gparoisse-backup",
        formatVersion: 1,
        data: { requests: [{ id: "r1" }], history: [{ id: "h1", action: "create" }] }
    };
    const result = context.detectBackupPayload(parsed, ["requests", "people"]);
    assert.strictEqual(result.data.requests.length, 1);
    assert.strictEqual(result.history.length, 1);
});
test("detectBackupPayload: format structuré, formatVersion inconnu -> ValidationError", () => {
    expectValidationError(() => context.detectBackupPayload({ format: "gparoisse-backup", formatVersion: 2, data: {} }, ["requests"]));
});
test("detectBackupPayload: format structuré, format inattendu -> ValidationError", () => {
    expectValidationError(() => context.detectBackupPayload({ format: "autre-app", formatVersion: 1, data: {} }, ["requests"]));
});
test("detectBackupPayload: format structuré sans data -> ValidationError", () => {
    expectValidationError(() => context.detectBackupPayload({ format: "gparoisse-backup", formatVersion: 1 }, ["requests"]));
});
test("detectBackupPayload: ancien format plat reconnu (au moins une clé de module)", () => {
    const parsed = { app: "Paroisse · Secrétariat", version: 9, requests: [{ id: "r1" }] };
    const result = context.detectBackupPayload(parsed, ["requests", "people"]);
    assert.strictEqual(result.data.requests.length, 1);
    assertSameStructure(result.history, []);
});
test("detectBackupPayload: JSON sans rapport -> ValidationError", () => {
    expectValidationError(() => context.detectBackupPayload({ foo: "bar" }, ["requests", "people"]));
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
