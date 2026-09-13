"use strict";

/* ============================================================
   MODULE PERSONNES
============================================================ */
const PEOPLE_PAGE_SIZE = 60;

async function loadPeopleData() {
    state.people = await PeopleRepository.list();
    // Recherche/tri précalculés une seule fois ici plutôt qu'à chaque
    // rendu : décisif dès quelques milliers de personnes.
    state.people.forEach(p => {
        p._search = normalize([p.prenom, p.nom, p.telephone, p.email, p.adresse, p.notes].join(" "));
        p._sortKey = normalize(`${p.nom} ${p.prenom}`);
    });
}

function createDefaultPerson() {
    return { id: "", prenom: "", nom: "", profileType: "paroissien", rgpd: false };
}

function isParoissien(p) {
    return (p.profileType || "paroissien") === "paroissien";
}

function personBirthLine(p) {
    if (p.dateDeces) {
        const ageAtDeath = computeAge(p.dateNaissance, p.dateDeces);
        const born = p.dateNaissance ? formatDate(p.dateNaissance) : "?";
        return `${born} – ${formatDate(p.dateDeces)}${ageAtDeath !== null ? ` · ${ageAtDeath} an${ageAtDeath > 1 ? "s" : ""}` : ""}`;
    }
    if (!p.dateNaissance) return "Date de naissance inconnue";
    const age = computeAge(p.dateNaissance);
    return `${formatDate(p.dateNaissance)}${age !== null ? " · " + age + " an" + (age > 1 ? "s" : "") : ""}`;
}

function deceasedBadge() {
    return `<span class="badge cancelled">Défunt(e)</span>`;
}

function sacramentBadge(label, done) {
    return `<span class="badge ${done ? "done" : "normal"}">${icon(done ? "check-circle" : "x-circle", "icon-inline")}${label}</span>`;
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
// Recherche générique réutilisée par les autres modules (ex. lier une
// demande à une personne) via setupAutocomplete().
function personSuggestions(query) {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return state.people
        .filter(p => normalize(`${p.prenom} ${p.nom}`).includes(q))
        .slice(0, 8);
}

function filteredPeople() {
    const query = normalize($("#peopleSearchInput").value);
    let result = query ? state.people.filter(p => p._search.includes(query)) : state.people.slice();
    if (state.peopleQuickFilter === "paroissien") result = result.filter(isParoissien);
    else if (state.peopleQuickFilter === "contact") result = result.filter(p => !isParoissien(p));
    else if (state.peopleQuickFilter === "confirmed") result = result.filter(p => isParoissien(p) && p.dateConfirmation);
    else if (state.peopleQuickFilter === "married") result = result.filter(p => isParoissien(p) && p.dateMariage);
    else if (state.peopleQuickFilter === "deceased") result = result.filter(p => p.dateDeces);
    result.sort((a, b) => (a._sortKey < b._sortKey ? -1 : a._sortKey > b._sortKey ? 1 : 0));
    return result;
}

function renderPeopleSummary() {
    let paroissiens = 0, confirmes = 0, maries = 0, defunts = 0;
    state.people.forEach(p => {
        if (p.dateDeces) defunts++;
        if (isParoissien(p)) {
            paroissiens++;
            if (p.dateConfirmation) confirmes++;
            if (p.dateMariage) maries++;
        }
    });
    $("#peopleStatTotal").textContent = state.people.length;
    $("#peopleStatParoissiens").textContent = paroissiens;
    $("#peopleStatContacts").textContent = state.people.length - paroissiens;
    $("#peopleStatConfirmes").textContent = confirmes;
    $("#peopleStatMaries").textContent = maries;
    $("#peopleStatDefunts").textContent = defunts;
}

function filterPeopleByKpi(kpi) {
    $("#peopleSearchInput").value = "";
    state.peopleQuickFilter = kpi === "all" ? null : kpi;
    state.peoplePage = 1;
    renderPeopleList();
    $("#peopleList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function profileTypeBadge(p) {
    return isParoissien(p)
        ? `<span class="badge progress">${icon("person", "icon-inline")}Paroissien</span>`
        : `<span class="badge normal">${icon("person", "icon-inline")}Contact</span>`;
}

function renderPersonCard(p) {
    return `
        <article class="person-card" data-person-id="${escapeHTML(p.id)}" role="listitem">
            <div class="avatar" aria-hidden="true">${escapeHTML(initials(`${p.prenom} ${p.nom}`))}</div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</div>
                <div class="request-contact">${escapeHTML([p.telephone, p.email].filter(Boolean).join(" · ") || "Aucun contact")}</div>
            </div>
            <div>
                <div class="request-type">${personBirthLine(p)}</div>
                <div class="request-date">${p.lieuNaissance ? "Né(e) à " + escapeHTML(p.lieuNaissance) : ""}</div>
            </div>
            <div class="badge-row">
                ${profileTypeBadge(p)}
                ${p.dateDeces ? deceasedBadge() : ""}
                ${isParoissien(p) ? sacramentBadge("Baptême", Boolean(p.dateBapteme)) : ""}
                ${isParoissien(p) ? sacramentBadge("Confirmation", Boolean(p.dateConfirmation)) : ""}
                ${isParoissien(p) && p.dateMariage ? `<span class="badge progress">${icon("cross", "icon-inline")}Marié(e)</span>` : ""}
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">${icon("edit")}</button>
                <button class="icon-btn" data-action="delete" title="Supprimer" aria-label="Supprimer">${icon("trash")}</button>
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
        $("#peoplePagination").innerHTML = "";
        return;
    }

    const { pageItems, page, totalPages } = paginate(people, state.peoplePage, PEOPLE_PAGE_SIZE);
    state.peoplePage = page;

    countEl.textContent = `${people.length} personne${people.length > 1 ? "s" : ""}`;
    container.innerHTML = pageItems.map(renderPersonCard).join("");
    $("#peoplePagination").innerHTML = paginationControlsHTML(page, totalPages);
}

/* ============================================================
   PAGES PLEIN ÉCRAN
============================================================ */
function fillPersonForm(p) {
    $("#personId").value = p.id || "";
    $("#personProfileType").value = p.profileType || "paroissien";
    $("#personPrenom").value = p.prenom || "";
    $("#personNom").value = p.nom || "";
    $("#personDateNaissance").value = p.dateNaissance || "";
    $("#personLieuNaissance").value = p.lieuNaissance || "";
    $("#personDateDeces").value = p.dateDeces || "";
    $("#personPere").value = p.pere || "";
    $("#personMere").value = p.mere || "";
    $("#personTelephone").value = p.telephone || "";
    $("#personEmail").value = p.email || "";
    $("#personAdresse").value = p.adresse || "";
    $("#personRgpd").checked = Boolean(p.rgpd);
    $("#personRegistre").value = p.registre || "";
    $("#personLieuBapteme").value = p.lieuBapteme || "";
    $("#personDiocese").value = p.diocese || "";
    $("#personAnneeBapteme").value = p.anneeBapteme || "";
    $("#personNumeroBapteme").value = p.numeroBapteme || "";
    $("#personDateBapteme").value = p.dateBapteme || "";
    $("#personParrain").value = p.parrain || "";
    $("#personMarraine").value = p.marraine || "";
    $("#personTemoin").value = p.temoin || "";
    $("#personDateCommunion").value = p.dateCommunion || "";
    $("#personLieuCommunion").value = p.lieuCommunion || "";
    $("#personDateConfirmation").value = p.dateConfirmation || "";
    $("#personLieuConfirmation").value = p.lieuConfirmation || "";
    $("#personDateMariage").value = p.dateMariage || "";
    $("#personLieuMariage").value = p.lieuMariage || "";
    $("#personConjoint").value = p.conjoint || "";
    $("#personRole").value = p.role || "";
    $("#personGroupe").value = p.groupe || "";
    $("#personNotes").value = p.notes || "";
    updateProfileTypeFields();
}

function updateProfileTypeFields() {
    const isContact = $("#personProfileType").value === "contact";
    $$("#personForm .paroissial-only").forEach(el => { el.hidden = isContact; });
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
    const profileType = $("#personProfileType").value;
    const isContact = profileType === "contact";

    const person = {
        id: id || uid(),
        profileType,
        prenom,
        nom,
        dateNaissance: $("#personDateNaissance").value,
        lieuNaissance: $("#personLieuNaissance").value.trim(),
        dateDeces: $("#personDateDeces").value,
        pere: $("#personPere").value.trim(),
        mere: $("#personMere").value.trim(),
        telephone: $("#personTelephone").value.trim(),
        email: $("#personEmail").value.trim(),
        adresse: $("#personAdresse").value.trim(),
        notes: $("#personNotes").value.trim(),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        // Un « Contact simple » ne porte aucune donnée paroissiale : on la
        // vide explicitement pour ne pas garder de valeurs cachées d'un
        // précédent profil « Paroissien ».
        rgpd: isContact ? false : $("#personRgpd").checked,
        registre: isContact ? "" : $("#personRegistre").value.trim(),
        lieuBapteme: isContact ? "" : $("#personLieuBapteme").value.trim(),
        diocese: isContact ? "" : $("#personDiocese").value.trim(),
        anneeBapteme: isContact ? "" : $("#personAnneeBapteme").value.trim(),
        numeroBapteme: isContact ? "" : $("#personNumeroBapteme").value.trim(),
        dateBapteme: isContact ? "" : $("#personDateBapteme").value,
        parrain: isContact ? "" : $("#personParrain").value.trim(),
        marraine: isContact ? "" : $("#personMarraine").value.trim(),
        temoin: isContact ? "" : $("#personTemoin").value.trim(),
        dateCommunion: isContact ? "" : $("#personDateCommunion").value,
        lieuCommunion: isContact ? "" : $("#personLieuCommunion").value.trim(),
        dateConfirmation: isContact ? "" : $("#personDateConfirmation").value,
        lieuConfirmation: isContact ? "" : $("#personLieuConfirmation").value.trim(),
        dateMariage: isContact ? "" : $("#personDateMariage").value,
        lieuMariage: isContact ? "" : $("#personLieuMariage").value.trim(),
        conjoint: isContact ? "" : $("#personConjoint").value.trim(),
        role: isContact ? "" : $("#personRole").value.trim(),
        groupe: isContact ? "" : $("#personGroupe").value.trim()
    };

    try {
        await PeopleRepository.put(person);
        await loadPeopleData();
        renderPeopleList();
        renderPeopleSummary();
        renderOverview();
        toast(existing ? "Personne modifiée." : "Personne ajoutée.", "success");
        if (e.submitter?.dataset.action === "save-and-new") showPersonForm(null);
        else showPersonDetail(person.id);
    } catch (err) {
        Logger.error("people.savePerson", err);
        toast("Impossible d'enregistrer cette personne.", "error");
    }
}

function relatedRequestsFor(p) {
    // Priorité au lien explicite (personId) posé depuis le formulaire de
    // demande ; repli sur la correspondance de nom pour les demandes plus
    // anciennes, saisies avant l'existence de ce lien.
    const key = normalize(`${p.prenom} ${p.nom}`);
    return state.requests
        .filter(r => r.personId ? r.personId === p.id : normalize(r.name) === key)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function sideField(label, value) {
    return `
        <div class="side-field">
            <dt>${escapeHTML(label)}</dt>
            <dd>${value || "—"}</dd>
        </div>
    `;
}

function quickActionBtn(kind, href, label) {
    return href
        ? `<a class="fiche-quick-btn" href="${href}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}">${icon(kind)}</a>`
        : `<span class="fiche-quick-btn disabled" aria-hidden="true">${icon(kind)}</span>`;
}

function showPersonDetail(id) {
    const p = state.people.find(x => x.id === id);
    if (!p) return;
    state.selectedPersonId = id;

    $("#personDetailTitle").textContent = `Membres › ${`${p.prenom} ${p.nom}`.trim() || "Personne"}`;
    const paroissien = isParoissien(p);

    if (!paroissien) {
        $("#personDetailBody").innerHTML = `
            <section class="panel">
                <div class="fiche-header">
                    <div class="fiche-avatar" aria-hidden="true">${escapeHTML(initials(`${p.prenom} ${p.nom}`))}</div>
                    <div class="fiche-heading">
                        <h3 class="fiche-name">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</h3>
                        <p class="fiche-meta">${personBirthLine(p)}${p.lieuNaissance ? " · né(e) à " + escapeHTML(p.lieuNaissance) : ""}</p>
                        <div class="fiche-chips">${profileTypeBadge(p)}${p.dateDeces ? deceasedBadge() : ""}</div>
                    </div>
                </div>
                <div class="fiche-section">
                    <h4 class="fiche-section-title">Coordonnées</h4>
                    <dl class="fiche-grid">
                        ${ficheField("Téléphone", escapeHTML(p.telephone))}
                        ${ficheField("E-mail", escapeHTML(p.email))}
                        ${ficheField("Adresse", escapeHTML(p.adresse), true)}
                        ${ficheField("Date de décès", p.dateDeces ? formatDate(p.dateDeces) : "")}
                        ${ficheField("Notes", escapeHTML(p.notes) || "Aucune observation.", true)}
                    </dl>
                </div>
            </section>
        `;
        $("#personDocsBtn").hidden = true;
        showPage("person-detail");
        return;
    }

    $("#personDocsBtn").hidden = false;
    updatePersonDocsMenu(p);

    const relatedRequests = relatedRequestsFor(p);

    $("#personDetailBody").innerHTML = `
        <div class="fiche-layout">
            <aside class="fiche-side panel">
                <div class="fiche-side-avatar" aria-hidden="true">${escapeHTML(initials(`${p.prenom} ${p.nom}`))}</div>
                <h3 class="fiche-side-name">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</h3>
                <p class="fiche-side-meta">${personBirthLine(p)}</p>
                <div class="fiche-side-badges">
                    ${profileTypeBadge(p)}
                    ${p.dateDeces ? deceasedBadge() : ""}
                    <span class="badge ${p.rgpd ? "done" : "normal"}">${icon(p.rgpd ? "check-circle" : "x-circle", "icon-inline")}RGPD</span>
                </div>
                <div class="fiche-side-actions">
                    ${quickActionBtn("phone", p.telephone ? `tel:${escapeHTML(p.telephone)}` : "", "Appeler")}
                    ${quickActionBtn("mail", p.email ? `mailto:${escapeHTML(p.email)}` : "", "Envoyer un e-mail")}
                </div>

                <details class="side-accordion">
                    <summary class="accordion-summary">
                        <span>Coordonnées</span>
                        ${icon("chevron-down", "accordion-chevron")}
                    </summary>
                    <dl class="accordion-body">
                        ${sideField("Téléphone", escapeHTML(p.telephone))}
                        ${sideField("E-mail", escapeHTML(p.email))}
                        ${sideField("Adresse", escapeHTML(p.adresse))}
                        ${sideField("Lieu de naissance", escapeHTML(p.lieuNaissance))}
                        ${sideField("Date de décès", p.dateDeces ? formatDate(p.dateDeces) : "")}
                    </dl>
                </details>

                <details class="side-accordion">
                    <summary class="accordion-summary">
                        <span>Sacrements</span>
                        ${icon("chevron-down", "accordion-chevron")}
                    </summary>
                    <dl class="accordion-body">
                        ${sideField("Baptême", p.dateBapteme ? formatDate(p.dateBapteme) + (p.lieuBapteme ? " · " + escapeHTML(p.lieuBapteme) : "") : "")}
                        ${sideField("Communion", p.dateCommunion ? formatDate(p.dateCommunion) + (p.lieuCommunion ? " · " + escapeHTML(p.lieuCommunion) : "") : "")}
                        ${sideField("Confirmation", p.dateConfirmation ? formatDate(p.dateConfirmation) + (p.lieuConfirmation ? " · " + escapeHTML(p.lieuConfirmation) : "") : "")}
                        ${sideField("Mariage", p.dateMariage ? formatDate(p.dateMariage) + (p.conjoint ? " · avec " + escapeHTML(p.conjoint) : "") : "")}
                    </dl>
                </details>

                <details class="side-accordion">
                    <summary class="accordion-summary">
                        <span>Foyer</span>
                        ${icon("chevron-down", "accordion-chevron")}
                    </summary>
                    <dl class="accordion-body">
                        ${sideField("Père", escapeHTML(p.pere))}
                        ${sideField("Mère", escapeHTML(p.mere))}
                    </dl>
                </details>

                <details class="side-accordion">
                    <summary class="accordion-summary">
                        <span>Groupes &amp; engagements</span>
                        ${icon("chevron-down", "accordion-chevron")}
                    </summary>
                    <dl class="accordion-body">
                        ${sideField("Rôle", escapeHTML(p.role))}
                        ${sideField("Groupe / caté", escapeHTML(p.groupe))}
                    </dl>
                </details>
            </aside>

            <div class="fiche-main panel">
                <div class="fiche-tabs" role="tablist">
                    <button type="button" class="fiche-tab active" data-tab="apercu" role="tab" aria-selected="true">Aperçu</button>
                    <button type="button" class="fiche-tab" data-tab="demandes" role="tab" aria-selected="false">Demandes liées${relatedRequests.length ? ` (${relatedRequests.length})` : ""}</button>
                    <button type="button" class="fiche-tab" data-tab="notes" role="tab" aria-selected="false">Notes</button>
                </div>

                <div class="fiche-tab-panel" data-tab-panel="apercu">
                    <div class="fiche-subsection">
                        <h5 class="fiche-subsection-title">Baptême — registre</h5>
                        <dl class="fiche-grid">
                            ${ficheField("Registre", escapeHTML(p.registre))}
                            ${ficheField("Diocèse", escapeHTML(p.diocese))}
                            ${ficheField("Année", escapeHTML(p.anneeBapteme))}
                            ${ficheField("N° baptême", escapeHTML(p.numeroBapteme))}
                            ${ficheField("Parrain", escapeHTML(p.parrain))}
                            ${ficheField("Marraine", escapeHTML(p.marraine))}
                            ${ficheField("Témoin", escapeHTML(p.temoin), true)}
                        </dl>
                    </div>
                    <div class="fiche-subsection">
                        <h5 class="fiche-subsection-title">Mariage — détail</h5>
                        <dl class="fiche-grid">
                            ${ficheField("Lieu de mariage", escapeHTML(p.lieuMariage))}
                            ${ficheField("Conjoint(e)", escapeHTML(p.conjoint), true)}
                        </dl>
                    </div>
                </div>

                <div class="fiche-tab-panel" data-tab-panel="demandes" hidden>
                    ${relatedRequests.length
                        ? `<div class="alert-list" role="list">${relatedRequests.map(r => `
                            <div class="alert-item" data-request-id="${escapeHTML(r.id)}" role="listitem">
                                <div class="alert-marker"></div>
                                <div class="alert-main">
                                    <div class="alert-name">${escapeHTML(r.type)}</div>
                                    <div class="alert-detail">${escapeHTML(r.status)} · demandée le ${formatDate(r.dateDemande)}</div>
                                </div>
                            </div>
                        `).join("")}</div>`
                        : `<div class="empty">Aucune demande liée à cette personne.</div>`}
                </div>

                <div class="fiche-tab-panel" data-tab-panel="notes" hidden>
                    <dl class="fiche-grid">
                        ${ficheField("Notes", escapeHTML(p.notes) || "Aucune observation.", true)}
                        ${ficheField("Créée le", formatDateTime(p.createdAt))}
                        ${ficheField("Modifiée le", formatDateTime(p.updatedAt))}
                    </dl>
                </div>
            </div>
        </div>
    `;

    showPage("person-detail");
}

/* ============================================================
   DOCUMENTS & CERTIFICATS
   Impression navigateur (fenêtre dédiée) plutôt qu'une librairie
   PDF : aucune dépendance, fonctionne hors-ligne, « Enregistrer en
   PDF » est proposé nativement par la boîte de dialogue d'impression.
   Référentiel CERTIFICATES : voir js/constants.js.
============================================================ */
function updatePersonDocsMenu(p) {
    $$("#personDocsMenu [data-cert]").forEach(btn => {
        const cert = CERTIFICATES[btn.dataset.cert];
        btn.disabled = !p[cert.requires];
    });
}

function certificateBody(kind, p) {
    const nom = `${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}`;
    const parish = escapeHTML(state.settings.parishName);
    const parents = (p.pere || p.mere)
        ? `<p>fils/fille de <span class="cert-field">${escapeHTML(p.pere) || "—"}</span> et de <span class="cert-field">${escapeHTML(p.mere) || "—"}</span>,</p>`
        : "";

    let details = "";
    if (kind === "bapteme") {
        details = `
            <p>né(e) le <span class="cert-field">${formatDate(p.dateNaissance)}</span>${p.lieuNaissance ? ` à <span class="cert-field">${escapeHTML(p.lieuNaissance)}</span>` : ""},</p>
            ${parents}
            <p>a été baptisé(e) le <span class="cert-field">${formatDate(p.dateBapteme)}</span>${p.lieuBapteme ? ` en l'église <span class="cert-field">${escapeHTML(p.lieuBapteme)}</span>` : ""}${p.diocese ? ` du diocèse de <span class="cert-field">${escapeHTML(p.diocese)}</span>` : ""}.</p>
            ${(p.parrain || p.marraine) ? `<p>Parrain : <span class="cert-field">${escapeHTML(p.parrain) || "—"}</span> — Marraine : <span class="cert-field">${escapeHTML(p.marraine) || "—"}</span></p>` : ""}
        `;
    } else if (kind === "communion") {
        details = `
            <p>né(e) le <span class="cert-field">${formatDate(p.dateNaissance)}</span>,</p>
            <p>a fait sa première communion le <span class="cert-field">${formatDate(p.dateCommunion)}</span>${p.lieuCommunion ? ` à <span class="cert-field">${escapeHTML(p.lieuCommunion)}</span>` : ""}.</p>
        `;
    } else if (kind === "confirmation") {
        details = `
            <p>né(e) le <span class="cert-field">${formatDate(p.dateNaissance)}</span>,</p>
            <p>a reçu le sacrement de confirmation le <span class="cert-field">${formatDate(p.dateConfirmation)}</span>${p.lieuConfirmation ? ` à <span class="cert-field">${escapeHTML(p.lieuConfirmation)}</span>` : ""}.</p>
        `;
    } else if (kind === "mariage") {
        details = `
            <p>a été uni(e) par le sacrement de mariage le <span class="cert-field">${formatDate(p.dateMariage)}</span>${p.lieuMariage ? ` à <span class="cert-field">${escapeHTML(p.lieuMariage)}</span>` : ""}${p.conjoint ? ` avec <span class="cert-field">${escapeHTML(p.conjoint)}</span>` : ""}.</p>
        `;
    }

    return `
        <div class="cert-cross">✝</div>
        <h1>${escapeHTML(CERTIFICATES[kind].label)}</h1>
        <p class="cert-sub">${parish}</p>
        <div class="cert-body">
            <p>Nous certifions que <span class="cert-field">${nom}</span>,</p>
            ${details}
        </div>
        <div class="cert-footer">
            <div>Fait le ${formatDate(todayISO())}</div>
            <div class="cert-seal">Signature et cachet paroissial</div>
        </div>
    `;
}

function openPrintWindow(title, bodyHTML) {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) {
        toast("Autorisez les fenêtres pop-up pour générer le document.", "error");
        return;
    }
    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>${escapeHTML(title)}</title>
<style>
    body { font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif; color: #2b2621; padding: 60px; max-width: 720px; margin: 0 auto; }
    h1 { text-align: center; font-size: 21px; letter-spacing: .04em; text-transform: uppercase; margin: 10px 0 4px; }
    .cert-cross { text-align: center; font-size: 30px; }
    .cert-sub { text-align: center; color: #7c7266; font-size: 13px; margin-bottom: 44px; }
    .cert-body { font-size: 15px; line-height: 2; }
    .cert-field { font-weight: 700; border-bottom: 1px solid #2b2621; padding: 0 3px; }
    .cert-footer { margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 13px; }
    .cert-seal { text-align: center; }
    @media print { body { padding: 15mm; } }
</style>
</head><body>${bodyHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
}

function generateCertificate(kind, p) {
    const cert = CERTIFICATES[kind];
    if (!cert || !p[cert.requires]) {
        toast("Cette personne n'a pas de date renseignée pour ce sacrement.", "error");
        return;
    }
    openPrintWindow(`${cert.label} — ${p.prenom} ${p.nom}`, certificateBody(kind, p));
}

// Ouvre le formulaire Intentions déjà pré-rempli avec cette personne comme
// demandeur, plutôt que de la rechercher à nouveau dans l'autocomplete.
function createIntentionForPerson(id) {
    const p = state.people.find(x => x.id === id);
    if (!p) return;
    showIntentionForm(null);
    $("#intentionDemandeur").value = `${p.prenom} ${p.nom}`.trim();
    $("#intentionPersonId").value = p.id;
    $("#intentionContact").value = p.telephone || p.email || "";
}

// Compte les demandes/intentions qui référencent cette personne (V6.2.a) :
// on n'y touche pas, on avertit seulement avant la suppression définitive.
function personLinkedRecordsWarning(p) {
    return describeLinkedRecords([
        { label: "demande", count: countByField(state.requests, "personId", p.id) },
        { label: "intention", count: countByField(state.intentions, "personId", p.id) }
    ]);
}

async function deletePerson(id) {
    const p = state.people.find(x => x.id === id);
    if (!p) return;
    const warning = personLinkedRecordsWarning(p);
    if (!window.confirm(`${warning}\n\nSupprimer définitivement la fiche de ${p.prenom} ${p.nom} ?\n\nCette action est irréversible.`)) return;

    try {
        await PeopleRepository.remove(id);
        await loadPeopleData();
        renderPeopleList();
        renderPeopleSummary();
        renderOverview();
        toast("Personne supprimée.", "success");
        showPage("people");
    } catch (err) {
        Logger.error("people.deletePerson", err);
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
    datedeces: "dateDeces",
    datededeces: "dateDeces",
    deces: "dateDeces",
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

const CSV_DATE_FIELDS = ["dateNaissance", "dateDeces", "dateBapteme", "dateConfirmation", "dateMariage"];

async function importPeopleCSV(file) {
    if (!file) return;
    try {
        const text = await file.text();
        const rows = parseCSV(text);
        if (rows.length < 2) throw new ValidationError("Le fichier ne contient aucune ligne de données.");

        const fieldKeys = rows[0].map(h => CSV_FIELD_MAP[normalizeHeaderKey(h)] || null);
        if (!fieldKeys.some(Boolean)) throw new ValidationError("Aucune colonne reconnue dans l'en-tête du fichier.");

        const now = nowISO();
        const skippedLines = [];
        const dateWarnings = [];
        const toInsert = [];

        for (let i = 1; i < rows.length; i++) {
            const line = i + 1; // ligne 1 = en-tête
            const cols = rows[i];
            const person = { id: uid(), prenom: "", nom: "" };

            fieldKeys.forEach((key, idx) => {
                if (!key) return;
                const raw = (cols[idx] || "").trim();
                if (!raw) return;
                if (CSV_DATE_FIELDS.includes(key)) {
                    const parsed = parseFrenchDate(raw);
                    if (!parsed) dateWarnings.push({ line, field: key, value: raw });
                    person[key] = parsed;
                } else {
                    person[key] = raw;
                }
            });

            if (!person.prenom && !person.nom) {
                skippedLines.push({ line, reason: "Prénom ou nom manquant" });
                continue;
            }

            person.createdAt = now;
            person.updatedAt = now;
            toInsert.push(person);
        }

        // Une seule transaction groupée plutôt qu'un aller-retour IndexedDB
        // par ligne : indispensable pour des fichiers de plusieurs milliers
        // de personnes (un put() individuel par ligne serait très long).
        if (toInsert.length) await PeopleRepository.bulkPut(toInsert);

        state.peoplePage = 1;
        await loadPeopleData();
        renderPeopleList();
        renderPeopleSummary();
        renderOverview();
        toast(`${toInsert.length} personne(s) importée(s)${skippedLines.length ? ` · ${skippedLines.length} ligne(s) ignorée(s)` : ""}.`, "success");
        renderImportReport({
            importedCount: toInsert.length,
            label: "personne(s)",
            skipped: skippedLines,
            warnings: dateWarnings
        });
    } catch (err) {
        Logger.error("people.importPeopleCSV", err);
        toast("Import CSV impossible : " + err.message, "error");
        renderImportReport({ error: err.message });
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
    $("#personNewIntentionBtn").addEventListener("click", () => state.selectedPersonId && createIntentionForPerson(state.selectedPersonId));

    $("#personDetailBody").addEventListener("click", e => {
        const tab = e.target.closest(".fiche-tab");
        if (tab) {
            $$("#personDetailBody .fiche-tab").forEach(t => {
                const active = t === tab;
                t.classList.toggle("active", active);
                t.setAttribute("aria-selected", String(active));
            });
            $$("#personDetailBody .fiche-tab-panel").forEach(panel => {
                panel.hidden = panel.dataset.tabPanel !== tab.dataset.tab;
            });
            return;
        }

        const item = e.target.closest("[data-request-id]");
        if (item) showRequestDetail(item.dataset.requestId);
    });

    $("#personProfileType").addEventListener("change", updateProfileTypeFields);

    $("#personDocsBtn").addEventListener("click", e => {
        e.stopPropagation();
        $("#personDocsMenu").hidden = !$("#personDocsMenu").hidden;
    });
    document.addEventListener("click", () => { $("#personDocsMenu").hidden = true; });
    $("#personDocsMenu").addEventListener("click", e => {
        const btn = e.target.closest("[data-cert]");
        if (!btn || btn.disabled) return;
        $("#personDocsMenu").hidden = true;
        const p = state.people.find(x => x.id === state.selectedPersonId);
        if (p) generateCertificate(btn.dataset.cert, p);
    });

    $("#peopleKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) filterPeopleByKpi(btn.dataset.kpi);
    });

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

    const debouncedPeopleRender = debounce(() => { state.peoplePage = 1; renderPeopleList(); }, 200);
    $("#peopleSearchInput").addEventListener("input", debouncedPeopleRender);

    $("#peoplePagination").addEventListener("click", e => {
        const btn = e.target.closest("[data-page-nav]");
        if (!btn || btn.disabled) return;
        state.peoplePage += btn.dataset.pageNav === "next" ? 1 : -1;
        renderPeopleList();
        $("#peopleList").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("#importPeopleCsvBtn").addEventListener("click", () => {
        $("#importPeopleCsvFile").value = "";
        $("#importPeopleCsvFile").click();
    });
    $("#importPeopleCsvFile").addEventListener("change", e => importPeopleCSV(e.target.files[0]));
}
