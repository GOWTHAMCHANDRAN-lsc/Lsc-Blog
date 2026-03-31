# SaaS Multi-Tenant Blog Platform - Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Configuration](#configuration)
6. [Workflows](#workflows)
7. [API Reference](#api-reference)
8. [Client Integration](#client-integration)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

A full-featured multi-tenant SaaS blog platform with:

- **Multi-tenancy**: Multiple blogs on a single instance
- **Role-based access**: Super Admin, Admin, Editor, Author, Viewer
- **Content workflow**: Draft → Pending → Approved → Published
- **SEO optimization**: Meta tags, Open Graph, schema markup
- **Comments**: Moderation with spam detection
- **Analytics**: Pageview tracking
- **REST API**: For client website integration
- **Media management**: File uploads with CDN support

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- MySQL 8.0+
- Redis 7+

### 1. Start Infrastructure

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

Wait for MySQL to be healthy:

```bash
docker-compose -f infrastructure/docker/docker-compose.yml ps
```

### 2. Run Migrations

```bash
npm run db:migrate
```

### 3. Seed Demo Data

```bash
npm run db:seed
```

### 4. Start Development Servers

```bash
npm run dev
```

### Services

| Service         | URL                   | Description         |
| --------------- | --------------------- | ------------------- |
| Admin API       | http://localhost:3001 | REST API            |
| Admin Dashboard | http://localhost:3000 | Next.js Admin Panel |
| Blog Frontend   | http://localhost:3002 | Public Blog         |
| PHPMyAdmin      | http://localhost:8080 | Database Management |
| MySQL           | localhost:3306        | Database            |
| Redis           | localhost:6379        | Cache & Queue       |

### Demo Credentials

| Role        | Email               | Password     |
| ----------- | ------------------- | ------------ |
| Super Admin | superadmin@demo.com | Admin@12345  |
| Editor      | editor@demo.com     | Editor@12345 |
| Author      | author@demo.com     | Author@12345 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │   Admin      │  │   Blog       │  │   Client         │       │
│  │   Dashboard  │  │   Frontend   │  │   Websites       │       │
│  │  (Next.js)   │  │  (Next.js)   │  │   (Any)          │       │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘       │
│         │                 │                   │                 │               │
└─────────┼──────────────────┼────────────────────┼────────────── ┘
          │                  │                    │
          ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN API (Express)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │  Auth    │  │  Posts   │  │  Media   │  │  API     │         │
│  │  Module  │  │  Module  │  │  Module  │  │  Tokens  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Comments │  │  SEO     │  │Analytics │  │  Import/ │         │
│  │  Module  │  │  Module  │  │  Module  │  │  Export  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
          │                  │                    │
          ▼                  ▼                    ▼
┌─────────────────┐  ┌───────────┐  ┌─────────────────┐
│      MySQL      │  │   Redis   │  │ Elasticsearch   │
│   (Database)    │  │  (Cache)  │  │   (Search)      │
└─────────────────┘  └───────────┘  └─────────────────┘
```

---

## Project Structure

```
saas-blog-platform/
├── apps/
│   ├── admin-api/              # Express REST API
│   │   └── src/
│   │       ├── modules/        # Feature modules
│   │       ├── jobs/           # Background workers
│   │       ├── config/         # Configuration
│   │       └── middleware/     # Express middleware
│   │
│   ├── admin-dashboard/        # Next.js Admin Panel
│   │   └── src/
│   │       └── app/           # App Router pages
│   │
│   └── blog-frontend/          # Public Blog Theme
│       └── src/
│           ├── app/           # App Router pages
│           └── components/     # React components
│
├── database/
│   ├── schema.sql             # Complete database schema
│   ├── migrations/             # Incremental migrations
│   └── seeds/                 # Demo data seeder
│
├── infrastructure/
│   └── docker/
│       ├── docker-compose.yml  # Development stack
│       └── docker-compose.prod.yml  # Production stack
│
├── docs/                       # Integration examples
│   ├── client-integration-example.tsx
│   ├── standalone-example.html
│   └── nextjs-blog-page.tsx
│
└── scripts/
    ├── verify-workflows.js     # Workflow testing
    └── generate-api-token.js   # Token generation
```

---

## Configuration

### Environment Variables (apps/admin-api/.env)

```env
# Server
NODE_ENV=development
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=saas_blog
DB_USER=root
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password
```

### Blog Frontend (apps/blog-frontend/.env)

```env
# API Connection
PLATFORM_API_URL=http://localhost:3001
PLATFORM_API_TOKEN=sbp_your_token_here

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

---

## Workflows

### 1. Authentication Flow

```
┌──────────┐     POST /auth/login       ┌──────────┐
│  Client  │ ────────────────────────▶ │   API    │
└──────────┘                            └────┬─────┘
     ▲                                       │
     │                                       ▼
     │           POST /auth/refresh    ┌──────────┐
     └───────────────────────────────  │  Redis   │
                                       │  (Token  │
                                       │  Store)  │
                                       └──────────┘
```

**Endpoints:**

- `POST /admin/v1/auth/login` - Login
- `POST /admin/v1/auth/refresh` - Refresh tokens
- `POST /admin/v1/auth/switch-tenant` - Switch tenant context
- `POST /admin/v1/auth/logout` - Logout

### 2. Content Workflow

```
Draft ──▶ Pending Approval ──▶ Approved ──▶ Published
  │              │                  │
  │              ▼                  ▼
  └── Rejected ◀─────────────────┘

Scheduled Posts:
  Approved ──▶ Scheduled ──▶ Published (auto at scheduled time)
```

**Endpoints:**

- `POST /admin/v1/posts` - Create draft
- `POST /admin/v1/posts/:id/submit` - Submit for approval
- `POST /admin/v1/posts/:id/approve` - Approve post
- `POST /admin/v1/posts/:id/reject` - Reject post
- `POST /admin/v1/posts/:id/publish` - Publish immediately
- `POST /admin/v1/posts/:id/schedule` - Schedule for later

### 3. Comment Moderation

```
Visitor submits comment
        │
        ▼
   Auto-detect spam? ──── Yes ──▶ Mark as spam
        │ No
        ▼
   comment_moderation setting?
        │
    ┌───┴───┐
    │       │
  'off'   'manual'
    │       │
    ▼       ▼
Approved  Pending
```

### 4. Multi-Tenant Request Flow

```
Request: GET /api/v1/posts
Headers: X-API-Token: sbp_xxx
         X-Tenant-Domain: client-site.com (optional)

         │
         ▼
    API validates token
         │
         ▼
    Lookup tenant by token OR domain
         │
         ▼
    Filter all queries by tenant_id
         │
         ▼
    Return tenant-specific data
```

---

## API Reference

### Authentication

#### Login

```http
POST /admin/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "uuid-token",
    "user": {
      "id": "uuid",
      "email": "admin@example.com",
      "tenantId": "uuid",
      "tenantRole": "admin"
    }
  }
}
```

### Public API (Client Websites)

All public endpoints use `X-API-Token` header:

```http
GET /api/v1/posts
X-API-Token: sbp_your_token

GET /api/v1/posts/:slug
X-API-Token: sbp_your_token

GET /api/v1/categories
X-API-Token: sbp_your_token
```

#### Available Scopes

| Scope              | Description          |
| ------------------ | -------------------- |
| `posts:read`       | Read published posts |
| `posts:write`      | Create/update posts  |
| `categories:read`  | Read categories      |
| `categories:write` | Manage categories    |
| `tags:read`        | Read tags            |
| `tags:write`       | Manage tags          |
| `comments:read`    | Read comments        |
| `comments:write`   | Submit comments      |
| `config:read`      | Read site config     |
| `analytics:read`   | View analytics       |
| `analytics:write`  | Track pageviews      |

### API Endpoints Summary

| Method | Endpoint                     | Description         | Auth        |
| ------ | ---------------------------- | ------------------- | ----------- |
| GET    | /health                      | Health check        | None        |
| POST   | /admin/v1/auth/login         | Login               | None        |
| POST   | /admin/v1/auth/refresh       | Refresh token       | None        |
| GET    | /admin/v1/auth/me            | Current user        | JWT         |
| POST   | /admin/v1/tenants            | Create tenant       | Super Admin |
| GET    | /admin/v1/tenants            | List tenants        | Super Admin |
| POST   | /admin/v1/posts              | Create post         | Admin+      |
| GET    | /admin/v1/posts              | List all posts      | Admin+      |
| PUT    | /admin/v1/posts/:id          | Update post         | Admin+      |
| DELETE | /admin/v1/posts/:id          | Delete post         | Admin+      |
| POST   | /admin/v1/posts/:id/submit   | Submit for approval | Author+     |
| POST   | /admin/v1/posts/:id/approve  | Approve post        | Editor+     |
| POST   | /admin/v1/posts/:id/reject   | Reject post         | Editor+     |
| POST   | /admin/v1/posts/:id/publish  | Publish post        | Editor+     |
| GET    | /api/v1/posts                | Public posts list   | API Token   |
| GET    | /api/v1/posts/:slug          | Single post         | API Token   |
| GET    | /api/v1/categories           | Public categories   | API Token   |
| GET    | /api/v1/tags                 | Public tags         | API Token   |
| GET    | /api/v1/site-config          | Site configuration  | API Token   |
| POST   | /api/v1/posts/:slug/comments | Submit comment      | API Token   |
| GET    | /api/v1/posts/:slug/comments | List comments       | API Token   |

---

## Client Integration

### Option A: API Token (Recommended)

Best for: Multiple client websites, white-label solutions

#### 1. Generate API Token

```bash
node scripts/generate-api-token.js <email> <password> <tenant-id> "Token Name"

# Example
node scripts/generate-api-token.js admin@demo.com Admin@12345 tenant-uuid "My Blog"
```

#### 2. HTML/JavaScript Integration

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Blog</title>
  </head>
  <body>
    <div id="posts"></div>

    <script>
      const API_BASE = 'https://your-api.com';
      const API_TOKEN = 'sbp_xxxxxxxxxxxx';

      async function loadPosts() {
        const res = await fetch(`${API_BASE}/api/v1/posts`, {
          headers: { 'X-API-Token': API_TOKEN },
        });
        const { data } = await res.json();

        document.getElementById('posts').innerHTML = data
          .map(
            post => `
        <article>
          <h2>${post.title}</h2>
          <p>${post.excerpt}</p>
          <a href="/post/${post.slug}">Read more</a>
        </article>
      `
          )
          .join('');
      }

      loadPosts();
    </script>
  </body>
</html>
```

#### 3. Next.js Integration

**Step 1: Create API utility**

```typescript
// lib/blog-api.ts
const API_BASE = process.env.PLATFORM_API_URL;
const API_TOKEN = process.env.PLATFORM_API_TOKEN;

export async function getPosts() {
  const res = await fetch(`${API_BASE}/api/v1/posts`, {
    headers: { 'X-API-Token': API_TOKEN! },
    next: { revalidate: 300 }, // Cache 5 minutes
  });
  return res.json();
}
```

**Step 2: Create page**

```typescript
// app/blog/page.tsx
import { getPosts } from '@/lib/blog-api';

export default async function BlogPage() {
  const { data: posts } = await getPosts();

  return (
    <main>
      <h1>Blog</h1>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </main>
  );
}
```

**Step 3: Environment variables**

```env
# .env.local
PLATFORM_API_URL=https://your-api.com
PLATFORM_API_TOKEN=sbp_xxxxxxxxxxxx
```

### Option B: Custom Domain

Best for: Full white-label with custom domains

```http
# Client's DNS
blog.client.com → Your Server IP

# Request to your blog frontend
GET / HTTP/1.1
Host: blog.client.com

# Blog frontend detects tenant from Host header
# and fetches from API with tenant context
```

### Option C: Embed Script

```html
<!-- Add to client's <head> -->
<script
  src="https://your-platform.com/embed.js"
  data-api-url="https://your-platform.com"
  data-token="sbp_xxx"
  data-theme="modern"
  data-container="#blog-posts"
></script>
```

---

## Deployment

### Development (Docker)

```bash
# Start all services
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# View logs
docker-compose -f infrastructure/docker/docker-compose.yml logs -f

# Stop services
docker-compose -f infrastructure/docker/docker-compose.yml down
```

### Production

#### 1. Build Images

```bash
# Admin API
docker build -t saas-blog-api ./apps/admin-api

# Blog Frontend
docker build -t saas-blog-frontend ./apps/blog-frontend

# Admin Dashboard
docker build -t saas-blog-admin ./apps/admin-dashboard
```

#### 2. Production Docker Compose

```yaml
# docker-compose.prod.yml
services:
  api:
    image: saas-blog-api
    environment:
      - NODE_ENV=production
      - DB_HOST=${DB_HOST}
      - DB_PORT=3306
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - '3001:3001'
    depends_on:
      - mysql
      - redis

  blog:
    image: saas-blog-frontend
    environment:
      - PLATFORM_API_URL=https://api.yourplatform.com
      - PLATFORM_API_TOKEN=${PLATFORM_API_TOKEN}
    ports:
      - '3000:3000'

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

#### 3. Environment Variables

Create `.env.production`:

```env
# Database
DB_HOST=mysql
DB_PORT=3306
DB_NAME=saas_blog
DB_USER=root
DB_PASSWORD=secure_password_here

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=very_long_random_secret_at_least_32_chars

# API
PLATFORM_API_TOKEN=sbp_production_token_here
```

#### 4. Deploy

```bash
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/blog-platform

upstream api {
    server 127.0.0.1:3001;
}

upstream blog {
    server 127.0.0.1:3000;
}

# API - api.yourplatform.com
server {
    listen 80;
    server_name api.yourplatform.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourplatform.com;

    ssl_certificate /etc/ssl/certs/yourplatform.crt;
    ssl_certificate_key /etc/ssl/private/yourplatform.key;

    location / {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Blog - www.yourplatform.com
server {
    listen 80;
    server_name yourplatform.com www.yourplatform.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourplatform.com www.yourplatform.com;

    ssl_certificate /etc/ssl/certs/yourplatform.crt;
    ssl_certificate_key /etc/ssl/private/yourplatform.key;

    location / {
        proxy_pass http://blog;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if MySQL is running
docker ps | grep mysql

# Test connection
docker exec -it saas_blog_mysql mysql -uroot -prootpassword -e "SELECT 1"

# View MySQL logs
docker logs saas_blog_mysql --tail 50
```

### Redis Connection Issues

```bash
# Check Redis
docker exec -it saas_blog_redis redis-cli ping

# Should return: PONG
```

### API Not Responding

```bash
# Check API logs
docker logs saas_blog_api --tail 50

# Restart API
docker-compose -f infrastructure/docker/docker-compose.yml restart admin-api
```

### Workflow Verification

```bash
# Run workflow tests
node scripts/verify-workflows.js
```

### Common Issues

| Issue                   | Solution                                                   |
| ----------------------- | ---------------------------------------------------------- |
| `ECONNREFUSED` on MySQL | Start Docker containers: `docker-compose up -d`            |
| Token expired errors    | Increase JWT_EXPIRES_IN to 24h in .env                     |
| 401 on switch-tenant    | Ensure refresh token is from same login session            |
| Posts not appearing     | Check post status is 'published', API token matches tenant |
| Rate limit errors       | Increase rateLimitRpm when creating API token              |

### Reset Database

```bash
# Drop and recreate database
docker exec -it saas_blog_mysql mysql -uroot -prootpassword -e "DROP DATABASE saas_blog; CREATE DATABASE saas_blog;"

# Re-run migrations and seeds
npm run db:migrate
npm run db:seed
```

---

## Support & Contributing

### Scripts

| Script               | Description                    |
| -------------------- | ------------------------------ |
| `npm run dev`        | Start all services in dev mode |
| `npm run db:migrate` | Run database migrations        |
| `npm run db:seed`    | Seed demo data                 |
| `npm run build`      | Build all apps for production  |

### Testing Workflows

```bash
# Full workflow test
node scripts/verify-workflows.js

# Generate API token
node scripts/generate-api-token.js <email> <password> <tenant-id> <name>
```

---

_Last updated: March 2026_
