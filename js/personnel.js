"use strict";

/* ============================================================
   MODULE PERSONNEL
   Bénévoles, salariés et clergé qui font vivre la paroisse (à ne
   pas confondre avec « Personnes », l'annuaire des paroissiens).
   Recherchable depuis les autres modules (ex. célébrant d'une
   intention de messe) via setupAutocomplete().
============================================================ */
async function loadPersonnelData() {
    state.personnel = await db.personnel.orderBy("updatedAt").reverse().toArray();
}

function renderPersonnelFormOptions() {
    $("#personnelTypeEngagement").innerHTML = PERSONNEL_TYPES
        .map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
    $("#personnelEtat").innerHTML = PERSONNEL_ETATS
        .map(e => `<option value="${escapeHTML(e)}">${escapeHTML(e)}</option>`).join("");
}

function createDefaultPersonnel() {
    const now = nowISO();
    return {
        id: uid(),
        prenom: "",
        nom: "",
        typeEngagement: PERSONNEL_TYPES[0],
        etat: PERSONNEL_ETATS[0],
        fonction: "",
        telephone: "",
        email: "",
        adresse: "",
        dateDebut: todayISO(),
        dateFin: "",
        notes: "",
        active: true,
        createdAt: now,
        updatedAt: now
    };
}

// Recherche générique réutilisée par les autres modules (ex. lier une
// intention de messe à un célébrant) via setupAutocomplete().
function personnelSuggestions(query) {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return state.personnel
        .filter(p => normalize(`${p.prenom} ${p.nom} ${p.fonction}`).includes(q))
        .slice(0, 8);
}

function personnelSuggestionLabel(p) {
    return `${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}${p.fonction ? " — " + escapeHTML(p.fonction) : ""}`;
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
function sortedPersonnel() {
    return sortByKey(state.personnel, p => normalize(`${p.nom} ${p.prenom}`));
}

function filteredPersonnel() {
    let items = sortedPersonnel();
    if (state.personnelQuickFilter === "Bénévole") items = items.filter(p => p.typeEngagement === "Bénévole");
    else if (state.personnelQuickFilter === "Salarié") items = items.filter(p => p.typeEngagement === "Salarié");
    else if (state.personnelQuickFilter === "clerge") items = items.filter(p => p.etat && p.etat !== "Laïc");
    return items;
}

function renderPersonnelSummary() {
    $("#personnelStatTotal").textContent = state.personnel.length;
    $("#personnelStatBenevoles").textContent = state.personnel.filter(p => p.typeEngagement === "Bénévole").length;
    $("#personnelStatSalaries").textContent = state.personnel.filter(p => p.typeEngagement === "Salarié").length;
    $("#personnelStatClerge").textContent = state.personnel.filter(p => p.etat && p.etat !== "Laïc").length;
}

function filterPersonnelByKpi(kpi) {
    state.personnelQuickFilter = kpi === "all" ? null : kpi;
    renderPersonnelList();
    $("#personnelList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPersonnelCard(p) {
    return `
        <article class="schedule-card ${!p.active ? "inactive" : ""}" data-personnel-id="${escapeHTML(p.id)}" role="listitem">
            <div class="avatar" aria-hidden="true">${escapeHTML(initials(`${p.prenom} ${p.nom}`))}</div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</div>
                <div class="request-contact">${escapeHTML(p.fonction || "Fonction non renseignée")}</div>
            </div>
            <div>
                <div class="request-type">${escapeHTML(p.typeEngagement)}</div>
                <div class="request-date">${escapeHTML(p.etat)}</div>
            </div>
            <div class="badge-row">
                ${!p.active ? `<span class="badge cancelled">Inactif</span>` : `<span class="badge done">${icon("check-circle", "icon-inline")}Actif</span>`}
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">${icon("edit")}</button>
                <button class="icon-btn" data-action="delete" title="Supprimer" aria-label="Supprimer">${icon("trash")}</button>
            </div>
        </article>
    `;
}

function renderPersonnelList() {
    const container = $("#personnelList");
    const items = filteredPersonnel();
    const countEl = $("#personnelResultCount");

    if (!items.length) {
        countEl.textContent = "";
        container.innerHTML = `<div class="empty">${state.personnel.length ? "Personne ne correspond à ce filtre." : "Aucun membre du personnel enregistré. Ajoutez les bénévoles, salariés et membres du clergé de la paroisse."}</div>`;
        return;
    }

    countEl.textContent = `${items.length} personne${items.length > 1 ? "s" : ""}`;
    container.innerHTML = items.map(renderPersonnelCard).join("");
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
function fillPersonnelForm(p) {
    $("#personnelId").value = p.id || "";
    $("#personnelPrenom").value = p.prenom || "";
    $("#personnelNom").value = p.nom || "";
    $("#personnelTypeEngagement").value = p.typeEngagement || PERSONNEL_TYPES[0];
    $("#personnelEtat").value = p.etat || PERSONNEL_ETATS[0];
    $("#personnelFonction").value = p.fonction || "";
    $("#personnelTelephone").value = p.telephone || "";
    $("#personnelEmail").value = p.email || "";
    $("#personnelAdresse").value = p.adresse || "";
    $("#personnelDateDebut").value = p.dateDebut || todayISO();
    $("#personnelDateFin").value = p.dateFin || "";
    $("#personnelNotes").value = p.notes || "";
    $("#personnelActive").checked = p.active !== false;
}

function showPersonnelForm(id) {
    const existing = id ? state.personnel.find(x => x.id === id) : null;
    state.personnelFormMode = existing ? "edit" : "new";
    fillPersonnelForm(existing || createDefaultPersonnel());
    $("#personnelFormTitle").textContent = existing ? "Modifier la fiche" : "Nouveau membre du personnel";
    showPage("personnel-form");
    setTimeout(() => $("#personnelPrenom").focus(), 50);
}

async function savePersonnel(e) {
    e.preventDefault();
    const prenom = $("#personnelPrenom").value.trim();
    const nom = $("#personnelNom").value.trim();
    if (!prenom || !nom) {
        toast("Le prénom et le nom sont obligatoires.", "error");
        return;
    }

    const id = $("#personnelId").value.trim();
    const existing = state.personnel.find(p => p.id === id);
    const now = nowISO();

    const personnel = {
        id: id || uid(),
        prenom,
        nom,
        typeEngagement: $("#personnelTypeEngagement").value,
        etat: $("#personnelEtat").value,
        fonction: $("#personnelFonction").value.trim(),
        telephone: $("#personnelTelephone").value.trim(),
        email: $("#personnelEmail").value.trim(),
        adresse: $("#personnelAdresse").value.trim(),
        dateDebut: $("#personnelDateDebut").value,
        dateFin: $("#personnelDateFin").value,
        notes: $("#personnelNotes").value.trim(),
        active: $("#personnelActive").checked,
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    try {
        await db.personnel.put(personnel);
        await loadPersonnelData();
        renderPersonnelList();
        renderPersonnelSummary();
        toast(existing ? "Fiche modifiée." : "Fiche ajoutée.", "success");
        showPersonnelDetail(personnel.id);
    } catch (err) {
        console.error(err);
        toast("Impossible d'enregistrer cette fiche.", "error");
    }
}

function relatedIntentionsFor(p) {
    return state.intentions
        .filter(i => i.personnelId === p.id)
        .sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut)));
}

function showPersonnelDetail(id) {
    const p = state.personnel.find(x => x.id === id);
    if (!p) return;
    state.selectedPersonnelId = id;

    const relatedIntentions = relatedIntentionsFor(p);

    $("#personnelDetailTitle").textContent = `${p.prenom} ${p.nom}`.trim() || "Personnel";

    $("#personnelDetailBody").innerHTML = `
        <div class="fiche-header">
            <div class="fiche-avatar" aria-hidden="true">${escapeHTML(initials(`${p.prenom} ${p.nom}`))}</div>
            <div class="fiche-heading">
                <h3 class="fiche-name">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</h3>
                <p class="fiche-meta">${escapeHTML(p.fonction || "Fonction non renseignée")}</p>
                <div class="fiche-chips">
                    <span class="badge normal">${escapeHTML(p.typeEngagement)}</span>
                    <span class="badge normal">${escapeHTML(p.etat)}</span>
                    ${!p.active ? `<span class="badge cancelled">Inactif</span>` : `<span class="badge done">${icon("check-circle", "icon-inline")}Actif</span>`}
                </div>
            </div>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Coordonnées</h4>
            <dl class="fiche-grid">
                ${ficheField("Téléphone", escapeHTML(p.telephone))}
                ${ficheField("E-mail", escapeHTML(p.email))}
                ${ficheField("Adresse", escapeHTML(p.adresse), true)}
            </dl>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Engagement</h4>
            <dl class="fiche-grid">
                ${ficheField("Début", formatDate(p.dateDebut))}
                ${ficheField("Fin", p.dateFin ? formatDate(p.dateFin) : "")}
                ${ficheField("Notes", escapeHTML(p.notes) || "Aucune note.", true)}
            </dl>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Intentions de messe célébrées${relatedIntentions.length ? ` (${relatedIntentions.length})` : ""}</h4>
            ${relatedIntentions.length
                ? `<div class="alert-list" role="list">${relatedIntentions.map(i => `
                    <div class="alert-item" data-intention-id="${escapeHTML(i.id)}" role="listitem">
                        <div class="alert-marker"></div>
                        <div class="alert-main">
                            <div class="alert-name">${escapeHTML(i.intitule || i.type)}</div>
                            <div class="alert-detail">${escapeHTML(i.type)} · ${formatDate(i.dateDebut)}</div>
                        </div>
                    </div>
                `).join("")}</div>`
                : `<div class="empty">Aucune intention liée à cette fiche.</div>`}
        </div>
    `;

    $("#personnelDetailToggleBtn").innerHTML = p.active
        ? `${icon("archive")} Désactiver`
        : `${icon("restore")} Réactiver`;
    showPage("personnel-detail");
}

async function togglePersonnelActive(id) {
    const p = state.personnel.find(x => x.id === id);
    if (!p) return;
    p.active = !p.active;
    p.updatedAt = nowISO();
    await db.personnel.put(p);
    await loadPersonnelData();
    renderPersonnelList();
    renderPersonnelSummary();
    showPersonnelDetail(id);
    toast(p.active ? "Fiche réactivée." : "Fiche désactivée.", "success");
}

async function deletePersonnel(id) {
    const p = state.personnel.find(x => x.id === id);
    if (!p) return;
    if (!window.confirm(`Supprimer définitivement la fiche de ${p.prenom} ${p.nom} ?\n\nCette action est irréversible.`)) return;

    try {
        await db.personnel.delete(id);
        await loadPersonnelData();
        renderPersonnelList();
        renderPersonnelSummary();
        toast("Fiche supprimée.", "success");
        showPage("personnel");
    } catch (err) {
        console.error(err);
        toast("Impossible de supprimer cette fiche.", "error");
    }
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initPersonnelEvents() {
    $("#newPersonnelBtn").addEventListener("click", () => showPersonnelForm(null));
    $("#personnelForm").addEventListener("submit", savePersonnel);
    $("#personnelFormBackBtn").addEventListener("click", goBack);
    $("#personnelFormCancelBtn").addEventListener("click", goBack);

    $("#personnelKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) filterPersonnelByKpi(btn.dataset.kpi);
    });

    $("#personnelDetailBackBtn").addEventListener("click", goBack);
    $("#personnelEditBtn").addEventListener("click", () => state.selectedPersonnelId && showPersonnelForm(state.selectedPersonnelId));
    $("#personnelDetailToggleBtn").addEventListener("click", () => state.selectedPersonnelId && togglePersonnelActive(state.selectedPersonnelId));
    $("#personnelDeleteBtn").addEventListener("click", () => state.selectedPersonnelId && deletePersonnel(state.selectedPersonnelId));

    $("#personnelDetailBody").addEventListener("click", e => {
        const item = e.target.closest("[data-intention-id]");
        if (item) showIntentionDetail(item.dataset.intentionId);
    });

    $("#personnelList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-personnel-id]");
        if (!card) return;
        const id = card.dataset.personnelId;

        if (!btn) { showPersonnelDetail(id); return; }

        switch (btn.dataset.action) {
            case "edit": showPersonnelForm(id); break;
            case "delete": deletePersonnel(id); break;
        }
    });
}
