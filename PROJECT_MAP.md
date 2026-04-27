# Project Architecture & Logic Map

The ArabSoft HR Portal is a specialized enterprise application for managing internal workflows, projects, and employees.

## 🏗 System Architecture

### Frontend (Next.js 16)
- **App Router**: Modern React Server Components for performance.
- **Client Components**: Interactive dashboards, chat, and task management.
- **State Management**: React Context (`lib/contexts`) for Authentication and Notifications.

### Backend (Prisma & Kafka)
- **Custom server.ts**: High-performance entry point using `Socket.io` and `KafkaJS`.
- **Kafka Consumer**: Responsible for background message processing and persistent storage.
- **Prisma Client**: Unified data access layer with PostgreSQL.

## 🛡 Authentication & Logic

### Workflow
1. **Login**: JWT-based session stored in HTTP-only cookies.
2. **OTP**: 2FA verification stored in `sessionStorage` and temporary server state.
3. **Role-based Access**: Managed via `lib/api-middleware.ts` for fine-grained permissions.

### Authorization
- `COLLABORATEUR`: View own requests and team projects.
- `CHEF`: Approve/reject team requests, create and manage projects.
- `RH`: Universal administrative access, employee management, and final approvals.

## 📡 Essential Services

- **Mailer Service**: Logic for automated SMTP notifications.
- **Notification Service**: Centralized handler for in-app and push alerts.
- **Request Service**: Handles complex multi-step approval workflows.
- **Task Service**: Manages AI-powered task splitting and project boards.

## 🚀 Deployment & Integrity

- **Dockerized Environment**: The entire stack (App, DB, Kafka) is pre-configured via `docker-compose.yml`.
- **Database Migrations**: Managed via Prisma CLI inside the application container.
- **Integrity**: Comprehensive `.gitignore` and `.env.example` ensure repository safety.

---
© 2026 ArabSoft HR Documentation.
