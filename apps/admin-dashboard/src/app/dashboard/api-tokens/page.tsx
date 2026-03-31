'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type ApiToken = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  expires_at: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newToken, setNewToken] = useState({
    name: '',
    scopes: ['posts:read'],
    expires_in_days: 365,
  });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const scopes = [
    { id: 'posts:read', label: 'Read Posts' },
    { id: 'posts:write', label: 'Write Posts' },
    { id: 'categories:read', label: 'Read Categories' },
    { id: 'categories:write', label: 'Write Categories' },
    { id: 'tags:read', label: 'Read Tags' },
    { id: 'tags:write', label: 'Write Tags' },
    { id: 'comments:read', label: 'Read Comments' },
    { id: 'comments:write', label: 'Write Comments' },
    { id: 'subscribers:read', label: 'Read Subscribers' },
    { id: 'subscribers:write', label: 'Write Subscribers' },
    { id: 'analytics:read', label: 'Read Analytics' },
  ];

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    const token = localStorage.getItem('access_token') ?? '';
    try {
      const res = (await api.listApiTokens(token)) as any;
      setTokens(res.data || []);
    } catch (err: any) {
      toast.error('Failed to load API tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      const res = (await api.createApiToken(token, {
        name: newToken.name,
        scopes: newToken.scopes,
        expires_in_days: newToken.expires_in_days,
      })) as any;
      toast.success('API Token created successfully!');
      setTokens([
        { ...res.data, token_prefix: res.data.token.split('-')[0] },
        ...tokens,
      ]);
      setShowCreate(false);
      setNewToken({ name: '', scopes: ['posts:read'], expires_in_days: 365 });
      alert(
        `API Token: ${res.data.token}\n\nSave this token now - it won't be shown again!`
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this token?')) return;
    const token = localStorage.getItem('access_token') ?? '';
    try {
      await api.revokeApiToken(token, id);
      toast.success('Token revoked');
      setTokens(tokens.filter(t => t.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyToken = (prefix: string) => {
    navigator.clipboard.writeText(prefix + '-xxxx-xxxx-xxxx');
    setCopied(prefix);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleScope = (scope: string) => {
    setNewToken(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">API Tokens</h1>
          <p className="admin-page-subtitle">
            Manage API access tokens for external integrations
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create Token
        </button>
      </div>

      {tokens.length === 0 ? (
        <div className="card">
          <div
            className="card-body"
            style={{ textAlign: 'center', padding: '3rem' }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-light)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 1rem' }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h3 style={{ marginBottom: '0.5rem' }}>No API Tokens</h3>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Create your first API token to enable external integrations
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              Create Token
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Token</th>
                  <th>Scopes</th>
                  <th>Rate Limit</th>
                  <th>Last Used</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td>
                      <code
                        style={{
                          background: 'var(--bg-tertiary)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                        }}
                      >
                        {t.token_prefix}-****-****-****
                      </code>
                      <button
                        className="btn-icon"
                        onClick={() => copyToken(t.token_prefix)}
                        title="Copy prefix"
                      >
                        {copied === t.token_prefix ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--success)"
                            strokeWidth="2"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="13"
                              height="13"
                              rx="2"
                              ry="2"
                            />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.25rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {t.scopes.slice(0, 3).map(s => (
                          <span key={s} className="badge badge-info">
                            {s}
                          </span>
                        ))}
                        {t.scopes.length > 3 && (
                          <span className="badge">+{t.scopes.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>{t.rate_limit_rpm} req/min</td>
                    <td>
                      {t.last_used_at
                        ? new Date(t.last_used_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td>
                      {t.expires_at
                        ? new Date(t.expires_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRevoke(t.id)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create API Token</h3>
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
                  <label className="form-label">Token Name</label>
                  <input
                    className="form-input"
                    value={newToken.name}
                    onChange={e =>
                      setNewToken({ ...newToken, name: e.target.value })
                    }
                    placeholder="e.g., My App Integration"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Scopes</label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    {scopes.map(s => (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '6px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={newToken.scopes.includes(s.id)}
                          onChange={() => toggleScope(s.id)}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Expires In</label>
                  <select
                    className="form-input form-select"
                    value={newToken.expires_in_days}
                    onChange={e =>
                      setNewToken({
                        ...newToken,
                        expires_in_days: parseInt(e.target.value),
                      })
                    }
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                    <option value="0">Never expires</option>
                  </select>
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
                  {creating ? 'Creating...' : 'Create Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
