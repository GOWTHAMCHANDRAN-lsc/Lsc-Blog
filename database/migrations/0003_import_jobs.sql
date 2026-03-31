-- Import jobs (RSS/WXR)

CREATE TABLE IF NOT EXISTS import_jobs (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  tenant_id   CHAR(36) NOT NULL,
  type        ENUM('rss','wxr') NOT NULL,
  status      ENUM('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
  progress    INT UNSIGNED NOT NULL DEFAULT 0,
  total       INT UNSIGNED NOT NULL DEFAULT 0,
  result_json JSON DEFAULT NULL,
  error       VARCHAR(1000) DEFAULT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_import_tenant_status (tenant_id, status),
  FOREIGN KEY fk_import_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

