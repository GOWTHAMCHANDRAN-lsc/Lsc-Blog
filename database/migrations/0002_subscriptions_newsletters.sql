-- Subscriptions + newsletters

CREATE TABLE IF NOT EXISTS subscribers (
  id                CHAR(36)      NOT NULL DEFAULT (UUID()),
  tenant_id         CHAR(36)      NOT NULL,
  email             VARCHAR(255)  NOT NULL,
  name              VARCHAR(255)  DEFAULT NULL,
  status            ENUM('pending','active','unsubscribed') NOT NULL DEFAULT 'pending',
  confirm_token_hash CHAR(64)     DEFAULT NULL,
  unsubscribe_token CHAR(64)      NOT NULL,
  confirmed_at      TIMESTAMP NULL DEFAULT NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriber_email (tenant_id, email),
  INDEX idx_subscriber_status (tenant_id, status),
  FOREIGN KEY fk_subscriber_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)     NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  preview_text  VARCHAR(255) DEFAULT NULL,
  html          LONGTEXT     NOT NULL,
  status        ENUM('draft','scheduled','sending','sent','failed') NOT NULL DEFAULT 'draft',
  scheduled_at  TIMESTAMP NULL DEFAULT NULL,
  sent_at       TIMESTAMP NULL DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_campaign_tenant_status (tenant_id, status),
  FOREIGN KEY fk_campaign_tenant (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id            CHAR(36)   NOT NULL DEFAULT (UUID()),
  campaign_id   CHAR(36)   NOT NULL,
  subscriber_id CHAR(36)   NOT NULL,
  status        ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  error         VARCHAR(500) DEFAULT NULL,
  sent_at       TIMESTAMP NULL DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_send_campaign_subscriber (campaign_id, subscriber_id),
  INDEX idx_send_campaign_status (campaign_id, status),
  FOREIGN KEY fk_send_campaign (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY fk_send_subscriber (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

