# gParoisse

Application web et mobile (PWA / responsive) de gestion paroissiale : personnes, foyers, groupes, sacrements et vie chrétienne, avec une partie publique et une partie administrateur/membres.

## Stack technique

| Domaine | Choix |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Langage | TypeScript |
| Style | Tailwind CSS v4 |
| Icônes | [lucide-react](https://lucide.dev) |
| Auth (cible) | [Supabase](https://supabase.com) (`@supabase/ssr`, `@supabase/supabase-js`) |
| Auth (actuelle) | démo par cookie, voir [Authentification](#authentification) |

## Architecture générale

L'app utilise deux **route groups** Next.js qui partagent le même routeur mais ont des layouts et des règles d'accès différents :

```
src/app/
├── layout.tsx              # Layout racine (police, <html>, <body>)
├── globals.css             # Thème Tailwind (couleurs, variables)
├── proxy.ts                # ⚠️ à la racine de src/, pas dans app/ — voir Middleware
│
├── (public)/                # Accessible sans connexion
│   ├── layout.tsx           # PublicHeader + contenu + PublicFooter
│   ├── page.tsx              # Accueil "/"
│   ├── evenements/page.tsx   # "/evenements"
│   ├── demande/               # "/demande" — formulaire de demande
│   │   ├── page.tsx
│   │   └── actions.ts         # Server Action de soumission
│   └── connexion/              # "/connexion" — login démo
│       ├── page.tsx
│       └── actions.ts          # Server Action qui pose le cookie de session
│
└── (admin)/                  # Protégé — nécessite une session
    ├── layout.tsx             # Vérifie la session, sinon redirige vers /connexion
    ├── AdminShell.tsx          # Client component : Sidebar + TopHeader + BottomNav
    ├── actions.ts               # Server Action de déconnexion
    ├── dashboard/page.tsx        # "/dashboard" — tableau de bord
    ├── personnes/                # "/personnes", nouveau, foyers, morales
    ├── groupes/                   # "/groupes", tous, mes-agregats, gerer
    ├── vie-chretienne/              # sacrements, funerailles
    ├── agenda/page.tsx
    └── profil/page.tsx
```

Un dossier entre parenthèses — `(public)`, `(admin)` — est un **route group** : il structure le code mais n'apparaît pas dans l'URL. C'est pourquoi `(public)/page.tsx` répond bien sur `/` et `(admin)/dashboard/page.tsx` sur `/dashboard`, sans segment `public` ou `admin` dans le chemin.

### Composants partagés

```
src/components/
├── layout/
│   ├── PublicHeader.tsx      # Nav publique (Accueil, Événements, Demande, Connexion)
│   ├── PublicFooter.tsx
│   ├── Sidebar.tsx            # Menu admin desktop (fixe) + drawer mobile
│   ├── TopHeader.tsx           # Barre du haut admin (recherche, année, profil)
│   ├── MobileBottomNav.tsx      # Barre de nav mobile (5 icônes)
│   └── PagePlaceholder.tsx       # Coquille générique pour une page pas encore implémentée
├── dashboard/
│   ├── WidgetCard.tsx                # Carte générique (titre + icône + contenu)
│   ├── PendingSupportUsersCard.tsx
│   ├── PendingSacramentsCard.tsx
│   ├── PendingPersonsCard.tsx
│   ├── UpcomingBirthdaysCard.tsx
│   └── ParishInfoCard.tsx             # Colonne de droite (paroisse, profil, aide)
└── ui/
    ├── Badge.tsx
    └── IconButton.tsx
```

### Logique et données

```
src/lib/
├── nav-config.ts       # Source unique de la navigation (sections + items),
│                         utilisée par Sidebar ET MobileBottomNav
├── types/index.ts      # Types métier (Person, Household, Group, Sacrament...)
├── auth/session.ts      # getSession() — lit le cookie de démo
└── supabase/
    ├── client.ts         # Client Supabase navigateur (pas encore branché)
    └── server.ts          # Client Supabase serveur (pas encore branché)
```

Toutes les données affichées dans le dashboard et les pages "Personnes/Groupes/..." sont **mockées en dur** dans les composants — il n'y a pas encore de base de données branchée. Chaque page admin (hors dashboard) utilise `PagePlaceholder` pour afficher une coquille propre en attendant sa vraie implémentation.

## Fonctionnement

### Navigation

Toute la structure du menu (sections "Personnes", "Groupes et activités", "Vie chrétienne") est définie **une seule fois** dans [`src/lib/nav-config.ts`](src/lib/nav-config.ts). La `Sidebar` (desktop + drawer mobile) et la `MobileBottomNav` lisent ce même fichier : ajouter une page dans le menu se fait à un seul endroit.

### Authentification

Il n'y a pas encore de vrai backend d'auth. Le flux actuel est un **mock** volontairement simple pour que la coquille soit navigable de bout en bout :

1. `/connexion` accepte n'importe quel email/mot de passe.
2. La Server Action [`loginAction`](src/app/(public)/connexion/actions.ts) pose un cookie `gp_session=demo` (httpOnly).
3. [`src/proxy.ts`](src/proxy.ts) intercepte toutes les requêtes vers `/dashboard`, `/personnes`, `/groupes`, `/vie-chretienne`, `/agenda` et `/profil` : sans le cookie, redirection vers `/connexion?redirect=<page demandée>`.
4. [`getSession()`](src/lib/auth/session.ts) relit ce même cookie côté serveur pour savoir qui est « connecté » (un utilisateur factice, `Élodie Moreau`).
5. La déconnexion ([`logoutAction`](src/app/(admin)/actions.ts)) supprime le cookie.

**Pour brancher Supabase plus tard**, un seul endroit change vraiment : remplacer le corps de `getSession()` par un `supabase.auth.getUser()` (via [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts), déjà prêt), et remplacer la logique de `proxy.ts` par la vérification de session Supabase équivalente. Les pages et composants qui consomment `getSession()` n'ont pas à changer.

> ⚠️ Depuis Next.js 16, le fichier historique `middleware.ts` a été renommé `proxy.ts` (fonction exportée `proxy` au lieu de `middleware`). C'est la nouvelle convention du framework, pas une particularité de ce projet.

### Dashboard admin

Quatre widgets, tous avec des données mock pour l'instant :
- **Utilisateurs en attente de support**
- **Sacrements en attente de validation** (valider ✅ / refuser ❌ — boutons non encore branchés)
- **Personnes en attente de validation** (idem)
- **Prochains anniversaires**

Plus une colonne de droite : identité de la paroisse, utilisateur connecté, bloc d'aide.

## Démarrer le projet

```bash
npm install
npm run dev       # http://localhost:3000
```

```bash
npm run build     # build de production
npm run start      # sert le build
npm run lint        # ESLint
```

## Variables d'environnement

Copier `.env.local.example` en `.env.local` et renseigner un projet Supabase quand il sera créé :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Tant que ces variables ne sont pas renseignées, l'app fonctionne quand même grâce à l'authentification de démo décrite plus haut.

## Déploiement du code

`scripts/push.ps1` (PowerShell) commit les changements en cours (si besoin) et pousse sur `origin main`. Voir le script pour le détail du flux d'authentification GitHub attendu.

## Pistes pour la suite

- Brancher un vrai projet Supabase (tables `personnes`, `foyers`, `groupes`, `sacrements`, rôles) et remplacer les données mock par de vraies requêtes.
- Remplacer `getSession()` / `proxy.ts` par une vraie vérification de session Supabase.
- Implémenter les actions de validation/refus (sacrements, personnes) sur le dashboard.
- Remplir les pages `PagePlaceholder` une par une (ex: tableau réel pour "Toutes les personnes").
