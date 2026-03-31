# API Reference

## Base URLs

| Environment | URL                            |
| ----------- | ------------------------------ |
| Development | `http://localhost:3001`        |
| Production  | `https://api.yourplatform.com` |

## Authentication

### Login

```http
POST /admin/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "name": "Admin User",
      "systemRole": "user",
      "tenantId": "550e8400-e29b-41d4-a716-446655440001",
      "tenantRole": "admin",
      "tenantName": "Demo Blog"
    }
  }
}
```

### Refresh Token

```http
POST /admin/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Switch Tenant

```http
POST /admin/v1/auth/switch-tenant
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Get Current User

```http
GET /admin/v1/auth/me
Authorization: Bearer <access_token>
```

---

## Public API Endpoints

All public endpoints require `X-API-Token` header.

### List Posts

```http
GET /api/v1/posts
X-API-Token: <token>
```

**Query Parameters:**

| Parameter | Type    | Default      | Description              |
| --------- | ------- | ------------ | ------------------------ |
| page      | integer | 1            | Page number              |
| per_page  | integer | 10           | Items per page (max 100) |
| category  | string  | -            | Filter by category slug  |
| tag       | string  | -            | Filter by tag slug       |
| search    | string  | -            | Search in title/content  |
| sort      | string  | published_at | Sort field               |
| order     | string  | DESC         | ASC or DESC              |

**Example:**

```http
GET /api/v1/posts?page=1&per_page=10&category=technology&sort=published_at&order=DESC
X-API-Token: sbp_xxx
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "getting-started-with-nextjs",
      "title": "Getting Started with Next.js",
      "excerpt": "A comprehensive guide...",
      "content": "<h1>Getting Started</h1>...",
      "featured_image_url": "https://cdn.example.com/image.jpg",
      "reading_time_mins": 5,
      "word_count": 1000,
      "published_at": "2026-03-23T10:00:00Z",
      "author": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "John Doe",
        "avatar_url": "https://cdn.example.com/avatar.jpg",
        "bio": "Tech writer"
      },
      "categories": [
        {
          "id": "...",
          "name": "Technology",
          "slug": "technology",
          "is_primary": true
        }
      ],
      "tags": [
        {
          "id": "...",
          "name": "Next.js",
          "slug": "nextjs"
        }
      ],
      "seo": {
        "meta_title": "Getting Started with Next.js",
        "meta_description": "A comprehensive guide...",
        "og_title": "Getting Started with Next.js",
        "og_description": "A comprehensive guide...",
        "og_image_url": "https://cdn.example.com/og-image.jpg",
        "canonical_url": null,
        "twitter_card": "summary_large_image",
        "schema_markup": {},
        "robots": "index, follow"
      }
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 50,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### Get Single Post

```http
GET /api/v1/posts/:slug
X-API-Token: <token>
```

**Response:** Same structure as single item in list response.

### List Categories

```http
GET /api/v1/categories
X-API-Token: <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Technology",
      "slug": "technology",
      "description": "Tech related posts",
      "parent_id": null,
      "post_count": 15
    }
  ]
}
```

### List Tags

```http
GET /api/v1/tags
X-API-Token: <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Next.js",
      "slug": "nextjs",
      "post_count": 10
    }
  ]
}
```

### Get Site Config

```http
GET /api/v1/site-config
X-API-Token: <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "site_name": "Demo Blog",
    "site_tagline": "A sample SaaS blog",
    "logo_url": "https://cdn.example.com/logo.png",
    "favicon_url": "https://cdn.example.com/favicon.ico",
    "primary_color": "#2563eb",
    "font_family": "Inter",
    "posts_per_page": 10,
    "enable_comments": true,
    "comment_provider": "native",
    "comment_moderation": "manual",
    "comments_per_page": 10,
    "analytics_id": null,
    "rss_enabled": true,
    "header_scripts": null,
    "footer_scripts": null,
    "social_links": {
      "twitter": "https://twitter.com/example",
      "github": "https://github.com/example"
    },
    "locale": "en",
    "timezone": "UTC"
  }
}
```

### List Comments

```http
GET /api/v1/posts/:slug/comments
X-API-Token: <token>
```

**Query Parameters:**

| Parameter | Type    | Default |
| --------- | ------- | ------- |
| page      | integer | 1       |
| per_page  | integer | 10      |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "author_name": "John Doe",
      "author_website": "https://example.com",
      "content": "Great article!",
      "created_at": "2026-03-23T10:00:00Z",
      "status": "approved"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 5,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

### Submit Comment

```http
POST /api/v1/posts/:slug/comments
X-API-Token: <token>
Content-Type: application/json

{
  "authorName": "John Doe",
  "authorEmail": "john@example.com",
  "authorWebsite": "https://example.com",
  "content": "Great article! Thanks for sharing."
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending"
  }
}
```

---

## Admin API Endpoints

All admin endpoints require JWT authentication.

### Posts

| Method | Endpoint                      | Description         |
| ------ | ----------------------------- | ------------------- |
| GET    | /admin/v1/posts               | List all posts      |
| POST   | /admin/v1/posts               | Create post         |
| GET    | /admin/v1/posts/:id           | Get post            |
| PUT    | /admin/v1/posts/:id           | Update post         |
| DELETE | /admin/v1/posts/:id           | Delete post         |
| POST   | /admin/v1/posts/:id/submit    | Submit for approval |
| POST   | /admin/v1/posts/:id/approve   | Approve post        |
| POST   | /admin/v1/posts/:id/reject    | Reject post         |
| POST   | /admin/v1/posts/:id/publish   | Publish post        |
| POST   | /admin/v1/posts/:id/schedule  | Schedule post       |
| POST   | /admin/v1/posts/:id/unpublish | Unpublish post      |

### Create Post

```http
POST /admin/v1/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My New Post",
  "content": "<h1>Content</h1><p>...</p>",
  "excerpt": "Short summary",
  "categoryIds": ["category-uuid-1"],
  "tagIds": ["tag-uuid-1", "tag-uuid-2"],
  "featuredImageUrl": "https://cdn.example.com/image.jpg"
}
```

### Tenants (Super Admin only)

| Method | Endpoint                      | Description        |
| ------ | ----------------------------- | ------------------ |
| GET    | /admin/v1/tenants             | List all tenants   |
| POST   | /admin/v1/tenants             | Create tenant      |
| GET    | /admin/v1/tenants/:id         | Get tenant         |
| PUT    | /admin/v1/tenants/:id         | Update tenant      |
| DELETE | /admin/v1/tenants/:id         | Soft delete tenant |
| POST   | /admin/v1/tenants/:id/restore | Restore tenant     |

### Create Tenant

```http
POST /admin/v1/tenants
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Client Blog",
  "slug": "new-client",
  "plan": "starter",
  "ownerEmail": "client@example.com"
}
```

### API Tokens

| Method | Endpoint                 | Description  |
| ------ | ------------------------ | ------------ |
| GET    | /admin/v1/api-tokens     | List tokens  |
| POST   | /admin/v1/api-tokens     | Create token |
| DELETE | /admin/v1/api-tokens/:id | Revoke token |

### Create API Token

```http
POST /admin/v1/api-tokens
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Client Website",
  "scopes": ["posts:read", "config:read", "categories:read", "tags:read"],
  "rateLimitRpm": 300
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Client Website",
    "token": "sbp_a588b62acee1347c9064e77d7156507dc283ec6a715f6d35ca59328a8c42031d",
    "tokenPrefix": "sbp_a588b62",
    "scopes": ["posts:read", "config:read", "categories:read", "tags:read"],
    "rateLimitRpm": 300,
    "expiresAt": null,
    "createdAt": "2026-03-23T10:00:00Z"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Common Error Codes

| Code                | HTTP Status | Description              |
| ------------------- | ----------- | ------------------------ |
| UNAUTHORIZED        | 401         | Invalid or missing token |
| FORBIDDEN           | 403         | Insufficient permissions |
| NOT_FOUND           | 404         | Resource not found       |
| VALIDATION_ERROR    | 400         | Invalid request data     |
| RATE_LIMIT_EXCEEDED | 429         | Too many requests        |
| INTERNAL_ERROR      | 500         | Server error             |

---

## Rate Limits

| Tier       | Requests per minute |
| ---------- | ------------------- |
| Starter    | 60                  |
| Pro        | 300                 |
| Enterprise | 1000                |

Custom limits can be set per API token.

---

## Webhooks

Configure webhooks in tenant settings to receive notifications:

```json
{
  "webhook_urls": ["https://your-app.com/webhooks/blog"]
}
```

### Webhook Payload

```json
{
  "event": "post.published",
  "timestamp": "2026-03-23T10:00:00Z",
  "data": {
    "postId": "...",
    "slug": "new-post",
    "title": "New Post",
    "tenantId": "..."
  }
}
```

### Events

| Event                | Description           |
| -------------------- | --------------------- |
| post.created         | New post created      |
| post.published       | Post published        |
| post.updated         | Post updated          |
| post.deleted         | Post deleted          |
| comment.submitted    | New comment submitted |
| comment.approved     | Comment approved      |
| subscription.created | New subscriber        |
