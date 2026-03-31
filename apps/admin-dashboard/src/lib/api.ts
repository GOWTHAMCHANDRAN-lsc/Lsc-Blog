// Central API client for admin dashboard → admin API
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

class ApiClient {
  private getHeaders(token?: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string
  ): Promise<T> {
    return this.requestWithBase(
      `${BASE_URL}/admin/v1${path}`,
      method,
      body,
      token
    );
  }

  async requestAbsolute<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string
  ): Promise<T> {
    return this.requestWithBase(`${BASE_URL}${path}`, method, body, token);
  }

  private async requestWithBase<T>(
    url: string,
    method: string,
    body?: unknown,
    token?: string
  ): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: this.getHeaders(token),
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data?.error?.message ?? `Request failed: ${res.status}`);
    }
    return data;
  }

  // Auth
  login(email: string, password: string, tenantId?: string) {
    return this.request<{
      data: { accessToken: string; refreshToken: string; user: object };
    }>('POST', '/auth/login', { email, password, tenantId });
  }

  refreshToken(refreshToken: string) {
    return this.request<{ data: { accessToken: string; user: object } }>(
      'POST',
      '/auth/refresh',
      { refreshToken }
    );
  }

  switchTenant(token: string, refreshToken: string, tenantId: string) {
    return this.request<{
      data: { accessToken: string; refreshToken?: string; user: object };
    }>('POST', '/auth/switch-tenant', { tenantId, refreshToken }, token);
  }

  // Posts
  listPosts(token: string, params: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.request('GET', `/posts${qs ? `?${qs}` : ''}`, undefined, token);
  }

  getPost(token: string, id: string) {
    return this.request('GET', `/posts/${id}`, undefined, token);
  }

  createPost(token: string, data: object) {
    return this.request('POST', '/posts', data, token);
  }

  updatePost(token: string, id: string, data: object) {
    return this.request('PUT', `/posts/${id}`, data, token);
  }

  submitPost(token: string, id: string) {
    return this.request('POST', `/posts/${id}/submit`, {}, token);
  }

  approvePost(token: string, id: string, note?: string) {
    return this.request('POST', `/posts/${id}/approve`, { note }, token);
  }

  rejectPost(token: string, id: string, reason: string) {
    return this.request('POST', `/posts/${id}/reject`, { reason }, token);
  }

  publishPost(token: string, id: string) {
    return this.request('POST', `/posts/${id}/publish`, {}, token);
  }

  schedulePost(token: string, id: string, scheduledAt: string) {
    return this.request(
      'POST',
      `/posts/${id}/schedule`,
      { scheduledAt },
      token
    );
  }

  analyzeSEO(token: string, id: string) {
    return this.request('POST', `/posts/${id}/seo/analyze`, {}, token);
  }

  saveSEOMeta(token: string, id: string, data: object) {
    return this.request('PUT', `/posts/${id}/seo`, data, token);
  }

  // Users
  listUsers(token: string) {
    return this.request('GET', '/users', undefined, token);
  }

  getCurrentUser(token: string) {
    return this.request('GET', '/users/me', undefined, token);
  }

  changePassword(token: string, currentPassword: string, newPassword: string) {
    return this.request(
      'PUT',
      '/users/me/password',
      { currentPassword, newPassword },
      token
    );
  }

  inviteUser(token: string, data: object) {
    return this.request('POST', '/users/invite', data, token);
  }

  updateUserRole(token: string, userId: string, role: string) {
    return this.request('PUT', `/users/${userId}/role`, { role }, token);
  }

  removeUser(token: string, userId: string) {
    return this.request('DELETE', `/users/${userId}`, undefined, token);
  }

  // Categories
  listCategories(token: string) {
    return this.requestAbsolute(
      'GET',
      '/api/v1/categories/admin',
      undefined,
      token
    );
  }

  createCategory(token: string, data: object) {
    return this.requestAbsolute(
      'POST',
      '/api/v1/categories/admin',
      data,
      token
    );
  }

  updateCategory(token: string, id: string, data: object) {
    return this.requestAbsolute(
      'PUT',
      `/api/v1/categories/admin/${id}`,
      data,
      token
    );
  }

  deleteCategory(token: string, id: string) {
    return this.requestAbsolute(
      'DELETE',
      `/api/v1/categories/admin/${id}`,
      undefined,
      token
    );
  }

  // Analytics
  getAnalyticsOverview(token: string) {
    return this.request('GET', '/analytics/overview', undefined, token);
  }

  // Site Config
  getSiteConfig(token: string) {
    return this.requestAbsolute(
      'GET',
      '/api/v1/site-config/admin',
      undefined,
      token
    );
  }

  updateSiteConfig(token: string, data: object) {
    return this.requestAbsolute(
      'PUT',
      '/api/v1/site-config/admin',
      data,
      token
    );
  }

  // API Tokens
  listApiTokens(token: string) {
    return this.request('GET', '/api-tokens', undefined, token);
  }

  createApiToken(token: string, data: object) {
    return this.request('POST', '/api-tokens', data, token);
  }

  revokeApiToken(token: string, id: string) {
    return this.request('DELETE', `/api-tokens/${id}`, undefined, token);
  }

  // Tenants (super_admin)
  listTenants(token: string) {
    return this.request('GET', '/tenants', undefined, token);
  }

  getTenant(token: string, id: string) {
    return this.request('GET', `/tenants/${id}`, undefined, token);
  }

  createTenant(token: string, data: object) {
    return this.request('POST', '/tenants', data, token);
  }

  updateTenant(token: string, id: string, data: object) {
    return this.request('PUT', `/tenants/${id}`, data, token);
  }

  deleteTenant(token: string, id: string) {
    return this.request('DELETE', `/tenants/${id}`, undefined, token);
  }

  getTenantStats(token: string, id: string) {
    return this.request('GET', `/tenants/${id}/stats`, undefined, token);
  }

  // Approval Queue
  getApprovalQueue(token: string) {
    return this.request('GET', '/approval/queue', undefined, token);
  }

  getApprovalHistory(token: string, postId: string) {
    return this.request('GET', `/approval/${postId}/history`, undefined, token);
  }

  // Comments
  listComments(token: string, params: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.request(
      'GET',
      `/comments${qs ? `?${qs}` : ''}`,
      undefined,
      token
    );
  }

  approveComment(token: string, id: string) {
    return this.request('POST', `/comments/${id}/approve`, {}, token);
  }

  rejectComment(token: string, id: string, reason?: string) {
    return this.request('POST', `/comments/${id}/reject`, { reason }, token);
  }

  deleteComment(token: string, id: string) {
    return this.request('DELETE', `/comments/${id}`, undefined, token);
  }

  // Tags
  listTags(token: string) {
    return this.requestAbsolute('GET', '/api/v1/tags/admin', undefined, token);
  }

  createTag(token: string, data: object) {
    return this.requestAbsolute('POST', '/api/v1/tags/admin', data, token);
  }

  deleteTag(token: string, id: string) {
    return this.requestAbsolute(
      'DELETE',
      `/api/v1/tags/admin/${id}`,
      undefined,
      token
    );
  }

  // Media
  listMedia(token: string, params: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.request('GET', `/media${qs ? `?${qs}` : ''}`, undefined, token);
  }

  deleteMedia(token: string, id: string) {
    return this.request('DELETE', `/media/${id}`, undefined, token);
  }

  async uploadMediaFile(token: string, file: File) {
    const url = `${BASE_URL}/admin/v1/media/upload-file`;
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data?.error?.message ?? `Upload failed: ${res.status}`);
    }
    return data;
  }

  createMediaPresignedUpload(
    token: string,
    params: { filename: string; mimeType: string; fileSize?: number }
  ) {
    return this.request<{
      data: { cdnUrl: string; presignedUrl: string | null };
    }>('POST', '/media/upload', params, token);
  }

  // Subscriptions / newsletters
  listSubscribers(token: string, params: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.request(
      'GET',
      `/subscribers${qs ? `?${qs}` : ''}`,
      undefined,
      token
    );
  }

  listCampaigns(token: string) {
    return this.request('GET', '/campaigns', undefined, token);
  }

  createCampaign(
    token: string,
    data: { subject: string; preview_text?: string; html: string }
  ) {
    return this.request('POST', '/campaigns', data, token);
  }

  updateCampaign(
    token: string,
    id: string,
    data: { subject?: string; preview_text?: string; html?: string }
  ) {
    return this.request('PUT', `/campaigns/${id}`, data, token);
  }

  sendCampaign(token: string, id: string) {
    return this.request('POST', `/campaigns/${id}/send`, {}, token);
  }

  // Imports
  listImports(token: string) {
    return this.request('GET', '/imports', undefined, token);
  }

  getImport(token: string, id: string) {
    return this.request('GET', `/imports/${id}`, undefined, token);
  }

  async uploadImportFile(token: string, type: 'rss' | 'wxr', file: File) {
    const url = `${BASE_URL}/admin/v1/imports/${type}`;
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(
        data?.error?.message ?? `Import upload failed: ${res.status}`
      );
    }
    return data;
  }
}

export const api = new ApiClient();
export default api;
