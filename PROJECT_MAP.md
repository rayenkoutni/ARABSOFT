# Project Map

## Overview

This repository is a Next.js 16 HR portal for ARABSOFT. It supports three roles:

- `RH`: HR/admin users
- `CHEF`: managers
- `COLLABORATEUR`: employees

Main features:

- Cookie-based login with JWT
- Employee request creation and approval workflows
- Notifications
- Employee management for HR
- Task APIs
- Prisma + PostgreSQL persistence

Tech stack:

- Next.js App Router
- React 19
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS v4
- shadcn/ui + Radix UI

## Top-Level Structure

- `app/`: pages, layouts, API routes
- `components/`: project-specific UI plus reusable `components/ui` primitives
- `hooks/`: shared frontend hooks
- `lib/`: auth, Prisma client, fetch/service wrappers, shared types
- `prisma/`: schema, migrations, seed script
- `public/`: logos and placeholder assets
- `styles/`: extra global styling file, likely legacy/redundant vs `app/globals.css`

## Data Model

Defined in `prisma/schema.prisma`.

Main models:

- `Employee`: users with role, optional manager, department, position
- `Request`: employee requests with type, status, approval type, SLA fields
- `RequestHistory`: audit trail for request creation/approval/rejection
- `Task`: assignable tasks
- `Project`: optional grouping for tasks
- `Evaluation`: employee evaluations
- `Notification`: per-user notifications
- `AuditLog`: generic audit entity

Enums:

- `Role`: `COLLABORATEUR`, `CHEF`, `RH`
- `RequestType`: `CONGE`, `AUTORISATION`, `DOCUMENT`, `PRET`
- `RequestStatus`: `BROUILLON`, `EN_ATTENTE_CHEF`, `EN_ATTENTE_RH`, `APPROUVE`, `REJETE`
- `ApprovalType`: `CHEF_THEN_RH`, `DIRECT_RH`

## Auth Flow

Core files:

- `lib/auth.ts`
- `lib/getCurrentUser.ts`
- `lib/auth-context.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`

Behavior:

- Passwords are hashed with `bcryptjs`
- Login validates credentials and stores a JWT in an HTTP-only `token` cookie
- Server routes use `getCurrentUser()` to resolve the logged-in employee
- Client-side auth state is managed by `AuthProvider`

## API Routes

### Auth

- `app/api/auth/login/route.ts`
  - POST login
- `app/api/auth/logout/route.ts`
  - POST logout
- `app/api/auth/me/route.ts`
  - GET current authenticated user

### Employees

- `app/api/employees/route.ts`
  - GET employees, filtered by role
  - POST create employee, RH only
  - Can assign manager/subordinates
  - Creates a welcome notification
  - Tries to send EmailJS onboarding email if env vars exist

- `app/api/employees/[id]/route.ts`
  - PUT update employee, RH only
  - Optional temp password reset
  - DELETE employee with related cleanup, RH only

### Requests

- `app/api/requests/route.ts`
  - GET requests filtered by role
  - POST create request
  - Sets approval path automatically
  - Sets SLA deadline based on request type
  - Creates initial history entry
  - Sends notifications to manager or HR

- `app/api/requests/[id]/action/route.ts`
  - POST approve/reject request
  - `CHEF` moves `EN_ATTENTE_CHEF` to `EN_ATTENTE_RH` or `REJETE`
  - `RH` moves `EN_ATTENTE_RH` to `APPROUVE` or `REJETE`
  - Adds request history
  - Sends follow-up notifications

### Tasks

- `app/api/tasks/route.ts`
  - GET tasks filtered by role
  - POST create task
  - `COLLABORATEUR` cannot create tasks

### Notifications

- `app/api/notifications/route.ts`
  - GET current user notifications

- `app/api/notifications/[id]/read/route.ts`
  - PATCH mark one notification as read

## App Pages

### Public

- `app/page.tsx`
  - Login page

### Layouts

- `app/layout.tsx`
  - Root layout, fonts, auth provider, analytics, theme bootstrap

- `app/dashboard/layout.tsx`
  - Protected dashboard shell with top nav and sidebar

### Dashboard Pages

- `app/dashboard/page.tsx`
  - Overview dashboard with stats and recent requests

- `app/dashboard/requests/page.tsx`
  - RH view of all requests

- `app/dashboard/approvals/page.tsx`
  - RH approval queue

- `app/dashboard/my-approvals/page.tsx`
  - Manager approval queue

- `app/dashboard/my-requests/page.tsx`
  - Employee request list

- `app/dashboard/new-request/page.tsx`
  - Employee request creation form

- `app/dashboard/team-requests/page.tsx`
  - Manager team requests view

- `app/dashboard/users/page.tsx`
  - RH employee management UI

- `app/dashboard/settings/page.tsx`
  - User profile/settings UI
  - Includes local avatar/profile/theme/preferences storage

## Shared Frontend Services

In `lib/`:

- `request-service.ts`
  - Frontend wrapper over request APIs
  - Also computes simple dashboard stats client-side

- `task-service.ts`
  - Frontend wrapper over task API

- `employee-service.ts`
  - Frontend wrapper over employees API

- `types.ts`
  - Shared app types for user, request, history, stats

- `utils.ts`
  - `cn()` helper for class merging

## Important Components

Project-specific components:

- `components/navigation.tsx`
  - Top bar with notifications, avatar, settings, logout

- `components/sidebar.tsx`
  - Role-based sidebar navigation

- `components/request-card.tsx`
  - Standard request summary card

- `components/approval-timeline.tsx`
  - Request history timeline

- `components/stat-card.tsx`
  - Dashboard stat card

- `components/theme-provider.tsx`
  - Wrapper around `next-themes`

Reusable UI system:

- `components/ui/`
  - Mostly shadcn/ui and Radix-based primitives such as buttons, cards, inputs, dialogs, tabs, tables, selects, badges, dropdowns, switches, toast, etc.

Notable custom helpers inside `components/ui/`:

- `spinner.tsx`
  - Generic spinner plus branded loading state
- `field.tsx`
  - Structured form layout helpers
- `empty.tsx`
  - Empty-state layout helpers
- `item.tsx`
  - Generic item/list layout helpers
- `button-group.tsx`
  - Grouped button layout helpers
- `input-group.tsx`
  - Input wrappers with addons/buttons

## Hooks

- `hooks/use-toast.ts`
  - App toast state helper
- `hooks/use-mobile.ts`
  - Mobile breakpoint helper

There are also UI-scoped hook variants under `components/ui/`.

## Styling

- `app/globals.css`
  - Main theme tokens, light/dark variables, brand palette, Tailwind theme bindings

- `styles/globals.css`
  - Secondary global style file that appears older or unused compared to `app/globals.css`

## Seed Data

`prisma/seed.ts` creates demo users:

- `rh@demo.com / password123`
- `chef@demo.com / password123`
- `chef2@demo.com / password123`
- `collab1@demo.com / password123`

## Environment Notes

Important env vars include:

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_PRIVATE_KEY`

## Known Caveats

- `app/dashboard/settings/page.tsx` calls `/api/auth/password`, but that route does not exist yet.
- Some UI text appears to have encoding issues such as `Ã©` instead of `é`.
- `next.config.mjs` sets `typescript.ignoreBuildErrors = true`, so type errors may not block builds.
- `styles/globals.css` may be redundant.
- `requestService.submitRequest()` is effectively a compatibility no-op.

## Fast Orientation For A New Chat

If you only need the core business logic, read these first:

1. `prisma/schema.prisma`
2. `lib/auth.ts`
3. `lib/getCurrentUser.ts`
4. `app/api/requests/route.ts`
5. `app/api/requests/[id]/action/route.ts`
6. `app/api/employees/route.ts`
7. `app/api/employees/[id]/route.ts`
8. `app/dashboard/page.tsx`
9. `components/navigation.tsx`
10. `components/sidebar.tsx`
