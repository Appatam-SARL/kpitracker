# Dossier de conception fonctionnelle BPMN 2.0  
## SaaS – Gestion d’agences de sécurité privée (Afrique)

**Version :** 1.0  
**Norme :** BPMN 2.0 (OMG)  
**Outils cibles :** Camunda Modeler · Bizagi Modeler · Draw.io  
**Public :** Product, BA, Architectes, Développeurs workflow / mobile / API

---

## Contenu du dossier

| Fichier | Description |
|---------|-------------|
| [00-CONVENTIONS-BPMN.md](./00-CONVENTIONS-BPMN.md) | Éléments BPMN, rôles/lanes, notifications, intégrations, mapping SaaS |
| [processus/](./processus/) | 17 processus métier détaillés |

Chaque fiche processus contient :

1. Nom · 2. Objectif · 3. Déclencheur · 4. Acteurs · 5. Préconditions  
6. Description détaillée · 7. Tableau des étapes · 8. Gateways · 9. Exceptions  
10. Données · 11. Notifications · 12. KPI · 13. Améliorations  
14. Diagramme ASCII · 15. Diagramme Mermaid  
+ Compléments SaaS (règles, validations, contrôles, risques, automatisation, intégrations)

---

## Catalogue des 17 processus

| N° | Processus | Fichier | Domaine | Workflow ID (indicatif) |
|----|-----------|---------|---------|-------------------------|
| 1 | Pilotage de l’entreprise | [01-pilotage-entreprise.md](./processus/01-pilotage-entreprise.md) | Direction | `WF_PILOTAGE_ENTREPRISE_V1` |
| 2 | Prospection d’un client | [02-prospection-client.md](./processus/02-prospection-client.md) | Commercial | `WF_PROSPECTION_CLIENT_V1` |
| 3 | Contractualisation d’un client | [03-contractualisation-client.md](./processus/03-contractualisation-client.md) | Commercial | `WF_CONTRACTUALISATION_CLIENT_V1` |
| 4 | Création d’un site à sécuriser | [04-creation-site.md](./processus/04-creation-site.md) | Opérations | `WF_CREATION_SITE_V1` |
| 5 | Recrutement d’un agent | [05-recrutement-agent.md](./processus/05-recrutement-agent.md) | RH | `WF_RECRUTEMENT_AGENT_V1` |
| 6 | Affectation d’un agent | [06-affectation-agent.md](./processus/06-affectation-agent.md) | Opérations | `WF_AFFECTATION_AGENT_V1` |
| 7 | Remplacement d’un agent | [07-remplacement-agent.md](./processus/07-remplacement-agent.md) | Opérations | `ops.remplacement-agent.v1` |
| 8 | Prise de service | [08-prise-de-service.md](./processus/08-prise-de-service.md) | Terrain | `ops.prise-de-service.v1` |
| 9 | Pointage de présence | [09-pointage-presence.md](./processus/09-pointage-presence.md) | Terrain | `ops.pointage-presence.v1` |
| 10 | Gestion des rondes | [10-gestion-rondes.md](./processus/10-gestion-rondes.md) | Terrain | `ops.gestion-rondes.v1` |
| 11 | Déclaration d’un incident | [11-declaration-incident.md](./processus/11-declaration-incident.md) | Sécurité | `ops.declaration-incident.v1` |
| 12 | Gestion des absences | [12-gestion-absences.md](./processus/12-gestion-absences.md) | RH / Ops | `ops.gestion-absences.v1` |
| 13 | Gestion des équipements | [13-gestion-equipements.md](./processus/13-gestion-equipements.md) | Logistique | `ops.gestion-equipements.v1` |
| 14 | Facturation | [14-facturation.md](./processus/14-facturation.md) | Finance | `fin.facturation.v1` |
| 15 | Paiement des agents | [15-paiement-agents.md](./processus/15-paiement-agents.md) | Finance / RH | `fin.paiement-agents.v1` |
| 16 | Reporting | [16-reporting.md](./processus/16-reporting.md) | Pilotage | `pil.reporting.v1` |
| 17 | Audit | [17-audit.md](./processus/17-audit.md) | Conformité | `qms.audit.v1` |

---

## Chaîne de valeur (enchaînements)

```
[Pilotage] ──────────────────────────────────────────────► [Reporting] ─► [Audit]
     │
     ▼
[Prospection] ─► [Contractualisation] ─► [Création site]
                                              │
                                              ▼
[Recrutement] ─► [Affectation] ─┬─► [Prise de service] ─► [Pointage]
                                │         │
                                │         ├─► [Rondes]
                                │         └─► [Incident]
                                │
                                ├─► [Absences] ─► [Remplacement]
                                └─► [Équipements]

[Pointage + Contrat + Avenants] ─► [Facturation]
[Pointage + Absences + Primes] ─► [Paiement agents]
```

### Dépendances critiques

| Processus | Dépend de | Déclenche |
|-----------|-----------|-----------|
| Contractualisation | Prospection (devis accepté) | Création site, Facturation |
| Affectation | Recrutement + Site actif | Prise de service, Planning |
| Remplacement | Absence / Incident / Retard | Affectation temporaire |
| Facturation | Contrat + Pointages validés | Relances, Reporting finance |
| Paie | Pointages + Absences + Primes | Mobile money / banque |
| Audit | Tous (piste d’audit) | CAPA → Pilotage |

---

## Matrice d’intégrations (vue produit)

| Processus | WhatsApp | SMS | Email | GPS | QR | NFC | API | IA |
|-----------|:--------:|:---:|:-----:|:---:|:--:|:---:|:---:|:--:|
| 1 Pilotage | ○ | ○ | ● | | | | ● | ● |
| 2 Prospection | ● | ● | ● | ○ | | | ● | ● |
| 3 Contractualisation | ● | ● | ● | | | | ● | ○ |
| 4 Création site | ○ | | ● | ● | ● | ● | ● | ● |
| 5 Recrutement | ● | ● | ● | | | | ● | ● |
| 6 Affectation | ● | ● | ○ | | | | ● | ● |
| 7 Remplacement | ● | ● | | ○ | | | ● | ● |
| 8 Prise de service | ● | ○ | | ● | ● | ● | ● | ○ |
| 9 Pointage | ● | ● | | ● | ● | ● | ● | ● |
| 10 Rondes | ● | ○ | | ● | ● | ● | ● | ● |
| 11 Incident | ● | ● | ● | ● | | | ● | ● |
| 12 Absences | ● | ● | ○ | | | | ● | ● |
| 13 Équipements | ○ | ○ | ● | ○ | ● | ● | ● | ○ |
| 14 Facturation | ● | ● | ● | | | | ● | ○ |
| 15 Paiement agents | ● | ● | ● | | | | ● | ○ |
| 16 Reporting | ○ | | ● | | | | ● | ● |
| 17 Audit | ○ | | ● | | | | ● | ● |

● = cœur de valeur · ○ = optionnel / fallback

---

## Priorisation MVP (recommandation)

### Vague 1 — Opérations terrain (valeur immédiate)
6 Affectation · 8 Prise de service · 9 Pointage · 10 Rondes · 11 Incident · 7 Remplacement

### Vague 2 — Commercial & RH
2 Prospection · 3 Contractualisation · 4 Site · 5 Recrutement · 12 Absences

### Vague 3 — Finance & gouvernance
14 Facturation · 15 Paie · 13 Équipements · 1 Pilotage · 16 Reporting · 17 Audit

---

## Recréation dans les modeleurs

1. Lire [00-CONVENTIONS-BPMN.md](./00-CONVENTIONS-BPMN.md).  
2. Ouvrir la fiche processus.  
3. Recréer le **Pool + Lanes** listés en section 4.  
4. Suivre le **tableau d’étapes** (section 7) et les **gateways** (section 8).  
5. Utiliser le **diagramme ASCII** comme storyboard, le **Mermaid** comme aide visuelle.  
6. Exporter `.bpmn` (Camunda) ou `.bpm` (Bizagi) ; Draw.io : stencil BPMN 2.0.

---

## Prochaines livrables suggérés

- Modèles Camunda `.bpmn` XML versionnés  
- Schéma de données (Prisma / ERD) aligné sur les Data Objects  
- Matrice RBAC par User Task  
- Spécifications API OpenAPI des Service Tasks  
- Backlog tickets (Epic par processus)
