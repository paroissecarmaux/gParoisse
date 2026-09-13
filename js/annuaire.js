"use strict";

/* ============================================================
   MODULE ANNUAIRE (V6.8.b)
   Interface de la table `directory` (fondations posées en V6.8.a,
   js/core/directory.js). Coexiste avec js/people.js/js/personnel.js,
   qui restent les écrans actifs pour leurs propres tables — aucune
   référence croisée (requests.personId, intentions.personId/
   personnelId), aucun diagnostic, aucune recherche globale, aucun
   import/export n'est basculé ici : voir docs/V6.8-B-ANNUAIRE-INTERFACE.md
   pour le périmètre exact et ce qui reste réservé à V6.8.c.
============================================================ */
const ANNUAIRE_PAGE_SIZE = 60;

// Libellés d'affichage uniquement — DIRECTORY_ROLE_TYPES (js/constants.js)
// reste la liste de référence du vocabulaire.
const ROLE_LABELS = {
    registre: "Registre",
    clerge: "Clergé",
    salarie: "Salarié",
    benevole: "Bénévole",
    contact: "Contact",
    fournisseur: "Fournisseur",
    association: "Association"
};

const ROLE_STAT_IDS = {
    registre: "annuaireStatRegistre",
    clerge: "annuaireStatClerge",
    salarie: "annuaireStatSalarie",
    benevole: "annuaireStatBenevole",
    contact: "annuaireStatContact",
    fournisseur: "annuaireStatFournisseur",
    association: "annuaireStatAssociation"
};

// Champs propres à chaque rôle (V6.7 §5.5) — noms de propriétés repris
// tels quels de la conception, jamais réinventés. `contact` n'a aucun
// champ propre. `affectation` (clergé) et `contactPersonId`
// (association) restent de simples champs texte dans cette sous-phase
// (pas de sélecteur lié type findLinked()) : une intégration plus
// riche relèverait de V6.8.c, pas nécessaire pour rendre l'Annuaire
// utilisable dès maintenant.
const ROLE_FIELD_DEFS = {
    registre: [
        { key: "rgpd", label: "Consentement RGPD obtenu", type: "checkbox" },
        { key: "registre", label: "Registre", type: "text" },
        { key: "lieuBapteme", label: "Lieu de baptême", type: "text" },
        { key: "diocese", label: "Diocèse", type: "text" },
        { key: "anneeBapteme", label: "Année de baptême", type: "text" },
        { key: "numeroBapteme", label: "N° baptême", type: "text" },
        { key: "dateBapteme", label: "Date de baptême", type: "date" },
        { key: "parrain", label: "Parrain", type: "text" },
        { key: "marraine", label: "Marraine", type: "text" },
        { key: "temoin", label: "Témoin", type: "text" },
        { key: "dateCommunion", label: "Date de première communion", type: "date" },
        { key: "lieuCommunion", label: "Lieu de première communion", type: "text" },
        { key: "dateConfirmation", label: "Date de confirmation", type: "date" },
        { key: "lieuConfirmation", label: "Lieu de confirmation", type: "text" },
        { key: "dateMariage", label: "Date de mariage", type: "date" },
        { key: "lieuMariage", label: "Lieu de mariage", type: "text" },
        { key: "conjoint", label: "Conjoint(e)", type: "text" }
    ],
    clerge: [
        { key: "etatCanonique", label: "État canonique", type: "select", options: ["Prêtre", "Diacre", "Religieux(se)"] },
        { key: "affectation", label: "Affectation (clocher)", type: "text" },
        { key: "diocese", label: "Diocèse", type: "text" },
        { key: "dateDebut", label: "Date de début", type: "date" },
        { key: "dateFin", label: "Date de fin", type: "date" }
    ],
    salarie: [
        { key: "fonction", label: "Fonction", type: "text" },
        { key: "service", label: "Service", type: "text" },
        { key: "dateDebut", label: "Date de début", type: "date" },
        { key: "dateFin", label: "Date de fin", type: "date" }
    ],
    benevole: [
        { key: "domaine", label: "Domaine", type: "text" },
        { key: "dateDebut", label: "Date de début", type: "date" },
        { key: "dateFin", label: "Date de fin", type: "date" }
    ],
    contact: [],
    fournisseur: [
        { key: "categorie", label: "Catégorie", type: "text" },
        { key: "notes", label: "Notes", type: "text" }
    ],
    association: [
        { key: "categorie", label: "Catégorie", type: "text" },
        { key: "contactPersonId", label: "Personne référente (ID)", type: "text" }
    ]
};

function roleLabel(role) {
    if (role.type === "clerge" && role.etatCanonique) return `Clergé — ${role.etatCanonique}`;
    return ROLE_LABELS[role.type] || role.type;
}

/* ============================================================
   FILTRAGE & RENDU LISTE
============================================================ */
function filteredDirectory() {
    const query = normalize($("#annuaireSearchInput").value);
    let result = state.directory.filter(e =>
        directoryMatchesQuery(e, query) && directoryMatchesRoleFilter(e, state.directoryQuickFilter)
    );
    return sortByKey(result, e => normalize(`${e.nom} ${e.prenom}`));
}

function renderDirectorySummary() {
    $("#annuaireStatTotal").textContent = state.directory.length;
    DIRECTORY_ROLE_TYPES.forEach(roleType => {
        const id = ROLE_STAT_IDS[roleType];
        if (id && $(`#${id}`)) $(`#${id}`).textContent = state.directory.filter(e => hasRole(e, roleType)).length;
    });
    if ($("#annuaireStatNoRole")) $("#annuaireStatNoRole").textContent = state.directory.filter(hasNoRole).length;
}

function filterDirectoryByKpi(role) {
    $("#annuaireSearchInput").value = "";
    state.directoryQuickFilter = role === "all" ? null : role;
    state.directoryPage = 1;
    renderDirectoryList();
    $("#annuaireList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDirectoryCard(entry) {
    const activeRoles = DIRECTORY_ROLE_TYPES.filter(t => hasRole(entry, t));
    return `
        <article class="person-card" data-directory-id="${escapeHTML(entry.id)}" role="listitem">
            <div class="avatar" aria-hidden="true">${escapeHTML(initials(directoryDisplayName(entry)))}</div>
            <div class="request-person">
                <div class="request-name">${escapeHTML(directoryDisplayName(entry))}</div>
                <div class="request-contact">${escapeHTML([entry.telephone, entry.email].filter(Boolean).join(" · ") || "Aucun contact")}</div>
            </div>
            <div>
                <div class="request-type">${escapeHTML(entry.adresse || "")}</div>
            </div>
            <div class="badge-row">
                ${activeRoles.map(t => `<span class="badge progress">${escapeHTML(ROLE_LABELS[t] || t)}</span>`).join("")}
                ${hasNoRole(entry) ? `<span class="badge urgent">${icon("alert-triangle", "icon-inline")}Rôle à déterminer</span>` : ""}
            </div>
            <div class="request-actions">
                <button class="icon-btn" data-action="edit" title="Modifier" aria-label="Modifier">${icon("edit")}</button>
                <button class="icon-btn" data-action="delete" title="Mettre à la corbeille" aria-label="Mettre à la corbeille">${icon("trash")}</button>
            </div>
        </article>
    `;
}

function renderDirectoryList() {
    const container = $("#annuaireList");
    const entries = filteredDirectory();
    const countEl = $("#annuaireResultCount");

    if (!entries.length) {
        countEl.textContent = "";
        container.innerHTML = `<div class="empty">${state.directory.length ? "Aucune entrée ne correspond à la recherche." : "Aucune entrée dans l'annuaire. Ajoutez-en une avec « Nouvelle personne »."}</div>`;
        $("#annuairePagination").innerHTML = "";
        return;
    }

    const { pageItems, page, totalPages } = paginate(entries, state.directoryPage, ANNUAIRE_PAGE_SIZE);
    state.directoryPage = page;

    countEl.textContent = `${entries.length} entrée${entries.length > 1 ? "s" : ""}`;
    container.innerHTML = pageItems.map(renderDirectoryCard).join("");
    $("#annuairePagination").innerHTML = paginationControlsHTML(page, totalPages);
}

/* ============================================================
   FORMULAIRE IDENTITÉ (création/modification — ne touche jamais roles)
============================================================ */
function fillDirectoryForm(entry) {
    $("#directoryId").value = entry.id || "";
    $("#directoryPrenom").value = entry.prenom || "";
    $("#directoryNom").value = entry.nom || "";
    $("#directoryDateNaissance").value = entry.dateNaissance || "";
    $("#directoryLieuNaissance").value = entry.lieuNaissance || "";
    $("#directoryDateDeces").value = entry.dateDeces || "";
    $("#directoryPere").value = entry.pere || "";
    $("#directoryMere").value = entry.mere || "";
    $("#directoryTelephone").value = entry.telephone || "";
    $("#directoryEmail").value = entry.email || "";
    $("#directoryAdresse").value = entry.adresse || "";
    $("#directoryNotes").value = entry.notes || "";
}

function showDirectoryForm(id) {
    const existing = id ? state.directory.find(x => x.id === id) : null;
    state.directoryFormMode = existing ? "edit" : "new";
    fillDirectoryForm(existing || createDefaultDirectoryEntry("person"));
    $("#annuaireFormTitle").textContent = existing ? "Modifier l'identité" : "Nouvelle personne";
    showPage("annuaire-form");
    setTimeout(() => $("#directoryPrenom").focus(), 50);
}

async function saveDirectoryEntry(e) {
    e.preventDefault();
    const prenom = $("#directoryPrenom").value.trim();
    const nom = $("#directoryNom").value.trim();
    if (!prenom && !nom) {
        toast("Le prénom ou le nom est obligatoire.", "error");
        return;
    }

    const id = $("#directoryId").value.trim();
    const existing = state.directory.find(x => x.id === id);
    const identityFields = {
        prenom, nom,
        dateNaissance: $("#directoryDateNaissance").value,
        lieuNaissance: $("#directoryLieuNaissance").value.trim(),
        dateDeces: $("#directoryDateDeces").value,
        pere: $("#directoryPere").value.trim(),
        mere: $("#directoryMere").value.trim(),
        telephone: $("#directoryTelephone").value.trim(),
        email: $("#directoryEmail").value.trim(),
        adresse: $("#directoryAdresse").value.trim(),
        notes: $("#directoryNotes").value.trim()
    };

    // existing : conserve roles/entityType/deletedAt tels quels (jamais
    // recréé). Nouveau : createDefaultDirectoryEntry() pose roles: []
    // — jamais de rôle ajouté automatiquement (V6.8.b §9).
    const entry = existing
        ? updateDirectoryIdentity(existing, identityFields)
        : { ...createDefaultDirectoryEntry("person"), ...identityFields, id: id || uid() };

    await withSubmitLock(e.target, async () => {
        try {
            await withHistoryTx([db.directory], async () => {
                await DirectoryRepository.put(entry);
                await addHistory("directory", entry.id, existing ? "update" : "create", existing ? "Identité modifiée" : "Identité créée");
            });
            await loadDirectoryData();
            renderDirectoryList();
            renderDirectorySummary();
            toast(existing ? "Identité modifiée." : "Personne ajoutée.", "success");
            if (e.submitter?.dataset.action === "save-and-new") showDirectoryForm(null);
            else showDirectoryDetail(entry.id);
        } catch (err) {
            Logger.error("annuaire.saveDirectoryEntry", err);
            toast("Impossible d'enregistrer cette entrée.", "error");
        }
    });
}

/* ============================================================
   FICHE DÉTAIL — identité + rôles + historique
============================================================ */
function roleFieldInputHTML(field, value) {
    if (field.type === "checkbox") {
        return `
            <label class="checkbox-label" for="roleField_${field.key}">
                <input type="checkbox" id="roleField_${field.key}" ${value ? "checked" : ""}>
                ${escapeHTML(field.label)}
            </label>
        `;
    }
    if (field.type === "select") {
        return `
            <div class="field">
                <label for="roleField_${field.key}">${escapeHTML(field.label)}</label>
                <select id="roleField_${field.key}">
                    ${field.options.map(o => `<option value="${escapeHTML(o)}" ${value === o ? "selected" : ""}>${escapeHTML(o)}</option>`).join("")}
                </select>
            </div>
        `;
    }
    return `
        <div class="field">
            <label for="roleField_${field.key}">${escapeHTML(field.label)}</label>
            <input id="roleField_${field.key}" type="${field.type === "date" ? "date" : "text"}" value="${escapeHTML(value || "")}">
        </div>
    `;
}

function renderRoleCard(role, index) {
    const fields = ROLE_FIELD_DEFS[role.type] || [];
    const fieldRows = fields
        .filter(f => role[f.key] !== undefined && role[f.key] !== "" && role[f.key] !== false)
        .map(f => ficheField(f.label, f.type === "checkbox" ? "Oui" : escapeHTML(String(role[f.key]))))
        .join("");

    return `
        <div class="fiche-section" data-role-index="${index}">
            <h4 class="fiche-section-title">
                ${escapeHTML(roleLabel(role))}
                ${role.active === false ? `<span class="badge cancelled">Inactif</span>` : `<span class="badge done">${icon("check-circle", "icon-inline")}Actif</span>`}
            </h4>
            <dl class="fiche-grid">${fieldRows || `<div class="empty">Aucune information complémentaire.</div>`}</dl>
            <div class="request-actions">
                <button type="button" class="btn" data-role-action="edit" data-role-index="${index}">${icon("edit")} Modifier</button>
                <button type="button" class="btn" data-role-action="toggle" data-role-index="${index}">${role.active === false ? icon("restore") + " Réactiver" : icon("archive") + " Désactiver"}</button>
                <button type="button" class="btn btn-danger" data-role-action="delete" data-role-index="${index}">${icon("trash")} Supprimer ce rôle</button>
            </div>
        </div>
    `;
}

function showDirectoryDetail(id) {
    const entry = state.directory.find(x => x.id === id);
    if (!entry) return;
    state.selectedDirectoryId = id;
    hideRoleEditor();

    $("#annuaireDetailTitle").textContent = `Annuaire › ${directoryDisplayName(entry)}`;

    const activeRoleBadges = DIRECTORY_ROLE_TYPES.filter(t => hasRole(entry, t))
        .map(t => `<span class="badge progress">${escapeHTML(ROLE_LABELS[t])}</span>`).join("");

    $("#annuaireDetailBody").innerHTML = `
        <div class="fiche-header">
            <div class="fiche-avatar" aria-hidden="true">${escapeHTML(initials(directoryDisplayName(entry)))}</div>
            <div class="fiche-heading">
                <h3 class="fiche-name">${escapeHTML(directoryDisplayName(entry))}</h3>
                <p class="fiche-meta">${entry.dateNaissance ? "Né(e) le " + formatDate(entry.dateNaissance) : ""}</p>
                <div class="fiche-chips">
                    ${activeRoleBadges}
                    ${hasNoRole(entry) ? `<span class="badge urgent">${icon("alert-triangle", "icon-inline")}Rôle à déterminer</span>` : ""}
                </div>
            </div>
        </div>

        <div class="fiche-section">
            <h4 class="fiche-section-title">Identité</h4>
            <dl class="fiche-grid">
                ${ficheField("Téléphone", escapeHTML(entry.telephone))}
                ${ficheField("E-mail", escapeHTML(entry.email))}
                ${ficheField("Adresse", escapeHTML(entry.adresse), true)}
                ${ficheField("Date de naissance", entry.dateNaissance ? formatDate(entry.dateNaissance) : "")}
                ${ficheField("Lieu de naissance", escapeHTML(entry.lieuNaissance))}
                ${ficheField("Date de décès", entry.dateDeces ? formatDate(entry.dateDeces) : "")}
                ${ficheField("Père", escapeHTML(entry.pere))}
                ${ficheField("Mère", escapeHTML(entry.mere))}
                ${ficheField("Notes", escapeHTML(entry.notes) || "Aucune note.", true)}
            </dl>
        </div>

        <div class="fiche-section">
            <h4 class="fiche-section-title">Rôles${entry.roles.length ? ` (${entry.roles.length})` : ""}</h4>
            ${entry.roles.length
                ? entry.roles.map((r, i) => renderRoleCard(r, i)).join("")
                : `<div class="empty">${icon("alert-triangle", "icon-inline")}Aucun rôle déterminé pour cette entrée. Utilisez « Ajouter un rôle » ci-dessous.</div>`}
            <div class="request-actions">
                <button type="button" class="btn btn-primary" id="addRoleBtn">${icon("plus")} Ajouter un rôle</button>
            </div>
            <div id="roleEditPanel" hidden></div>
        </div>

        ${historySectionHTML("directory", id)}
    `;

    showPage("annuaire-detail");
}

/* ---- Éditeur de rôle (ajout ou modification d'une instance) ---- */
let editingRoleIndex = null; // null = ajout ; sinon index du rôle édité

function roleEditPanelHTML(roleType, role) {
    const fields = ROLE_FIELD_DEFS[roleType] || [];
    return `
        <div class="fiche-section">
            <h4 class="fiche-section-title">${editingRoleIndex === null ? "Ajouter un rôle" : "Modifier ce rôle"}</h4>
            <div class="form-grid">
                <div class="field">
                    <label for="roleTypeSelect">Type de rôle</label>
                    <select id="roleTypeSelect" ${editingRoleIndex !== null ? "disabled" : ""}>
                        ${DIRECTORY_ROLE_TYPES.map(t => `<option value="${t}" ${t === roleType ? "selected" : ""}>${escapeHTML(ROLE_LABELS[t])}</option>`).join("")}
                    </select>
                </div>
                <div class="field">
                    <label class="checkbox-label" for="roleActiveCheckbox">
                        <input type="checkbox" id="roleActiveCheckbox" ${role?.active === false ? "" : "checked"}>
                        Rôle actif
                    </label>
                </div>
                <div class="field full">
                    <div class="form-grid" id="roleFieldsContainer">
                        ${fields.map(f => roleFieldInputHTML(f, role ? role[f.key] : "")).join("") || `<p class="field-help">Ce rôle n'a aucun champ complémentaire.</p>`}
                    </div>
                </div>
            </div>
            <div class="panel-footer">
                <button type="button" class="btn" id="roleEditCancelBtn">Annuler</button>
                <button type="button" class="btn btn-primary" id="roleEditSaveBtn">${icon("check")} Enregistrer le rôle</button>
            </div>
        </div>
    `;
}

function showRoleEditor(roleIndex) {
    const entry = state.directory.find(x => x.id === state.selectedDirectoryId);
    if (!entry) return;
    editingRoleIndex = roleIndex;
    const role = roleIndex !== null && roleIndex !== undefined ? entry.roles[roleIndex] : null;
    const roleType = role ? role.type : DIRECTORY_ROLE_TYPES[0];

    const panel = $("#roleEditPanel");
    panel.innerHTML = roleEditPanelHTML(roleType, role);
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideRoleEditor() {
    editingRoleIndex = null;
    const panel = $("#roleEditPanel");
    if (!panel) return;
    panel.hidden = true;
    panel.innerHTML = "";
}

function readRoleFieldsFromForm(roleType) {
    const defs = ROLE_FIELD_DEFS[roleType] || [];
    const data = {};
    defs.forEach(f => {
        const el = $(`#roleField_${f.key}`);
        if (!el) return;
        data[f.key] = f.type === "checkbox" ? el.checked : el.value.trim();
    });
    return data;
}

async function saveRoleFromEditor() {
    const entry = state.directory.find(x => x.id === state.selectedDirectoryId);
    if (!entry) return;

    const roleType = $("#roleTypeSelect").value;
    const active = $("#roleActiveCheckbox").checked;
    const roleObject = buildRoleInstance(roleType, readRoleFieldsFromForm(roleType), active);
    const roleIndex = editingRoleIndex;

    await withActionLock(`directory:role:${entry.id}`, async () => {
        try {
            const updated = upsertRole(entry, roleIndex, roleObject);
            await withHistoryTx([db.directory], async () => {
                await DirectoryRepository.put(updated);
                await addHistory("directory", entry.id, "update", `Rôle « ${roleLabel(roleObject)} » ${roleIndex === null ? "ajouté" : "modifié"}`);
            });
            await loadDirectoryData();
            renderDirectoryList();
            renderDirectorySummary();
            toast("Rôle enregistré.", "success");
            showDirectoryDetail(entry.id);
        } catch (err) {
            Logger.error("annuaire.saveRoleFromEditor", err);
            toast("Impossible d'enregistrer ce rôle.", "error");
        }
    });
}

async function toggleRoleActive(roleIndex) {
    const entry = state.directory.find(x => x.id === state.selectedDirectoryId);
    const role = entry?.roles[roleIndex];
    if (!entry || !role) return;
    const nextActive = role.active === false;

    await withActionLock(`directory:role:${entry.id}`, async () => {
        try {
            const updated = setRoleActive(entry, roleIndex, nextActive);
            await withHistoryTx([db.directory], async () => {
                await DirectoryRepository.put(updated);
                await addHistory("directory", entry.id, "update", `Rôle « ${roleLabel(role)} » ${nextActive ? "réactivé" : "désactivé"}`);
            });
            await loadDirectoryData();
            renderDirectoryList();
            renderDirectorySummary();
            toast(nextActive ? "Rôle réactivé." : "Rôle désactivé.", "success");
            showDirectoryDetail(entry.id);
        } catch (err) {
            Logger.error("annuaire.toggleRoleActive", err);
            toast("Impossible de modifier ce rôle.", "error");
        }
    });
}

async function deleteRoleInstance(roleIndex) {
    const entry = state.directory.find(x => x.id === state.selectedDirectoryId);
    const role = entry?.roles[roleIndex];
    if (!entry || !role) return;
    if (!window.confirm(`Supprimer définitivement le rôle « ${roleLabel(role)} » ?\n\nCette action ne peut pas être annulée et perd les informations propres à ce rôle. Si vous n'êtes pas sûr, préférez « Désactiver ».`)) return;

    await withActionLock(`directory:role:${entry.id}`, async () => {
        try {
            const updated = removeRoleAt(entry, roleIndex);
            await withHistoryTx([db.directory], async () => {
                await DirectoryRepository.put(updated);
                await addHistory("directory", entry.id, "update", `Rôle « ${roleLabel(role)} » supprimé`);
            });
            await loadDirectoryData();
            renderDirectoryList();
            renderDirectorySummary();
            toast("Rôle supprimé.", "success");
            showDirectoryDetail(entry.id);
        } catch (err) {
            Logger.error("annuaire.deleteRoleInstance", err);
            toast("Impossible de supprimer ce rôle.", "error");
        }
    });
}

/* ============================================================
   CORBEILLE (réutilise le mécanisme généralisé V6.2.c — voir js/trash.js)
============================================================ */
async function trashDirectoryEntry(id) {
    const entry = state.directory.find(x => x.id === id);
    if (!entry) return;
    if (!window.confirm(`Mettre à la corbeille « ${directoryDisplayName(entry)} » ?\n\nElle pourra être restaurée depuis la Corbeille, avec tous ses rôles.`)) return;

    await withActionLock(`directory:trash:${id}`, async () => {
        try {
            await withHistoryTx([db.directory], async () => {
                entry.deletedAt = nowISO();
                entry.updatedAt = nowISO();
                await DirectoryRepository.put(entry);
                await addHistory("directory", id, "trash", "Entrée mise à la corbeille");
            });
            await loadDirectoryData();
            renderDirectoryList();
            renderDirectorySummary();
            renderTrash();
            toast("Entrée mise à la corbeille.", "success");
            showPage("annuaire");
        } catch (err) {
            Logger.error("annuaire.trashDirectoryEntry", err);
            toast("Impossible de mettre cette entrée à la corbeille.", "error");
        }
    });
}

async function restoreDirectoryEntry(id) {
    const entry = state.directoryTrash.find(x => x.id === id);
    if (!entry) return;

    await withActionLock(`directory:restore:${id}`, async () => {
        try {
            await withHistoryTx([db.directory], async () => {
                entry.deletedAt = null;
                entry.updatedAt = nowISO();
                await DirectoryRepository.put(entry);
                await addHistory("directory", id, "restore", "Entrée restaurée depuis la corbeille");
            });
            await loadDirectoryData();
            renderDirectoryList();
            renderDirectorySummary();
            renderTrash();
            toast("Entrée restaurée.", "success");
        } catch (err) {
            Logger.error("annuaire.restoreDirectoryEntry", err);
            toast("Impossible de restaurer cette entrée.", "error");
        }
    });
}

async function purgeDirectoryEntry(id) {
    const entry = state.directoryTrash.find(x => x.id === id);
    if (!entry) return;
    if (!window.confirm(`Supprimer définitivement « ${directoryDisplayName(entry)} » ?\n\nCette action est IRRÉVERSIBLE : la fiche et tous ses rôles ne pourront plus être restaurés.`)) return;

    await withActionLock(`directory:purge:${id}`, async () => {
        try {
            await withHistoryTx([db.directory], async () => {
                await DirectoryRepository.remove(id);
                // Historique conservé après purge, comme pour les 6 autres
                // modules (voir docs/V6.2-C-DESIGN.md).
                await addHistory("directory", id, "purge", "Entrée supprimée définitivement");
            });
            await loadDirectoryData();
            renderDirectoryList();
            renderDirectorySummary();
            renderTrash();
            toast("Entrée supprimée définitivement.", "success");
        } catch (err) {
            Logger.error("annuaire.purgeDirectoryEntry", err);
            toast("Impossible de supprimer définitivement cette entrée.", "error");
        }
    });
}

/* ============================================================
   ÉVÉNEMENTS
============================================================ */
function initAnnuaireEvents() {
    $("#newDirectoryBtn").addEventListener("click", () => showDirectoryForm(null));
    $("#annuaireForm").addEventListener("submit", saveDirectoryEntry);
    $("#annuaireFormBackBtn").addEventListener("click", goBack);
    $("#annuaireFormCancelBtn").addEventListener("click", goBack);

    $("#annuaireDetailBackBtn").addEventListener("click", goBack);
    $("#annuaireEditBtn").addEventListener("click", () => state.selectedDirectoryId && showDirectoryForm(state.selectedDirectoryId));
    $("#annuaireDeleteBtn").addEventListener("click", () => state.selectedDirectoryId && trashDirectoryEntry(state.selectedDirectoryId));

    $("#annuaireDetailBody").addEventListener("click", e => {
        if (e.target.closest("#addRoleBtn")) { showRoleEditor(null); return; }
        if (e.target.closest("#roleEditCancelBtn")) { hideRoleEditor(); return; }
        if (e.target.closest("#roleEditSaveBtn")) { saveRoleFromEditor(); return; }

        const roleBtn = e.target.closest("[data-role-action]");
        if (roleBtn) {
            const index = Number(roleBtn.dataset.roleIndex);
            if (roleBtn.dataset.roleAction === "edit") showRoleEditor(index);
            else if (roleBtn.dataset.roleAction === "toggle") toggleRoleActive(index);
            else if (roleBtn.dataset.roleAction === "delete") deleteRoleInstance(index);
        }
    });

    $("#annuaireDetailBody").addEventListener("change", e => {
        if (e.target.id !== "roleTypeSelect") return;
        const fields = ROLE_FIELD_DEFS[e.target.value] || [];
        $("#roleFieldsContainer").innerHTML = fields.map(f => roleFieldInputHTML(f, "")).join("") || `<p class="field-help">Ce rôle n'a aucun champ complémentaire.</p>`;
    });

    $("#annuaireKpis").addEventListener("click", e => {
        const btn = e.target.closest("[data-kpi]");
        if (btn) filterDirectoryByKpi(btn.dataset.kpi);
    });

    $("#annuaireList").addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        const card = e.target.closest("[data-directory-id]");
        if (!card) return;
        const id = card.dataset.directoryId;

        if (!btn) { showDirectoryDetail(id); return; }
        switch (btn.dataset.action) {
            case "edit": showDirectoryForm(id); break;
            case "delete": trashDirectoryEntry(id); break;
        }
    });

    const debouncedDirectoryRender = debounce(() => { state.directoryPage = 1; renderDirectoryList(); }, 200);
    $("#annuaireSearchInput").addEventListener("input", debouncedDirectoryRender);

    $("#annuairePagination").addEventListener("click", e => {
        const btn = e.target.closest("[data-page-nav]");
        if (!btn || btn.disabled) return;
        state.directoryPage += btn.dataset.pageNav === "next" ? 1 : -1;
        renderDirectoryList();
        $("#annuaireList").scrollIntoView({ behavior: "smooth", block: "start" });
    });
}
