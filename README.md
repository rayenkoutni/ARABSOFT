# ArabSoft HR Portal

The ArabSoft HR Portal is a modern, collaborative platform designed to streamline human resource management, workflow automation, and real-time internal communications. Built with Next.js, Prisma, and Kafka, it provides an integrated ecosystem for managing employee requests, project tracking, and real-time messaging with AI-assisted productivity.

## 🚀 Tech Stack

- **Frontend**: Next.js 16 (App Router), Tailwind CSS, Radix UI.
- **Backend**: Custom Node.js server (tsx), Socket.io for real-time updates.
- **Database**: PostgreSQL with Prisma ORM.
- **Messaging**: Kafka and Zookeeper for distributed, reliable message handling.
- **AI**: Groq SDK for intelligent task generation and workflow assistance.
- **Auth**: JWT-based session management with multi-factor OTP verification.

## 📋 Prerequisites

Ensure you have the following installed on your machine:

- **Docker** (Desktop or Engine)
- **Git**

## 🏁 Getting Started

Follow these simple steps to get the entire project running locally:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/rayenkoutni/ARABSOFT.git
   cd ARABSOFT
   ```

2. **Setup Environment Variables**
   ```bash
   cp .env.example .env
   ```
   *Edit the `.env` file and fill in the required API keys (GROQ, SMTP).*

3. **Launch the Stack**
   ```bash
   docker compose up --build
   ```

4. **Initialize Database** (Once the containers are running)
   ```bash
   docker compose exec app npx prisma db push
   docker compose exec app npx prisma db seed
   ```

The application will be available at [http://localhost:3000](http://localhost:3000).

## 🔑 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@db:5432/portail_rh` |
| `JWT_SECRET` | Secret key for JWT signing | `arabsoft_secret` |
| `GROQ_API_KEY` | API Key for AI task generation | (Required) |
| `KAFKA_BROKER` | Address of the Kafka broker | `kafka:9092` |
| `SMTP_USER` | Email address for OTP notifications | (Required) |
| `SMTP_PASS` | App password for the email account | (Required) |

## 📂 Folder Structure

- `app/`: Next.js application routes and API endpoints.
- `components/`: Reusable UI components (shadcn/ui).
- `lib/`: Core library, services, and shared utilities.
- `prisma/`: Database schema and seed scripts.
- `public/`: Static assets and images.

---
© 2026 ArabSoft HR Solutions. All rights reserved.
