# gParoisse

Application de secrétariat paroissial pour le suivi des demandes (certificats, baptêmes, mariages, obsèques, rendez-vous…).

## Stack technique

| Domaine | Choix |
|---|---|
| Structure | Une seule page HTML autonome (`index.html`) |
| Style | CSS pur, inclus dans la page |
| Logique | JavaScript vanille, inclus dans la page |
| Stockage | [Dexie.js](https://dexie.org) sur IndexedDB — tout est stocké localement dans le navigateur |

Aucune installation, aucun serveur, aucune dépendance à builder : le fichier `index.html` s'ouvre directement dans un navigateur.

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
