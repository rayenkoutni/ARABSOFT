# Project Map

This document is a fast orientation guide for engineers opening the repository for the first time.

## Runtime Entry Points

- [server.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/server.ts:1)
  - boots Next.js
  - initializes Socket.IO
  - initializes Kafka-backed chat processing
  - starts cron jobs
- [scripts/run-dev.mjs](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/scripts/run-dev.mjs:1)
  - local dev launcher for the custom server
  - compiles `server.ts` before boot

## Main App Areas

- [app/dashboard](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard:1)
  - authenticated application UI
  - role-based pages for RH, manager, and collaborator flows
- [app/api](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api:1)
  - internal HTTP APIs used by the frontend
- [components](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/components:1)
  - reusable UI, dialogs, navigation, uploaders, and shared widgets
- [lib/services/server](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server:1)
  - backend business logic
  - auth, requests, documents, payroll, projects, SLA, audit, notifications
- [prisma/schema.prisma](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/prisma/schema.prisma:1)
  - source of truth for the data model

## Key Business Flows

### Authentication

- login and OTP APIs:
  - [app/api/auth/login/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/auth/login/route.ts:1)
  - [app/api/auth/verify-otp/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/auth/verify-otp/route.ts:1)
- server auth logic:
  - [lib/services/server/auth.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/auth.service.ts:1)
- auth state on the client:
  - [lib/contexts/auth.context.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/contexts/auth.context.tsx:1)

### Requests And Approvals

- UI:
  - [app/dashboard/new-request/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/new-request/page.tsx:1)
  - [app/dashboard/approvals/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/approvals/page.tsx:1)
  - [app/dashboard/my-approvals/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/my-approvals/page.tsx:1)
- API:
  - [app/api/requests/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/requests/route.ts:1)
  - [app/api/requests/[id]/action/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/requests/[id]/action/route.ts:1)
- service layer:
  - [lib/services/server/request.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/request.service.ts:1)

### Documents And Payroll

- work certificate generation:
  - [lib/documents/work-certificate.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/documents/work-certificate.ts:1)
  - [lib/services/server/documents.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/documents.service.ts:1)
- payslip generation:
  - [lib/services/server/payslip.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/payslip.service.ts:1)
  - [lib/services/server/payslip-pdf.service.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/payslip-pdf.service.tsx:1)
- RH signature handling:
  - [app/api/rh/signature/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/rh/signature/route.ts:1)
  - [lib/services/server/signature.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/signature.service.ts:1)

### Projects, Tasks, And AI Assistance

- project list/details:
  - [app/dashboard/projects/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/projects/page.tsx:1)
  - [app/dashboard/projects/[id]/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/projects/[id]/page.tsx:1)
- APIs:
  - [app/api/projects/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/projects/route.ts:1)
  - [app/api/projects/[id]/tasks/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/projects/[id]/tasks/route.ts:1)
  - [app/api/projects/[id]/generate-tasks/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/projects/[id]/generate-tasks/route.ts:1)
- services:
  - [lib/services/server/projects.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/projects.service.ts:1)
  - [lib/services/server/tasks.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/tasks.service.ts:1)

### Skills

- UI:
  - [app/dashboard/skills/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/skills/page.tsx:1)
- APIs and services:
  - [app/api/skills/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/skills/route.ts:1)
  - [lib/services/server/skills.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/skills.service.ts:1)

### Chat And Notifications

- chat UI:
  - [app/dashboard/chat/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/chat/page.tsx:1)
- chat API:
  - [app/api/conversations/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/conversations/route.ts:1)
- services:
  - [lib/services/server/chat.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/chat.service.ts:1)
  - [lib/services/server/socket.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/socket.service.ts:1)
  - [lib/services/server/notification.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/notification.service.ts:1)

### SLA, Reporting, And Audit

- cron:
  - [lib/cron.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/cron.ts:1)
- SLA:
  - [lib/services/server/sla.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/sla.service.ts:1)
  - [app/api/sla/stats/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/sla/stats/route.ts:1)
- audit:
  - [app/dashboard/audit/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/audit/page.tsx:1)
  - [app/api/audit-logs/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/audit-logs/route.ts:1)
  - [app/api/audit-logs/export/route.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/api/audit-logs/export/route.ts:1)

## Recommended Reading Order

1. [README.md](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/README.md:1)
2. [prisma/schema.prisma](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/prisma/schema.prisma:1)
3. [server.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/server.ts:1)
4. [lib/services/server/auth.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/auth.service.ts:1)
5. [lib/services/server/request.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/request.service.ts:1)
6. [lib/services/server/sla.service.ts](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/sla.service.ts:1)
7. [app/dashboard/page.tsx](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/page.tsx:1)
8. [docs/full-project-summary.md](/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/docs/full-project-summary.md:1)
