-- Add theme + navigation config to site_config

ALTER TABLE site_config
  ADD COLUMN theme_id VARCHAR(50) DEFAULT 'classic' AFTER font_family,
  ADD COLUMN nav_links JSON DEFAULT NULL AFTER social_links,
  ADD COLUMN footer_links JSON DEFAULT NULL AFTER nav_links;

