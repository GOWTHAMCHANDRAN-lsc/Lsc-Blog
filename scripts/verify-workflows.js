const BASE_URL = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const BLOG_URL = process.env.BLOG_URL || 'http://localhost:3002';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000';
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@demo.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Admin@12345';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(message) {
  process.stdout.write(`${message}\n`);
}

function toQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let payload = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  if (
    !response.ok ||
    (payload && typeof payload === 'object' && payload.success === false)
  ) {
    const detail =
      typeof payload === 'string'
        ? payload
        : payload?.error?.message ||
          payload?.message ||
          JSON.stringify(payload);
    throw new Error(`${method} ${url} failed (${response.status}): ${detail}`);
  }

  return payload;
}

async function requestText(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${url} failed (${response.status})`);
  }
  return text;
}

function adminHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function publicHeaders(apiToken) {
  return {
    'X-API-Token': apiToken,
    'Content-Type': 'application/json',
  };
}

async function adminRequest(accessToken, path, options = {}) {
  return requestJson(`${BASE_URL}/admin/v1${path}`, {
    ...options,
    headers: { ...adminHeaders(accessToken), ...(options.headers || {}) },
  });
}

async function publicRequest(apiToken, path, options = {}) {
  return requestJson(`${BASE_URL}/api/v1${path}`, {
    ...options,
    headers: { ...publicHeaders(apiToken), ...(options.headers || {}) },
  });
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function poll(
  assertion,
  { timeoutMs = 30000, intervalMs = 3000, description } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      return await assertion();
    } catch (err) {
      lastError = err;
      await wait(intervalMs);
    }
  }

  throw new Error(
    `${description || 'Polling condition'} did not pass in time: ${lastError?.message}`
  );
}

async function main() {
  const runId = Date.now();
  const created = {
    tenantId: null,
    tenantName: null,
    tokenId: null,
    token: null,
  };

  let superSession = null;
  let tenantSession = null;
  let originalTenantId = null;

  try {
    logStep('1. Checking stack endpoints');
    const health = await requestJson(`${BASE_URL}/health`);
    assert(health.status === 'ok', 'API health check failed');

    try {
      const adminLoginHtml = await requestText(`${ADMIN_URL}/login`);
      assert(
        adminLoginHtml.includes('Welcome back') || adminLoginHtml.length > 100,
        'Admin login page did not render expected content'
      );
      logStep('   Admin dashboard: OK');
    } catch {
      logStep('   Admin dashboard: Skipped (not running)');
    }

    try {
      const blogHomeHtml = await requestText(`${BLOG_URL}/`);
      assert(blogHomeHtml.length > 200, 'Blog homepage did not render');
      logStep('   Blog frontend: OK');
    } catch {
      logStep('   Blog frontend: Skipped (not running)');
    }

    logStep('2. Authenticating super admin');
    const loginResult = await requestJson(`${BASE_URL}/admin/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD },
    });
    superSession = loginResult.data;
    originalTenantId = superSession.user.tenantId;
    assert(superSession.accessToken, 'Login did not return access token');
    assert(superSession.refreshToken, 'Login did not return refresh token');

    const me = await adminRequest(superSession.accessToken, '/auth/me');
    assert(
      me.data.email === SUPERADMIN_EMAIL,
      'Authenticated user payload is incorrect'
    );

    const refresh = await requestJson(`${BASE_URL}/admin/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { refreshToken: superSession.refreshToken },
    });
    assert(refresh.data.accessToken, 'Refresh token flow failed');
    superSession.accessToken = refresh.data.accessToken;
    superSession.refreshToken = refresh.data.refreshToken;

    logStep('3. Creating and switching into an isolated tenant');
    const tenantsBefore = await adminRequest(
      superSession.accessToken,
      '/tenants'
    );
    assert(
      Array.isArray(tenantsBefore.data) && tenantsBefore.data.length >= 1,
      'Tenant listing returned no data'
    );

    const tenantName = `Workflow ${runId}`;
    const tenantSlug = `workflow-${runId}`;
    const createTenant = await adminRequest(
      superSession.accessToken,
      '/tenants',
      {
        method: 'POST',
        body: { name: tenantName, slug: tenantSlug, plan: 'starter' },
      }
    );
    created.tenantId = createTenant.data.id;
    created.tenantName = tenantName;
    assert(created.tenantId, 'Tenant creation failed');

    const tenantStats = await adminRequest(
      superSession.accessToken,
      `/tenants/${created.tenantId}/stats`
    );
    assert(
      tenantStats.data.users >= 1,
      'New tenant owner membership was not created'
    );

    const switchTenant = await requestJson(
      `${BASE_URL}/admin/v1/auth/switch-tenant`,
      {
        method: 'POST',
        headers: adminHeaders(superSession.accessToken),
        body: {
          tenantId: created.tenantId,
          refreshToken: superSession.refreshToken,
        },
      }
    );
    tenantSession = switchTenant.data;
    assert(
      tenantSession.user.tenantId === created.tenantId,
      'Tenant switch did not update tenant context'
    );

    logStep('4. Verifying workspace management workflows');
    const usersBefore = await adminRequest(tenantSession.accessToken, '/users');
    assert(
      usersBefore.data.some(user => user.email === SUPERADMIN_EMAIL),
      'Owner user missing from tenant'
    );

    const inviteEmail = `workflow-user-${runId}@demo.com`;
    await adminRequest(tenantSession.accessToken, '/users/invite', {
      method: 'POST',
      body: { email: inviteEmail, role: 'author', name: 'Workflow User' },
    });
    const usersAfterInvite = await adminRequest(
      tenantSession.accessToken,
      '/users'
    );
    assert(
      usersAfterInvite.data.some(user => user.email === inviteEmail),
      'Invited user was not added'
    );

    const categoryResult = await requestJson(
      `${BASE_URL}/api/v1/categories/admin`,
      {
        method: 'POST',
        headers: adminHeaders(tenantSession.accessToken),
        body: {
          name: `Workflow Category ${runId}`,
          description: 'Workflow coverage category',
        },
      }
    );
    const categoryId = categoryResult.data.id;
    assert(categoryId, 'Category creation failed');

    const categoriesAdmin = await requestJson(
      `${BASE_URL}/api/v1/categories/admin`,
      {
        headers: adminHeaders(tenantSession.accessToken),
      }
    );
    assert(
      categoriesAdmin.data.some(category => category.id === categoryId),
      'Created category missing from admin list'
    );

    const tagResult = await requestJson(`${BASE_URL}/api/v1/tags/admin`, {
      method: 'POST',
      headers: adminHeaders(tenantSession.accessToken),
      body: { name: `workflow-tag-${runId}` },
    });
    const tagId = tagResult.data.id;
    const tagSlug = tagResult.data.slug;
    assert(tagId && tagSlug, 'Tag creation failed');

    const tokenResult = await adminRequest(
      tenantSession.accessToken,
      '/api-tokens',
      {
        method: 'POST',
        body: {
          name: `workflow-token-${runId}`,
          scopes: [
            'posts:read',
            'posts:write',
            'config:read',
            'config:write',
            'categories:read',
            'categories:write',
            'tags:read',
            'tags:write',
            'comments:read',
            'comments:write',
            'analytics:read',
            'analytics:write',
          ],
          rateLimitRpm: 300,
        },
      }
    );
    created.tokenId = tokenResult.data.id;
    created.token = tokenResult.data.token;
    assert(created.token, 'API token creation failed');

    const tokens = await adminRequest(tenantSession.accessToken, '/api-tokens');
    assert(
      tokens.data.some(token => token.id === created.tokenId),
      'Created API token missing from list'
    );

    logStep('5. Verifying site configuration and security sanitization');
    await requestJson(`${BASE_URL}/api/v1/site-config/admin`, {
      method: 'PUT',
      headers: adminHeaders(tenantSession.accessToken),
      body: {
        site_name: `Workflow Site ${runId}`,
        site_tagline: 'Workflow verification tenant',
        primary_color: '#2563eb',
        enable_comments: true,
        comment_provider: 'native',
        comment_moderation: 'auto',
        comments_per_page: 12,
        comment_blocked_words: 'casino',
        rss_enabled: true,
        header_scripts:
          '<iframe src=\"https://example.com/embed\" onload=\"alert(1)\"></iframe>',
        footer_scripts: '<iframe src=\"javascript:alert(1)\"></iframe>',
        social_links: {
          github: 'https://github.com/example',
          broken: 'javascript:alert(1)',
        },
      },
    });

    const siteConfigPublic = await publicRequest(created.token, '/site-config');
    assert(
      siteConfigPublic.data.enable_comments === true,
      'Site config did not enable comments'
    );
    assert(
      siteConfigPublic.data.comment_provider === 'native',
      'Comment provider was not saved'
    );
    assert(
      siteConfigPublic.data.header_scripts.includes(
        'https://example.com/embed'
      ),
      'Safe embed markup was not preserved'
    );
    assert(
      !siteConfigPublic.data.header_scripts.includes('onload'),
      'Unsafe embed attributes were not removed'
    );
    assert(
      siteConfigPublic.data.footer_scripts === null,
      'Unsafe footer embed was not stripped'
    );
    assert(
      siteConfigPublic.data.social_links.github ===
        'https://github.com/example',
      'Valid social link missing'
    );
    assert(
      !('broken' in (siteConfigPublic.data.social_links || {})),
      'Unsafe social link was not removed'
    );

    logStep('6. Verifying content lifecycle workflows');
    const postResult = await adminRequest(tenantSession.accessToken, '/posts', {
      method: 'POST',
      body: {
        title: `Workflow publish ${runId}`,
        excerpt: 'Workflow post excerpt',
        content:
          '<h1>Workflow content</h1><p>This post verifies publish flow.</p><script>alert(1)</script>',
        categoryIds: [categoryId],
        tagIds: [tagId],
      },
    });
    const postId = postResult.data.id;
    let postSlug = postResult.data.slug;
    assert(postId && postSlug, 'Post creation failed');
    assert(
      !postResult.data.content.includes('<script>'),
      'Unsafe post content was not sanitized'
    );

    const updatedPost = await adminRequest(
      tenantSession.accessToken,
      `/posts/${postId}`,
      {
        method: 'PUT',
        body: {
          title: `Workflow publish updated ${runId}`,
          excerpt: 'Updated workflow excerpt',
          content:
            '<h1>Workflow content</h1><h2>Coverage</h2><p>This updated post verifies publish flow end to end.</p>',
          categoryIds: [categoryId],
          tagIds: [tagId],
        },
      }
    );
    postSlug = updatedPost.data.slug;

    const seoAnalysis = await adminRequest(
      tenantSession.accessToken,
      `/posts/${postId}/seo/analyze`,
      {
        method: 'POST',
        body: {},
      }
    );
    assert(seoAnalysis.data.score >= 0, 'SEO analysis did not return a score');

    await adminRequest(tenantSession.accessToken, `/posts/${postId}/seo`, {
      method: 'PUT',
      body: {
        meta_title: `Workflow publish updated ${runId}`,
        meta_description:
          'Learn how this workflow smoke test validates the publish lifecycle.',
        focus_keyword: 'workflow smoke test',
      },
    });

    await adminRequest(tenantSession.accessToken, `/posts/${postId}/submit`, {
      method: 'POST',
      body: {},
    });

    const approvalQueue = await adminRequest(
      tenantSession.accessToken,
      '/approval/queue'
    );
    assert(
      approvalQueue.data.some(post => post.id === postId),
      'Submitted post missing from approval queue'
    );

    await adminRequest(tenantSession.accessToken, `/posts/${postId}/approve`, {
      method: 'POST',
      body: { note: 'Workflow approval' },
    });

    await adminRequest(tenantSession.accessToken, `/posts/${postId}/publish`, {
      method: 'POST',
      body: {},
    });

    const adminPosts = await adminRequest(
      tenantSession.accessToken,
      `/posts${toQuery({ status: 'published' })}`
    );
    assert(
      adminPosts.data.some(post => post.id === postId),
      'Published post missing from admin list'
    );

    const publicPost = await publicRequest(created.token, `/posts/${postSlug}`);
    assert(
      publicPost.data.slug === postSlug,
      'Published post was not available publicly'
    );
    assert(
      publicPost.data.categories.some(category => category.id === categoryId),
      'Public post missing category relation'
    );
    assert(
      publicPost.data.tags.some(tag => tag.id === tagId),
      'Public post missing tag relation'
    );

    const publicPosts = await publicRequest(
      created.token,
      `/posts${toQuery({ per_page: 10 })}`
    );
    assert(
      publicPosts.data.some(post => post.id === postId),
      'Published post missing from public list'
    );

    const publicCategories = await publicRequest(created.token, '/categories');
    assert(
      publicCategories.data.some(category => category.id === categoryId),
      'Category missing from public API'
    );

    const publicTags = await publicRequest(created.token, '/tags');
    assert(
      publicTags.data.some(tag => tag.id === tagId),
      'Tag missing from public API'
    );

    const categoryPosts = await publicRequest(
      created.token,
      `/categories/${publicPost.data.categories[0].slug}/posts`
    );
    assert(
      categoryPosts.data.some(post => post.id === postId),
      'Category posts endpoint missing published post'
    );

    const tagPosts = await publicRequest(
      created.token,
      `/tags/${tagSlug}/posts`
    );
    assert(
      tagPosts.data.some(post => post.id === postId),
      'Tag posts endpoint missing published post'
    );

    logStep('7. Verifying analytics and comments workflows');
    await publicRequest(created.token, '/analytics/pageview', {
      method: 'POST',
      body: {
        postId,
        path: `/${postSlug}`,
        referrer: 'https://example.com/',
        countryCode: 'IN',
        deviceType: 'desktop',
      },
    });

    const analyticsOverview = await adminRequest(
      tenantSession.accessToken,
      '/analytics/overview'
    );
    assert(
      Number(analyticsOverview.data.total_views) >= 1,
      'Analytics overview did not record the pageview'
    );

    const approvedComment = await publicRequest(
      created.token,
      `/posts/${postSlug}/comments`,
      {
        method: 'POST',
        body: {
          authorName: 'Workflow Reader',
          authorEmail: `reader-${runId}@example.com`,
          authorWebsite: 'https://example.com',
          content: 'This comment should publish automatically.',
        },
      }
    );
    assert(
      approvedComment.data.status === 'approved',
      'Expected safe comment to auto-approve'
    );

    const pendingComment = await publicRequest(
      created.token,
      `/posts/${postSlug}/comments`,
      {
        method: 'POST',
        body: {
          authorName: 'Workflow Spam',
          authorEmail: `spam-${runId}@example.com`,
          authorWebsite: 'https://example.com',
          content: 'casino offer inside comment should trigger moderation.',
        },
      }
    );
    assert(
      pendingComment.data.status === 'pending',
      'Blocked-word comment should have entered moderation'
    );

    const adminComments = await adminRequest(
      tenantSession.accessToken,
      '/comments'
    );
    const spamComment = adminComments.data.find(
      comment => comment.author_email === `spam-${runId}@example.com`
    );
    assert(
      spamComment && spamComment.status === 'spam',
      'Spam comment missing from moderation queue'
    );

    await adminRequest(
      tenantSession.accessToken,
      `/comments/${spamComment.id}/approve`,
      {
        method: 'POST',
        body: {},
      }
    );

    const publicComments = await publicRequest(
      created.token,
      `/posts/${postSlug}/comments`
    );
    assert(
      publicComments.data.length >= 2,
      'Approved comments were not visible publicly'
    );

    logStep('8. Verifying scheduled publishing fallback');
    const scheduledPost = await adminRequest(
      tenantSession.accessToken,
      '/posts',
      {
        method: 'POST',
        body: {
          title: `Workflow scheduled ${runId}`,
          excerpt: 'Scheduled workflow post',
          content:
            '<h1>Scheduled workflow</h1><p>This post verifies scheduled publishing.</p>',
          categoryIds: [categoryId],
          tagIds: [tagId],
        },
      }
    );
    const scheduledPostId = scheduledPost.data.id;
    const scheduledSlug = scheduledPost.data.slug;

    await adminRequest(
      tenantSession.accessToken,
      `/posts/${scheduledPostId}/submit`,
      {
        method: 'POST',
        body: {},
      }
    );
    await adminRequest(
      tenantSession.accessToken,
      `/posts/${scheduledPostId}/approve`,
      {
        method: 'POST',
        body: { note: 'Scheduling workflow test' },
      }
    );

    const scheduledAt = new Date(Date.now() + 9000).toISOString();
    await adminRequest(
      tenantSession.accessToken,
      `/posts/${scheduledPostId}/schedule`,
      {
        method: 'POST',
        body: { scheduledAt },
      }
    );

    await poll(
      async () => {
        const scheduledPublicPost = await publicRequest(
          created.token,
          `/posts/${scheduledSlug}`
        );
        assert(
          scheduledPublicPost.data.slug === scheduledSlug,
          'Scheduled post not published yet'
        );
        return scheduledPublicPost;
      },
      {
        timeoutMs: 30000,
        intervalMs: 4000,
        description: 'Scheduled post publication',
      }
    );

    logStep('9. Verifying media, token revocation, and tenant cleanup flows');
    const uploadMedia = await adminRequest(
      tenantSession.accessToken,
      '/media/upload',
      {
        method: 'POST',
        body: {
          filename: 'workflow-image.png',
          mimeType: 'image/png',
          fileSize: 1024,
        },
      }
    );
    assert(
      uploadMedia.data.mediaId,
      'Media upload bootstrap did not return a media record'
    );

    const mediaList = await adminRequest(tenantSession.accessToken, '/media');
    assert(
      mediaList.data.some(media => media.id === uploadMedia.data.mediaId),
      'Media record missing from list'
    );

    await adminRequest(
      tenantSession.accessToken,
      `/media/${uploadMedia.data.mediaId}`,
      {
        method: 'DELETE',
        body: {},
      }
    );

    await adminRequest(
      tenantSession.accessToken,
      `/api-tokens/${created.tokenId}`,
      {
        method: 'DELETE',
        body: {},
      }
    );

    let revokeFailedAsExpected = false;
    try {
      await publicRequest(created.token, '/site-config');
    } catch (err) {
      revokeFailedAsExpected = err.message.includes('401');
    }
    assert(revokeFailedAsExpected, 'Revoked API token still worked');

    const switchBack = await requestJson(
      `${BASE_URL}/admin/v1/auth/switch-tenant`,
      {
        method: 'POST',
        headers: adminHeaders(tenantSession.accessToken),
        body: {
          tenantId: originalTenantId,
          refreshToken: tenantSession.refreshToken,
        },
      }
    );
    superSession = switchBack.data;
    assert(
      superSession.user.tenantId === originalTenantId,
      'Failed to switch back to original tenant'
    );

    await adminRequest(
      superSession.accessToken,
      `/tenants/${created.tenantId}`,
      {
        method: 'DELETE',
        body: {},
      }
    );

    const tenantsAfterDelete = await adminRequest(
      superSession.accessToken,
      '/tenants'
    );
    assert(
      !tenantsAfterDelete.data.some(tenant => tenant.id === created.tenantId),
      'Deleted tenant still visible'
    );

    await requestJson(`${BASE_URL}/admin/v1/auth/logout`, {
      method: 'POST',
      headers: adminHeaders(superSession.accessToken),
      body: { refreshToken: superSession.refreshToken },
    });

    let refreshRejected = false;
    try {
      await requestJson(`${BASE_URL}/admin/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { refreshToken: superSession.refreshToken },
      });
    } catch (err) {
      refreshRejected = err.message.includes('401');
    }
    assert(refreshRejected, 'Refresh token remained valid after logout');

    logStep('All workflow checks passed.');
  } catch (err) {
    logStep(`Workflow verification failed: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
