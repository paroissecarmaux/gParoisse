"use strict";

/* ============================================================
   MODULE INTENTIONS DE MESSE
   Une intention peut porter sur une messe unique (défunt,
   anniversaire, action de grâce…) ou sur une neuvaine : 9 messes
   consécutives à partir de dateDebut (nombreMesses = 9). Se lie aux
   Personnes (demandeur), au Personnel (célébrant) et aux Clochers
   (lieu) plutôt que de ressaisir ces informations en texte libre.
============================================================ */
async function loadIntentionsData() {
    state.intentions = await IntentionsRepository.listActive();
    state.intentionsTrash = await IntentionsRepository.listDeleted();
}

function renderIntentionFormOptions() {
    $("#intentionType").innerHTML = INTENTION_TYPES
        .map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
    $("#intentionStatut").innerHTML = INTENTION_STATUS
        .map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
}

function createDefaultIntention() {
    const now = nowISO();
    return {
        id: uid(),
        type: INTENTION_TYPES[0],
        intitule: "",
        personId: "",
        contact: "",
        dateDebut: todayISO(),
        nombreMesses: 1,
        heure: "",
        clocherId: "",
        personnelId: "",
        offrande: "",
        statut: INTENTION_STATUS[0],
        notes: "",
        createdAt: now,
        updatedAt: now
    };
}

/* --- Dates couvertes par l'intention (utile pour la neuvaine) --- */
function intentionEndDate(i) {
    const n = Math.max(1, Number(i.nombreMesses) || 1);
    return n > 1 ? addDays(i.dateDebut, n - 1) : i.dateDebut;
}

function describeIntentionDates(i) {
    const n = Math.max(1, Number(i.nombreMesses) || 1);
    if (n <= 1) return formatDate(i.dateDebut);
    return `Du ${formatDate(i.dateDebut)} au ${formatDate(intentionEndDate(i))} (${n} messes)`;
}

// Utilisée par l'Agenda et le Tableau de bord pour savoir si cette
// intention concerne une date donnée (une neuvaine couvre plusieurs jours).
function intentionOccursOn(i, iso) {
    if (i.statut === "Annulée") return false;
    return iso >= i.dateDebut && iso <= intentionEndDate(i);
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
function sortedIntentions() {
    return state.intentions.slice().sort((a, b) => String(a.dateDebut).localeCompare(String(b.dateDebut)));
}

function filteredIntentions() {
    let items = sortedIntentions();
    if (state.intentionQuickFilter === "Neuvaine") items = items.filter(i => i.type === "Neuvaine");
    else if (state.intentionQuickFilter) items = items.filter(i => i.statut === state.intentionQuickFilter);
    return items;
}

function renderIntentionsSummary() {
    $("#intentionStatTotal").textContent = state.intentions.length;
    $("#intentionStatACelebrer").textContent = state.intentions.filter(i => i.statut === "À célébrer").length;
    $("#intentionStatCelebree").textContent = state.intentions.filter(i => i.statut === "Célébrée").length;
    $("#intentionStatNeuvaine").textContent = state.intentions.filter(i => i.type === "Neuvaine").length;
}

function filterIntentionsByKpi(kpi) {
    state.intentionQuickFilter = kpi === "all" ? null : kpi;
    renderIntentionsList();
    $("#intentionList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function intentionStatusClass(statut) {
    return ({ "À célébrer": "pending", "Célébrée": "done", "Annulée": "cancelled" })[statut] || "normal";
}

function renderIntentionCard(i) {
    const celebrant = i.personnelId ? state.personnel.find(p => p.id === i.personnelId) : null;
    const clocher = i.clocherId ? state.clochers.find(c => c.id === i.clocherId) : null;

    return `
        <article class="request-card" data-intention-id="${escapeHTML(i.id)}" role="listitem">
            <div class="avatar" aria-hidden="true"><svg class="icon"><use href="#i-candle"></use></svg></div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(i.intitule || i.type)}</div>
                <div class="request-contact">${escapeHTML([celebrant ? `${celebrant.prenom} ${celebrant.nom}` : "", clocher ? clocher.nom : ""].filter(Boolean).join(" · ") || "Célébrant et lieu non renseignés")}</div>
            </div>
            <div>
                <div class="request-type">${escapeHTML(i.type)}</div>
                <div class="request-date">${describeIntentionDates(i)}</div>
            </div>
            <div class="badge-row">
                <span class="badge ${intentionStatusClass(i.statut)}">${escapeHTML(i.statut)}</span>
                ${i.type === "Neuvaine" ? `<span class="badge progress">Neuvaine</span>` : ""}
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">${icon("edit")}</button>
                <button class="icon-btn" data-action="delete" title="Mettre à la corbeille" aria-label="Mettre à la corbeille">${icon("trash")}</button>
            </div>
        </article>
    `;
}

function renderIntentionsList() {
    const container = $("#intentionList");
    const items = filteredIntentions();
    const countEl = $("#intentionResultCount");

    if (!items.length) {
        countEl.textContent = "";
        container.innerHTML = `<div class="empty">${state.intentions.length ? "Aucune intention ne correspond à ce filtre." : "Aucune intention de messe enregistrée."}</div>`;
        return;
    }

    countEl.textContent = `${items.length} intention${items.length > 1 ? "s" : ""}`;
    container.innerHTML = items.map(renderIntentionCard).join("");
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
function fillIntentionForm(i) {
    $("#intentionId").value = i.id || "";
    $("#intentionType").value = i.type || INTENTION_TYPES[0];
    $("#intentionIntitule").value = i.intitule || "";
    $("#intentionDemandeur").value = "";
    $("#intentionPersonId").value = i.personId || "";
    if (i.personId) {
        const person = state.people.find(p => p.id === i.personId);
        if (person) $("#intentionDemandeur").value = `${person.prenom} ${person.nom}`.trim();
    }
    $("#demandeurAutocompleteMenu").hidden = true;
    $("#intentionContact").value = i.contact || "";
    $("#intentionDateDebut").value = i.dateDebut || todayISO();
    $("#intentionNombreMesses").value = i.nombreMesses || 1;
    $("#intentionHeure").value = i.heure || "";
    $("#intentionLieu").value = "";
    $("#intentionClocherId").value = i.clocherId || "";
    if (i.clocherId) {
        const clocher = state.clochers.find(c => c.id === i.clocherId);
        if (clocher) $("#intentionLieu").value = clocher.nom;
    }
    $("#intentionLieuAutocompleteMenu").hidden = true;
    $("#intentionCelebrant").value = "";
    $("#intentionPersonnelId").value = i.personnelId || "";
    if (i.personnelId) {
        const celebrant = state.personnel.find(p => p.id === i.personnelId);
        if (celebrant) $("#intentionCelebrant").value = `${celebrant.prenom} ${celebrant.nom}`.trim();
    }
    $("#celebrantAutocompleteMenu").hidden = true;
    $("#intentionOffrande").value = i.offrande || "";
    $("#intentionStatut").value = i.statut || INTENTION_STATUS[0];
    $("#intentionNotes").value = i.notes || "";
}

function showIntentionForm(id) {
    const existing = id ? state.intentions.find(x => x.id === id) : null;
    state.intentionFormMode = existing ? "edit" : "new";
    fillIntentionForm(existing || createDefaultIntention());
    $("#intentionFormTitle").textContent = existing ? "Modifier l'intention" : "Nouvelle intention de messe";
    showPage("intention-form");
    setTimeout(() => $("#intentionIntitule").focus(), 50);
}

async function saveIntention(e) {
    e.preventDefault();
    const intitule = $("#intentionIntitule").value.trim();
    if (!intitule) {
        toast("L'intitulé de l'intention est obligatoire.", "error");
        $("#intentionIntitule").focus();
        return;
    }

    const id = $("#intentionId").value.trim();
    const existing = state.intentions.find(i => i.id === id);
    const now = nowISO();

    const intention = {
        id: id || uid(),
        type: $("#intentionType").value,
        intitule,
        personId: $("#intentionPersonId").value.trim(),
        contact: $("#intentionContact").value.trim(),
        dateDebut: $("#intentionDateDebut").value || todayISO(),
        nombreMesses: Math.max(1, Number($("#intentionNombreMesses").value) || 1),
        heure: $("#intentionHeure").value.trim(),
        clocherId: $("#intentionClocherId").value.trim(),
        personnelId: $("#intentionPersonnelId").value.trim(),
        offrande: $("#intentionOffrande").value.trim(),
        statut: $("#intentionStatut").value,
        notes: $("#intentionNotes").value.trim(),
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    try {
        await IntentionsRepository.put(intention);
        await addHistory("intention", intention.id, existing ? "update" : "create", existing ? "Intention modifiée" : "Intention créée");
        await loadIntentionsData();
        renderIntentionsList();
        renderIntentionsSummary();
        renderOverview();
        renderAgenda();
        toast(existing ? "Intention modifiée." : "Intention ajoutée.", "success");
        if (e.submitter?.dataset.action === "save-and-new") showIntentionForm(null);
        else showIntentionDetail(intention.id);
    } catch (err) {
        Logger.error("intentions.saveIntention", err);
        toast("Impossible d'enregistrer cette intention.", "error");
    }
}

function showIntentionDetail(id) {
    const i = state.intentions.find(x => x.id === id);
    if (!i) return;
    state.selectedIntentionId = id;

    const personLink = findLinked(state.people, state.peopleTrash, i.personId);
    const clocherLink = findLinked(state.clochers, state.clochersTrash, i.clocherId);
    const celebrantLink = findLinked(state.personnel, state.personnelTrash, i.personnelId);

    $("#intentionDetailTitle").textContent = `Intentions › ${i.intitule || i.type}`;

    $("#intentionDetailBody").innerHTML = `
        <div class="fiche-header">
            <div class="fiche-avatar" aria-hidden="true"><svg class="icon"><use href="#i-candle"></use></svg></div>
            <div class="fiche-heading">
                <h3 class="fiche-name">${escapeHTML(i.intitule || i.type)}</h3>
                <p class="fiche-meta">${escapeHTML(i.type)} · ${describeIntentionDates(i)}</p>
                <div class="fiche-chips">
                    <span class="badge ${intentionStatusClass(i.statut)}">${escapeHTML(i.statut)}</span>
                    ${i.type === "Neuvaine" ? `<span class="badge progress">Neuvaine</span>` : ""}
                </div>
            </div>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Célébration</h4>
            <dl class="fiche-grid">
                ${ficheField("Dates", describeIntentionDates(i))}
                ${ficheField("Heure", escapeHTML(i.heure))}
                ${ficheField("Lieu", clocherLink.status !== "none"
                    ? linkedRecordFieldHTML(clocherLink, "data-goto-clocher", c => `${icon("church", "icon-inline")}${escapeHTML(c.nom)}`)
                    : "")}
                ${ficheField("Célébrant", celebrantLink.status !== "none"
                    ? linkedRecordFieldHTML(celebrantLink, "data-goto-personnel", p => `${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}`)
                    : "")}
                ${ficheField("Offrande", escapeHTML(i.offrande))}
            </dl>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Demandeur</h4>
            <dl class="fiche-grid">
                ${ficheField("Personne liée", linkedRecordFieldHTML(personLink, "data-goto-person", p => `${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}`))}
                ${ficheField("Contact", escapeHTML(i.contact))}
            </dl>
        </div>
        <div class="fiche-section">
            <h4 class="fiche-section-title">Notes</h4>
            <dl class="fiche-grid">
                ${ficheField("Notes", escapeHTML(i.notes) || "Aucune note.", true)}
            </dl>
        </div>
        ${historySectionHTML("intention", id)}
    `;

    $("#intentionDetailToggleBtn").innerHTML = i.statut === "Célébrée"
        ? `${icon("restore")} Remettre à célébrer`
        : `${icon("check")} Marquer célébrée`;
    showPage("intention-detail");
}

async function toggleIntentionStatus(id) {
    const i = state.intentions.find(x => x.id === id);
    if (!i) return;
    i.statut = i.statut === "Célébrée" ? "À célébrer" : "Célébrée";
    i.updatedAt = nowISO();
    await IntentionsRepository.put(i);
    await addHistory("intention", id, i.statut === "Célébrée" ? "complete" : "update", i.statut === "Célébrée" ? "Marquée célébrée" : "Remise à célébrer");
    await loadIntentionsData();
    renderIntentionsList();
    renderIntentionsSummary();
    renderOverview();
    renderAgenda();
    showIntentionDetail(id);
    toast(i.statut === "Célébrée" ? "Intention marquée célébrée." : "Intention remise à célébrer.", "success");
}

/* ============================================================
   CORBEILLE (V6.2.c) — même principe que js/requests.js.
============================================================ */
async function trashIntention(id) {
    const i = state.intentions.find(x => x.id === id);
    if (!i) return;
    if (!window.confirm(`Mettre à la corbeille l'intention « ${i.intitule || i.type} » ?\n\nElle pourra être restaurée depuis la Corbeille.`)) return;

    try {
        i.deletedAt = nowISO();
        i.updatedAt = nowISO();
        await IntentionsRepository.put(i);
        await addHistory("intention", id, "trash", "Intention mise à la corbeille");
        await loadIntentionsData();
        renderIntentionsList();
        renderIntentionsSummary();
        renderOverview();
        renderAgenda();
        renderTrash();
        toast("Intention mise à la corbeille.", "success");
        showPage("intentions");
    } catch (err) {
        Logger.error("intentions.trashIntention", err);
        toast("Impossible de mettre cette intention à la corbeille.", "error");
    }
}

async function restoreIntention(id) {
    const i = state.intentionsTrash.find(x => x.id === id);
    if (!i) return;

    try {
        i.deletedAt = null;
        i.updatedAt = nowISO();
        await IntentionsRepository.put(i);
        await addHistory("intention", id, "restore", "Intention restaurée depuis la corbeille");
        await loadIntentionsData();
        renderIntentionsList();
        renderIntentionsSummary();
        renderOverview();
        renderAgenda();
        renderTrash();
        toast("Intention restaurée.", "success");
    } catch (err) {
        Logger.error("intentions.restoreIntention", err);
        toast("Impossible de restaurer cette intention.", "error");
    }
}

async function purgeIntention(id) {
    const i = state.intentionsTrash.find(x => x.id === id);
    if (!i) return;
    if (!window.confirm(`Supprimer définitivement l'intention « ${i.intitule || i.type} » ?\n\nCette action est IRRÉVERSIBLE : la fiche ne pourra plus être restaurée.`)) return;

    try {
        await IntentionsRepository.remove(id);
        await addHistory("intention", id, "purge", "Intention supprimée définitivement");
        await loadIntentionsData();
        renderIntentionsList();
        renderIntentionsSummary();
        renderOverview();
        renderAgenda();
        renderTrash();
        toast("Intention supprimée définitivement.", "success");
    } catch (err) {
        Logger.error("intentions.purgeIntention", err);
        toast("Impossible de supprimer définitivement cette intention.", "error");
    }
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initIntentionsEvents() {
    $("#newIntentionBtn").addEventListener("click", () => showIntentionForm(null));
    $("#intentionForm").addEventListener("submit", saveIntention);
    $("#intentionFormBackBtn").addEventListener("click", goBack);
    $("#intentionFormCancelBtn").addEventListener("click", goBack);

    // Passer en « Neuvaine » propose directement 9 messes (modifiable).
    $("#intentionType").addEventListener("change", () => {
        if ($("#intentionType").value === "Neuvaine" && Number($("#intentionNombreMesses").value) <= 1) {
            $("#intentionNombreMesses").value = 9;
        }
    });

    $("#intentionDemandeur").addEventListener("input", () => { $("#intentionPersonId").value = ""; });
    setupAutocomplete($("#intentionDemandeur"), $("#demandeurAutocompleteMenu"), {
        search: personSuggestions,
        renderLabel: personSuggestionLabel,
        onSelect: person => {
            $("#intentionDemandeur").value = `${person.prenom} ${person.nom}`.trim();
            $("#intentionPersonId").value = person.id;
            if (!$("#intentionContact").value.trim()) $("#intentionContact").value = person.telephone || person.email || "";
        }
    });

    $("#intentionLieu").addEventListener("input", () => { $("#intentionClocherId").value = ""; });
    setupAutocomplete($("#intentionLieu"), $("#intentionLieuAutocompleteMenu"), {
        search: clocherSuggestions,
        renderLabel: clocherSuggestionLabel,
        onSelect: c => { $("#intentionLieu").value = c.nom; $("#intentionClocherId").value = c.id; }
    });

    $("#intentionCelebrant").addEventListener("input", () => { $("#intentionPersonnelId").value = ""; });
    setupAutocomplete($("#intentionCelebrant"), $("#celebrantAutocompleteMenu"), {
        search: personnelSuggestions,
        renderLabel: personnelSuggestionLabel,
        onSelect: p => { $("#intentionCelebrant").value = `${p.prenom} ${p.nom}`.trim(); $("#intentionPersonnelId").value = p.id; }
    });

    $("#intentionKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) filterIntentionsByKpi(btn.dataset.kpi);
    });

    $("#intentionDetailBackBtn").addEventListener("click", goBack);
    $("#intentionEditBtn").addEventListener("click", () => state.selectedIntentionId && showIntentionForm(state.selectedIntentionId));
    $("#intentionDetailToggleBtn").addEventListener("click", () => state.selectedIntentionId && toggleIntentionStatus(state.selectedIntentionId));
    $("#intentionDeleteBtn").addEventListener("click", () => state.selectedIntentionId && trashIntention(state.selectedIntentionId));

    $("#intentionDetailBody").addEventListener("click", e => {
        const personBtn = e.target.closest("[data-goto-person]");
        if (personBtn) { showPersonDetail(personBtn.dataset.gotoPerson); return; }
        const clocherBtn = e.target.closest("[data-goto-clocher]");
        if (clocherBtn) { showClocherDetail(clocherBtn.dataset.gotoClocher); return; }
        const personnelBtn = e.target.closest("[data-goto-personnel]");
        if (personnelBtn) showPersonnelDetail(personnelBtn.dataset.gotoPersonnel);
    });

    $("#intentionList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-intention-id]");
        if (!card) return;
        const id = card.dataset.intentionId;

        if (!btn) { showIntentionDetail(id); return; }

        switch (btn.dataset.action) {
            case "edit": showIntentionForm(id); break;
            case "delete": trashIntention(id); break;
        }
    });
}
