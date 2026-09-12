# gParoisse

Application de secrétariat paroissial pour le suivi des demandes (certificats, baptêmes, mariages, obsèques, rendez-vous…).

## Stack technique

| Domaine | Choix |
|---|---|
| Structure | HTML/CSS/JS statiques, aucun build |
| Style | `css/style.css` |
| Logique | JavaScript vanille, un fichier par module dans `js/` |
| Stockage | [Dexie.js](https://dexie.org) sur IndexedDB — tout est stocké localement dans le navigateur |

Aucune installation, aucun serveur, aucune dépendance à builder : `index.html` s'ouvre directement dans un navigateur.

## Structure du code

```
index.html          Coquille : sprite d'icônes, sidebar, pages plein écran, modale Paramètres
css/style.css        Tous les styles (palette, typographie, composants)
js/db.js             Schéma Dexie (IndexedDB)
js/utils.js          Utilitaires génériques (dates, texte, DOM, toast, fiche…)
js/icons.js          Aide pour référencer une icône du sprite SVG depuis le JS
js/csv.js            Parsing CSV générique (délimiteur, dates FR, dates Excel)
js/state.js           État partagé, navigation plein écran, thème, modale
js/dashboard.js        Module « Demandes / Tableau de bord »
js/people.js            Module « Personnes » (+ import CSV)
js/settings.js           Paramètres, export/import/effacement des données
js/main.js                Initialisation, raccourcis clavier, câblage global
```

### Identité visuelle

Palette chaleureuse (papier/bordeaux) plutôt qu'un gris-bleu générique de tableau
de bord, typographie sérif pour les titres / sans-serif pour l'interface, et un
jeu d'icônes SVG dessinées à la main (aucune police d'icônes ni CDN, tout
fonctionne hors-ligne). Les pages de détail (« fiches ») affichent
systématiquement l'intégralité des champs du formulaire correspondant — aucune
donnée saisie ne reste invisible en dehors du formulaire d'édition.

Chaque module métier (demandes, personnes, et les suivants à venir) est autonome :
une page liste, une page détail et une page formulaire en plein écran (pas de
popup), reliées à la barre latérale. Pour ajouter un nouveau module, il suffit
de dupliquer ce schéma dans un nouveau fichier `js/<module>.js` et de déclarer
ses pages dans `index.html` et `PAGE_SECTION` (`js/state.js`).

## Démarrer

Ouvrir `index.html` dans un navigateur (double-clic, ou glisser-déposer dans la fenêtre du navigateur).

## Données

Les demandes, l'historique et les paramètres sont stockés dans IndexedDB (base `paroisse_secretariat`), propre à chaque navigateur/appareil. Le stockage du navigateur n'étant pas un système de sauvegarde fiable, l'application propose :

- Export JSON (sauvegarde complète, ré-importable)
- Export CSV (pour tableur)
- Import (fusion ou remplacement complet)

Ces actions sont accessibles depuis le bouton « Sauvegarde » et le menu « Paramètres ».

## Déploiement du code

`scripts/push.ps1` (PowerShell) commit les changements en cours (si besoin) et pousse sur `origin main`. Voir le script pour le détail du flux d'authentification GitHub attendu.
