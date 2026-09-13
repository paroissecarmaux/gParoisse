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
    "js/core/backup.js",
    // js/core/directory.js (V6.8.a) : personToDirectoryEntry/
    // personnelToDirectoryEntry/hasRole/getRolesByType/
    // computeDirectoryMigration sont réellement pures (n'utilisent que
    // nowISO(), déjà chargé). migratePeopleAndPersonnelToDirectory()/
    // loadDirectoryData() référencent DirectoryRepository/PeopleRepository/
    // state/Logger, absents de ce contexte — non appelées par les tests
    // ci-dessous, même principe que js/core/history.js juste au-dessus.
    "js/core/directory.js",
    // js/diagnostics.js (V6.6) lit `state.*` au moment de l'appel, pas au
    // chargement — safe à charger ici sans js/state.js ; les tests
    // ci-dessous posent `context.state` manuellement avant d'appeler les
    // fonctions de vérification.
    "js/diagnostics.js"
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

/* ---------- js/diagnostics.js : diagnostic d'intégrité (V6.6) ---------- */

test("isInvalidDateValue: vide -> non invalide (non renseigné)", () => {
    assert.strictEqual(context.isInvalidDateValue(""), false);
    assert.strictEqual(context.isInvalidDateValue(null), false);
    assert.strictEqual(context.isInvalidDateValue(undefined), false);
});
test("isInvalidDateValue: date ISO valide -> non invalide", () => {
    assert.strictEqual(context.isInvalidDateValue("2026-09-13"), false);
});
test("isInvalidDateValue: format non ISO -> invalide", () => {
    assert.strictEqual(context.isInvalidDateValue("13/09/2026"), true);
});
test("isInvalidDateValue: date impossible (mois 13) -> invalide", () => {
    assert.strictEqual(context.isInvalidDateValue("2026-13-40"), true);
});

test("checkReferenceIntegrity: lien vers une fiche définitivement supprimée -> signalé", () => {
    context.state = {
        requests: [{ id: "r1", name: "Dupont", personId: "p-missing", clocherId: "" }],
        people: [], peopleTrash: [],
        clochers: [], clochersTrash: [],
        schedule: [], intentions: [], personnel: [], personnelTrash: []
    };
    const findings = context.checkReferenceIntegrity();
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].entityType, "request");
});
test("checkReferenceIntegrity: lien vers une fiche active -> rien signalé", () => {
    context.state = {
        requests: [{ id: "r1", name: "Dupont", personId: "p1", clocherId: "" }],
        people: [{ id: "p1", prenom: "Jean", nom: "Dupont" }], peopleTrash: [],
        clochers: [], clochersTrash: [],
        schedule: [], intentions: [], personnel: [], personnelTrash: []
    };
    assertSameStructure(context.checkReferenceIntegrity(), []);
});
test("checkReferenceIntegrity: lien vers une fiche en corbeille -> rien signalé (restaurable, pas cassé)", () => {
    context.state = {
        requests: [{ id: "r1", name: "Dupont", personId: "p1", clocherId: "" }],
        people: [], peopleTrash: [{ id: "p1", prenom: "Jean", nom: "Dupont" }],
        clochers: [], clochersTrash: [],
        schedule: [], intentions: [], personnel: [], personnelTrash: []
    };
    assertSameStructure(context.checkReferenceIntegrity(), []);
});

test("checkEnumValues: statut de demande hors vocabulaire -> signalé", () => {
    context.state = { requests: [{ id: "r1", name: "Dupont", status: "Statut inventé" }], intentions: [], personnel: [] };
    const findings = context.checkEnumValues();
    assert.strictEqual(findings.length, 1);
    assert.ok(findings[0].message.includes("statut"));
});
test("checkEnumValues: valeurs connues -> rien signalé", () => {
    context.state = { requests: [{ id: "r1", name: "Dupont", type: "Baptême", status: "En attente", priority: "Normale" }], intentions: [], personnel: [] };
    assertSameStructure(context.checkEnumValues(), []);
});

test("checkPossibleDuplicates: même nom/prénom/date de naissance -> signalé", () => {
    context.state = {
        people: [
            { id: "p1", prenom: "Jean", nom: "Dupont", dateNaissance: "1950-01-01" },
            { id: "p2", prenom: "Jean", nom: "Dupont", dateNaissance: "1950-01-01" }
        ]
    };
    const findings = context.checkPossibleDuplicates();
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].entityId, "p2");
});
test("checkPossibleDuplicates: personnes différentes -> rien signalé", () => {
    context.state = {
        people: [
            { id: "p1", prenom: "Jean", nom: "Dupont", dateNaissance: "1950-01-01" },
            { id: "p2", prenom: "Marie", nom: "Martin", dateNaissance: "1962-05-05" }
        ]
    };
    assertSameStructure(context.checkPossibleDuplicates(), []);
});

/* ---------- js/core/directory.js : fondations de l'Annuaire (V6.8.a) ---------- */

test("personToDirectoryEntry: paroissien complet -> rôle registre avec les champs sacramentaux", () => {
    const person = {
        id: "p1", profileType: "paroissien", prenom: "Marie", nom: "Dupont",
        dateNaissance: "1950-03-02", lieuNaissance: "Carmaux", telephone: "0600000000",
        rgpd: true, registre: "Registre 1950", lieuBapteme: "Église Saint-Jean",
        diocese: "Albi", anneeBapteme: "1950", numeroBapteme: "12", dateBapteme: "1950-04-01",
        parrain: "Jean", marraine: "Anne", temoin: "", dateCommunion: "1958-05-01",
        lieuCommunion: "", dateConfirmation: "1962-06-01", lieuConfirmation: "",
        dateMariage: "", lieuMariage: "", conjoint: "",
        notes: "Note existante", createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-02T00:00:00.000Z"
    };
    const entry = context.personToDirectoryEntry(person);
    assert.strictEqual(entry.id, "p1");
    assert.strictEqual(entry.entityType, "person");
    assert.strictEqual(entry.roles.length, 1);
    assert.strictEqual(entry.roles[0].type, "registre");
    assert.strictEqual(entry.roles[0].active, true);
    assert.strictEqual(entry.roles[0].lieuBapteme, "Église Saint-Jean");
    assert.strictEqual(entry.roles[0].dateBapteme, "1950-04-01");
    assert.strictEqual(entry.roles[0].parrain, "Jean");
    assert.strictEqual(entry.notes, "Note existante");
});

test("personToDirectoryEntry: contact -> rôle contact sans champ sacramentel", () => {
    const person = { id: "p2", profileType: "contact", prenom: "Paul", nom: "Martin", rgpd: false };
    const entry = context.personToDirectoryEntry(person);
    assert.strictEqual(entry.roles.length, 1);
    assert.strictEqual(entry.roles[0].type, "contact");
    assert.strictEqual(entry.roles[0].rgpd, undefined);
});

test("personToDirectoryEntry: RGPD conservé sur le rôle registre", () => {
    const withConsent = context.personToDirectoryEntry({ id: "p3", profileType: "paroissien", rgpd: true });
    const withoutConsent = context.personToDirectoryEntry({ id: "p4", profileType: "paroissien", rgpd: false });
    assert.strictEqual(withConsent.roles[0].rgpd, true);
    assert.strictEqual(withoutConsent.roles[0].rgpd, false);
});

test("personToDirectoryEntry: role/groupe (texte libre) conservés dans notes, jamais structurés", () => {
    const entry = context.personToDirectoryEntry({
        id: "p5", profileType: "paroissien", role: "Catéchiste", groupe: "Éveil à la foi", notes: "RAS"
    });
    assert.ok(entry.notes.includes("Catéchiste"));
    assert.ok(entry.notes.includes("Éveil à la foi"));
    assert.ok(entry.notes.includes("RAS"));
    // Aucun rôle structuré "catechiste" ou similaire n'est créé à partir de ces champs.
    assert.strictEqual(entry.roles.length, 1);
    assert.strictEqual(entry.roles[0].type, "registre");
});

test("personToDirectoryEntry: personne supprimée -> deletedAt conservé", () => {
    const entry = context.personToDirectoryEntry({ id: "p6", profileType: "contact", deletedAt: "2024-01-01T00:00:00.000Z" });
    assert.strictEqual(entry.deletedAt, "2024-01-01T00:00:00.000Z");
});

test("personToDirectoryEntry: id conservé à l'identique", () => {
    const entry = context.personToDirectoryEntry({ id: "exact-same-id", profileType: "contact" });
    assert.strictEqual(entry.id, "exact-same-id");
});

test("personnelToDirectoryEntry: bénévole -> rôle benevole avec domaine", () => {
    const entry = context.personnelToDirectoryEntry({
        id: "e1", prenom: "Alice", nom: "Roy", typeEngagement: "Bénévole", etat: "Laïc",
        fonction: "Catéchisme", active: true, dateDebut: "2019-01-01"
    });
    assert.strictEqual(entry.roles.length, 1);
    assert.strictEqual(entry.roles[0].type, "benevole");
    assert.strictEqual(entry.roles[0].domaine, "Catéchisme");
    assert.strictEqual(entry.roles[0].active, true);
});

test("personnelToDirectoryEntry: salarié -> rôle salarie avec fonction", () => {
    const entry = context.personnelToDirectoryEntry({
        id: "e2", typeEngagement: "Salarié", etat: "Laïc", fonction: "Secrétaire", active: true
    });
    assert.strictEqual(entry.roles.length, 1);
    assert.strictEqual(entry.roles[0].type, "salarie");
    assert.strictEqual(entry.roles[0].fonction, "Secrétaire");
});

test("personnelToDirectoryEntry: prêtre -> rôle clerge avec etatCanonique", () => {
    const entry = context.personnelToDirectoryEntry({ id: "e3", typeEngagement: "Bénévole", etat: "Prêtre", active: true });
    const clerge = entry.roles.find(r => r.type === "clerge");
    assert.ok(clerge);
    assert.strictEqual(clerge.etatCanonique, "Prêtre");
});

test("personnelToDirectoryEntry: diacre -> rôle clerge avec etatCanonique Diacre", () => {
    const entry = context.personnelToDirectoryEntry({ id: "e4", typeEngagement: "Bénévole", etat: "Diacre", active: true });
    assert.strictEqual(entry.roles.find(r => r.type === "clerge").etatCanonique, "Diacre");
});

test("personnelToDirectoryEntry: religieux(se) -> rôle clerge avec etatCanonique Religieux(se)", () => {
    const entry = context.personnelToDirectoryEntry({ id: "e5", typeEngagement: "Bénévole", etat: "Religieux(se)", active: true });
    assert.strictEqual(entry.roles.find(r => r.type === "clerge").etatCanonique, "Religieux(se)");
});

test("personnelToDirectoryEntry: laïc -> jamais de rôle clerge", () => {
    const entry = context.personnelToDirectoryEntry({ id: "e6", typeEngagement: "Salarié", etat: "Laïc", active: true });
    assert.strictEqual(entry.roles.some(r => r.type === "clerge"), false);
});

test("personnelToDirectoryEntry: engagement + clergé -> deux rôles indépendants", () => {
    const entry = context.personnelToDirectoryEntry({
        id: "e7", typeEngagement: "Salarié", etat: "Prêtre", fonction: "Curé", active: true, dateDebut: "2010-01-01"
    });
    assert.strictEqual(entry.roles.length, 2);
    assert.ok(entry.roles.some(r => r.type === "salarie" && r.fonction === "Curé"));
    assert.ok(entry.roles.some(r => r.type === "clerge" && r.etatCanonique === "Prêtre"));
});

test("personnelToDirectoryEntry: entrée inactive -> active propagé aux rôles", () => {
    const entry = context.personnelToDirectoryEntry({ id: "e8", typeEngagement: "Bénévole", etat: "Laïc", active: false });
    assert.strictEqual(entry.roles[0].active, false);
});

test("personnelToDirectoryEntry: entrée supprimée -> deletedAt conservé", () => {
    const entry = context.personnelToDirectoryEntry({ id: "e9", typeEngagement: "Bénévole", etat: "Laïc", active: true, deletedAt: "2023-05-05T00:00:00.000Z" });
    assert.strictEqual(entry.deletedAt, "2023-05-05T00:00:00.000Z");
});

test("personnelToDirectoryEntry: id conservé à l'identique", () => {
    const entry = context.personnelToDirectoryEntry({ id: "exact-personnel-id", typeEngagement: "Bénévole", etat: "Laïc", active: true });
    assert.strictEqual(entry.id, "exact-personnel-id");
});

test("personnelToDirectoryEntry: aucun rôle déterminable -> roles vide, donnée conservée en notes, jamais de rôle inventé", () => {
    const entry = context.personnelToDirectoryEntry({ id: "e10", typeEngagement: "Stagiaire", etat: "Laïc", fonction: "Aide ponctuelle", active: true });
    assert.strictEqual(entry.roles.length, 0);
    assert.ok(entry.notes.includes("Stagiaire"));
    assert.ok(entry.notes.includes("Aide ponctuelle"));
});

/* ---------- hasRole() / getRolesByType() ---------- */

test("hasRole: aucun rôle -> false", () => {
    assert.strictEqual(context.hasRole({ roles: [] }, "benevole"), false);
});
test("hasRole: un rôle correspondant -> true", () => {
    assert.strictEqual(context.hasRole({ roles: [{ type: "benevole", active: true }] }, "benevole"), true);
});
test("hasRole: plusieurs rôles différents -> ne répond que pour le type demandé", () => {
    const entry = { roles: [{ type: "benevole", active: true }, { type: "contact", active: true }] };
    assert.strictEqual(context.hasRole(entry, "benevole"), true);
    assert.strictEqual(context.hasRole(entry, "salarie"), false);
});
test("hasRole: plusieurs instances du même rôle -> true dès qu'une est active", () => {
    const entry = { roles: [
        { type: "benevole", active: false, domaine: "Catéchisme" },
        { type: "benevole", active: true, domaine: "Accueil" }
    ] };
    assert.strictEqual(context.hasRole(entry, "benevole"), true);
});
test("hasRole: rôle présent mais inactif (seule instance) -> false", () => {
    assert.strictEqual(context.hasRole({ roles: [{ type: "salarie", active: false }] }, "salarie"), false);
});
test("getRolesByType: renvoie toutes les instances, actives ou non", () => {
    const entry = { roles: [
        { type: "benevole", active: false, domaine: "Catéchisme" },
        { type: "benevole", active: true, domaine: "Accueil" },
        { type: "contact", active: true }
    ] };
    const result = context.getRolesByType(entry, "benevole");
    assert.strictEqual(result.length, 2);
});

/* ---------- computeDirectoryMigration() ---------- */

test("computeDirectoryMigration: ensemble vide -> rien à créer", () => {
    const { toCreate, report } = context.computeDirectoryMigration(new Set(), [], []);
    assertSameStructure(toCreate, []);
    assert.strictEqual(report.createdFromPeople, 0);
    assert.strictEqual(report.createdFromPersonnel, 0);
    assert.strictEqual(report.skipped, 0);
});

test("computeDirectoryMigration: migration de people seul", () => {
    const people = [{ id: "p1", profileType: "paroissien" }, { id: "p2", profileType: "contact" }];
    const { toCreate, report } = context.computeDirectoryMigration(new Set(), people, []);
    assert.strictEqual(toCreate.length, 2);
    assert.strictEqual(report.createdFromPeople, 2);
    assert.strictEqual(report.createdFromPersonnel, 0);
});

test("computeDirectoryMigration: migration de personnel seul", () => {
    const personnel = [{ id: "e1", typeEngagement: "Bénévole", etat: "Laïc", active: true }];
    const { toCreate, report } = context.computeDirectoryMigration(new Set(), [], personnel);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(report.createdFromPersonnel, 1);
});

test("computeDirectoryMigration: migration des deux -> ids conservés", () => {
    const people = [{ id: "p1", profileType: "paroissien" }];
    const personnel = [{ id: "e1", typeEngagement: "Salarié", etat: "Laïc", active: true }];
    const { toCreate } = context.computeDirectoryMigration(new Set(), people, personnel);
    assert.strictEqual(toCreate.length, 2);
    assertSameStructure(toCreate.map(e => e.id).sort(), ["e1", "p1"]);
});

test("computeDirectoryMigration: deletedAt (corbeille) conservé pendant la migration", () => {
    const people = [{ id: "p1", profileType: "contact", deletedAt: "2024-06-01T00:00:00.000Z" }];
    const { toCreate } = context.computeDirectoryMigration(new Set(), people, []);
    assert.strictEqual(toCreate[0].deletedAt, "2024-06-01T00:00:00.000Z");
});

test("computeDirectoryMigration: personnel sans rôle déterminable -> avertissement", () => {
    const personnel = [{ id: "e1", typeEngagement: "Inconnu", etat: "Laïc", active: true }];
    const { report } = context.computeDirectoryMigration(new Set(), [], personnel);
    assert.strictEqual(report.warnings.length, 1);
});

test("computeDirectoryMigration: seconde exécution -> aucune duplication (idempotence)", () => {
    const people = [{ id: "p1", profileType: "paroissien" }];
    const personnel = [{ id: "e1", typeEngagement: "Bénévole", etat: "Laïc", active: true }];

    const first = context.computeDirectoryMigration(new Set(), people, personnel);
    assert.strictEqual(first.toCreate.length, 2);

    // Simule l'état de `directory` après la première exécution : les deux
    // id existent désormais.
    const existingAfterFirstRun = new Set(first.toCreate.map(e => e.id));
    const second = context.computeDirectoryMigration(existingAfterFirstRun, people, personnel);
    assert.strictEqual(second.toCreate.length, 0);
    assert.strictEqual(second.report.skipped, 2);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
