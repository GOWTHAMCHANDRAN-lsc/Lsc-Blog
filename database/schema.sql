-- ============================================================
-- SaaS Multi-Tenant Blog Platform — Complete Schema
-- Engine: MySQL 8.0+ / MariaDB 10.6+
-- ============================================================

SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS saas_blog
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE saas_blog;

-- ─────────────────────────────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id              CHAR(36)        NOT NULL DEFAULT (UUID()),
    name            VARCHAR(255)    NOT NULL,
    slug            VARCHAR(100)    NOT NULL,
    custom_domain   VARCHAR(255)    DEFAULT NULL,
    plan            ENUM('starter','pro','enterprise') NOT NULL DEFAULT 'starter',
    status          ENUM('active','suspended','trial') NOT NULL DEFAULT 'trial',
    owner_id        CHAR(36)        DEFAULT NULL,
    webhook_urls    JSON            DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tenants_slug (slug),
    UNIQUE KEY uq_tenants_domain (custom_domain),
    INDEX idx_tenants_status (status),
    INDEX idx_tenants_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              CHAR(36)        NOT NULL DEFAULT (UUID()),
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    avatar_url      VARCHAR(1000)   DEFAULT NULL,
    bio             TEXT            DEFAULT NULL,
    system_role     ENUM('super_admin','user') NOT NULL DEFAULT 'user',
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN         NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMP NULL DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- TENANT USERS (memberships + roles)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_users (
    id          CHAR(36)    NOT NULL DEFAULT (UUID()),
    tenant_id   CHAR(36)    NOT NULL,
    user_id     CHAR(36)    NOT NULL,
    role        ENUM('admin','editor','author','viewer') NOT NULL DEFAULT 'author',
    invited_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    joined_at   TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tenant_user (tenant_id, user_id),
    FOREIGN KEY fk_tu_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY fk_tu_user   (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    INDEX idx_tu_tenant (tenant_id),
    INDEX idx_tu_user   (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id          CHAR(36)        NOT NULL DEFAULT (UUID()),
    tenant_id   CHAR(36)        NOT NULL,
    name        VARCHAR(255)    NOT NULL,
    slug        VARCHAR(255)    NOT NULL,
    description TEXT            DEFAULT NULL,
    parent_id   CHAR(36)        DEFAULT NULL,
    sort_order  INT             NOT NULL DEFAULT 0,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cat_slug_tenant (tenant_id, slug),
    FOREIGN KEY fk_cat_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY fk_cat_parent (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_cat_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
    id          CHAR(36)        NOT NULL DEFAULT (UUID()),
    tenant_id   CHAR(36)        NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    slug        VARCHAR(100)    NOT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tag_slug_tenant (tenant_id, slug),
    FOREIGN KEY fk_tag_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_tag_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- POSTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
    id                  CHAR(36)        NOT NULL DEFAULT (UUID()),
    tenant_id           CHAR(36)        NOT NULL,
    author_id           CHAR(36)        NOT NULL,
    title               VARCHAR(500)    NOT NULL,
    slug                VARCHAR(500)    NOT NULL,
    excerpt             TEXT            DEFAULT NULL,
    content             LONGTEXT        NOT NULL,
    content_format      ENUM('html','markdown','json') NOT NULL DEFAULT 'html',
    featured_image_url  VARCHAR(1000)   DEFAULT NULL,
    reading_time_mins   SMALLINT        UNSIGNED DEFAULT 0,
    word_count          INT             UNSIGNED DEFAULT 0,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_post_slug_tenant (tenant_id, slug),
    FOREIGN KEY fk_post_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY fk_post_author (author_id) REFERENCES users(id),
    INDEX idx_post_tenant     (tenant_id),
    INDEX idx_post_author     (author_id),
    INDEX idx_post_updated    (updated_at),
    FULLTEXT INDEX ft_post_search (title, content, excerpt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- POST STATUS (workflow audit log)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_status (
    id              CHAR(36)    NOT NULL DEFAULT (UUID()),
    post_id         CHAR(36)    NOT NULL,
    status          ENUM(
                        'draft',
                        'seo_review',
                        'pending_approval',
                        'approved',
                        'rejected',
                        'published',
                        'unpublished',
                        'scheduled'
                    ) NOT NULL DEFAULT 'draft',
    changed_by      CHAR(36)    NOT NULL,
    note            TEXT        DEFAULT NULL,
    scheduled_at    TIMESTAMP NULL DEFAULT NULL,
    published_at    TIMESTAMP NULL DEFAULT NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY fk_ps_post       (post_id)    REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY fk_ps_changed_by (changed_by) REFERENCES users(id),
    INDEX idx_ps_post    (post_id),
    INDEX idx_ps_status  (status),
    INDEX idx_ps_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- SEO META
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_meta (
    id                  CHAR(36)        NOT NULL DEFAULT (UUID()),
    post_id             CHAR(36)        NOT NULL,
    tenant_id           CHAR(36)        NOT NULL,
    meta_title          VARCHAR(70)     DEFAULT NULL,
    meta_description    VARCHAR(160)    DEFAULT NULL,
    canonical_url       VARCHAR(500)    DEFAULT NULL,
    og_title            VARCHAR(200)    DEFAULT NULL,
    og_description      VARCHAR(300)    DEFAULT NULL,
    og_image_url        VARCHAR(1000)   DEFAULT NULL,
    twitter_card        ENUM('summary','summary_large_image') DEFAULT 'summary_large_image',
    focus_keyword       VARCHAR(255)    DEFAULT NULL,
    keyword_density     DECIMAL(5,2)    DEFAULT NULL,
    readability_score   TINYINT         UNSIGNED DEFAULT NULL,
    seo_score           TINYINT         UNSIGNED DEFAULT NULL,
    schema_markup       JSON            DEFAULT NULL,
    robots              VARCHAR(100)    DEFAULT 'index,follow',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_seo_post (post_id),
    FOREIGN KEY fk_seo_post   (post_id)   REFERENCES posts(id)   ON DELETE CASCADE,
    FOREIGN KEY fk_seo_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_seo_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- POST CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_categories (
    post_id     CHAR(36)    NOT NULL,
    category_id CHAR(36)    NOT NULL,
    is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY fk_pc_post     (post_id)     REFERENCES posts(id)      ON DELETE CASCADE,
    FOREIGN KEY fk_pc_category (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_pc_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- POST TAGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_tags (
    post_id CHAR(36) NOT NULL,
    tag_id  CHAR(36) NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY fk_pt_post (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY fk_pt_tag  (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE,
    INDEX idx_pt_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- API TOKENS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_tokens (
    id              CHAR(36)        NOT NULL DEFAULT (UUID()),
    tenant_id       CHAR(36)        NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    token_hash      VARCHAR(255)    NOT NULL,
    token_prefix    CHAR(8)         NOT NULL,
    scopes          JSON            NOT NULL,
    rate_limit_rpm  INT             UNSIGNED NOT NULL DEFAULT 300,
    expires_at      TIMESTAMP NULL DEFAULT NULL,
    last_used_at    TIMESTAMP NULL DEFAULT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_token_hash (token_hash),
    FOREIGN KEY fk_at_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_at_prefix (token_prefix),
    INDEX idx_at_tenant (tenant_id),
    INDEX idx_at_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- SITE CONFIG
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_config (
    id                  CHAR(36)        NOT NULL DEFAULT (UUID()),
    tenant_id           CHAR(36)        NOT NULL,
    site_name           VARCHAR(255)    NOT NULL,
    site_tagline        VARCHAR(500)    DEFAULT NULL,
    logo_url            VARCHAR(1000)   DEFAULT NULL,
    favicon_url         VARCHAR(1000)   DEFAULT NULL,
    primary_color       CHAR(7)         DEFAULT '#3B82F6',
    font_family         VARCHAR(100)    DEFAULT 'Inter',
    posts_per_page      TINYINT         UNSIGNED NOT NULL DEFAULT 10,
    enable_comments     BOOLEAN         NOT NULL DEFAULT FALSE,
    comment_provider    VARCHAR(100)    DEFAULT NULL,
    comment_moderation  ENUM('off','manual','auto') NOT NULL DEFAULT 'manual',
    comments_per_page   TINYINT         UNSIGNED NOT NULL DEFAULT 10,
    comment_blocked_words TEXT          DEFAULT NULL,
    analytics_id        VARCHAR(100)    DEFAULT NULL,
    rss_enabled         BOOLEAN         NOT NULL DEFAULT TRUE,
    header_scripts      TEXT            DEFAULT NULL,
    footer_scripts      TEXT            DEFAULT NULL,
    social_links        JSON            DEFAULT NULL,
    locale              VARCHAR(10)     NOT NULL DEFAULT 'en',
    timezone            VARCHAR(50)     NOT NULL DEFAULT 'UTC',
    webhook_urls        JSON            DEFAULT NULL,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sc_tenant (tenant_id),
    FOREIGN KEY fk_sc_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- MEDIA
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
    id              CHAR(36)        NOT NULL DEFAULT (UUID()),
    tenant_id       CHAR(36)        NOT NULL,
    uploaded_by     CHAR(36)        NOT NULL,
    filename        VARCHAR(500)    NOT NULL,
    storage_key     VARCHAR(1000)   NOT NULL,
    cdn_url         VARCHAR(1000)   NOT NULL,
    mime_type       VARCHAR(100)    NOT NULL,
    file_size_bytes INT             UNSIGNED NOT NULL DEFAULT 0,
    width           SMALLINT        UNSIGNED DEFAULT NULL,
    height          SMALLINT        UNSIGNED DEFAULT NULL,
    alt_text        VARCHAR(500)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY fk_media_tenant  (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY fk_media_user    (uploaded_by) REFERENCES users(id),
    INDEX idx_media_tenant  (tenant_id),
    INDEX idx_media_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- POST REVISIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_revisions (
    id              CHAR(36)        NOT NULL DEFAULT (UUID()),
    post_id         CHAR(36)        NOT NULL,
    revised_by      CHAR(36)        NOT NULL,
    title           VARCHAR(500)    NOT NULL,
    content         LONGTEXT        NOT NULL,
    revision_note   VARCHAR(500)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY fk_rev_post (post_id)    REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY fk_rev_user (revised_by) REFERENCES users(id),
    INDEX idx_rev_post    (post_id),
    INDEX idx_rev_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- —————————————————————————————————————————————————————————————
-- COMMENTS
-- —————————————————————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS comments (
    id                  CHAR(36)        NOT NULL DEFAULT (UUID()),
    tenant_id           CHAR(36)        NOT NULL,
    post_id             CHAR(36)        NOT NULL,
    parent_id           CHAR(36)        DEFAULT NULL,
    author_name         VARCHAR(120)    NOT NULL,
    author_email        VARCHAR(255)    NOT NULL,
    author_website      VARCHAR(1000)   DEFAULT NULL,
    content             TEXT            NOT NULL,
    status              ENUM('pending','approved','rejected','spam') NOT NULL DEFAULT 'pending',
    moderation_reason   VARCHAR(255)    DEFAULT NULL,
    ip_hash             CHAR(64)        DEFAULT NULL,
    user_agent          VARCHAR(500)    DEFAULT NULL,
    approved_at         TIMESTAMP NULL DEFAULT NULL,
    approved_by         CHAR(36)        DEFAULT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY fk_comments_tenant      (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY fk_comments_post        (post_id)     REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY fk_comments_parent      (parent_id)   REFERENCES comments(id) ON DELETE SET NULL,
    FOREIGN KEY fk_comments_approved_by (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_comments_tenant_status (tenant_id, status),
    INDEX idx_comments_post_status   (post_id, status),
    INDEX idx_comments_created       (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- ANALYTICS PAGEVIEWS (partitioned by date)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_pageviews (
    id              BIGINT          UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_id       CHAR(36)        NOT NULL,
    post_id         CHAR(36)        DEFAULT NULL,
    path            VARCHAR(2000)   NOT NULL,
    referrer        VARCHAR(2000)   DEFAULT NULL,
    country_code    CHAR(2)         DEFAULT NULL,
    device_type     ENUM('desktop','mobile','tablet') DEFAULT NULL,
    viewed_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, viewed_at),
    INDEX idx_av_tenant_date (tenant_id, viewed_at),
    INDEX idx_av_post        (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (UNIX_TIMESTAMP(viewed_at)) (
    PARTITION p_2024 VALUES LESS THAN (UNIX_TIMESTAMP('2025-01-01')),
    PARTITION p_2025 VALUES LESS THAN (UNIX_TIMESTAMP('2026-01-01')),
    PARTITION p_2026 VALUES LESS THAN (UNIX_TIMESTAMP('2027-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────────────────────────────────────────
-- SEED: Default super admin user
-- password: Admin@12345 (change immediately!)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO users (id, email, password_hash, name, system_role, is_active, email_verified)
VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'admin@yourplatform.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeKxxxxxxxxxxxxxxxxxxx',
    'Super Admin',
    'super_admin',
    1,
    1
);
