# Conventions BPMN 2.0 – Plateforme SaaS Agences de Sécurité Privée

## Périmètre marché

Plateforme destinée aux agences de sécurité privée en Afrique (Côte d’Ivoire, Sénégal, Cameroun, etc.) : multi-sites, multi-agents, contraintes de connectivité intermittente, usage mobile intensif, notifications WhatsApp / SMS prioritaires sur l’email.

## Éléments BPMN utilisés

| Élément | Usage |
|---------|--------|
| **Pool** | Organisation (Agence) ou partenaire externe (Client, Banque, Autorité) |
| **Lane** | Rôle métier interne (Directeur, Chef de site, Agent, RH, Comptabilité, Système) |
| **Start Event** | Déclenchement (manuel, message, timer, signal) |
| **End Event** | Terminaison normale / erreur / compensation |
| **User Task** | Action humaine dans l’UI SaaS |
| **Service Task** | Traitement automatique (API, calcul, IA, GPS) |
| **Manual Task** | Action hors système (visite terrain, signature papier) |
| **Exclusive Gateway (XOR)** | Décision exclusive |
| **Parallel Gateway (AND)** | Parallélisation / synchronisation |
| **Intermediate Timer** | Délais, échéances, rappels |
| **Intermediate Message** | Envoi/réception WhatsApp, SMS, Email, API |
| **Intermediate Error / Boundary** | Exceptions métier |
| **Sequence Flow** | Flux interne |
| **Message Flow** | Flux inter-pool |
| **Data Object / Data Store** | Entités métier persistées |

## Convention de nommage des IDs workflow (Camunda / moteur)

`{domaine}.{processus}.{version}` — ex. `ops.affectation-agent.v1`

Clés de corrélation : `companyId`, `siteId`, `agentId`, `contractId`, `incidentId`.

## Rôles transverses (Lanes types)

| Lane | Rôle |
|------|------|
| Direction / Pilotage | Stratégie, validation budgétaire, audit |
| Commercial | Prospection, devis, contractualisation |
| RH / Recrutement | Agents, dossiers, formations |
| Opérations / Dispatch | Affectations, remplacements, planning |
| Chef de site | Prise de service, rondes, incidents terrain |
| Agent de sécurité | Pointage, rondes, déclaration |
| Comptabilité / Finance | Facturation, paie |
| Système | Automatismes, timers, notifications, IA |

## Statuts génériques

`DRAFT` → `PENDING_VALIDATION` → `APPROVED` / `REJECTED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED` / `FAILED`

## Canaux de notification (priorité Afrique)

1. WhatsApp Business API  
2. SMS (fallback hors data)  
3. Push mobile  
4. Email (reporting, pièces jointes)  
5. Appel vocal IVR (incidents critiques)

## Intégrations transverses

| Canal | Cas d’usage |
|-------|-------------|
| WhatsApp / SMS | Confirmations, alertes incident, rappels pointage |
| Email | Contrats PDF, factures, rapports |
| GPS | Géofencing prise de service, rondes, absences |
| QR Code / NFC | Pointage, checkpoints ronde, inventaire équipement |
| API | Paiement mobile money, banque, cartographie, RH |
| IA | Scoring prospection, détection anomalie pointage, résumé incident, prédiction absences |

## Mapping implémentation SaaS

Chaque **User Task** = écran + permission RBAC + audit log.  
Chaque **Service Task** = job / webhook / worker Camunda (ou moteur équivalent).  
Chaque **Timer** = scheduler + SLA.  
Chaque **Data Object** = table Prisma / entité API + DTO validation Zod.
