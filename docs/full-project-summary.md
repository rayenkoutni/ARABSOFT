# ARABSOFT HR Platform - Full Project Summary

Date de mise a jour: 2026-05-28

## 1. Vue d'ensemble

Le projet ARABSOFT est un portail RH collaboratif, role-based, construit autour de plusieurs domaines fonctionnels reunis dans une meme plateforme:

- gestion des demandes RH et de leurs validations
- administration des collaborateurs par les RH
- gestion des projets et des taches
- messagerie interne temps reel
- gestion des competences
- suivi SLA
- journal d'audit
- remuneration, bonus et fiches de paie
- exports documentaires PDF / Excel

Le systeme est deja exploitable sur ses flux principaux, mais tous les modules n'ont pas le meme niveau de maturite. Certains sont tres avances fonctionnellement, alors que d'autres restent partiellement relies ou encore perfectibles sur la rigueur metier.

## 2. Stack technique

- Frontend: Next.js 16 App Router + React 19 + TypeScript
- UI: Tailwind CSS 4 + composants `shadcn/ui` / Radix UI
- Backend HTTP: route handlers Next.js sous `app/api/**`
- Serveur custom: `server.ts`
- Base de donnees: PostgreSQL
- ORM: Prisma
- Authentification: JWT dans cookie `httpOnly` nomme `token`
- Temps reel: Socket.IO
- Pipeline chat: Kafka
- Emails: Nodemailer
- Taches planifiees: `node-cron`
- PDF: `@react-pdf/renderer`

## 3. Architecture globale

### 3.1 Frontend

Le frontend est majoritairement compose de pages client sous `app/dashboard/**`. Les pages utilisent surtout `fetch()` vers les API internes plutot que des server actions.

Les grands blocs frontend sont:

- `app/`: pages, layouts, routes API
- `components/`: composants UI, cartes, dialogues, listes, widgets
- `lib/`: helpers, contextes auth/notifications, services client, logique metier partagee

### 3.2 Backend

Le backend repose sur deux couches:

- les routes actives `app/api/**`, qui constituent le vrai chemin runtime principal
- une couche `lib/services/server/**` plus orientee services, utilisee selon les modules mais pas partout de maniere uniforme

Le serveur custom `server.ts` ajoute:

- Socket.IO
- le producteur Kafka
- le consumer Kafka
- l'initialisation des cron jobs

### 3.3 Base de donnees

Le schema Prisma couvre notamment:

- `Employee`
- `Request`
- `RequestHistory`
- `GeneratedDocument`
- `Project`
- `Task`
- `TaskRequiredSkill`
- `Skill`
- `EmployeeSkill`
- `EmployeeSkillHistory`
- `Evaluation`
- `Bonus`
- `Payslip`
- `SalaryGrade`
- `SalaryHistory`
- `SlaConfig`
- `SlaEvent`
- `Notification`
- `AuditLog`
- `Conversation`
- `Message`
- `MessageRead`

## 4. Roles et acces

### 4.1 COLLABORATEUR

Acces principal:

- tableau de bord personnel
- mes demandes
- nouvelle demande
- projets visibles
- competences personnelles
- chat
- parametres

Capacites principales:

- creer et suivre ses demandes
- consulter ses projets et taches
- faire avancer ses taches
- consulter ses competences et leur historique
- acceder a ses documents generes

### 4.2 CHEF

Acces principal:

- tableau de bord manager
- mon equipe
- demandes equipe
- validations manager
- projets
- chat
- competences equipe
- parametres

Capacites principales:

- consulter et piloter son equipe
- valider ou refuser les demandes au stade manager
- creer et gerer des projets
- creer, assigner et revoir des taches
- attribuer des bonus exceptionnels
- gerer les competences officielles de son equipe
- exporter son rapport PDF executif de dashboard

### 4.3 RH

Acces principal:

- tableau de bord RH
- demandes globales
- approbations RH
- gestion des collaborateurs
- competences
- projets
- journal d'audit
- chat
- parametres

Capacites principales:

- administrer les comptes utilisateurs
- valider les demandes RH
- configurer les SLA
- consulter les logs d'audit
- exporter le journal d'audit en Excel
- exporter le rapport PDF executif global
- administrer le catalogue de competences
- consulter tout l'environnement projet et organisationnel

## 5. Authentification et session

### 5.1 Fonctionnement

Le flux nominal est le suivant:

1. l'utilisateur se connecte avec email + mot de passe
2. l'API verifie le mot de passe chiffre
3. un JWT est emis et pose dans le cookie `token`
4. le frontend recharge l'utilisateur courant via `/api/auth/me`
5. un code OTP peut etre demande et verifie
6. une fois le contexte charge, l'utilisateur accede au dashboard selon son role

### 5.2 Points a retenir

- l'OTP existe dans l'experience de connexion
- l'OTP repose sur `otpCode` et `otpExpiresAt` cote base
- la restauration de session passe par `getCurrentUser()`
- le middleware applique notamment des controles CSRF sur les routes mutatives

### 5.3 Limite actuelle

Le depot indique encore une faiblesse importante: l'OTP reste surtout une barriere cote interface et n'est pas uniformement impose comme second facteur server-side sur tous les points d'entree.

## 6. Navigation et experience dashboard

Le shell dashboard fournit:

- un layout authentifie
- une sidebar/navigation role-aware
- un handler global pour certains evenements de messages
- un systeme de notifications

Le tableau de bord principal affiche selon le role:

- KPI de demandes
- liste recente ou liste d'approbations
- indicateurs SLA pour `RH` et `CHEF`
- export PDF executif pour `RH` et `CHEF`

## 7. Module Demandes RH

### 7.1 Types de demandes

Le systeme gere actuellement:

- `CONGE`
- `AUTORISATION`
- `DOCUMENT`
- `PRET`

### 7.2 Statuts

- `BROUILLON`
- `EN_ATTENTE_CHEF`
- `EN_ATTENTE_RH`
- `APPROUVE`
- `REJETE`

### 7.3 Types de workflow

- `CHEF_THEN_RH`
- `DIRECT_RH`

Les demandes de type `DOCUMENT` et `PRET` passent en `DIRECT_RH`. Les autres passent par `CHEF_THEN_RH`.

### 7.4 Ecrans lies

- `app/dashboard/new-request/page.tsx`
- `app/dashboard/my-requests/page.tsx`
- `app/dashboard/team-requests/page.tsx`
- `app/dashboard/my-approvals/page.tsx`
- `app/dashboard/approvals/page.tsx`
- `app/dashboard/requests/page.tsx`

### 7.5 Workflow collaborateur

1. le collaborateur ouvre `Nouvelle demande`
2. il choisit le type et remplit le formulaire
3. la demande peut etre sauvegardee en brouillon
4. a la soumission, le backend determine le circuit de validation
5. une entree `CREATED` est ajoutee a `RequestHistory`
6. les notifications sont envoyees au manager ou aux RH selon le type
7. le SLA initial est calcule

### 7.6 Workflow manager

1. le `CHEF` consulte `Mes validations` ou `Demandes equipe`
2. il examine la demande
3. il approuve ou rejette
4. si approuve sur un workflow a deux niveaux, la demande passe a `EN_ATTENTE_RH`
5. une entree d'historique est ajoutee
6. l'employe est notifie

### 7.7 Workflow RH

1. le `RH` consulte `Approvals` / `Requests`
2. il valide ou refuse les demandes en attente RH
3. l'historique est enrichi
4. la transition SLA est mise a jour
5. si necessaire, un document est genere automatiquement
6. les notifications finales sont envoyeess

### 7.8 Documents de demandes

Pour les demandes `DOCUMENT`, le systeme peut produire:

- attestation de travail PDF
- fiche de paie PDF selon la demande

Les fichiers generes sont relies a `GeneratedDocument` ou `Payslip` selon le cas.

### 7.9 Limites actuelles

- certaines parties du module restent generiques
- le mode brouillon a historiquement ete un point fragile
- une partie du contenu reste serialisee dans des champs textuels plutot que completement normalisee

## 8. Module SLA

### 8.1 Objectif

Le module SLA suit les delais de traitement des demandes RH.

### 8.2 Capacites actuelles

- configuration par type de demande
- calcul initial de deadline
- indicateurs statistiques
- distribution des statuts SLA
- tendance 30 jours
- KPI de conformite et de depassements

### 8.3 Ecrans lies

- dashboard RH / manager
- onglet SLA dans `Settings` pour RH

### 8.4 Role coverage

- `RH`: vue globale
- `CHEF`: vue limitee a son equipe

## 9. Module Audit Log

### 9.1 Objectif

Tracer les mutations sensibles du systeme.

### 9.2 Ce qui est journalise

Selon les modules, on retrouve notamment:

- creations et actions sur demandes
- evenements de generation documentaire
- operations projets
- operations competences
- exports PDF / Excel recents

### 9.3 Ecran RH

`/dashboard/audit` permet:

- consultation paginee
- recherche par acteur
- filtre par entite

### 9.4 Export Excel

Le journal d'audit dispose maintenant d'un export `.xls` XML Spreadsheet 2003:

- reserve aux RH
- export complet ou selon filtres actifs
- fichier stylise en theme corporate
- ligne d'entete figee
- largeurs de colonnes explicites
- trace d'audit `EXPORT_EXCEL`

## 10. Module Collaborateurs / Administration RH

### 10.1 Ecran principal

`/dashboard/users`

### 10.2 Capacites RH

- lister les collaborateurs
- creer un compte
- modifier un compte
- reinitialiser le mot de passe
- supprimer un compte
- rattacher un collaborateur a un manager
- affecter grade salarial et override salarial
- definir competences techniques initiales pour un collaborateur

### 10.3 Workflow de creation

1. RH ouvre le dialogue de creation
2. saisit les infos personnelles
3. choisit le role
4. choisit le grade salarial
5. si collaborateur, affecte un manager
6. si collaborateur, renseigne les competences techniques minimales
7. le backend cree le compte
8. un mot de passe temporaire est genere
9. un email d'information est envoye

### 10.4 Donnees visibles

- nom
- email
- telephone
- role
- departement
- poste
- statut disponible / en conge
- avatar

## 11. Module Equipe Manager

### 11.1 Ecran principal

`/dashboard/equipe`

### 11.2 Fonctionnalites

- vue carte de l'equipe du manager
- detail d'un collaborateur dans une modale
- consultation des informations RH de base
- consultation remuneration
- consultation bonus
- consultation evaluations
- consultation taches actives
- consultation competences
- attribution d'un bonus exceptionnel

### 11.3 Workflow bonus exceptionnel

1. le chef ouvre la fiche d'un collaborateur
2. clique sur `Donner un bonus exceptionnel`
3. saisit montant, raison, periode eventuelle
4. l'API cree le bonus
5. l'historique du collaborateur est recharge

## 12. Module Competences

### 12.1 Ecran principal

`/dashboard/skills`

### 12.2 Vision par role

- `COLLABORATEUR`: lecture seule de ses competences et de son historique
- `CHEF`: consultation de son equipe + gestion des competences officielles de ses collaborateurs
- `RH`: consultation globale + administration du catalogue de competences

### 12.3 Capacites collaborateurs

- voir competences techniques
- voir competences comportementales
- consulter l'historique des changements

### 12.4 Capacites manager

- rechercher un collaborateur
- consulter ses competences
- voir son historique
- ouvrir le dialogue `Gerer les competences`
- appliquer des actions `ADD`, `LEVEL_UPDATE`, `REMOVE`

### 12.5 Capacites RH

- tout ce que voit le manager
- en plus, administrer le catalogue global
- creer une competence
- modifier une competence
- activer / desactiver une competence
- supprimer une competence sous contraintes d'usage

### 12.6 Types de competences

- `TECHNICAL`
- `SOFT`

### 12.7 Historique

Le systeme conserve un historique dedie via `EmployeeSkillHistory`, avec snapshots metier utiles meme si une competence est archivee ou supprimee.

## 13. Module Projets

### 13.1 Ecrans

- `/dashboard/projects`
- `/dashboard/projects/[id]`

### 13.2 Capacites principales

- lister les projets selon role
- creer un projet
- gerer les membres
- consulter les details
- suivre la progression
- piloter les taches
- demander une validation RH pour certaines modifications de projets RH

### 13.3 Roles

- `CHEF`: creation et pilotage principal
- `COLLABORATEUR`: acces selon appartenance
- `RH`: vue globale et capacites de supervision/edition selon cas

### 13.4 Historique et validation

Le schema comprend `ProjectChangeHistory` pour stocker certains changements soumis a arbitrage.

## 14. Module Taches

### 14.1 Etats

- `TODO`
- `IN_PROGRESS`
- `IN_REVIEW`
- `DONE`

### 14.2 Fonctionnalites

- creation de tache
- assignation
- suivi kanban
- soumission pour revue
- revue manager
- recalcul de progression projet
- notifications associees

### 14.3 Competences requises par tache

Le projet inclut maintenant `TaskRequiredSkill`:

- plusieurs competences techniques par tache
- niveau minimum
- controle anti-doublons
- affichage dans l'UI des taches

## 15. Module Generation IA de taches

### 15.1 Objectif

Proposer automatiquement un lot de taches a partir d'un projet et de son contexte.

### 15.2 Fonctionnement

1. le chef lance la generation
2. le backend appelle Groq
3. une proposition structuree est retournee
4. l'utilisateur previsualise / ajuste
5. les taches retenues sont persistees

### 15.3 Dependance

Cette fonctionnalite depend de la cle `GROQ_API_KEY`.

## 16. Module Chat

### 16.1 Ecran

`/dashboard/chat`

### 16.2 Fonctionnalites

- conversations privees
- conversations de groupe
- envoi / reception temps reel
- chargement de l'historique
- accusés de lecture
- compteurs non lus
- notifications visuelles de nouveaux messages

### 16.3 Architecture

1. le client emet via Socket.IO
2. le serveur valide les droits d'acces
3. le message est publie dans Kafka
4. le consumer persiste le message en base
5. le message est reemis aux participants concernes

### 16.4 Donnees

- `Conversation`
- `Message`
- `MessageRead`

## 17. Module Notifications

### 17.1 Fonctionnalites

- liste des notifications
- marquage lu
- suppression/clear
- affichage dans la navigation

### 17.2 Particularite

Le chat a une logique de non-lu partiellement dediee, distincte des notifications classiques.

## 18. Module Remuneration, Grades, Bonus et Fiches de paie

### 18.1 Concepts

Le schema prend en charge:

- `SalaryGrade`
- `SalaryHistory`
- `Bonus`
- `BonusRule`
- `Payslip`

### 18.2 Capacites actuelles observees

- gestion des grades salariaux via API
- consultation salaire d'un employe
- consultation bonus
- bonus exceptionnels
- bonus annuels
- PDF de fiche de paie
- rattachement des fiches de paie a des demandes documentaires

### 18.3 Role coverage

- RH: administration et vision globale
- CHEF: consultation RH restreinte sur son equipe et bonus exceptionnels
- COLLABORATEUR: acces a ses propres documents selon les flux exposes

## 19. Module Evaluations

### 19.1 Etat actuel

Le schema et l'API existent, mais le module n'est pas encore expose comme un produit complet dedie cote dashboard.

### 19.2 Usage visible aujourd'hui

- le manager peut consulter les evaluations d'un collaborateur depuis `Mon Equipe`
- l'API `/api/evaluations?employeeId=...` respecte un controle `CHEF` / `RH`

### 19.3 Potentiel

Le domaine evaluation semble modele pour etre etendu plus loin.

## 20. Module Parametres

### 20.1 Ecran

`/dashboard/settings`

### 20.2 Fonctionnalites

- photo de profil
- changement de mot de passe
- preferences notifications locales
- theme clair / sombre local
- configuration SLA pour RH

### 20.3 Remarque

Certaines preferences sont purement locales au navigateur, alors que d'autres sont reliees au backend.

## 21. Exports et documents

### 21.1 PDF

Le projet sait generer plusieurs PDFs:

- attestation de travail
- fiche de paie
- rapport executif dashboard RH
- rapport executif dashboard manager

### 21.2 Excel

- export Excel du journal d'audit RH

### 21.3 Rapport executif dashboard

Le rapport PDF executif inclut actuellement:

- en-tete officiel ArabSoft
- date de generation
- nom du responsable
- cartes KPI
- tendance 30 jours SLA
- breaches par type
- repartition des statuts
- audit d'export `EXPORT_PDF`

Le perimetre est:

- `RH`: donnees globales
- `CHEF`: donnees de son equipe

## 22. APIs majeures

### 22.1 Auth

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/send-otp`
- `/api/auth/verify-otp`
- `/api/auth/password`

### 22.2 Demandes

- `/api/requests`
- `/api/requests/[id]`
- `/api/requests/[id]/action`
- `/api/requests/[id]/document`

### 22.3 Employes / RH

- `/api/employees`
- `/api/employees/[id]`
- `/api/employees/profile`
- `/api/users/team`
- `/api/employees/[id]/salary`
- `/api/employees/[id]/bonuses`
- `/api/employees/[id]/payslips`
- `/api/employees/[id]/skills`

### 22.4 Competences

- `/api/skills`
- `/api/skills/[id]`
- `/api/skills/employees`

### 22.5 Projets / Taches

- `/api/projects`
- `/api/projects/[id]`
- `/api/projects/[id]/tasks`
- `/api/projects/[id]/tasks/review`
- `/api/projects/[id]/generate-tasks`
- `/api/projects/[id]/approve`
- `/api/tasks`
- `/api/tasks/[id]/review`
- `/api/tasks/[id]/submit-review`

### 22.6 Chat / Notifications

- `/api/conversations`
- `/api/conversations/[id]/messages`
- `/api/conversations/[id]/read`
- `/api/notifications`
- `/api/notifications/[id]/read`

### 22.7 SLA / Audit / Rapports

- `/api/sla/stats`
- `/api/sla-config`
- `/api/audit-logs`
- `/api/audit-logs/export`
- `/api/dashboard/report`

## 23. Infrastructure et execution locale

### 23.1 Services attendus

- application Next.js + serveur custom
- PostgreSQL
- Kafka
- Zookeeper

### 23.2 Commandes usuelles

- `npm run dev`
- `docker compose up -d db kafka`

### 23.3 Particularite runtime

Le chat et une partie du temps reel supposent la disponibilite de Kafka. Ce n'est pas un simple projet Next.js stateless.

## 24. Forces actuelles du projet

- vraie separation par roles
- plateforme riche fonctionnellement
- workflow de demandes deja complet sur les cas principaux
- administration RH assez developpee
- module competences nettement plus mature qu'avant
- chat temps reel deja en place
- SLA, audit et exports maintenant bien presents
- generation documentaire PDF / Excel deja reliee aux cas metier

## 25. Limitations et points d'attention

### 25.1 Maturite inegale

Tous les modules ne sont pas au meme niveau de robustesse. Certains sont tres aboutis visuellement, d'autres ont encore une dette metier ou technique.

### 25.2 OTP

Le depot documente encore une enforcement MFA incomplete cote serveur.

### 25.3 Leave / conges

Le domaine conges et demandes reste plus generique que ce que le schema pourrait laisser penser.

### 25.4 Couches paralleles

Le code contient parfois:

- logique directe en route handler
- services serveur en parallele
- services client plus anciens

Il faut toujours verifier quelle couche est vraiment utilisee au runtime avant de faire evoluer un flux.

### 25.5 Kafka et serveur custom

Le demarrage et certaines fonctions temps reel dependent de la topologie complete.

## 26. Lecture recommandee du projet

Pour comprendre rapidement le depot, lire dans cet ordre:

1. `prisma/schema.prisma`
2. `server.ts`
3. `lib/getCurrentUser.ts`
4. `app/dashboard/layout.tsx`
5. `app/dashboard/page.tsx`
6. `app/api/requests/route.ts`
7. `app/api/requests/[id]/action/route.ts`
8. `app/api/projects/route.ts`
9. `app/api/projects/[id]/tasks/route.ts`
10. `app/dashboard/projects/[id]/page.tsx`
11. `app/dashboard/skills/page.tsx`
12. `app/dashboard/users/page.tsx`
13. `app/dashboard/equipe/page.tsx`
14. `app/dashboard/chat/page.tsx`
15. `app/dashboard/audit/page.tsx`

## 27. Resume final

ARABSOFT est aujourd'hui une plateforme RH interne multi-modules qui relie administration, workflow, pilotage, collaboration et reporting.

Le coeur reel du produit dans l'etat actuel est:

- demandes RH multi-etapes
- administration utilisateurs RH
- supervision manager de l'equipe
- projets et taches
- chat temps reel
- competences et historique
- SLA et journal d'audit
- generation de documents et exports

Le projet est deja significatif et coherent fonctionnellement. Les prochaines evolutions doivent rester attentives a la realite du runtime, au controle d'acces, et a la dette historique de certains modules plus anciens.
