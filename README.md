# 🚀 SaaS Multi-Tenant Blog Platform

A production-ready SaaS blog platform inspired by Zoho Blog and WordPress Multisite.  
Supports **thousands of blog websites** from a single admin system, with full publishing workflow, SEO tooling, and per-tenant frontend customisation.

---

## Architecture Overview

```
Admin Dashboard (Next.js)
        │ JWT
        ▼
  Admin API (Node.js)          ← Blog Frontends (Next.js)
        │                              │ X-API-Token
        ▼                              ▼
  API Gateway (Nginx)  ←────  Public Blog API (Node.js)
        │
   ┌────┴────────────────────────┐
   │         Data Layer          │
   │  MySQL  │  Redis  │  ES     │
   └─────────────────────────────┘
```

## Tech Stack

| Layer         | Technology                           |
| ------------- | ------------------------------------ |
| Backend API   | Node.js 20, Express, BullMQ          |
| Admin UI      | Next.js 14, React 18, TipTap Editor  |
| Blog Frontend | Next.js 14 (ISR + SSG)               |
| Database      | MySQL 8 / MariaDB 10.6               |
| Cache         | Redis 7 (ioredis)                    |
| Search        | Elasticsearch 8 (MySQL FTS fallback) |
| File Storage  | AWS S3 + CloudFront CDN              |
| Container     | Docker + Kubernetes (EKS/GKE)        |
| Auth          | JWT (access) + UUID refresh tokens   |

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose
- npm ≥ 10

### 1. Clone & Install

```bash
git clone https://github.com/your-org/saas-blog-platform.git
cd saas-blog-platform
npm install
```

### 2. Configure Environment

```bash
cp apps/admin-api/.env.example apps/admin-api/.env
cp apps/blog-frontend/.env.example apps/blog-frontend/.env
```

Edit `apps/admin-api/.env` with your secrets.

### 3. Start Infrastructure

```bash
npm run docker:up
# Starts: MySQL, Redis, Elasticsearch
```

### 4. Run Database Migrations

```bash
cd apps/admin-api
npm run migrate
```

### 5. Seed Demo Data

```bash
npm run db:seed
```

This creates demo users, a tenant, sample posts, and prints an API token.

### 6. Start Development Servers

```bash
npm run dev
# admin-api:       http://localhost:3001
# admin-dashboard: http://localhost:3000
# blog-frontend:   http://localhost:3002
# PHPMyAdmin:      http://localhost:8080
```

---

## User Invitation & Password Management

When you invite a new user:

1. Admin sends invitation via **Users → Invite User** in the dashboard
2. System generates a **temporary password** and sends it via email
3. User receives invitation email with their temporary password
4. User **must change their password** on first login via **Settings → Security** tab
5. User can change their password anytime from the Security settings

Password change requires:

- Current password (for verification)
- New password (min 8 characters)
- Confirm new password

---

## Project Structure

```
saas-blog-platform/
├── apps/
│   ├── admin-api/          # Node.js backend API
│   ├── admin-dashboard/    # Next.js admin UI
│   └── blog-frontend/      # Next.js blog site template
├── packages/
│   └── shared/             # Shared TypeScript types
├── infrastructure/
│   ├── docker/             # Docker Compose + Dockerfiles
│   ├── nginx/              # Nginx configs
│   └── k8s/                # Kubernetes manifests + HPA
└── database/
    ├── schema.sql           # Complete MySQL schema
    └── seeds/               # Development seed data
```

---

## Multi-Tenant Architecture

Each blog website is a **tenant**. Isolation is achieved through:

- **Shared database, shared schema** — all tables have a `tenant_id` column
- **API token auth** — each blog frontend has its own token scoped to one tenant
- **Domain resolution** — `blog.client.com` → `tenant_id` resolved at API layer via Redis cache

---

## Publishing Workflow

```
Author writes post
        ↓
Save Draft
        ↓
SEO Analysis (auto-scored 0–100)
        ↓
Submit for Approval
        ↓
Editor Reviews
        ↓
Admin Approves
        ↓
Publish → Webhook fires → Blog ISR revalidates
```

---

## API Reference

### Public Blog API (for blog frontends)

Requires `X-API-Token` header.

| Method | Endpoint              | Description          |
| ------ | --------------------- | -------------------- |
| GET    | `/api/v1/posts`       | List published posts |
| GET    | `/api/v1/posts/:slug` | Get post by slug     |
| GET    | `/api/v1/categories`  | List categories      |
| GET    | `/api/v1/tags`        | List tags            |
| GET    | `/api/v1/site-config` | Tenant site config   |

### Admin API (for admin dashboard)

Requires `Authorization: Bearer <jwt>` header.

| Method | Endpoint                          | Description                         |
| ------ | --------------------------------- | ----------------------------------- |
| POST   | `/admin/v1/auth/login`            | Login (returns JWT + refresh token) |
| POST   | `/admin/v1/auth/refresh`          | Refresh access token                |
| POST   | `/admin/v1/auth/logout`           | Logout (invalidates refresh token)  |
| GET    | `/admin/v1/users/me`              | Get current user profile            |
| PUT    | `/admin/v1/users/me/password`     | Change current user password        |
| POST   | `/admin/v1/users/invite`          | Invite user (sends temp password)   |
| GET    | `/admin/v1/posts`                 | List posts (admin)                  |
| POST   | `/admin/v1/posts`                 | Create post                         |
| PUT    | `/admin/v1/posts/:id`             | Update post                         |
| POST   | `/admin/v1/posts/:id/submit`      | Submit for approval                 |
| POST   | `/admin/v1/posts/:id/approve`     | Approve (editor+)                   |
| POST   | `/admin/v1/posts/:id/publish`     | Publish (admin+)                    |
| POST   | `/admin/v1/posts/:id/seo/analyze` | Run SEO analysis                    |
| GET    | `/admin/v1/tenants`               | List tenants (super_admin)          |
| POST   | `/admin/v1/tenants`               | Create tenant                       |
| GET    | `/admin/v1/analytics/overview`    | Analytics overview                  |
| POST   | `/admin/v1/api-tokens`            | Create API token                    |

---

## SEO Scoring System

Posts are scored 0–100 across 7 weighted dimensions:

| Dimension         | Weight | Checks                                      |
| ----------------- | ------ | ------------------------------------------- |
| Title             | 20%    | Length (50–60), keyword presence & position |
| Meta Description  | 15%    | Length (120–160), keyword, CTA              |
| Keyword Density   | 15%    | 0.5–3% range detection                      |
| Readability       | 20%    | Flesch-Kincaid score                        |
| Heading Structure | 15%    | H1 present, H2 hierarchy, keyword in H2     |
| Internal Links    | 10%    | 3–5 links recommended                       |
| Content Length    | 5%     | 1,000+ words recommended                    |

---

## Role Permissions

| Action              | super_admin | admin | editor | author | viewer |
| ------------------- | :---------: | :---: | :----: | :----: | :----: |
| Manage tenants      |      ✓      |       |        |        |        |
| Invite users        |      ✓      |   ✓   |        |        |        |
| Create/edit posts   |      ✓      |   ✓   |   ✓    |   ✓    |        |
| Submit for approval |      ✓      |   ✓   |   ✓    |   ✓    |        |
| Approve posts       |      ✓      |   ✓   |   ✓    |        |        |
| Publish posts       |      ✓      |   ✓   |        |        |        |
| Manage site config  |      ✓      |   ✓   |        |        |        |
| View analytics      |      ✓      |   ✓   |   ✓    |   ✓    |   ✓    |

---

## Deployment (Production)

### Docker Compose

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Kubernetes

```bash
kubectl apply -f infrastructure/k8s/deployment.yaml
```

### Environment Variables

See `apps/admin-api/.env.example` for all required variables.

---

## Accessing the Platform

### Admin Dashboard (http://localhost:3000)

1. Go to http://localhost:3000
2. Login with demo credentials (see below)
3. Access Settings → Security to change your password
4. Explore posts, users, categories, and approval workflows

### Blog Frontend (http://localhost:3002)

- This is a template blog frontend showing posts from the default tenant
- Each tenant gets their own blog frontend (typically deployed separately per domain)
- Blog content is fetched via the Public Blog API using `X-API-Token`

### Creating API Tokens for Blog Frontends

1. Go to **Settings → API Tokens** in admin dashboard
2. Create a new token for your blog frontend
3. Use this token in the blog frontend's `.env` file as `NEXT_PUBLIC_API_TOKEN`

| Role        | Email               | Password     |
| ----------- | ------------------- | ------------ |
| Super Admin | superadmin@demo.com | Admin@12345  |
| Editor      | editor@demo.com     | Editor@12345 |
| Author      | author@demo.com     | Author@12345 |

> **Change all passwords immediately in production.**

---

## Troubleshooting

### Services not starting

```bash
# Check Docker is running
docker ps

# View logs
docker logs saas_blog_mysql
docker logs saas_blog_redis
docker logs saas_blog_api
```

### Database connection issues

```bash
# Reset database
npm run docker:down
npm run docker:up
npm run db:migrate
npm run db:seed
```

### Clear Redis cache

```bash
docker exec saas_blog_redis redis-cli FLUSHALL
```

### Access PHPMyAdmin

- URL: http://localhost:8080
- Server: `saas_blog_mysql`
- Username: `root`
- Password: `rootpassword` (or as set in .env)

---

## License

MIT
