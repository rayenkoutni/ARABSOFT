# HR Platform Context

## 1. Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Node.js runtime with custom `server.ts`
- Prisma ORM
- PostgreSQL
- shadcn/ui + Radix UI
- Tailwind CSS 4
- JWT auth via httpOnly cookie (`token`)
- Nodemailer for emails
- `@react-pdf/renderer` for PDF generation
- `node-cron` for scheduled jobs
- Socket.IO for chat / realtime notifications

Source: [package.json](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/package.json)

## 2. Prisma Schema

Full schema:

- [prisma/schema.prisma](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/prisma/schema.prisma)

Key domains:

- Employees / roles / manager hierarchy
- Requests / approvals / SLA
- Generated documents
- Projects / tasks / reviews
- Skills / history
- Evaluations
- Salary grades / salary history / bonuses / payslips
- Notifications / audit logs
- Conversations / messages

## 3. Project Folder Structure

Main directories:

- `app/`
- `components/`
- `lib/`

Snapshot source files list:

- [docs/platform-context.md](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/docs/platform-context.md:1)

Command used:

```bash
find . -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' | sort
```

Notes:

- App pages and API routes live under `app/`
- Shared UI lives under `components/`
- Business logic and server services live under `lib/`

## 4. API Routes

Full route path list:

- `app/api/audit-logs/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/password/route.ts`
- `app/api/auth/send-otp/route.ts`
- `app/api/auth/verify-otp/route.ts`
- `app/api/bonuses/annual/route.ts`
- `app/api/bonuses/exceptional/route.ts`
- `app/api/bonus-rules/[id]/route.ts`
- `app/api/bonus-rules/route.ts`
- `app/api/conversations/[id]/messages/route.ts`
- `app/api/conversations/[id]/read/route.ts`
- `app/api/conversations/route.ts`
- `app/api/employees/[id]/bonuses/route.ts`
- `app/api/employees/[id]/payslips/route.ts`
- `app/api/employees/[id]/route.ts`
- `app/api/employees/[id]/salary/route.ts`
- `app/api/employees/[id]/salary-grade/route.ts`
- `app/api/employees/[id]/skills/route.ts`
- `app/api/employees/chat/route.ts`
- `app/api/employees/profile/route.ts`
- `app/api/employees/route.ts`
- `app/api/evaluations/route.ts`
- `app/api/init/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/notifications/route.ts`
- `app/api/payslips/[id]/pdf/route.ts`
- `app/api/projects/[id]/approve/route.ts`
- `app/api/projects/[id]/generate-tasks/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/[id]/tasks/review/route.ts`
- `app/api/projects/[id]/tasks/route.ts`
- `app/api/projects/route.ts`
- `app/api/requests/[id]/action/route.ts`
- `app/api/requests/[id]/document/route.ts`
- `app/api/requests/[id]/route.ts`
- `app/api/requests/route.ts`
- `app/api/salary-grades/[id]/route.ts`
- `app/api/salary-grades/route.ts`
- `app/api/skills/[id]/route.ts`
- `app/api/skills/employees/route.ts`
- `app/api/skills/route.ts`
- `app/api/sla/stats/route.ts`
- `app/api/sla-config/[id]/route.ts`
- `app/api/sla-config/route.ts`
- `app/api/tasks/[id]/review/route.ts`
- `app/api/tasks/[id]/submit-review/route.ts`
- `app/api/tasks/route.ts`
- `app/api/users/team/route.ts`

Functional grouping:

- Auth: login, logout, me, OTP, password reset/change
- Employees: CRUD, profile, salary, salary grade, bonuses, skills, payslips
- Requests: creation, update, approval actions, document generation
- Salary: salary grades, bonuses, payslip PDF download
- Projects: project CRUD, task CRUD, task AI generation, approvals/review
- Skills: catalog + employee skill management
- Messaging: conversations, messages, read receipts
- Notifications: list, mark read, clear
- SLA: config + stats
- Audit / initialization helpers

## 5. Authentication Setup

Current user loader:

- [lib/getCurrentUser.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/getCurrentUser.ts)

API middleware:

- [middleware.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/middleware.ts)

Auth summary:

- JWT token stored in cookie named `token`
- `getCurrentUser()` verifies token and loads employee identity from Prisma
- `middleware.ts` applies:
  - CSRF exact-origin checks on mutating API methods
  - in-memory rate limiting on `/api/auth/*`

## 6. Actor Access

Based on current sidebar/navigation and page guards.

### COLLABORATEUR

- `/dashboard`
- `/dashboard/chat`
- `/dashboard/my-requests`
- `/dashboard/new-request`
- `/dashboard/projects`
- `/dashboard/projects/[id]`
- `/dashboard/skills`
- `/dashboard/settings`

### CHEF

- `/dashboard`
- `/dashboard/chat`
- `/dashboard/equipe`
- `/dashboard/team-requests`
- `/dashboard/my-approvals`
- `/dashboard/projects`
- `/dashboard/projects/[id]`
- `/dashboard/skills`
- `/dashboard/settings`

### RH

- `/dashboard`
- `/dashboard/chat`
- `/dashboard/requests`
- `/dashboard/approvals`
- `/dashboard/users`
- `/dashboard/skills`
- `/dashboard/projects`
- `/dashboard/projects/[id]`
- `/dashboard/audit`
- `/dashboard/settings`

## 7. Known Issues or Bugs

- No major blocking type errors currently: `npx next typegen` and `npx tsc --noEmit` pass.
- `npm run lint` currently cannot run in this environment because `eslint` is not installed/resolvable.
- Some older UI files outside the recently touched areas may still contain text encoding inconsistencies and deserve a future sweep.

## 8. Key Service Files

- [lib/services/server/bonus.service.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/bonus.service.ts)
- [lib/services/server/payslip.service.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/payslip.service.ts)
- [lib/cron/monthly-evaluation.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/cron/monthly-evaluation.ts)
- [lib/utils/salary.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/utils/salary.ts)

Related salary/document services:

- [lib/services/server/payslip-pdf.service.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/payslip-pdf.service.tsx)
- [lib/services/server/payslip-export.service.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/payslip-export.service.ts)
- [lib/services/server/salary-history.service.ts](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/lib/services/server/salary-history.service.ts)

## 9. Key Frontend Pages

- [app/dashboard/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/page.tsx)
- [app/dashboard/users/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/users/page.tsx)
- [app/dashboard/equipe/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/equipe/page.tsx)
- [app/dashboard/requests/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/requests/page.tsx)
- [app/dashboard/projects/[id]/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/projects/%5Bid%5D/page.tsx)
- [app/dashboard/new-request/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/new-request/page.tsx)

Other important pages:

- [app/dashboard/approvals/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/approvals/page.tsx)
- [app/dashboard/my-requests/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/my-requests/page.tsx)
- [app/dashboard/team-requests/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/team-requests/page.tsx)
- [app/dashboard/chat/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/chat/page.tsx)
- [app/dashboard/skills/page.tsx](/abs/path/c:/Users/rayen/OneDrive/Bureau/arabsoft/ARABSOFT/app/dashboard/skills/page.tsx)

## 10. Additional Constraints / Notes

- The project is currently being edited in a live local workspace with existing in-progress changes.
- Do not assume all older text content is consistently UTF-8-clean.
- Salary, payslip and RH user-management flows were recently updated and should be treated carefully.
- PDF document styling references ArabSoft branding and the work certificate family.
- Use non-destructive git/file operations because the worktree may already be dirty.
