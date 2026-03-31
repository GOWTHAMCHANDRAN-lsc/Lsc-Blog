'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: 'active' | 'suspended' | 'trial';
  owner_id: string;
  created_at: string;
  updated_at: string;
  post_count?: number;
  user_count?: number;
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    trial: number;
    suspended: number;
  } | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    custom_domain: '',
    blog_url: '',
    blog_api_key: '',
    allowed_origins: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    const token = localStorage.getItem('access_token') ?? '';
    try {
      const res = (await api.listTenants(token)) as any;
      const data = res.data ?? [];
      setTenants(data);
      setStats({
        total: data.length,
        active: data.filter((t: Tenant) => t.status === 'active').length,
        trial: data.filter((t: Tenant) => t.status === 'trial').length,
        suspended: data.filter((t: Tenant) => t.status === 'suspended').length,
      });
    } catch {
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      (await api.createTenant(token, {
        name: form.name.trim(),
        slug: form.slug || generateSlug(form.name),
        custom_domain: form.custom_domain || undefined,
        blog_url: form.blog_url || undefined,
        blog_api_key: form.blog_api_key || undefined,
        allowed_origins: form.allowed_origins
          ? form.allowed_origins
              .split(',')
              .map(o => o.trim())
              .filter(Boolean)
          : undefined,
      })) as any;
      toast.success('Tenant created');
      setShowCreate(false);
      setForm({
        name: '',
        slug: '',
        custom_domain: '',
        blog_url: '',
        blog_api_key: '',
        allowed_origins: '',
      });
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    setCreating(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      (await api.updateTenant(token, showEdit.id, {
        name: showEdit.name,
        status: showEdit.status,
        custom_domain: showEdit.custom_domain || undefined,
      })) as any;
      toast.success('Tenant updated');
      setShowEdit(null);
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tenant? All data will be lost.')) return;
    const token = localStorage.getItem('access_token') ?? '';
    try {
      (await api.deleteTenant(token, id)) as any;
      toast.success('Tenant deleted');
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'badge-success',
      suspended: 'badge-danger',
      trial: 'badge-warning',
    };
    return (
      <span className={`badge ${styles[status] || 'badge-gray'}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Tenants</h1>
          <p className="admin-page-subtitle">
            Manage all blog tenants and workspaces
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Tenant
        </button>
      </div>

      {stats && (
        <div
          className="stats-grid"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
            marginBottom: '1.5rem',
          }}
        >
          <div className="stat-card">
            <div className="stat-card-icon blue">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
              </svg>
            </div>
            <div className="stat-card-value">{stats.total}</div>
            <div className="stat-card-label">Total Tenants</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="stat-card-value">{stats.active}</div>
            <div className="stat-card-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon yellow">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-card-value">{stats.trial}</div>
            <div className="stat-card-label">Trial</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="stat-card-value">{stats.suspended}</div>
            <div className="stat-card-label">Suspended</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : tenants.length === 0 ? (
            <div className="empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-light)"
                strokeWidth="1.5"
              >
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
              </svg>
              <h3>No tenants yet</h3>
              <p>Create your first tenant to get started</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreate(true)}
              >
                Create Tenant
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(tenant => (
                    <tr key={tenant.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{tenant.name}</div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-light)',
                            fontFamily: 'monospace',
                          }}
                        >
                          /{tenant.slug}
                        </div>
                      </td>
                      <td>
                        {tenant.custom_domain || (
                          <span style={{ color: 'var(--text-light)' }}>-</span>
                        )}
                      </td>
                      <td>{getStatusBadge(tenant.status)}</td>
                      <td
                        style={{
                          color: 'var(--text-light)',
                          fontSize: '0.8rem',
                        }}
                      >
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-icon"
                            onClick={() => setShowEdit(tenant)}
                            title="Edit"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn-icon text-danger"
                            onClick={() => handleDelete(tenant.id)}
                            title="Delete"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Tenant</h3>
              <button className="btn-icon" onClick={() => setShowCreate(false)}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tenant Name</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e =>
                      setForm({
                        ...form,
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      })
                    }
                    placeholder="Acme Corporation"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input
                    className="form-input"
                    value={form.slug}
                    onChange={e => setForm({ ...form, slug: e.target.value })}
                    placeholder="auto-generated"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Custom Domain (optional)</label>
                  <input
                    className="form-input"
                    value={form.custom_domain}
                    onChange={e =>
                      setForm({ ...form, custom_domain: e.target.value })
                    }
                    placeholder="blog.acme.com"
                  />
                </div>
                <div
                  className="form-group"
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '0.5rem',
                  }}
                >
                  <h4
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Tenant Blog Authentication
                  </h4>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '1rem',
                    }}
                  >
                    Configure authentication to connect to the tenant&apos;s
                    blog hosted on a different cloud/server.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Blog URL</label>
                    <input
                      className="form-input"
                      value={form.blog_url}
                      onChange={e =>
                        setForm({ ...form, blog_url: e.target.value })
                      }
                      placeholder="https://blog.example.com"
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem',
                        display: 'block',
                      }}
                    >
                      The public URL where the tenant&apos;s blog is hosted
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blog API Key</label>
                    <input
                      className="form-input"
                      type="password"
                      value={form.blog_api_key}
                      onChange={e =>
                        setForm({ ...form, blog_api_key: e.target.value })
                      }
                      placeholder="sk-..."
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem',
                        display: 'block',
                      }}
                    >
                      API key for authenticating requests to the tenant&apos;s
                      blog
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Allowed Origins (CORS)</label>
                    <input
                      className="form-input"
                      value={form.allowed_origins}
                      onChange={e =>
                        setForm({ ...form, allowed_origins: e.target.value })
                      }
                      placeholder="https://example.com, https://app.example.com"
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem',
                        display: 'block',
                      }}
                    >
                      Comma-separated list of origins allowed to access the blog
                      API
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Tenant</h3>
              <button className="btn-icon" onClick={() => setShowEdit(null)}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tenant Name</label>
                  <input
                    className="form-input"
                    value={showEdit.name}
                    onChange={e =>
                      setShowEdit({ ...showEdit, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-input form-select"
                      value={showEdit.status}
                      onChange={e =>
                        setShowEdit({
                          ...showEdit,
                          status: e.target.value as any,
                        })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Custom Domain</label>
                  <input
                    className="form-input"
                    value={showEdit.custom_domain || ''}
                    onChange={e =>
                      setShowEdit({
                        ...showEdit,
                        custom_domain: e.target.value,
                      })
                    }
                    placeholder="blog.acme.com"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEdit(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
