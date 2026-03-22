# Project Map 1.1

## Purpose Of This Document

This file documents the **current** project state as of the latest request-management changes. It is intentionally delta-oriented relative to [PROJECT_MAP.md](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/PROJECT_MAP.md): it explains how the application works now, what is outdated in the older map, and where recent behavior has been implemented.

It is meant to be a practical reference for a developer or AI agent continuing work without having to rediscover the current request workflow, page semantics, filtering model, and modal/navigation behavior.

## Project Overview

This is a Next.js App Router HR portal with three roles:

- `COLLABORATEUR`: creates and tracks own requests
- `CHEF`: reviews team requests and approves the manager step
- `RH`: final approver for RH-stage requests and owner of user administration

The most actively evolved part of the codebase is the **request lifecycle UI**:

- request creation
- role-specific request history pages
- role-specific pending approval queues
- shared request card rendering
- workflow trail / audit-history rendering
- deep-linked approval popups
- client-side search + filtering

## Current Architecture

### Backend Shape

- [app/api/requests/route.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/api/requests/route.ts)
  - Central request read/create endpoint.
  - `GET` now has **role-aware view partitioning** via `view` query params:
    - RH:
      - `rh-pending` => only `EN_ATTENTE_CHEF` + `EN_ATTENTE_RH`
      - `rh-history` => only terminal `APPROUVE` + `REJETE`
    - CHEF:
      - `pending` => only `CHEF_THEN_RH` requests in `EN_ATTENTE_CHEF` + `EN_ATTENTE_RH`
      - `history` => only `CHEF_THEN_RH` requests in `APPROUVE` + `REJETE`
    - COLLABORATEUR:
      - receives own requests without role-specific `view` partitioning
  - `POST` creates requests, derives `approvalType`, initial `status`, initial history entry, SLA deadline, and notifications.

- [app/api/requests/[id]/action/route.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/api/requests/[id]/action/route.ts)
  - Enforces approval transitions:
    - `CHEF` can act only on `EN_ATTENTE_CHEF`
    - `RH` can act only on `EN_ATTENTE_RH`
  - Writes `RequestHistory` entries for `APPROVE` / `REJECT`
  - Sends employee notification updates and RH escalation notifications

### Frontend Service Layer

- [lib/request-service.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-service.ts)
  - Thin fetch wrapper around `/api/requests`
  - Important semantic methods:
    - `getManagerPendingRequests()`
    - `getManagerHistoryRequests()`
    - `getRHPendingRequests()`
    - `getRHHistoryRequests()`
    - `getUserRequests()`
  - Still contains compatibility/legacy patterns:
    - `getUserRequests()` currently delegates to unscoped `getRequests()`, relying on backend role scoping
    - `submitRequest()` is still a compatibility no-op

## Request Workflow Model By Role

### Collaborateur

- Creates draft or submitted requests from [app/dashboard/new-request/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/new-request/page.tsx)
- Sees own requests in [app/dashboard/my-requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/my-requests/page.tsx)
- Dataset includes broader lifecycle states:
  - `BROUILLON`
  - `EN_ATTENTE_CHEF`
  - `EN_ATTENTE_RH`
  - `APPROUVE`
  - `REJETE`

### Chef

- Queue page: [app/dashboard/my-approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/my-approvals/page.tsx)
  - Visible pending set: `EN_ATTENTE_CHEF` + `EN_ATTENTE_RH`
  - Actionable subset: only `EN_ATTENTE_CHEF`
  - `EN_ATTENTE_RH` remains visible as workflow-tracking, non-clickable
- History page: [app/dashboard/team-requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/team-requests/page.tsx)
  - Terminal-only view: `APPROUVE` + `REJETE`
  - `EN_ATTENTE_RH` was explicitly removed from this page and belongs in the pending workflow queue instead

### RH

- Queue page: [app/dashboard/approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/approvals/page.tsx)
  - Visible pending set: `EN_ATTENTE_CHEF` + `EN_ATTENTE_RH`
  - Actionable subset: only `EN_ATTENTE_RH`
  - `EN_ATTENTE_CHEF` remains visible as tracking-only, non-clickable
- History page: [app/dashboard/requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/requests/page.tsx)
  - Terminal-only history: `APPROUVE` + `REJETE`
  - No pending requests should appear here anymore

## Important Pages And Responsibilities

### Dashboard Overview

- [app/dashboard/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/page.tsx)
  - Shared top-level role dashboard
  - Uses role to decide what “recent” means:
    - RH: all requests
    - CHEF: manager pending queue
    - COLLABORATEUR: own requests
  - Deep-links `Examiner` actions:
    - CHEF => `/dashboard/my-approvals?requestId=...`
    - RH => `/dashboard/approvals?requestId=...`

### RH History

- [app/dashboard/requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/requests/page.tsx)
  - Purpose is now **history only**, not “all requests”
  - Uses tabs:
    - `Tous`
    - `Approuvees`
    - `Rejetees`
  - Uses search + date-range + type filters

### Chef History

- [app/dashboard/team-requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/team-requests/page.tsx)
  - Mirrors RH history structure, but scoped to manager-relevant terminal team requests
  - Same search/date/type/status filter model as RH history

### Collaborateur Requests

- [app/dashboard/my-requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/my-requests/page.tsx)
  - Same filter UI model as history pages, but extended statuses:
    - `Tous`
    - `Approuvees`
    - `Rejetees`
    - `En attente`
    - `Brouillon`

### Pending Approval Queues

- [app/dashboard/my-approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/my-approvals/page.tsx)
- [app/dashboard/approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/approvals/page.tsx)
  - Both now support:
    - shared card-content search
    - status tabs: `Tous`, `En attente Chef`, `En attente RH`
    - date range filter
    - request type filter
  - These filters narrow the queue only; they do **not** change action permissions

## Shared Components And Utilities

### Request Card Stack

- [components/request-card.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/components/request-card.tsx)
  - Central card renderer used across history pages, dashboard previews, and queues
  - Displays:
    - labeled `Title:`
    - labeled `Description:`
    - employee/requester name when present
    - type badge
    - status badge
    - request timestamp
    - workflow trail
    - conditional `Examiner` affordance
  - Layout hardened for long content with wrapping and line-clamped preview text

- [components/request-workflow-trail.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/components/request-workflow-trail.tsx)
  - Shared condensed per-card workflow history renderer
  - Used for all roles
  - Shows:
    - approved/rejected steps that actually happened
    - pending next-step placeholder when workflow still active
    - inline decision comments when present

- [components/approval-timeline.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/components/approval-timeline.tsx)
  - Full detail timeline used inside approval/detail dialogs
  - Wraps long comments and shows formatted timestamps

### Request-Domain Utilities

- [lib/request-content.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-content.ts)
  - Parses request title/description from the `CREATED` history entry comment using `[title] - description`
  - Falls back to request type as title when parsing fails

- [lib/request-workflow.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-workflow.ts)
  - Serializes workflow into shared display steps
  - Decides contextual actor role (`Chef` vs `RH`)
  - Adds pending labels only when appropriate

- [lib/request-actions.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-actions.ts)
  - Centralizes “is this request actionable for this role right now?”
  - Current rule is intentionally simple:
    - CHEF => only `EN_ATTENTE_CHEF`
    - RH => only `EN_ATTENTE_RH`

- [lib/request-search.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-search.ts)
  - Builds normalized searchable text from what users actually see on the card:
    - title
    - description
    - type
    - employee name
    - status label
    - displayed timestamp
    - workflow steps
    - workflow comments
  - Shared by history pages and pending-approval pages

- [lib/request-date.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-date.ts)
  - Shared date-time formatting helper
  - The app now prefers date + hour + minute everywhere for request events

- [lib/request-date-filter.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-date-filter.ts)
  - Shared inclusive `from/to` date range filter
  - Used by history pages and pending queue pages

- [lib/request-type.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-type.ts)
  - Shared request type label map used by the filter dropdowns

## Search / Filter / Status Logic

### Shared Pattern Now In Use

History pages and pending-approval pages increasingly follow the same pattern:

1. load role-scoped dataset from backend
2. optionally reduce by shared search text
3. optionally reduce by date range
4. optionally reduce by request type
5. finally apply status tab filter

This means the final visible card list is the intersection of:

- role visibility rules
- search term
- date range
- request type
- selected status tab

### Status Tabs By Page

- RH history: `Tous`, `Approuvees`, `Rejetees`
- CHEF history: `Tous`, `Approuvees`, `Rejetees`
- COLLABORATEUR requests: `Tous`, `Approuvees`, `Rejetees`, `En attente`, `Brouillon`
- CHEF pending queue: `Tous`, `En attente Chef`, `En attente RH`
- RH pending queue: `Tous`, `En attente Chef`, `En attente RH`

Tabs are now rendered as compact segmented controls rather than stretched full-width controls.

## Navigation And Popup Behavior

### Sidebar Semantics

- [components/sidebar.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/components/sidebar.tsx)
  - RH sidebar now uses:
    - `Request History`
    - `Pending Approvals`
  - CHEF sidebar uses:
    - `Team Requests`
    - `My Approvals`
  - COLLABORATEUR sidebar uses:
    - `My Requests`
    - `New Request`

### Approval Popup Behavior

- CHEF queue popup lives in [app/dashboard/my-approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/my-approvals/page.tsx)
- RH queue popup lives in [app/dashboard/approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/approvals/page.tsx)

Current behavior:

- popup can auto-open from dashboard deep-links using `requestId`
- full card click opens popup only for actionable requests
- non-actionable pending cards remain visible but non-clickable
- modal layout is hardened for long text:
  - bounded width
  - bounded height
  - scrollable body
  - persistent footer / action buttons

## Audit / History Behavior

- The application uses `RequestHistory` as the practical audit source for request lifecycle rendering
- `AuditLog` exists in Prisma schema but is not part of the main request UI flow
- Card-level history and modal-level history are derived from the same stored action entries rather than fabricated separately

## Known Conventions And Data Flow Patterns

- Request title/description are persisted indirectly inside the `CREATED` history comment payload as `[title] - description`
- The UI treats `request.createdAt` as the primary displayed request date for cards and filters
- Workflow step labels are user-facing and partially normalized in shared helpers, but some label maps still exist in multiple files
- Frontend page semantics depend heavily on backend `view` partitioning in `/api/requests`
- Several files still contain text-encoding artifacts such as `Ã©` or stripped accents

## What Is Outdated In PROJECT_MAP.md

### Outdated Page Semantics

[PROJECT_MAP.md](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/PROJECT_MAP.md) says:

- RH `app/dashboard/requests/page.tsx` is “RH view of all requests”
- CHEF `app/dashboard/team-requests/page.tsx` is a general team requests view

That is no longer accurate.

Current reality:

- RH `requests` page is a **terminal history-only page**
- CHEF `team-requests` page is also a **terminal history-only page**
- Pending/in-progress workflow items were intentionally separated into:
  - RH => `app/dashboard/approvals/page.tsx`
  - CHEF => `app/dashboard/my-approvals/page.tsx`

### Outdated Filtering Description

The old map does not describe the current filter/search system at all. It is now a major part of the request UI:

- shared full-card search
- date-range filter
- request type filter
- role-specific status tabs
- compact segmented-control tab UI

### Outdated Request Card Description

The old map only says `request-card.tsx` is a “standard request summary card”.
That undersells the current responsibility. It is now the central display surface for:

- labeled title/description rendering
- bounded preview behavior
- workflow trail rendering
- conditional examiner affordances
- role-aware action visibility
- long-content containment

### Outdated Navigation Semantics

The old map still refers to RH “all requests”. The sidebar now exposes RH `Request History`, which is intentionally narrower in meaning.

### Missing Shared Helper Layer

The old map does not mention newer request-domain utilities:

- `lib/request-content.ts`
- `lib/request-workflow.ts`
- `lib/request-search.ts`
- `lib/request-date.ts`
- `lib/request-date-filter.ts`
- `lib/request-type.ts`
- `lib/request-actions.ts`

These now carry a large part of the request UI semantics.

## Recently Added / Changed Behavior

- Request cards now render explicit labels:
  - `Title:`
  - `Description:`
- Long text is now constrained in cards and modals
- RH history page was converted into request-history-only semantics
- CHEF history page was restricted to terminal states only
- RH and CHEF pending pages now separate visible-vs-actionable items
- Shared workflow trail was generalized across roles
- Shared card-content search was extended to:
  - RH history
  - CHEF history
  - COLLABORATEUR request list
  - CHEF pending approvals
  - RH pending approvals
- Date/time formatting was standardized to include hour + minute
- Date-range and type filters were added to history pages and pending queues

## Known Limitations / Technical Debt / Inconsistencies

- **Encoding issues remain** across multiple files and labels (`Ã©`, `Â·`, missing accents).
- **Filter UI logic is duplicated** across multiple page files rather than abstracted into a shared hook/component.
- **Status/type label maps are duplicated** in several places:
  - `request-card.tsx`
  - `request-search.ts`
  - `request-type.ts`
- **`requestService` remains thin but inconsistent**:
  - comments explain semantics, but methods still rely on implicit backend behavior
  - `getUserRequests(userId)` ignores its parameter
- **Dashboard RH data source is broad**: RH dashboard still calls `getAllRequests()`, which is not history-only and is different from RH history semantics.
- **History counts are not fully normalized**: some pages compute tab counts from search-filtered data but not from all other active filters.
- **Queue/history page composition remains page-local** rather than role-config-driven.
- **AuditLog is underused** relative to `RequestHistory`.

## Areas Most Likely To Break

- Any change to the request status enum or approval path rules
- Any change to how title/description are encoded into the created history comment
- Any refactor of `/api/requests?view=...` semantics without updating all page assumptions
- Any attempt to “simplify” card click logic without respecting the visible-vs-actionable split
- Any date formatting/filtering change that stops aligning with `request.createdAt`

## Suggested Improvements

### High-Value Refactors

- Create a shared `useRequestFilters()` hook that handles:
  - search
  - date range
  - type filter
  - status tab filtering
  - tab counts
- Create a reusable `RequestFilterBar` component for the repeated search/date/type UI
- Centralize request status/type label normalization in one file and reuse it everywhere
- Centralize role/view semantics in one backend/frontend shared config instead of scattering `view` strings and page-local assumptions
- Extract a shared approval modal component used by RH and CHEF queue pages

### Medium-Term Cleanup

- Replace comment-string title/description encoding with explicit DB fields on `Request`
- Normalize accented labels and fix encoding corruption project-wide
- Revisit RH dashboard semantics so “recent requests” is intentionally defined
- Add dedicated DTO/serializer logic on the backend instead of deriving most UI semantics only on the client

### Reliability Improvements

- Add tests around:
  - role-specific request partitioning
  - `canUserExamineRequest`
  - workflow step serialization
  - search text generation
  - date-range inclusivity
  - deep-link popup behavior

## Recommended Reading Order For Continuing Work

1. [prisma/schema.prisma](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/prisma/schema.prisma)
2. [app/api/requests/route.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/api/requests/route.ts)
3. [app/api/requests/[id]/action/route.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/api/requests/[id]/action/route.ts)
4. [lib/request-service.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-service.ts)
5. [components/request-card.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/components/request-card.tsx)
6. [lib/request-workflow.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-workflow.ts)
7. [lib/request-search.ts](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/lib/request-search.ts)
8. [app/dashboard/my-approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/my-approvals/page.tsx)
9. [app/dashboard/approvals/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/approvals/page.tsx)
10. [app/dashboard/my-requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/my-requests/page.tsx)
11. [app/dashboard/team-requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/team-requests/page.tsx)
12. [app/dashboard/requests/page.tsx](/c:/Users/baalo/Downloads/ARABSOFT-main%20(1)/ARABSOFT-main/app/dashboard/requests/page.tsx)
