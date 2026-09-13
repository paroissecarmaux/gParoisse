# RGPD — données personnelles traitées

Ce document décrit ce que l'application **stocke et permet de faire**, pas une analyse juridique complète — la qualification RGPD précise (base légale, durée de conservation, registre de traitement) reste de la responsabilité de la paroisse/du diocèse.

## Données personnelles stockées

- **Personnes** (`people`) : nom, prénom, dates (naissance, décès, sacrements), lieux, filiation (père/mère), téléphone, email, adresse, notes libres. Le champ le plus sensible : les dates/lieux de sacrements et la filiation constituent en pratique un registre paroissial.
- **Personnel** (`personnel`) : nom, prénom, coordonnées, dates d'engagement — données de bénévoles/salariés/clergé, pas seulement de paroissiens.
- **Demandes** (`requests`), **Intentions** (`intentions`) : contact (téléphone/email), nom du défunt le cas échéant, notes internes — peuvent contenir des informations sensibles selon le contexte (obsèques, situation familiale évoquée dans une note).
- **Clochers** (`clochers`) : aucune donnée personnelle (lieux uniquement).
- **Historique** (`history`) : `description` est un texte court généré par l'application (« Demande créée », « Fiche modifiée »…), ne recopie jamais le contenu des champs personnels.

## Consentement (`people.rgpd`)

Chaque fiche Personne « Paroissien » porte une case à cocher « Consentement RGPD obtenu (conservation des données personnelles) » (`people.rgpd`, booléen). C'est une **case à cocher manuelle**, pas un mécanisme qui bloque quoi que ce soit dans l'application — elle sert de mémo pour le secrétariat, pas de garde-fou technique. Absente/`false` par défaut pour une nouvelle fiche.

## Droit d'accès et de portabilité

- **Export JSON complet** (`docs/BACKUP.md`) : contient l'intégralité des données d'une personne, exploitable pour répondre à une demande d'accès.
- **Export CSV par module** : plus lisible pour une personne non technique, mais ne contient qu'un module à la fois (pas les demandes/intentions liées).
- Aucun export "profil individuel" dédié n'existe aujourd'hui (un export ne peut être que "tout le module" ou "toute la base") — à envisager si un besoin réel de réponse individuelle à une demande RGPD se présente.

## Droit à l'effacement

Modélisé en deux temps depuis V6.2.c (corbeille généralisée) :

1. **Mise à la corbeille** (`trashX`) : la fiche disparaît de toutes les listes, recherches, autocompletions et KPI, mais reste **restaurable** — ce n'est pas un effacement au sens RGPD, seulement un retrait de la vue courante.
2. **Suppression définitive** (`purgeX`, uniquement depuis la vue Corbeille) : `db.table.delete()` réel, irréversible — **c'est l'action qui répond à un droit à l'effacement**.

Important : purger une Personne/un Personnel/un Clocher **ne supprime pas** les Demandes/Intentions qui la référençaient (`personId`/`clocherId`/`personnelId` restent inchangés, la fiche liée devient "introuvable (supprimée définitivement)" — voir `docs/DATABASE.md`). Une demande d'effacement complète peut donc nécessiter de traiter plusieurs fiches liées, pas une seule — à vérifier manuellement au cas par cas, l'application ne le fait pas automatiquement (délibéré : ne jamais modifier silencieusement un enregistrement qui n'est pas celui visé par l'action).

L'entrée d'historique `purge` **n'est pas supprimée** avec la fiche (c'est le rôle d'un journal d'audit — voir `docs/DATABASE.md`) : elle garde une trace du type d'action et de la date, mais son `description` ne recopie pas les données personnelles de la fiche supprimée.

## Minimisation

- Le champ `notes`/`notesInternes` est en texte libre sur plusieurs modules — la responsabilité de ne pas y saisir plus que nécessaire reste humaine, l'application ne le valide pas.
- Aucune donnée n'est envoyée à un tiers, aucune analytics, aucun tracker (cohérent avec l'absence totale de réseau, voir `docs/ARCHITECTURE.md`).

## Ce qui n'est pas fait

- Pas de durée de conservation automatique (pas d'expiration/archivage automatique après N années).
- Pas de registre de traitement généré par l'application — à tenir séparément si requis.
- Pas d'export "profil individuel" dédié à une demande RGPD précise (voir ci-dessus).
