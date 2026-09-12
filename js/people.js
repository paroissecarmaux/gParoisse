"use strict";

/* ============================================================
   MODULE PERSONNES
============================================================ */
async function loadPeopleData() {
    state.people = await db.people.orderBy("updatedAt").reverse().toArray();
}

function createDefaultPerson() {
    return { id: "", prenom: "", nom: "" };
}

function personBirthLine(p) {
    if (!p.dateNaissance) return "Date de naissance inconnue";
    const age = computeAge(p.dateNaissance);
    return `${formatDate(p.dateNaissance)}${age !== null ? " · " + age + " an" + (age > 1 ? "s" : "") : ""}`;
}

function sacramentBadge(label, done) {
    return `<span class="badge ${done ? "done" : "normal"}">${label} ${done ? "✓" : "✗"}</span>`;
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
function filteredPeople() {
    const query = normalize($("#peopleSearchInput").value);
    let result = state.people.slice();
    if (query) {
        result = result.filter(p => {
            const hay = normalize([p.prenom, p.nom, p.telephone, p.email, p.adresse, p.notes].join(" "));
            return hay.includes(query);
        });
    }
    result.sort((a, b) => normalize(a.nom + a.prenom).localeCompare(normalize(b.nom + b.prenom), "fr"));
    return result;
}

function renderPersonCard(p) {
    return `
        <article class="person-card" data-person-id="${escapeHTML(p.id)}" role="listitem">
            <div class="request-person">
                <div class="request-name">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</div>
                <div class="request-contact">${escapeHTML([p.telephone, p.email].filter(Boolean).join(" · ") || "Aucun contact")}</div>
            </div>
            <div>
                <div class="request-type">${personBirthLine(p)}</div>
                <div class="request-date">${p.lieuNaissance ? "Né(e) à " + escapeHTML(p.lieuNaissance) : ""}</div>
            </div>
            <div>
                ${sacramentBadge("Baptême", Boolean(p.dateBapteme))}
                ${sacramentBadge("Confirmation", Boolean(p.dateConfirmation))}
                ${sacramentBadge("Mariage", Boolean(p.dateMariage))}
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="open" title="Ouvrir" aria-label="Ouvrir">↗</button>
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">✎</button>
                <button class="icon-btn" data-action="delete" title="Supprimer" aria-label="Supprimer">🗑</button>
            </div>
        </article>
    `;
}

function renderPeopleList() {
    const container = $("#peopleList");
    const people = filteredPeople();
    const countEl = $("#peopleResultCount");

    if (!people.length) {
        countEl.textContent = "";
        const msg = state.people.length
            ? "Aucune personne ne correspond à la recherche."
            : "Aucune personne enregistrée. Ajoutez-en une avec « Ajouter une personne ».";
        container.innerHTML = `<div class="empty">${msg}</div>`;
        return;
    }

    countEl.textContent = `${people.length} personne${people.length > 1 ? "s" : ""}`;
    container.innerHTML = people.map(renderPersonCard).join("");
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
function fillPersonForm(p) {
    $("#personId").value = p.id || "";
    $("#personPrenom").value = p.prenom || "";
    $("#personNom").value = p.nom || "";
    $("#personDateNaissance").value = p.dateNaissance || "";
    $("#personLieuNaissance").value = p.lieuNaissance || "";
    $("#personPere").value = p.pere || "";
    $("#personMere").value = p.mere || "";
    $("#personTelephone").value = p.telephone || "";
    $("#personEmail").value = p.email || "";
    $("#personAdresse").value = p.adresse || "";
    $("#personRegistre").value = p.registre || "";
    $("#personLieuBapteme").value = p.lieuBapteme || "";
    $("#personDiocese").value = p.diocese || "";
    $("#personAnneeBapteme").value = p.anneeBapteme || "";
    $("#personNumeroBapteme").value = p.numeroBapteme || "";
    $("#personDateBapteme").value = p.dateBapteme || "";
    $("#personParrain").value = p.parrain || "";
    $("#personMarraine").value = p.marraine || "";
    $("#personTemoin").value = p.temoin || "";
    $("#personDateConfirmation").value = p.dateConfirmation || "";
    $("#personLieuConfirmation").value = p.lieuConfirmation || "";
    $("#personDateMariage").value = p.dateMariage || "";
    $("#personLieuMariage").value = p.lieuMariage || "";
    $("#personConjoint").value = p.conjoint || "";
    $("#personNotes").value = p.notes || "";
}

function showPersonForm(id) {
    const existing = id ? state.people.find(x => x.id === id) : null;
    state.personFormMode = existing ? "edit" : "new";
    fillPersonForm(existing || createDefaultPerson());
    $("#personFormTitle").textContent = existing ? "Modifier la personne" : "Nouvelle personne";
    showPage("person-form");
    setTimeout(() => $("#personPrenom").focus(), 50);
}

async function savePerson(e) {
    e.preventDefault();
    const prenom = $("#personPrenom").value.trim();
    const nom = $("#personNom").value.trim();
    if (!prenom || !nom) {
        toast("Le prénom et le nom sont obligatoires.", "error");
        return;
    }

    const id = $("#personId").value.trim();
    const existing = state.people.find(p => p.id === id);
    const now = nowISO();

    const person = {
        id: id || uid(),
        prenom,
        nom,
        dateNaissance: $("#personDateNaissance").value,
        lieuNaissance: $("#personLieuNaissance").value.trim(),
        pere: $("#personPere").value.trim(),
        mere: $("#personMere").value.trim(),
        telephone: $("#personTelephone").value.trim(),
        email: $("#personEmail").value.trim(),
        adresse: $("#personAdresse").value.trim(),
        registre: $("#personRegistre").value.trim(),
        lieuBapteme: $("#personLieuBapteme").value.trim(),
        diocese: $("#personDiocese").value.trim(),
        anneeBapteme: $("#personAnneeBapteme").value.trim(),
        numeroBapteme: $("#personNumeroBapteme").value.trim(),
        dateBapteme: $("#personDateBapteme").value,
        parrain: $("#personParrain").value.trim(),
        marraine: $("#personMarraine").value.trim(),
        temoin: $("#personTemoin").value.trim(),
        dateConfirmation: $("#personDateConfirmation").value,
        lieuConfirmation: $("#personLieuConfirmation").value.trim(),
        dateMariage: $("#personDateMariage").value,
        lieuMariage: $("#personLieuMariage").value.trim(),
        conjoint: $("#personConjoint").value.trim(),
        notes: $("#personNotes").value.trim(),
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    try {
        await db.people.put(person);
        await loadPeopleData();
        renderPeopleList();
        toast(existing ? "Personne modifiée." : "Personne ajoutée.", "success");
        showPersonDetail(person.id);
    } catch (err) {
        console.error(err);
        toast("Impossible d'enregistrer cette personne.", "error");
    }
}

function showPersonDetail(id) {
    const p = state.people.find(x => x.id === id);
    if (!p) return;
    state.selectedPersonId = id;

    $("#personDetailTitle").textContent = `${p.prenom} ${p.nom}`.trim() || "Personne";
    $("#personDetailSubtitle").textContent = personBirthLine(p);

    $("#personDetailBody").innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Père</div>
                <div class="detail-value">${escapeHTML(p.pere || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Mère</div>
                <div class="detail-value">${escapeHTML(p.mere || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Téléphone</div>
                <div class="detail-value">${escapeHTML(p.telephone || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">E-mail</div>
                <div class="detail-value">${escapeHTML(p.email || "—")}</div>
            </div>
            <div class="detail-item full">
                <div class="detail-label">Adresse</div>
                <div class="detail-value">${escapeHTML(p.adresse || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Baptême</div>
                <div class="detail-value">${p.dateBapteme ? formatDate(p.dateBapteme) + (p.lieuBapteme ? " · " + escapeHTML(p.lieuBapteme) : "") : "—"}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Registre / diocèse</div>
                <div class="detail-value">${escapeHTML([p.registre, p.diocese].filter(Boolean).join(" · ") || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Année / n° baptême</div>
                <div class="detail-value">${escapeHTML([p.anneeBapteme, p.numeroBapteme].filter(Boolean).join(" · ") || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Parrain / marraine</div>
                <div class="detail-value">${escapeHTML([p.parrain, p.marraine].filter(Boolean).join(" · ") || "—")}</div>
            </div>
            <div class="detail-item full">
                <div class="detail-label">Témoin</div>
                <div class="detail-value">${escapeHTML(p.temoin || "—")}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Confirmation</div>
                <div class="detail-value">${p.dateConfirmation ? formatDate(p.dateConfirmation) + (p.lieuConfirmation ? " · " + escapeHTML(p.lieuConfirmation) : "") : "—"}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Mariage</div>
                <div class="detail-value">${p.dateMariage ? formatDate(p.dateMariage) + (p.lieuMariage ? " · " + escapeHTML(p.lieuMariage) : "") : "—"}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Conjoint(e)</div>
                <div class="detail-value">${escapeHTML(p.conjoint || "—")}</div>
            </div>
            <div class="detail-item full">
                <div class="detail-label">Observations</div>
                <div class="detail-value">${escapeHTML(p.notes || "Aucune observation.")}</div>
            </div>
        </div>
    `;

    showPage("person-detail");
}

async function deletePerson(id) {
    const p = state.people.find(x => x.id === id);
    if (!p) return;
    if (!window.confirm(`Supprimer définitivement la fiche de ${p.prenom} ${p.nom} ?\n\nCette action est irréversible.`)) return;

    try {
        await db.people.delete(id);
        await loadPeopleData();
        renderPeopleList();
        toast("Personne supprimée.", "success");
        showPage("people");
    } catch (err) {
        console.error(err);
        toast("Impossible de supprimer cette personne.", "error");
    }
}

/* ============================================================
   IMPORT CSV
============================================================ */
const CSV_FIELD_MAP = {
    registre: "registre",
    eglises: "lieuBapteme",
    eglise: "lieuBapteme",
    diocese: "diocese",
    annee: "anneeBapteme",
    nbaptemes: "numeroBapteme",
    databapteme: "dateBapteme",
    datebapteme: "dateBapteme",
    prenoms: "prenom",
    prenom: "prenom",
    noms: "nom",
    nom: "nom",
    pere: "pere",
    mere: "mere",
    datenaissance: "dateNaissance",
    lieunaissance: "lieuNaissance",
    parrain: "parrain",
    marraine: "marraine",
    temoin: "temoin",
    dateconfirmaion: "dateConfirmation",
    dateconfirmation: "dateConfirmation",
    confirmation: "lieuConfirmation",
    datemariage: "dateMariage",
    mariagelieu: "lieuMariage",
    lieumariage: "lieuMariage",
    nomepouse: "conjoint",
    observations: "notes",
    adresse: "adresse",
    telephone: "telephone",
    email: "email"
};

const CSV_DATE_FIELDS = ["dateNaissance", "dateBapteme", "dateConfirmation", "dateMariage"];

async function importPeopleCSV(file) {
    if (!file) return;
    try {
        const text = await file.text();
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error("Le fichier ne contient aucune ligne de données.");

        const fieldKeys = rows[0].map(h => CSV_FIELD_MAP[normalizeHeaderKey(h)] || null);
        if (!fieldKeys.some(Boolean)) throw new Error("Aucune colonne reconnue dans l'en-tête du fichier.");

        const now = nowISO();
        let imported = 0;
        let skipped = 0;

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            const person = { id: uid(), prenom: "", nom: "" };

            fieldKeys.forEach((key, idx) => {
                if (!key) return;
                const raw = (cols[idx] || "").trim();
                if (!raw) return;
                person[key] = CSV_DATE_FIELDS.includes(key) ? parseFrenchDate(raw) : raw;
            });

            if (!person.prenom && !person.nom) { skipped++; continue; }

            person.createdAt = now;
            person.updatedAt = now;
            await db.people.put(person);
            imported++;
        }

        await loadPeopleData();
        renderPeopleList();
        toast(`${imported} personne(s) importée(s)${skipped ? ` · ${skipped} ligne(s) ignorée(s)` : ""}.`, "success");
    } catch (err) {
        console.error(err);
        toast("Import CSV impossible : " + err.message, "error");
    }
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initPeopleEvents() {
    $("#newPersonBtn").addEventListener("click", () => showPersonForm(null));
    $("#personForm").addEventListener("submit", savePerson);
    $("#personFormBackBtn").addEventListener("click", goBack);
    $("#personFormCancelBtn").addEventListener("click", goBack);

    $("#personDetailBackBtn").addEventListener("click", goBack);
    $("#personEditBtn").addEventListener("click", () => state.selectedPersonId && showPersonForm(state.selectedPersonId));
    $("#personDeleteBtn").addEventListener("click", () => state.selectedPersonId && deletePerson(state.selectedPersonId));

    $("#peopleList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-person-id]");
        if (!card) return;
        const id = card.dataset.personId;

        if (!btn) { showPersonDetail(id); return; }

        switch (btn.dataset.action) {
            case "open": showPersonDetail(id); break;
            case "edit": showPersonForm(id); break;
            case "delete": deletePerson(id); break;
        }
    });

    const debouncedPeopleRender = debounce(renderPeopleList, 200);
    $("#peopleSearchInput").addEventListener("input", debouncedPeopleRender);

    $("#importPeopleCsvBtn").addEventListener("click", () => {
        $("#importPeopleCsvFile").value = "";
        $("#importPeopleCsvFile").click();
    });
    $("#importPeopleCsvFile").addEventListener("change", e => importPeopleCSV(e.target.files[0]));
}
