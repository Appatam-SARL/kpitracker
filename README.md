# KPI Tracker

CRM commercial multi-entreprises pour le suivi des prospects, clients, rendez-vous, objectifs et performances d’équipe.

Stack principale : **Next.js 16**, **React 19**, **Prisma 7**, **PostgreSQL**, **Tailwind CSS**.

## Architecture logicielle

Application **full-stack monolithique** : une seule base de code Next.js expose à la fois l’interface (App Router) et les API REST (`/api/*`). La persistance est assurée par **Prisma ORM** sur **PostgreSQL**. L’authentification repose sur des **cookies de session** ; les autorisations sont vérifiées côté **middleware** (navigation) et sur **chaque route API** (données).

### Vue d’ensemble

```mermaid
flowchart TB
  subgraph client [Client navigateur]
    UI[Pages React - App Router]
    Ctx[AuthContext]
    RQ[TanStack React Query]
  end

  subgraph next [Next.js 16 - serveur]
    MW[Middleware - auth et rôles]
    Pages[RSC / Client Components]
    API[Routes API - src/app/api]
    Lib[src/lib - auth, rôles, métier]
  end

  subgraph data [Données et services externes]
    Prisma[Prisma Client]
    PG[(PostgreSQL)]
    SMTP[Serveur SMTP]
    FS[Fichiers uploads]
  end

  UI --> Ctx
  UI --> RQ
  RQ --> API
  UI --> Pages
  Pages --> MW
  API --> Lib
  Lib --> Prisma
  Prisma --> PG
  API --> SMTP
  API --> FS
```

### Flux d’une requête authentifiée

```mermaid
sequenceDiagram
  participant B as Navigateur
  participant M as Middleware
  participant P as Page ou API
  participant A as lib/auth
  participant D as Prisma
  participant DB as PostgreSQL

  B->>M: GET /leads ou POST /api/leads
  M->>M: Vérifie cookie auth_session
  alt Route protégée sans session
    M-->>B: Redirect /login
  else Session valide
    M->>P: Passe la requête
    P->>A: getCurrentUser / requireRole
    A->>D: Lecture utilisateur
    D->>DB: SELECT
    DB-->>D: User
    alt Rôle ou périmètre insuffisant
      P-->>B: 403 Accès refusé
    else Autorisé
      P->>D: Logique métier CRUD
      D->>DB: Requêtes SQL
      DB-->>D: Résultats
      P-->>B: HTML ou JSON
    end
  end
```

### Couches du projet

| Couche | Emplacement | Rôle |
| ------ | ----------- | ---- |
| **Présentation** | `src/app/(dashboard)`, `src/app/(auth)`, `src/components` | Pages, formulaires, tableaux, calendrier, modales (shadcn/ui, Radix, Tailwind) |
| **État client** | `src/contexts/AuthContext.tsx`, TanStack Query | Session utilisateur, rafraîchissement, cache des appels API |
| **Routage & garde** | `src/middleware.ts` | Redirection login, MFA, changement de mot de passe, pages admin/manager |
| **API REST** | `src/app/api/**/route.ts` | Endpoints leads, clients, agenda, activités, objectifs, emails, corbeille, etc. |
| **Domaine / services** | `src/lib/*` | Auth, rôles, périmètre groupe, import leads, emails, signatures, rapports |
| **Validation** | Zod (schémas dans les routes API) | Contrôle des entrées POST/PATCH |
| **Persistance** | `prisma/schema.prisma`, `src/lib/prisma.ts` | Modèles, relations, migrations |
| **Audit** | `UserActionLog` via `logUserAction()` | Traçabilité des mutations sensibles |
| **Emails** | `src/emails/*`, Nodemailer | Templates React Email, envoi SMTP |
| **Production** | `server.js`, `load-env.cjs` | Serveur Node HTTP (ex. cPanel) après `next build` |

### Modèle de données (simplifié)

```mermaid
erDiagram
  Company ||--o{ User : emploie
  Company ||--o{ Lead : possède
  Company ||--o{ Product : catalogue
  Company ||--o{ Service : catalogue
  User ||--o{ Activity : crée
  User ||--o{ AgendaItem : crée
  User ||--o{ SalesGoal : reçoit
  Lead ||--o{ Activity : historise
  Lead ||--o{ AgendaItem : planifie
  Lead ||--o{ LeadAttachment : fichiers
  Activity ||--o| AgendaItem : rendez_vous
  Activity ||--o{ MeetingReschedule : reports_date
  Lead ||--o| Client : convertit
  Client ||--o{ Sale : ventes
```

### Principes clés

- **Multi-tenant par entreprise** : chaque `Lead`, `User`, objectif, etc. est rattaché à une `Company`.
- **Périmètre groupe** : les rôles directrice / PDG / directrice opération peuvent filtrer par `companyId` sur plusieurs filiales.
- **Séparation rendez-vous / agenda** : un rendez-vous est une `Activity` (`MEETING`), synchronisée avec un `AgendaItem` lié.
- **Sécurité en profondeur** : le frontend masque les menus ; le backend impose toujours `requireRole` et le filtre société.

## Fonctionnalités

- **Prospects (leads)** : création, édition, import/export Excel, pièces jointes, intérêts produits/services, conversion en client
- **Clients** : suivi post-conversion et intérêts associés
- **Agenda** : tâches de suivi liées aux prospects (vue fiche + calendrier)
- **Rendez-vous** : planification, report avec historique, modification, rapports d’échange (synchronisés avec l’agenda)
- **Activités** : appels, emails, WhatsApp, notes, rendez-vous
- **Objectifs commerciaux** : cibles conversion / CA par période et par commercial
- **Dashboard & statistiques** : répartition des leads, sources, résumés de ventes, exports
- **Utilisateurs & rôles** : admin, DG (manager), commerciaux, rôles groupe (directrice commerciale, PDG, directrice opération)
- **Corbeille** : soft delete / restauration (managers, admins, rôles groupe)
- **Profil** : mot de passe, MFA (TOTP), signature email, historique d’actions
- **Produits & services** : catalogue par entreprise

## Prérequis

- **Node.js** `>= 20.9.0`
- Une base **PostgreSQL** accessible
- (Optionnel) un serveur SMTP pour l’envoi d’emails

## Installation

```bash
npm install
```

Créez un fichier `.env` (ou `.env.local`) à la racine :

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"

# Emails (optionnel)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="IvorySales <noreply@example.com>"

# Optionnel
# AUTO_AGENDA_ON_LEAD_CREATE=true
# NEXT_PUBLIC_BASE_PATH=
# PORT=3000
```

Générez le client Prisma et appliquez les migrations :

```bash
npx prisma generate
npx prisma migrate deploy
```

## Scripts

| Commande        | Description                                      |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Serveur de développement (Next.js + webpack)     |
| `npm run build` | Génère Prisma Client + build de production       |
| `npm start`     | Démarre le serveur de production (`server.js`)   |
| `npm run lint`  | Lance ESLint                                     |

En local :

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

En production (après `npm run build`) :

```bash
npm start
```

Un endpoint de santé est disponible : `GET /api/health`.

## Rôles

| Rôle (API)                 | Libellé UI              | Périmètre principal                                      |
| -------------------------- | ----------------------- | -------------------------------------------------------- |
| `ADMIN`                    | Admin                   | Accès complet                                            |
| `MANAGER`                  | DG                      | Vision et gestion sur **sa société**                     |
| `AGENT`                    | Commercial              | Ses prospects, activités, agenda, profil                 |
| `DIRECTRICE_COMMERCIALE`   | Directrice commerciale  | Vision **multi-entreprises** (groupe)                     |
| `PDG`                      | PDG                     | Vision multi-entreprises (groupe)                        |
| `DIRECTRICE_OPERATION`     | Directrice opération    | Vision multi-entreprises (groupe)                        |

Les contrôles d’accès sont toujours appliqués côté API (`requireRole`, périmètre société / groupe). Le frontend restreint uniquement la navigation.

## Structure du dépôt

```
prisma/                 # Schéma Prisma et migrations SQL
src/
  app/
    (auth)/             # Login, MFA, mot de passe oublié
    (dashboard)/        # Pages CRM (leads, clients, stats, agenda…)
    api/                # Routes API REST
  components/           # Composants UI métier et shadcn/ui
  contexts/             # AuthContext
  emails/               # Templates React Email
  lib/                  # Auth, rôles, helpers métier, Prisma
  config/               # Listes métier (sources, civilités…)
server.js               # Entrée production Node (cPanel, VPS)
middleware.ts           # Garde des routes côté edge
```

## Sécurité

- Ne committez jamais `.env` / `.env.local` (secrets base, SMTP, etc.).
- Les mutations sensibles sont journalisées (`UserActionLog`).
- Consultez [SECURITY.md](./SECURITY.md) pour le signalement de vulnérabilités.

## Documentation interne

- Guide utilisateur intégré à l’application : route `/guide`
- Conventions rôles / permissions : `.cursor/rules/roles-and-permissions.mdc`
