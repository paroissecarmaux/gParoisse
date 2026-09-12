# gParoisse

Application de secrétariat paroissial **100 % locale et hors ligne** : suivi des
demandes (certificats, baptêmes, mariages, obsèques, rendez-vous…), annuaire
des personnes, agenda, annonces/horaires paroissiaux, référentiel des
clochers, personnel de la paroisse (bénévoles, salariés, clergé) et
intentions de messe (défunts, anniversaires, neuvaines…).

Aucune donnée ne quitte jamais l'appareil : tout est stocké dans le navigateur
(IndexedDB), il n'y a ni serveur, ni compte, ni connexion internet requise
pour utiliser l'application au quotidien.

## 📦 Sauvegarde obligatoire — à lire avant tout

> **Le stockage du navigateur n'est pas un système de sauvegarde fiable.**
> Un nettoyage du navigateur, une réinstallation, un changement d'ordinateur
> ou un profil corrompu peuvent effacer **toutes** les données (demandes,
> personnes, annonces, clochers, personnel, intentions de messe) sans
> avertissement.
>
> **Exportez régulièrement une sauvegarde JSON** (bouton « Sauvegarde » en
> haut de l'application, ou Paramètres → « Export JSON complet ») et conservez
> ce fichier en lieu sûr (clé USB, autre disque, cloud personnel…). C'est le
> seul moyen de restaurer les données en cas de problème, via
> Paramètres → « Fusionner un fichier » / « Remplacer par un fichier ».
>
> Un rappel de ce principe est aussi affiché directement dans les Paramètres
> de l'application.

## Stack technique

| Domaine | Choix |
|---|---|
| Structure | HTML/CSS/JS statiques, **aucun build, aucun framework, aucun bundler** |
| Style | `css/style.css` (palette et composants faits main) |
| Logique | JavaScript vanille, un fichier par module dans `js/`, chargés par de simples balises `<script>` (pas de modules ES, pour rester compatible avec une ouverture directe en `file://`) |
| Stockage | [Dexie.js](https://dexie.org) sur IndexedDB, **vendorisé en local** dans `js/vendor/dexie.min.js` (aucune dépendance réseau, y compris au premier lancement) |
| Mode hors-ligne / PWA | `manifest.json` + `sw.js` (service worker minimal, actif uniquement quand l'app est servie en http/https — sans effet ni erreur en `file://`) |

Aucune installation, aucun serveur, aucune dépendance à builder :
`index.html` s'ouvre directement dans un navigateur, y compris sans aucun
accès réseau.

## Démarrer

Ouvrir `index.html` dans un navigateur :

- double-clic sur le fichier depuis l'explorateur de fichiers, **ou**
- glisser-déposer `index.html` dans la fenêtre du navigateur, **ou**
- (optionnel) servir le dossier avec un petit serveur local statique si vous
  souhaitez tester le service worker / l'installation en PWA — non nécessaire
  pour un usage normal.

Aucune étape d'installation, de compilation ou de configuration n'est requise.

## Structure du code

```
index.html            Coquille : sprite d'icônes SVG, sidebar, toutes les pages plein écran
manifest.json         Manifeste PWA (nom, icônes, thème, mode standalone)
sw.js                 Service worker minimal (cache de l'app shell, hors ligne réel)
icons/icon.svg        Icône de l'application (PWA / favicon)
css/style.css         Tous les styles (palette, typographie, composants)

js/vendor/dexie.min.js   Dexie.js vendorisé en local (IndexedDB)
js/db.js                 Schéma Dexie (IndexedDB), versionné et additif
js/constants.js          Vocabulaire métier partagé (types de demande, statuts,
                          priorités, catégories d'annonces, certificats…)
js/utils.js               Utilitaires génériques (dates, texte, DOM, pagination,
                           autocomplete, toast, fiche…)
js/icons.js                Aide pour référencer une icône du sprite SVG depuis le JS
js/csv.js                   Parsing CSV générique (délimiteur, dates FR, dates Excel)
js/state.js                  État partagé, navigation plein écran, thème

js/requests.js                 Module « Demandes »
js/people.js                    Module « Personnes » (+ import CSV registre, certificats)
js/schedule.js                   Module « Annonces » (horaires récurrents/ponctuels)
js/clochers.js                    Module « Clochers » (référentiel des lieux)
js/personnel.js                    Module « Personnel » (bénévoles, salariés, clergé)
js/intentions.js                    Module « Intentions de messe » (défunts, neuvaines…)
js/overview.js                       Module « Tableau de bord » (vue d'ensemble)
js/agenda.js                           Module « Agenda » (vue semaine/jour)
js/settings.js                          Paramètres, export/import (JSON + CSV), effacement

js/main.js                            Initialisation, raccourcis clavier, câblage global,
                                       enregistrement du service worker

scripts/push.ps1       Script PowerShell de publication (commit + push GitHub)
```

### Identité visuelle

Palette chaleureuse (papier/bordeaux) plutôt qu'un gris-bleu générique de
tableau de bord, typographie sérif pour les titres / sans-serif pour
l'interface, et un jeu d'icônes SVG dessinées à la main (aucune police
d'icônes ni CDN, tout fonctionne hors-ligne). Les pages de détail (« fiches »)
affichent systématiquement l'intégralité des champs du formulaire
correspondant — aucune donnée saisie ne reste invisible en dehors du
formulaire d'édition.

Chaque module métier est autonome et suit le même schéma : une page liste
(avec KPI cliquables et recherche), une page détail et une page formulaire,
toutes en plein écran (pas de popup), reliées à la barre latérale.

## Gestion des données

Toutes les bases (demandes, personnes, annonces, clochers, personnel,
intentions de messe, historique, paramètres) sont stockées dans IndexedDB,
dans une base nommée
`paroisse_secretariat`, propre à ce navigateur et à cet appareil. Rien n'est
envoyé ni synchronisé ailleurs.

Le schéma est versionné dans `js/db.js` (`db.version(N).stores({...})`) : une
évolution de structure ajoute toujours une nouvelle version plutôt que de
modifier une version existante, pour ne jamais perdre les données déjà
enregistrées lors d'une mise à jour de l'application.

### Export / import

Chaque base peut être exportée et réimportée :

- **Export/Import JSON complet** (Paramètres, ou bouton « Sauvegarde ») :
  sauvegarde/restauration de l'intégralité des données en une fois. C'est le
  format à utiliser pour une sauvegarde régulière (voir ci-dessus).
- **Export/Import CSV, base par base** (Paramètres, ou directement dans
  l'en-tête de chaque section) : pratique pour relire/modifier les données
  dans un tableur. La colonne « ID » de l'export permet, en cas de
  réimportation, de mettre à jour un enregistrement existant plutôt que de le
  dupliquer.
- **Import CSV « registre »** (page Personnes) : import spécifique à partir
  d'un fichier de registre paroissial externe (colonnes en français, dates
  éventuellement au format Excel), distinct du format d'export/import CSV
  générique ci-dessus.

## Raccourcis clavier

| Touche | Effet |
|---|---|
| `/` | Place le curseur dans le champ de recherche de la section courante (Demandes, Personnes) |
| `N` | Ouvre le formulaire de création pour la section courante (Demandes, Personnes, Annonces, Clochers, Personnel, Intentions) |
| `Échap` | Retour à la page précédente (liste ou fiche détail) |

## Ajouter un nouveau module

Pour ajouter un module suivant le même schéma (liste + détail + formulaire) :

1. Créer `js/<module>.js` en suivant la forme des modules existants
   (`load<Module>Data()`, rendu de liste, formulaire, fiche détail,
   `init<Module>Events()`).
2. Déclarer ses pages dans `index.html` (`data-page="<module>"`,
   `<module>-detail`, `<module>-form`) et ajouter la balise
   `<script src="js/<module>.js"></script>` dans le bon ordre (après
   `js/constants.js`/`js/state.js`, avant `js/main.js`).
3. Déclarer les pages dans `PAGE_SECTION` et, si besoin, `pageBackTarget()`
   (`js/state.js`).
4. Appeler `init<Module>Events()`, `load<Module>Data()` et le rendu initial
   dans `init()` (`js/main.js`).
5. Si le module doit gérer sa propre table Dexie : ajouter une nouvelle
   `db.version(N)` dans `js/db.js` (jamais modifier une version existante),
   et l'ajouter dans `PRECACHE_URLS` (`sw.js`) si un nouveau fichier JS est
   créé.
6. Pour bénéficier de l'export/import JSON + CSV et de l'effacement des
   données sans dupliquer de logique : ajouter une entrée dans `DATA_MODULES`
   (`js/settings.js`) plutôt que d'écrire un export/import spécifique.

## Déploiement du code

`scripts/push.ps1` (PowerShell) commit les changements en cours (si besoin)
et pousse sur `origin main`. Voir le script pour le détail du flux
d'authentification GitHub attendu.
