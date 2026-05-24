# ArabSoft Project And Collaboration Handoff

This file is a practical handoff note for:

- another AI agent joining this workspace later
- a human developer who has never worked on this project

It explains both:

1. the current project as it actually exists today
2. the working style and recurring expectations of the current user

This file is intentionally more execution-oriented than `README.md`, and more compact and action-oriented than `project_map1,1.md`.

Do not copy secrets from `.env` into docs, commits, screenshots, or chat summaries.

## 1. What This Project Is

ArabSoft is a role-based internal HR portal built with:

- Next.js App Router
- Prisma + PostgreSQL
- a custom `server.ts`
- Socket.IO
- Kafka
- a mixed UI stack around Tailwind and shadcn-style components

The product currently combines several domains:

- employee/user administration
- HR request workflows
- project/task management
- internal chat
- skills management
- SLA monitoring
- audit logging

The project is functional, but not uniformly mature. Some modules feel product-ready at the UI level while still carrying incomplete backend logic, duplicated abstractions, or security/consistency gaps.

## 2. What Is Already Done

### Core platform

- Authentication exists with JWT cookie sessions.
- OTP exists in the login flow.
- Role system exists: `COLLABORATEUR`, `CHEF`, `RH`.
- Notifications exist and are persisted in DB.
- Audit logs exist and are viewable by RH.
- Kafka-backed chat exists with Socket.IO real-time behavior.

### HR / users

- RH can create, edit, delete users.
- RH user creation is much more mature than some other modules.
- User creation is connected to email sending and temporary password generation.
- The users page includes a derived "En Conge" / "Disponible" status, though its semantics are weak today.

### Request workflow module

- Generic request workflow exists for:
  - `CONGE`
  - `AUTORISATION`
  - `DOCUMENT`
  - `PRET`
- Drafts exist.
- Approval history exists through `RequestHistory`.
- Manager and RH pending/history pages exist.
- Dashboard cards and request cards exist.
- Search and created-at date filters exist on request listing pages.
- SLA configuration and SLA stats screens exist for RH.

### Projects / tasks

- Projects, tasks, team assignment, task status movement, AI task generation, review flow, and notifications exist.
- Recently added: required technical skills per task with minimum level.
- Required task skills are now normalized in DB through `TaskRequiredSkill`.
- Task creation modal supports dynamic required-skill rows.
- Task cards display required skill badges.
- Existing demo tasks were populated with required technical skills.
- The task creation modal also received a targeted layout + scroll fix so the dialog remains usable when multiple required skills are added.

### Skills module

- Skills catalog exists with `SOFT` and `TECHNICAL`.
- Collaborator skill profiles exist.
- Skill history exists and now uses snapshot fields (`skillName`, `skillType`) rather than depending only on live joins.
- RH / chef / collaborator skill history views were restored after schema drift issues.
- Chef "Gerer les competences" flow was repaired.
- Collaborator current competencies loading was restored.

## 3. Recent Important Work In This Workspace

These are especially important because another agent may otherwise misread the current state.

### Skills history / profile repair

The serious skills regression was not fixed by rolling back code. It was resolved by aligning the local database with the intended schema and keeping the Part 3 snapshot-history behavior.

Important migration:

- `prisma/migrations/20260424113000_snapshot_employee_skill_history_and_relax_skill_delete_rules`

Important outcome:

- `EmployeeSkillHistory.skillId` is nullable
- history rendering must tolerate deleted skills
- history should rely on stable snapshot fields

### Task required skills feature

A targeted feature extension was added to the project/tasks module:

- new relation model: `TaskRequiredSkill`
- task creation can capture required technical skills + minimum level
- duplicates are blocked
- backend enforces technical-only active skills
- task cards display requirements
- demo tasks were populated for immediate testing

Important migration:

- `prisma/migrations/20260425113000_add_task_required_skills`

Important supporting file:

- `lib/tasks.ts`

### Task modal UI cleanup

The "Creer une nouvelle tache" modal was later improved without changing the feature itself:

- required-skill rows were restructured for readability
- the dialog body became properly scrollable
- dialog height/width were constrained in a way consistent with other dialogs

## 4. What Is Still Not Done

These are the major incomplete or partially implemented areas.

### Leave / request module is still generic and under-modeled

The schema suggests richer request handling, but the actual leave flow is still mostly a generic text request.

Still missing for real leave management:

- proper leave date fields in UI
- balance / quota / remaining leave tracking
- overlap checks
- leave duration calculation
- cancellation / withdrawal flow
- structured validation per request type
- robust draft-to-submitted transition
- stricter server-side permission checks

### OTP is not truly enforced server-side

The UI treats OTP as mandatory, but backend/API access is still mostly cookie/JWT based after login.

This means:

- OTP behaves more like a client gate than a true second factor
- server routes do not generally enforce OTP completion state

### Service layer is only partially real

There are two backend styles in the repo:

- direct route handlers using Prisma
- a service-oriented layer under `lib/services/server/**`

In practice, the direct route handlers are the real runtime path for most features. The service layer often looks like a refactor-in-progress or a partially abandoned consolidation.

### Type and architectural hygiene are still uneven

- `next.config.mjs` ignores TypeScript build errors
- there are duplicated status/type label helpers
- some pages contain English fallback text while the main UI is French
- some APIs rely on implicit assumptions instead of explicit validation

## 5. Weak Points Of The Project So Far

These are the most important technical weak points to keep in mind before changing anything.

### 1. Request / leave module has the most business-logic debt

Actual issues include:

- draft submission is broken after reopening/editing
- edited draft content can remain stale because the parser prefers the original `CREATED` history comment
- API editing is not limited to drafts even though comments suggest it should be
- action endpoints do not validate ownership/team membership strongly enough
- invalid action payloads can fall through in unsafe ways
- there is no structured leave modeling despite schema hints

### 2. Security and permission boundaries are inconsistent

Examples:

- OTP is not fully server-enforced
- some request routes trust role/status but not full ownership
- some page-level restrictions are stronger than backend restrictions

### 3. Repo maturity is uneven

Some modules are well-finished from the UI side but still have:

- duplicated utilities
- direct `fetch` calls everywhere
- route-local business logic
- legacy or parallel abstractions that are not the true source of behavior

### 4. Kafka is a hard runtime dependency for local startup

The app is not a pure Next.js app. Local startup assumptions matter.

### 5. Local database state matters a lot

Several regressions in this project were caused by schema drift, not bad application code.

Always verify migrations before diagnosing higher-level behavior.

## 6. Module-By-Module Status Snapshot

### Authentication

Status: usable, but not security-complete.

### Requests / leave

Status: operational for simple generic requests, but still the weakest business module.

### Employee management

Status: fairly strong and connected.

### Projects / tasks

Status: strong enough for normal use, with recent required-skill support added.

### Skills

Status: significantly improved recently, but schema-sensitive.

### Chat

Status: present and architecturally heavier because of Kafka + Socket.IO.

### SLA / audit / notifications

Status: present, but some logic should be reviewed before treating it as production-grade.

## 7. Important Files To Read First

If a new agent needs fast orientation, start here:

- `project_map1,1.md`
- `prisma/schema.prisma`
- `server.ts`
- `lib/getCurrentUser.ts`
- `lib/index.ts`
- `app/api/requests/route.ts`
- `app/api/requests/[id]/route.ts`
- `app/api/requests/[id]/action/route.ts`
- `lib/services/request.service.ts`
- `app/dashboard/new-request/page.tsx`
- `app/dashboard/my-requests/page.tsx`
- `app/dashboard/my-approvals/page.tsx`
- `app/dashboard/approvals/page.tsx`
- `app/api/projects/[id]/tasks/route.ts`
- `lib/tasks.ts`
- `app/dashboard/projects/[id]/page.tsx`
- `components/skills/skill-management-dialog.tsx`

## 8. Local Working Assumptions

This project is being worked on from Windows / PowerShell.

Useful local patterns from actual work:

- Start Kafka only:
  - `docker compose up -d kafka`
- If local Postgres is needed too:
  - `docker compose up -d db kafka`
- Then start app locally:
  - `npm run dev`

Prisma note:

- On this machine, `npx` from PowerShell may require:
  - `cmd /c npx prisma ...`

Important warning:

- `docker compose down` removes containers
- it does not normally wipe DB data unless `-v` is used

## 9. How This User Usually Works With The Agent

This section is critical if another AI agent continues the collaboration.

### Prompt style

The user often gives prompts like:

- "Read the current repository carefully"
- "Do a targeted pass only for X module"
- "Do not redesign unrelated parts"
- "Reuse existing services / DTOs / queries / components whenever possible"
- "Keep all user-facing text in French"
- "Fix the root cause, not just symptoms"
- "Explain the technical summary at the end"

This means the agent should:

- inspect before changing
- avoid wide refactors unless explicitly requested
- preserve the current app's visual and structural language
- prefer local consistency over ideal greenfield redesign

### Collaboration expectations

The user generally wants:

- a careful reading of the repo before edits
- action, not just theory
- targeted implementation
- concise but honest summaries
- minimal unnecessary back-and-forth

If there is a likely root cause in schema or runtime state, the user prefers that the agent verify it rather than assuming code is wrong.

### Common recurring constraints from past work

- Keep the UI text in French.
- Preserve existing patterns.
- Do not widen scope silently.
- For regressions, trace end-to-end flow across DB, backend, mappers, and UI.
- For feature work, add only what is needed for that feature.
- Prefer clean fixes over temporary hacks.

## 10. Things Another Agent Should Remember

- Do not leak `.env` values into documentation or chat summaries.
- Be suspicious of "intended" behavior; verify what the repo actually does.
- In this project, DB schema state can be the real bug.
- The leave module looks more complete in schema than it is in the actual UI/backend flow.
- The request service on the client is real and used heavily.
- The request server service is mostly informative unless you confirm a route actually uses it.
- The skills module and task required-skills feature are now more mature than the leave module.

## 11. Recommended Working Method For Future Changes

If you are the next agent, this is the safest workflow:

1. Read the specific module end to end before editing.
2. Verify whether behavior comes from:
   - schema
   - route handler
   - client service
   - mapper/parser
   - page/component assumptions
3. Check whether the DB needs migration alignment before changing code.
4. Keep scope narrow unless the user explicitly asks for broader architecture work.
5. Reuse existing UI/dialog patterns from nearby modules.
6. Keep French UI text consistent.
7. Finish with a short technical summary that states:
   - root cause
   - files/layers changed
   - what behavior is now restored or added

## 12. If More Detail Is Needed

Use these existing files as deeper references:

- `project_map1,1.md` for a broad technical walkthrough
- `PROJECT_MAP.md` for a lighter project summary

This handoff file should be treated as the practical "how to continue this workspace" note.
