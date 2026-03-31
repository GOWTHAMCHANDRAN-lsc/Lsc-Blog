# Documentation Index

## Main Documentation

- [Platform Documentation](./README.md) - Complete platform documentation
- [Tenant Setup Guide](./tenant-setup.md) - How to create and configure tenants
- [API Reference](./API-REFERENCE.md) - API endpoints and usage
- [Hostinger VPS Deployment](./hostinger-vps-deployment.md) - Deploy on Ubuntu VPS

## Integration Examples

### Client Integration

| File                                                               | Description                | Technology    |
| ------------------------------------------------------------------ | -------------------------- | ------------- |
| [standalone-example.html](./standalone-example.html)               | Simple HTML/JS integration | Vanilla JS    |
| [nextjs-blog-page.tsx](./nextjs-blog-page.tsx)                     | Next.js Server Component   | React/Next.js |
| [client-integration-example.tsx](./client-integration-example.tsx) | TypeScript API utilities   | TypeScript    |

### Quick Start Examples

#### 1. HTML/JavaScript (5 minutes)

Copy `standalone-example.html` to your server and update:

```javascript
const API_BASE = 'https://your-api.com';
const API_TOKEN = 'sbp_your_token';
```

#### 2. Next.js (15 minutes)

1. Copy `nextjs-blog-page.tsx` to `app/blog/page.tsx`
2. Add environment variables:

```env
# .env.local
PLATFORM_API_URL=https://your-api.com
PLATFORM_API_TOKEN=sbp_your_token
```

3. Run `npm run dev`

#### 3. React (15 minutes)

1. Copy `client-integration-example.tsx` to `lib/blog-api.ts`
2. Import and use in your components:

```typescript
import { getBlogPosts } from '@/lib/blog-api';

const posts = await getBlogPosts(1, 10);
```

## Scripts

| Script                          | Description                     |
| ------------------------------- | ------------------------------- |
| `scripts/verify-workflows.js`   | Test all API workflows          |
| `scripts/generate-api-token.js` | Generate API tokens for clients |

## Generate API Token

```bash
node scripts/generate-api-token.js <email> <password> <tenant-id> "Token Name"

# Example
node scripts/generate-api-token.js admin@demo.com Admin@12345 tenant-uuid "My Client Blog"
```

## Common Use Cases

### Use Case 1: White-Label Blog

Each client gets their own:

- API token
- Subdomain or custom domain
- Custom branding (logo, colors via CSS)

### Use Case 2: API-Only Mode

Client fetches posts and renders with their own UI:

- `/api/v1/posts` - List posts
- `/api/v1/posts/:slug` - Single post
- `/api/v1/categories` - Categories
- `/api/v1/tags` - Tags

### Use Case 3: Embed Mode

Add blog to existing site:

```html
<script
  src="https://your-api.com/embed.js"
  data-token="sbp_xxx"
  data-theme="modern"
></script>
<div id="blog-posts"></div>
```
