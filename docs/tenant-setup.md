# Tenant Management Guide

This guide explains how to create, configure, and manage tenants in the SaaS Blog Platform.

## Table of Contents

1. [Overview](#overview)
2. [Creating a Tenant](#creating-a-tenant)
3. [Configuring Tenant Settings](#configuring-tenant-settings)
4. [Configuring Cloud/External Blog](#configuring-cloudexternal-blog)
5. [Configuring Custom Domain](#configuring-custom-domain)
6. [User Management](#user-management)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The SaaS Blog Platform uses a **multi-tenant architecture** where each tenant represents a separate blog/writer workspace. Tenants can:

- Have their own custom domain (e.g., `blog.company.com`)
- Connect to external/cloud-hosted blogs
- Manage their own users and content
- Have isolated data and settings

---

## Creating a Tenant

### Step 1: Access Tenants Page

1. Log in as a **Super Admin**
2. Navigate to **Tenants** in the sidebar
3. Click the **New Tenant** button

### Step 2: Fill in Tenant Details

| Field             | Required | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| **Tenant Name**   | Yes      | Display name for the tenant (e.g., "Acme Corporation") |
| **Slug**          | No       | Auto-generated from name, used in URLs                 |
| **Custom Domain** | No       | Custom domain for the tenant's blog                    |

### Step 3: Configure (Optional)

If you want the tenant to use an **external/cloud-hosted blog**, fill in the "Tenant Blog Authentication" section:

| Field               | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| **Blog URL**        | The public URL of the tenant's external blog                  |
| **Blog API Key**    | API key for authenticating requests to the external blog      |
| **Allowed Origins** | CORS origins allowed to access the blog API (comma-separated) |

### Step 4: Save

Click **Create Tenant** to create the tenant.

---

## Configuring Tenant Settings

### From Admin Dashboard

1. Go to **Tenants** page
2. Click the **Edit** icon on the tenant row
3. Modify the following settings:

| Setting           | Options                    | Description                |
| ----------------- | -------------------------- | -------------------------- |
| **Status**        | Active / Trial / Suspended | Controls tenant access     |
| **Custom Domain** | Domain string              | Custom domain for the blog |

---

## Configuring Cloud/External Blog

If a tenant wants to use an **external blog** (hosted on a different server/cloud provider), follow these steps:

### Step 1: Set Up External Blog

Choose one of the following options:

#### Option A: WordPress Self-Hosted

```bash
# Install WordPress on your server/cloud
# Install WP REST API plugin (built-in)
# Get API credentials
```

#### Option B: Headless CMS (Strapi, Contentful, etc.)

```bash
# Set up your CMS
# Get API endpoint and API key
# Configure webhooks
```

#### Option C: Another SaaS Blog Platform Instance

```bash
# Note the blog URL
# Generate an API token from that instance
```

### Step 2: Configure in Tenant Settings

1. Go to **Tenants** → Edit the tenant
2. Fill in the "Tenant Blog Authentication" section:

```
Blog URL: https://blog.example.com
Blog API Key: sk-xxxxxxxxxxxxxxxxxxxx
Allowed Origins: https://example.com, https://app.example.com
```

### Step 3: Verify Connection

After saving, the system will:

- Use the `Blog URL` to fetch posts from the external blog
- Use the `Blog API Key` for authentication
- Allow CORS requests from the `Allowed Origins`

---

## Configuring Custom Domain

### Step 1: Add Custom Domain to Tenant

1. Go to **Tenants** → Edit the tenant
2. Enter the custom domain in **Custom Domain** field:
   ```
   blog.acme.com
   ```

### Step 2: Configure DNS

Add a CNAME record pointing to your platform:

| Type  | Name | Value                    |
| ----- | ---- | ------------------------ |
| CNAME | blog | your-platform.vercel.app |

Or for apex/domain:
| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |

### Step 3: Configure Platform (Vercel/Cloudflare)

If using Vercel, add the domain in Vercel Dashboard:

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Configure appropriate redirects

### Step 4: Test

```bash
# Test DNS propagation
nslookup blog.acme.com

# Test HTTPS
curl -I https://blog.acme.com
```

---

## User Management

### Adding Users to a Tenant

1. Log in as Super Admin
2. Go to **Users** page
3. Create a user or edit existing user
4. The user will be associated with a specific tenant

### Switching Between Tenants

Users with access to multiple tenants can switch:

1. Click on the tenant dropdown in the header
2. Select the desired tenant

---

## Troubleshooting

### Tenant Not Loading

- Check tenant status is **Active**
- Verify custom domain DNS is correct
- Check allowed origins for CORS issues

### External Blog Not Syncing

- Verify Blog URL is correct and accessible
- Confirm Blog API key is valid
- Check Allowed Origins includes your admin domain

### Custom Domain Not Working

1. Check DNS configuration:
   ```bash
   dig your-domain.com
   ```
2. Verify SSL certificate is issued
3. Check Vercel/Platform domain settings

### API Authentication Failed

- Regenerate the Blog API Key
- Verify the key has correct permissions
- Check API key hasn't expired

---

## API Endpoints Reference

| Method | Endpoint              | Description        |
| ------ | --------------------- | ------------------ |
| GET    | `/api/v1/tenants`     | List all tenants   |
| POST   | `/api/v1/tenants`     | Create a tenant    |
| GET    | `/api/v1/tenants/:id` | Get tenant details |
| PUT    | `/api/v1/tenants/:id` | Update tenant      |
| DELETE | `/api/v1/tenants/:id` | Delete tenant      |

---

## Best Practices

1. **Use descriptive tenant names** - Makes it easier to identify in the admin
2. **Set appropriate status** - Use "trial" for new customers, "active" when ready
3. **Configure custom domain early** - Allows SEO to establish
4. **Document external blog setup** - Keep notes on API keys and configurations
5. **Regular backups** - Export tenant data periodically

---

## Need Help?

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review API logs in the dashboard
3. Contact support with tenant details
