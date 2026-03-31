# VPS Deployment (Docker + Nginx)

This project ships with a production-ish Docker Compose file and Nginx reverse proxy configuration.

## What you get

- **Nginx**: routes `/` → blog frontend, `/admin/` → admin dashboard, `/api/` + `/admin-api/` → Express API
- **API + worker**: scheduled publishing, sitemap jobs, newsletter sends, imports
- **MySQL + Redis + Elasticsearch**: stateful services (volumes)
- **Local media/import persistence**: API volumes mounted to `/app/uploads` and `/app/imports`

## Prerequisites on the VPS

- Docker + Docker Compose
- DNS pointing your domains to the VPS

## First-time setup

1. Copy env template and fill values:

```bash
cp .env.example .env
```

2. Start the stack:

```bash
npm run docker:up:prod
```

3. Run DB migrations once (adds theme/subscriptions/import tables):

```bash
docker exec -it saas_blog_api node src/config/migrate.js
```

## Nginx routing model

Config lives in:

- `infrastructure/nginx/nginx.conf`
- `infrastructure/nginx/conf.d/saas-blog.conf`

By default it listens on **port 80**. To enable TLS, add a 443 server and redirect 80 → 443.

## TLS (Let’s Encrypt) checklist

- Create certs for your primary domain(s)
- Add an Nginx 443 server block with `ssl_certificate` / `ssl_certificate_key`
- Redirect 80 → 443
- Set `NEXT_PUBLIC_SITE_URL` and `PUBLIC_MEDIA_BASE_URL` to `https://...`

## Backups checklist

- **MySQL**: dump nightly or use volume snapshots (`mysql_data`)
- **Uploads/imports**: back up `api_uploads` and `api_imports` volumes

## Monitoring checklist

- Watch container logs:

```bash
docker logs -f saas_blog_api
docker logs -f saas_blog_worker
docker logs -f saas_blog_nginx
```

- Health endpoint:
  - API: `/health`

## Common gotchas

- After any schema change, rerun migrations inside `saas_blog_api`.
- If SMTP env vars are missing, subscription confirmation and campaign sends will fail.
