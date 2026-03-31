/**
 * Development seed — creates demo tenant, users, and sample posts
 * Run: node database/seeds/index.js
 */
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../apps/admin-api/.env'),
});
console.log(
  'Loading env from:',
  path.resolve(__dirname, '../../apps/admin-api/.env')
);
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

async function seed() {
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'set' : 'NOT SET');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'saas_blog',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('🌱 Seeding development data…\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  const superAdminId = uuidv4();
  const editorId = uuidv4();
  const authorId = uuidv4();

  const hash = pw => bcrypt.hashSync(pw, 10);

  await conn.query(
    `
    INSERT IGNORE INTO users (id, email, password_hash, name, system_role, is_active, email_verified)
    VALUES
      (?, 'superadmin@demo.com', ?, 'Super Admin',   'super_admin', 1, 1),
      (?, 'editor@demo.com',     ?, 'Sarah Editor',   'user',        1, 1),
      (?, 'author@demo.com',     ?, 'Alex Author',    'user',        1, 1)
  `,
    [
      superAdminId,
      hash('Admin@12345'),
      editorId,
      hash('Editor@12345'),
      authorId,
      hash('Author@12345'),
    ]
  );
  console.log('✅ Users created');

  // ── Tenant ─────────────────────────────────────────────────────────────────
  let tenantId = uuidv4();
  await conn.query(
    `
      INSERT IGNORE INTO tenants (id, name, slug, plan, status, owner_id)
      VALUES (?, 'Demo Blog', 'demo', 'pro', 'active', ?)
    `,
    [tenantId, superAdminId]
  );

  // If the tenant already existed (slug is unique), use the existing tenant id
  const [tenantRows] = await conn.query(
    `SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1`
  );
  if (tenantRows?.[0]?.id) {
    tenantId = tenantRows[0].id;
  }

  // Tenant memberships
  await conn.query(
    `
    INSERT IGNORE INTO tenant_users (id, tenant_id, user_id, role, joined_at)
    VALUES
      (UUID(), ?, ?, 'admin',  NOW()),
      (UUID(), ?, ?, 'editor', NOW()),
      (UUID(), ?, ?, 'author', NOW())
  `,
    [tenantId, superAdminId, tenantId, editorId, tenantId, authorId]
  );
  console.log('✅ Tenant + memberships created');

  // ── Site Config ────────────────────────────────────────────────────────────
  await conn.query(
    `
    INSERT IGNORE INTO site_config
      (id, tenant_id, site_name, site_tagline, primary_color, posts_per_page,
       enable_comments, comment_provider, comment_moderation, comments_per_page, rss_enabled)
    VALUES (UUID(), ?, 'Demo Blog', 'A sample SaaS blog', '#2563eb', 10,
      1, 'native', 'manual', 10, 1)
  `,
    [tenantId]
  );
  console.log('✅ Site config created');

  // ── Categories ─────────────────────────────────────────────────────────────
  const cats = [
    { id: uuidv4(), name: 'Technology', slug: 'technology' },
    { id: uuidv4(), name: 'Design', slug: 'design' },
    { id: uuidv4(), name: 'Business', slug: 'business' },
  ];
  for (const c of cats) {
    await conn.query(
      `INSERT IGNORE INTO categories (id, tenant_id, name, slug) VALUES (?, ?, ?, ?)`,
      [c.id, tenantId, c.name, c.slug]
    );
  }
  console.log('✅ Categories created');

  // ── Tags ───────────────────────────────────────────────────────────────────
  const tags = [
    { id: uuidv4(), name: 'Next.js', slug: 'nextjs' },
    { id: uuidv4(), name: 'Node.js', slug: 'nodejs' },
    { id: uuidv4(), name: 'SaaS', slug: 'saas' },
    { id: uuidv4(), name: 'SEO', slug: 'seo' },
    { id: uuidv4(), name: 'API Design', slug: 'api-design' },
  ];
  for (const t of tags) {
    await conn.query(
      `INSERT IGNORE INTO tags (id, tenant_id, name, slug) VALUES (?, ?, ?, ?)`,
      [t.id, tenantId, t.name, t.slug]
    );
  }
  console.log('✅ Tags created');

  // ── Sample Posts ───────────────────────────────────────────────────────────
  const samplePosts = [
    {
      id: uuidv4(),
      title: 'Getting Started with Next.js 14',
      slug: 'getting-started-with-nextjs-14',
      excerpt:
        'A comprehensive guide to building modern web applications with Next.js 14 and the App Router.',
      content:
        '<h1>Getting Started with Next.js 14</h1><p>Next.js 14 introduces powerful new features including the App Router, Server Components, and Streaming. In this guide we will walk through everything you need to know to get started.</p><h2>What is the App Router?</h2><p>The App Router is a new routing paradigm built on React Server Components. It allows you to create layouts, nested routes, and loading states with ease.</p><h2>Server Components vs Client Components</h2><p>Server Components run on the server and can directly access databases and file systems. Client Components run in the browser and can use hooks and event handlers.</p>',
      status: 'published',
      catId: cats[0].id,
      tagIds: [tags[0].id, tags[2].id],
    },
    {
      id: uuidv4(),
      title: 'Building a Multi-Tenant SaaS Platform',
      slug: 'building-multi-tenant-saas-platform',
      excerpt:
        'Learn the architecture patterns for building a scalable multi-tenant SaaS application from scratch.',
      content:
        '<h1>Building a Multi-Tenant SaaS Platform</h1><p>Multi-tenancy is a software architecture where a single instance of the software serves multiple tenants. Each tenant is isolated from others, with their own data and configuration.</p><h2>Shared Database Strategy</h2><p>The most cost-effective strategy for thousands of tenants is the shared database, shared schema approach. All tenant data lives in one database, isolated by a tenant_id column.</p>',
      status: 'published',
      catId: cats[2].id,
      tagIds: [tags[2].id, tags[4].id],
    },
    {
      id: uuidv4(),
      title: 'SEO Best Practices for Developers',
      slug: 'seo-best-practices-developers',
      excerpt:
        'Technical SEO strategies every developer should know to improve search engine rankings.',
      content:
        '<h1>SEO Best Practices for Developers</h1><p>SEO is not just about keywords — it is about building a technically sound website that search engines can crawl, index, and rank effectively.</p>',
      status: 'pending_approval',
      catId: cats[0].id,
      tagIds: [tags[3].id],
    },
  ];

  for (const post of samplePosts) {
    const wordCount = post.content
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);

    await conn.query(
      `
      INSERT IGNORE INTO posts
        (id, tenant_id, author_id, title, slug, excerpt, content, word_count, reading_time_mins)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        post.id,
        tenantId,
        authorId,
        post.title,
        post.slug,
        post.excerpt,
        post.content,
        wordCount,
        readingTime,
      ]
    );

    // Status entries
    await conn.query(
      `INSERT IGNORE INTO post_status (id, post_id, status, changed_by) VALUES (UUID(), ?, 'draft', ?)`,
      [post.id, authorId]
    );
    if (post.status !== 'draft') {
      await conn.query(
        `INSERT IGNORE INTO post_status (id, post_id, status, changed_by) VALUES (UUID(), ?, 'pending_approval', ?)`,
        [post.id, authorId]
      );
    }
    if (post.status === 'published') {
      await conn.query(
        `INSERT IGNORE INTO post_status (id, post_id, status, changed_by, published_at) VALUES (UUID(), ?, 'published', ?, NOW())`,
        [post.id, editorId]
      );
    }

    // SEO meta
    await conn.query(
      `
      INSERT IGNORE INTO seo_meta (id, post_id, tenant_id, meta_title, meta_description, focus_keyword)
      VALUES (UUID(), ?, ?, ?, ?, ?)
    `,
      [
        post.id,
        tenantId,
        post.title.substring(0, 70),
        post.excerpt.substring(0, 160),
        post.title.split(' ').slice(0, 3).join(' ').toLowerCase(),
      ]
    );

    // Category
    await conn.query(
      `INSERT IGNORE INTO post_categories (post_id, category_id, is_primary) VALUES (?, ?, 1)`,
      [post.id, post.catId]
    );

    // Tags
    for (const tagId of post.tagIds) {
      await conn.query(
        `INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)`,
        [post.id, tagId]
      );
    }
  }
  console.log('✅ Sample posts created');

  // ── API Token ──────────────────────────────────────────────────────────────
  const rawToken = `sbp_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = rawToken.substring(0, 8);
  const tokenHash = bcrypt.hashSync(rawToken, 10);

  await conn.query(
    `
    INSERT IGNORE INTO api_tokens
      (id, tenant_id, name, token_hash, token_prefix, scopes, rate_limit_rpm)
    VALUES (UUID(), ?, 'Demo Blog Frontend', ?, ?, '["posts:read","config:read","categories:read","tags:read"]', 300)
  `,
    [tenantId, tokenHash, prefix]
  );

  console.log('\n📋 Demo Credentials:');
  console.log('─────────────────────────────────────────────────');
  console.log('Super Admin: superadmin@demo.com / Admin@12345');
  console.log('Editor:      editor@demo.com     / Editor@12345');
  console.log('Author:      author@demo.com     / Author@12345');
  console.log('Tenant ID:  ', tenantId);
  console.log('API Token:  ', rawToken);
  console.log('─────────────────────────────────────────────────');
  console.log('\n🎉 Seed complete!');

  await conn.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
