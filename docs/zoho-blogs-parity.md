# Zoho Blogs Parity Check

Last cross-check: 2026-03-16

Official feature references used for comparison:

- Zoho Sites blogging features: https://www.zoho.com/sites/features/blogging.html
- Zoho Commerce blog guide: https://www.zoho.com/commerce/help/blogs/
- Zoho Sites what's new: https://www.zoho.com/sites/whats-new.html
- Zoho storefront blog comments settings: https://www.zoho.com/commerce/help/storefront-settings/
- Zoho SEO tools: https://www.zoho.com/sites/features/seo-tools.html
- Zoho social media engagement: https://www.zoho.com/sites/features/social-media-engagement.html

## Implemented

- Single admin login with multi-tenant switching from one dashboard session.
- Blog posts with draft, approval, scheduled publish, and publish-now flows.
- Categories and tags with public archive pages.
- Native comment box on article pages.
- Comment moderation with `off`, `manual`, and `auto` modes.
- Automatic spam filtering via blocked words and link heuristics.
- Admin comment moderation screen with approve, reject, and delete actions.
- RSS feed generation and RSS enable/disable setting.
- SEO metadata, article schema, sitemap, search filters, and analytics pageviews.
- Cover images, excerpts, author details, related posts, article TOC, share actions.
- Config-driven webhook revalidation for local development and production-safe URLs.

## Partially Matched

- Comment anti-spam:
  Current implementation uses honeypot + rate limits + blocked-word moderation.
  Zoho also exposes explicit captcha toggles in settings.
- Comment access control:
  Current implementation supports public comments.
  Zoho also supports restricting comments to registered users.
- SEO tooling:
  Current implementation covers metadata, schema, sitemap, and scoring.
  Zoho also advertises broader SEO reports and redirect tooling.
- Social distribution:
  Share links are implemented on the public site.
  Zoho also advertises automated social publishing workflows.

## Not Yet Implemented

- Importing blogs from Blogger or WordPress, including imported comments.
- Email notifications for new comments.
- Blog clone flow in the admin UI.
- Trash and restore flow for deleted posts.
- Registered-user public comment accounts.

## Local Verification Completed

- Scheduled publish smoke test:
  A temporary approved post was scheduled and automatically transitioned to `published`.
- Manual comment moderation smoke test:
  A public comment landed in the pending queue, was approved in admin, and became visible on the public article page.
- Automatic spam moderation smoke test:
  A blocked-word comment was classified as `spam`.
- Browser verification:
  Admin login, comments screen, comment settings, RSS link, public comment section, and a scheduled post page were verified live.
