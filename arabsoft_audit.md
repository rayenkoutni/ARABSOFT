# ARABSOFT HR Platform — Production-Grade Audit Report
**Date:** 2026-05-24 | **Auditor:** Senior Architect / Security / QA / DevOps  
**Codebase:** Next.js 16 + custom Socket.io/Kafka server, PostgreSQL/Prisma, Docker

---

## PART 1 — CRITICAL & HIGH SEVERITY ISSUES

---

### 🔴 ISSUE #1 — HARDCODED SECRETS IN `.env` (LEAKED TO VERSION CONTROL)
**Severity:** CRITICAL  
**Location:** `.env` (lines 2–3, 8)

**Root Cause:** Real credentials are committed to the repository in plaintext:
```
JWT_SECRET="arabsoft"              # trivially brute-forceable
GROQ_API_KEY="gsk_0p69Rnf3r1a..."  # live API key
SMTP_PASS="lnwkklitwqcznrhl"       # live Gmail app password
```

**Impact:** Any attacker with repo access can forge JWT tokens for any user (including RH/admin), access the Groq API at the owner's cost, and send emails impersonating ArabSoft.

**Exploitability:** Immediate — no special skills required. A 4-character `JWT_SECRET` like `"arabsoft"` is crackable offline in milliseconds using `hashcat` against any stolen token cookie.

**Fix:**
- Rotate ALL three secrets immediately
- Use a minimum 256-bit random secret: `openssl rand -base64 32`
- Add a pre-commit hook (`detect-secrets`, `gitleaks`) to block future commits
- Use Docker secrets or a vault (HashiCorp Vault, AWS Secrets Manager) at runtime

---

### 🔴 ISSUE #2 — MISSING COOKIE `secure` FLAG (Session Hijacking over HTTP)
**Severity:** CRITICAL  
**Location:** `app/api/auth/login/route.ts` line 61–66

**Root Cause:** The JWT `token` cookie is set **without** `secure: true`:
```ts
serialize("token", token, {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
  sameSite: "lax",
  // ← NO secure: true
})
```

**Impact:** Over any non-HTTPS connection (or misconfigured proxy), the session cookie is transmitted in plaintext. An attacker on the same network can steal it with a passive MITM attack.

**Fix:**
```ts
secure: process.env.NODE_ENV === "production",
```

---

### 🔴 ISSUE #3 — DUPLICATE PRISMA CLIENT INSTANTIATION (Two Separate Singletons)
**Severity:** CRITICAL  
**Location:** `lib/prisma.ts` vs `lib/services/prisma.service.ts`

**Root Cause:** Two separate files create independent PrismaClient singletons using the **same** global key (`globalForPrisma.prisma`). Services under `lib/services/server/` import from `prisma.service.ts`; routes import from `lib/prisma.ts`. In production (where the global cache condition is skipped), this creates **two active connection pools** competing for the same PostgreSQL connection limit.

**Impact:**
- Connection pool exhaustion under moderate load
- Transaction isolation failures if two clients manage the same data
- Silent data corruption risk under concurrent writes

**Fix:** Delete `lib/services/prisma.service.ts`. Update all imports in `lib/services/server/` to use `@/lib/prisma`. The canonical singleton must be one file only.

---

### 🔴 ISSUE #4 — OTP SENT TO UNAUTHENTICATED ARBITRARY USER IDs (IDOR + User Enumeration)
**Severity:** CRITICAL  
**Location:** `app/api/auth/send-otp/route.ts` lines 10–21

**Root Cause:** The endpoint accepts a `userId` from the **request body** with zero authentication. Any anonymous caller can:
1. Query any user's OTP status (tells them if the user exists → enumeration)
2. Trigger an OTP send to any employee's email by guessing/knowing their UUID

```ts
const userId = body.userId;        // ← attacker-controlled
const employee = await prisma.employee.findUnique({ where: { id: userId } });
if (!employee) return 404          // ← confirms user existence
```

**Impact:** Full user enumeration + OTP spam for any employee in the system.

**Fix:** Require the user to be pre-authenticated (e.g., by email+password step first), then derive `userId` from the authenticated session, **never** from the request body.

---

### 🔴 ISSUE #5 — NO OTP BRUTE-FORCE PROTECTION
**Severity:** CRITICAL  
**Location:** `app/api/auth/verify-otp/route.ts`

**Root Cause:** The OTP verification endpoint has no attempt counter. An attacker can submit all 900,000 possible 6-digit codes in a loop. The only protection is the 10-minute expiry window, which is ample time.

**Impact:** Complete OTP bypass — attacker can pass any MFA/OTP challenge.

**Reproduction:** 
```bash
for code in $(seq 100000 999999); do
  curl -s -X POST /api/auth/verify-otp -d "{\"userId\":\"...\",\"code\":\"$code\"}"
done
```

**Fix:** Track failed attempts in DB or Redis. Lock the OTP after 5 failures and require re-generation. Apply middleware rate limiting specifically to this route.

---

### 🔴 ISSUE #6 — SQL INJECTION VIA UNTYPED `as any` CASTS
**Severity:** HIGH  
**Location:** `lib/services/server/request.service.ts` lines 33, 133, 139, 190

**Root Cause:** Multiple `as any` casts bypass Prisma's type safety, particularly when passing user-controlled strings into enum fields:
```ts
where: { requestType: type as any },   // line 33
status: initialStatus as RequestStatus, // attacker controls initialStatus
```

If an upstream validator is absent or broken, Prisma will attempt to pass the raw string into a PostgreSQL enum comparison, which may cause unexpected behavior or silent failures. More critically, `status: nextStatus` in `processAction` is derived without re-validating against the enum — a crafted `action` value could set `status` to an arbitrary string via `as any`.

**Fix:** Explicitly validate with Zod before DB calls:
```ts
import { z } from "zod"
const RequestTypeSchema = z.enum(["CONGE","AUTORISATION","DOCUMENT","PRET"])
const validType = RequestTypeSchema.parse(type)
```

---

### 🔴 ISSUE #7 — IN-MEMORY RATE LIMITER (Does Not Work in Production)
**Severity:** HIGH  
**Location:** `middleware.ts` lines 6–55

**Root Cause:** The rate limiter uses a `Map` stored in process memory:
```ts
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
```

In a multi-process or containerized environment (which this project uses via Docker), **each process has its own independent Map**. A client is rate-limited per-process, not globally. Under a 4-worker cluster, the real limit becomes `5 * 4 = 20` requests per minute per IP.

Additionally, the Map **never gets cleared** — it grows indefinitely, causing a memory leak over time.

**Impact:** Rate limiting is completely ineffective in production. Memory leak under sustained traffic.

**Fix:** Replace with a distributed store — use `@upstash/ratelimit` with Redis, or `ioredis` + sliding window:
```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, "1 m") })
```

---

### 🔴 ISSUE #8 — DOCKER COMPOSE HARDCODED FALLBACK SECRETS
**Severity:** HIGH  
**Location:** `docker-compose.yml` lines 9, 29–31

**Root Cause:** Default values for critical secrets are hardcoded as YAML fallbacks:
```yaml
JWT_SECRET=${JWT_SECRET:-arabsoft_secret}
POSTGRES_USER: ${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}
```

If the `.env` file is missing at deployment time, Docker silently uses these weak defaults. An operator deploying this to any cloud environment without setting env vars gets a fully exposed database.

**Fix:** Remove all `:-default` fallbacks for secrets. Fail loudly with an entrypoint script that validates required env vars before startup.

---

### 🔴 ISSUE #9 — EMPLOYEE DELETE IS NOT TRANSACTIONAL (Data Integrity Risk)
**Severity:** HIGH  
**Location:** `app/api/employees/[id]/route.ts` lines 216–234

**Root Cause:** The DELETE handler performs 8 sequential `prisma.X.deleteMany` / `prisma.X.update` calls outside a transaction:
```ts
await prisma.notification.deleteMany(...)
await prisma.requestHistory.deleteMany(...)
await prisma.employeeSkillHistory.deleteMany(...)
// ... 5 more calls
await prisma.employee.delete(...)
```

If any intermediate step fails (network hiccup, constraint violation), the employee record persists in a **partially-deleted, corrupt state** with orphaned foreign keys pointing to deleted rows.

**Fix:**
```ts
await prisma.$transaction([
  prisma.notification.deleteMany({ where: { employeeId: id } }),
  prisma.requestHistory.deleteMany({ where: { actorId: id } }),
  // ... all deletes
  prisma.employee.delete({ where: { id } }),
])
```

---

### 🔴 ISSUE #10 — `typescript: { ignoreBuildErrors: true }` IN PRODUCTION
**Severity:** HIGH  
**Location:** `next.config.mjs` lines 9–11

**Root Cause:**
```ts
typescript: {
  ignoreBuildErrors: true,   // ← Silent type errors ship to production
}
```

This disables all TypeScript compile-time safety checks. Any type error, including null dereferences and broken API contracts, is silently ignored and ships to production.

**Impact:** Runtime crashes from type errors that would have been caught at build time. Nullability bugs, wrong function signatures — all silently deployed.

**Fix:** Remove this flag entirely. Fix the underlying TypeScript errors.

---

## PART 2 — MEDIUM SEVERITY ISSUES

---

### 🟡 ISSUE #11 — DUAL SOCKET CONNECTION HANDLER (Dead Code + Race Condition)
**Severity:** Medium  
**Location:** `server.ts` line 291 AND `lib/services/server/socket.service.ts` line 44

**Root Cause:** There are **two separate** Socket.io `connection` event handlers: one directly in `server.ts` (the active one handling `send_message`) and one in `SocketService.setupHandlers()` (which only handles typing events). Both fire on every connection. This means every connected user has **duplicate event listeners** registered.

**Impact:** Typing events fire twice (double notifications). The `send_message` handler in `server.ts` duplicates DB writes if `socketService.init(io)` is ever called. Dead code creates maintenance confusion.

**Fix:** Consolidate all socket logic into `SocketService`. Remove the inline handlers from `server.ts`.

---

### 🟡 ISSUE #12 — N+1 QUERY IN ANNUAL BONUS CREATION
**Severity:** Medium  
**Location:** `lib/services/server/bonus.service.ts` lines 91–124

**Root Cause:** `createAnnualBonuses` fetches all employees then runs 2 queries per employee in a loop:
```ts
const employees = await prisma.employee.findMany(...)  // 1 query
for (const emp of employees) {
  const existing = await prisma.bonus.findFirst(...)   // N queries
  await prisma.bonus.create(...)                       // N queries
}
```

For 100 employees this is ~201 sequential database round-trips.

**Fix:** Use `createMany` with `skipDuplicates: true` or fetch all existing bonuses for the period first in one query, then filter in-memory before bulk insert.

---

### 🟡 ISSUE #13 — N+1 QUERY IN MONTHLY EVALUATION CRON
**Severity:** Medium  
**Location:** `lib/cron/monthly-evaluation.ts` lines 24–117

**Root Cause:** Same pattern — fetches all employees (1 query), then per employee: `findFirst` for existing evaluation, `findMany` for tasks, `create` for evaluation, `create` for objective, `createPerformanceBonus` (which runs 3 more queries). For 50 employees: ~300 sequential queries run at 23:59.

**Impact:** Database saturation at month-end, potentially causing timeout/deadlock on a production server handling simultaneous user requests.

**Fix:** Batch reads. Pre-fetch all evaluations for the period and all scored tasks for the month in 2 bulk queries. Process in-memory, then bulk-insert results.

---

### 🟡 ISSUE #14 — PAYSLIP GENERATED FROM MAGIC STRING PARSING
**Severity:** Medium  
**Location:** `lib/services/server/payslip.service.ts` lines 25–35

**Root Cause:** The payslip period type is parsed from `request.reason` using a fragile string split:
```ts
const parts = request.reason.split(":")
const [periodTypeRaw, period] = parts
```

`reason` is a free-text field on the `Request` model with no schema constraint. A user can submit `reason: "MONTHLY:2026-03:injected"` (3 parts) or `"ANNUAL"` (1 part) to crash the service or generate a payslip for a nonsensical period.

**Fix:** Add a dedicated `payslipPeriod` and `payslipPeriodType` field to the `Request` model, or validate with Zod before processing.

---

### 🟡 ISSUE #15 — SLA `addBusinessHours` IS IDENTICAL IN TWO PLACES (Duplicated Logic)
**Severity:** Medium  
**Location:** `lib/services/server/sla.service.ts` lines 16–29 AND `lib/services/server/request.service.ts` lines 44–57

**Root Cause:** The exact same `addBusinessHours` algorithm is copy-pasted into both `SlaService` and `RequestServerService`. If a bug is fixed in one, it won't be fixed in the other.

**Fix:** The method already exists on `SlaService`. `RequestServerService.calculateSlaDeadline` should call `slaService.addBusinessHours()` instead of duplicating it.

---

### 🟡 ISSUE #16 — BROKEN CSRF CHECK (Can Be Bypassed)
**Severity:** Medium  
**Location:** `middleware.ts` lines 22–30

**Root Cause:** The CSRF check uses `origin.includes(host)` — a substring match, not an exact origin comparison:
```ts
const isSafeOrigin = origin && origin.includes(host ?? "");
```

An attacker on a domain like `evil-localhost.com` or `myarabsoft.com.evil.com` would bypass this check since both contain the substring `localhost` or `arabsoft`.

**Fix:**
```ts
const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || `http://${host}`
const isSafeOrigin = origin === allowedOrigin
```

---

### 🟡 ISSUE #17 — UNVALIDATED PROFILE PATCH (XSS via Avatar URL)
**Severity:** Medium  
**Location:** `app/api/employees/profile/route.ts` lines 43–57

**Root Cause:** The PATCH handler accepts `name`, `phone`, and `avatar` from the request body with no validation or sanitization:
```ts
const { avatar, name, phone } = body
if (avatar !== undefined) updateData.avatar = avatar  // any string accepted
```

An attacker can set `avatar` to a `javascript:` URI or a data URL, which if rendered via `<img src={avatar}>` in the frontend, can trigger XSS in some browser contexts.

**Fix:** Validate `avatar` is a valid `https://` URL with Zod. Validate `name` length and character set. Validate `phone` format.

---

### 🟡 ISSUE #18 — KAFKA PRODUCER USED BEFORE INITIALIZATION CHECK (Race Condition)
**Severity:** Medium  
**Location:** `server.ts` lines 355, 406

**Root Cause:**
```ts
if (!kafkaEnabled || !producer) { /* fallback */ }
await producer.send(...)  // producer could still be null/disconnected
```

`kafkaEnabled` and `producer` are set asynchronously during `initKafkaIfAvailable()`. Between server start and Kafka initialization completing, a socket `send_message` event could arrive, pass the `kafkaEnabled` check if it's set to `true` mid-init, but fail at `producer.send()` because the producer isn't fully connected yet.

**Fix:** Initialize Kafka completely **before** starting the Socket.io listener, or use a mutex/queue to hold messages during initialization.

---

### 🟡 ISSUE #19 — AUDIT LOG DOES NOT CAPTURE SENSITIVE FIELD CHANGES
**Severity:** Medium  
**Location:** `app/api/employees/[id]/route.ts` line 182–189

**Root Cause:** The audit log for employee updates includes `hireDate` and `role` but **omits** `salaryOverride`, `salaryGradeId`, and `managerId` — the most sensitive changes for an HR system:
```ts
details: { name, email, role, department, position, hireDate: hireDate?.toISOString() },
// ← salaryOverride, salaryGradeId, managerId NOT logged
```

**Impact:** Salary manipulation by a rogue HR user goes undetected in audit logs.

**Fix:** Include all changed fields in `details`, or log a before/after diff.

---

### 🟡 ISSUE #20 — DOCKERFILE COPIES SOURCE TS FILES INTO PRODUCTION IMAGE
**Severity:** Medium  
**Location:** `Dockerfile` lines 31–33

**Root Cause:**
```dockerfile
COPY --from=base /app/server.ts ./server.ts
COPY --from=base /app/lib ./lib
COPY --from=base /app/app ./app
```

The production image contains raw TypeScript source files and runs them with `tsx server.ts` — a development-time transpile-on-the-fly tool. This means:
1. Every request pays a JIT transpilation cost
2. Source code is exposed in the container filesystem
3. `tsx` is not production-grade (no clustering, no PM2)

**Fix:** Compile TypeScript to JavaScript (`tsc`) during the build stage, copy only the compiled output, and run with plain `node dist/server.js`. Use PM2 or `node --cluster` for multi-process production.

---

## PART 3 — LOW SEVERITY / CODE QUALITY ISSUES

---

### 🔵 ISSUE #21 — `logAudit` IS FIRE-AND-FORGET (Silent Failures)
**Severity:** Low  
**Location:** `app/api/employees/[id]/route.ts` lines 182, 236

`logAudit()` is `async` but called **without `await`**. Audit failures are swallowed silently. For a compliance-sensitive HR system, failed audit writes should at minimum be surfaced.

---

### 🔵 ISSUE #22 — `onAny` DEBUG LISTENER REGISTERED TWICE
**Severity:** Low  
**Location:** `server.ts` lines 295–297 and 321–323

The same `socket.onAny` debug listener is registered twice per socket connection — once at line 295 and again at 321. Every event fires the log callback twice.

---

### 🔵 ISSUE #23 — `successResponse` TYPES `data` AS `any`
**Severity:** Low  
**Location:** `lib/api-middleware.ts` line 122

```ts
export function successResponse(data: any, status: number = HTTP_STATUS.OK)
```

Using `any` defeats TypeScript's purpose. Should be `unknown` or a generic `<T>`.

---

### 🔵 ISSUE #24 — MAILER CREATES NEW TRANSPORTER PER EMAIL
**Severity:** Low  
**Location:** `lib/mailer.ts` lines 34–42

A new `nodemailer.createTransport()` is called on every `sendEmail()` invocation, creating a new SMTP connection pool each time. Under load (SLA breach sends emails to all RH users + manager simultaneously), this creates many short-lived connections.

**Fix:** Create the transporter once as a module-level singleton.

---

### 🔵 ISSUE #25 — `Project.priority` IS A STRING, NOT AN ENUM
**Severity:** Low  
**Location:** `prisma/schema.prisma` line 215

```prisma
priority String @default("MEDIUM")
```

`Task.priority` correctly uses `TaskPriority` enum. `Project.priority` uses a raw `String`. This allows invalid values like `"CRITICAL"` or `""` to be stored, breaking any priority-based filtering logic.

---

### 🔵 ISSUE #26 — NO INDEX ON `Request.employeeId` OR `Request.status`
**Severity:** Low  
**Location:** `prisma/schema.prisma` — `Request` model

The `Request` table is queried heavily by `employeeId` (employee view), `status` (pending views), and `slaDeadline` (cron), but has **no `@@index` definitions**. `Task` and `Skill` models have indexes; `Request` is conspicuously absent.

**Fix:**
```prisma
@@index([employeeId, status])
@@index([status, slaDeadline])
@@index([managerId])
```

---

### 🔵 ISSUE #27 — NO TESTS ANYWHERE
**Severity:** Low (structural)  
**Location:** Entire project

There are zero test files (`*.test.ts`, `*.spec.ts`). No unit tests, no integration tests, no e2e tests. The `package.json` has no `test` script. For a production HR/payroll system handling salary computation and approval workflows, this is a significant reliability risk.

**High-priority test cases to add:**
- `resolveSalary()` edge cases (null override, null grade)
- `addBusinessHours()` with weekend boundaries
- `getMatchingBonusRule()` boundary values (score = minScore, score = maxScore)
- Request status state machine transitions
- OTP generation/verification/expiry flow
- Bonus creation idempotency

---

## PART 4 — TOP 10 HIGHEST-RISK ISSUES (RANKED)

| Rank | Issue | Severity | Immediate Risk |
|------|-------|----------|----------------|
| 1 | Hardcoded secrets in `.env` committed to repo | CRITICAL | JWT forgery, API abuse |
| 2 | OTP endpoint accepts arbitrary userId (IDOR) | CRITICAL | Account takeover |
| 3 | No OTP brute-force protection | CRITICAL | MFA bypass |
| 4 | Missing `secure` flag on auth cookie | CRITICAL | Session hijacking |
| 5 | Two independent Prisma singletons | CRITICAL | Connection exhaustion |
| 6 | `ignoreBuildErrors: true` ships broken code | HIGH | Runtime crashes |
| 7 | Employee delete not in transaction | HIGH | Data corruption |
| 8 | Docker Compose default weak credentials | HIGH | DB exposure |
| 9 | In-memory rate limiter (ineffective) | HIGH | Brute force on auth |
| 10 | Broken CSRF check (substring bypass) | MEDIUM | CSRF on state changes |

---

## PART 5 — SCORES & ASSESSMENT

### Security Score: **38 / 100** 🔴
- JWT secret is 8 chars, not rotatable without re-deployment
- Live credentials committed to git history (cannot be "un-committed")
- OTP system has IDOR + no brute-force protection
- Auth cookie missing `secure` flag
- CSRF check is bypassable

### Maintainability Score: **52 / 100** 🟡
- Good: constants centralized, Zod used in some routes, audit logging exists, service layer started
- Bad: `any` types throughout, duplicate Prisma clients, duplicate `addBusinessHours`, two socket handler systems, no tests, `ignoreBuildErrors` on

### Production Readiness Score: **31 / 100** 🔴
- Dockerfile runs TypeScript with `tsx` (dev tool in prod)
- Rate limiter is in-memory (ineffective in multi-process)
- No health check endpoint
- No structured logging (only `console.log`)
- No test suite
- No CI/CD pipeline detected
- Cron runs inside the same Node process as the HTTP server (process crash = cron stops)

### Scalability Assessment: **Poor**
The architecture has fundamental scalability blockers: the in-process Kafka consumer and cron scheduler don't support horizontal scaling (running 2 instances creates duplicate message processing and double cron executions). The dual Prisma singleton causes connection pool exhaustion at scale. N+1 queries in cron jobs will cause database saturation at month-end.

---

## PART 6 — TECHNICAL DEBT SUMMARY

| Category | Debt Level | Notes |
|----------|-----------|-------|
| Security | Critical | Leaked secrets must be rotated NOW |
| Testing | High | Zero coverage on financial logic |
| Architecture | Medium | Dual Prisma, dual socket handler, cron not extracted |
| Type Safety | Medium | `ignoreBuildErrors`, `any` types in service layer |
| Database | Medium | Missing indexes on `Request` table |
| DevOps | High | `tsx` in prod, no structured logs, no health checks |
| API Design | Low | No versioning, no pagination on all list endpoints |

---

## PART 7 — REFACTORING PRIORITIES ROADMAP

### 🚨 Week 1 — Security Emergency
1. Rotate `JWT_SECRET`, `GROQ_API_KEY`, `SMTP_PASS` immediately
2. Add `secure: true` to auth cookie
3. Protect `/api/auth/send-otp` — require pre-auth session
4. Add OTP attempt counter + lockout
5. Fix CSRF check to use exact origin match

### 🔴 Week 2 — Stability
6. Consolidate `lib/prisma.ts` and `lib/services/prisma.service.ts` into one file
7. Wrap employee DELETE in `prisma.$transaction()`
8. Remove `ignoreBuildErrors: true` and fix TypeScript errors
9. Replace in-memory rate limiter with Redis-backed one

### 🟡 Week 3 — Performance & Quality
10. Add `@@index([employeeId, status])` and `@@index([status, slaDeadline])` to `Request`
11. Fix N+1 in `createAnnualBonuses` and monthly evaluation cron
12. Remove duplicate `addBusinessHours` from `RequestServerService`
13. Add Zod validation to all profile PATCH fields including `avatar`

### 🟢 Week 4–6 — Architecture & Testing
14. Consolidate all socket handlers into `SocketService` only
15. Extract cron jobs into a separate worker process
16. Replace `tsx server.ts` in Dockerfile with compiled JS
17. Add unit tests for `resolveSalary`, `addBusinessHours`, bonus rules, OTP flow
18. Add structured logging (Pino or Winston)
19. Add `/api/health` endpoint for container health checks
20. Add `@@index` to `Bonus`, `Notification`, `AuditLog` tables
