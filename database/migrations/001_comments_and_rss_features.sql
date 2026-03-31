-- MySQL 8 does not support "ADD COLUMN IF NOT EXISTS".
-- Make this migration idempotent by checking INFORMATION_SCHEMA first.

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'site_config'
    AND COLUMN_NAME = 'comment_moderation'
);
SET @sql := IF(
  @col_exists = 0,
  "ALTER TABLE site_config ADD COLUMN comment_moderation ENUM('off','manual','auto') NOT NULL DEFAULT 'manual' AFTER comment_provider",
  "SELECT 1"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'site_config'
    AND COLUMN_NAME = 'comments_per_page'
);
SET @sql := IF(
  @col_exists = 0,
  "ALTER TABLE site_config ADD COLUMN comments_per_page TINYINT UNSIGNED NOT NULL DEFAULT 10 AFTER comment_moderation",
  "SELECT 1"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'site_config'
    AND COLUMN_NAME = 'comment_blocked_words'
);
SET @sql := IF(
  @col_exists = 0,
  "ALTER TABLE site_config ADD COLUMN comment_blocked_words TEXT DEFAULT NULL AFTER comments_per_page",
  "SELECT 1"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'site_config'
    AND COLUMN_NAME = 'rss_enabled'
);
SET @sql := IF(
  @col_exists = 0,
  "ALTER TABLE site_config ADD COLUMN rss_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER analytics_id",
  "SELECT 1"
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
);

UPDATE site_config
SET comment_provider = COALESCE(comment_provider, 'native')
WHERE enable_comments = 1;
