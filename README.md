# ARABSOFT

ARABSOFT is a role-based internal HR platform built for employee operations, request workflows, payroll documents, project delivery, skills management, SLA supervision, auditability, and real-time collaboration.

This repository contains the exact application version currently used in this workspace, including:

- HR request workflows with manager and RH approval paths
- payslip and work-certificate generation
- employee administration and salary management
- projects, tasks, review flows, and AI-assisted task generation
- internal chat with real-time updates
- SLA tracking, escalations, and dashboard reporting
- audit logs and exports

## What The App Does

The platform is organized around three main roles:

- `COLLABORATEUR`
  - creates and tracks personal requests
  - accesses generated documents
  - follows assigned projects and tasks
  - uses internal chat and personal settings
- `CHEF`
  - reviews team requests
  - supervises team members, tasks, and projects
  - assigns work and reviews deliverables
  - sees SLA and team-level operational indicators
- `RH`
  - manages users, approvals, salaries, signatures, and documents
  - configures SLA rules
  - accesses audit logs and exports
  - has global visibility over the platform

Core business modules:

- Requests: leave, authorization, loan, and document requests
- Documents: payslip PDFs and work certificates
- Payroll: salary grades, salary history, bonuses, and generated payslips
- Projects: project creation, team assignment, task planning, review workflow
- Skills: skill catalog, employee skills, and skill history
- Chat: private and group conversations with real-time delivery
- SLA: deadline computation, warnings, breaches, escalations, reporting
- Audit: traceability for sensitive operations and exports

## Architecture

ARABSOFT is not a plain Next.js CRUD app. It uses a mixed runtime architecture:

- Frontend
  - Next.js 16 App Router
  - React 19
  - Tailwind CSS 4
  - Radix UI / shadcn UI primitives
- Backend
  - Next.js route handlers in `app/api/**`
  - shared server-side service layer in `lib/services/server/**`
  - custom Node server in [server.ts](server.ts)
- Data
  - PostgreSQL
  - Prisma ORM
- Real time and async
  - Socket.IO for live events
  - Kafka for chat/event processing
  - `node-cron` for SLA and scheduled background jobs
- Documents and exports
  - `@react-pdf/renderer` for payslips and dashboard reports
  - Puppeteer for work-certificate PDF rendering
  - spreadsheet export for audit logs

High-level runtime flow:

1. the custom server boots Next.js, Socket.IO, Kafka integration, and cron jobs
2. the UI talks mainly to internal APIs under `app/api/**`
3. those routes delegate business logic to `lib/services/server/**`
4. Prisma persists operational state in PostgreSQL
5. chat and notifications propagate through Socket.IO and Kafka-backed flows
6. long-running business concerns like SLA checks are executed by scheduled jobs

## Repository Layout

- [app](app): pages, layouts, route handlers, dashboard screens
- [components](components): reusable UI building blocks
- [lib](lib): shared helpers, auth, cron, services, document logic
- [prisma](prisma): schema and seed data
- [public](public): static assets and runtime-uploaded public files
- [docs](docs): project summary, handoff notes, and architecture references
- [scripts](scripts): custom dev bootstrapping and utility scripts
- [storage/generated-documents](storage/generated-documents): generated PDFs saved by the app at runtime

## How To Run

### Option 1: Full Docker stack

Use this when you want the app, PostgreSQL, and Kafka in one stack.

1. Copy the environment file.

```bash
cp .env.example .env
```

2. Fill in the required secrets in `.env`.

Important values:

- `JWT_SECRET`
- `INIT_SECRET`
- `SMTP_*`
- `GROQ_API_KEY` if you want AI task generation

3. Start the stack.

```bash
docker compose up --build
```

4. Initialize the database.

```bash
docker compose exec app npx prisma db push
docker compose exec app npm run prisma -- seed
```

If the seed command above does not work in your shell, use:

```bash
docker compose exec app npx prisma db seed
```

5. Open:

```text
http://localhost:3000
```

### Option 2: App locally, services via Docker

This is the most practical local development setup.

1. Copy the environment file.

```bash
cp .env.example .env
```

2. Start PostgreSQL and Kafka only.

```bash
docker compose up -d db kafka
```

3. Use local-compatible values in `.env`.

Recommended:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/portail_rh?schema=public
KAFKA_BROKER=localhost:29094
NEXT_PUBLIC_APP_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

4. Install dependencies.

```bash
npm install
```

5. Sync and seed the database.

```bash
npx prisma db push
npx prisma db seed
```

6. Start the app with the custom dev launcher.

```bash
npm run dev
```

The dev command compiles and launches the custom server through [scripts/run-dev.mjs](scripts/run-dev.mjs), so you still get Socket.IO, cron startup, and the real server runtime.

## Partner Setup

Use these steps when another teammate needs to see the same demo dataset from this repository.

1. Clone the repository and enter it.

```bash
git clone https://github.com/rayenkoutni/ARABSOFT.git
cd ARABSOFT
```

2. Create the local environment file from the example.

```bash
cp .env.example .env
```

3. Set the same seeded login password in `.env`.

```env
SEED_PASSWORD=ChangeMe2024!
```

4. Start the required local services.

```bash
docker compose up -d db kafka
```

5. Install dependencies, sync the schema, and seed the database.

```bash
npm install
npx prisma db push
npx prisma db seed
```

6. Start the app.

```bash
npm run dev
```

If they want the exact seeded state again later, reset the local database and rerun `npx prisma db seed`.

## Useful Commands

```bash
npm run dev
npm run dev:clean
npm run build
npm run start
npx prisma db push
npx prisma db seed
npx tsc --noEmit
```

## Environment Variables

Use [.env.example](.env.example) as the source of truth.

Key groups:

- Database
  - `DATABASE_URL`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
- Auth
  - `JWT_SECRET`
  - `INIT_SECRET`
- Email
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`
- Messaging
  - `KAFKA_BROKER`
- App
  - `NEXT_PUBLIC_APP_URL`
  - `PORT`
  - `NODE_ENV`
- AI
  - `GROQ_API_KEY`

## Seeded Demo Accounts

The seed script creates a demo roster including RH, managers, and collaborators.

Examples:

- `rh@demo.com`
- `chef@demo.com`
- `chef2@demo.com`
- `collab1@demo.com`
- `collab2@demo.com`

Default seeded password:

```text
ChangeMe2024!
```

Or whatever value is set in `SEED_PASSWORD` before running `npx prisma db seed`.

If you reseed a populated database, verify the resulting records before using the environment for demos.

## Operational Notes

- Generated PDFs are stored under `storage/generated-documents/`
- RH signatures are stored under `public/signatures/`
- The custom server starts cron jobs automatically
- Chat is designed around Kafka, but the runtime includes fallback behavior if Kafka is unavailable during boot
- Some settings are persisted in the browser, while business data lives in PostgreSQL

## Documentation

For deeper project context:

- [Full Project Summary](docs/full-project-summary.md)
- [Project Map](docs/PROJECT_MAP.md)
- [Agent Handoff](docs/PROJECT_AGENT_HANDOFF.md)

## Current Repository Notes

- This push intentionally excludes local secrets from `.env`
- `.env.example` is the documented setup reference
- runtime-generated files and temporary build artifacts are ignored where appropriate

## License

Internal project repository for ARABSOFT.
