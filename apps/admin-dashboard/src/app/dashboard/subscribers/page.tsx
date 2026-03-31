'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: 'pending' | 'active' | 'unsubscribed';
  confirmed_at: string | null;
  created_at: string;
};

const STATUS_OPTIONS = ['', 'active', 'pending', 'unsubscribed'] as const;

export default function SubscribersPage() {
  const [token, setToken] = useState('');
  const [status, setStatus] =
    useState<(typeof STATUS_OPTIONS)[number]>('active');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Subscriber[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem('access_token') ?? '');
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .listSubscribers(token, {
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      .then((res: any) => setRows(res.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [token, status, search]);

  const headline = useMemo(() => {
    if (status)
      return `${status.charAt(0).toUpperCase() + status.slice(1)} subscribers`;
    return 'All subscribers';
  }, [status]);

  const stats = useMemo(() => {
    const active = rows.filter(r => r.status === 'active').length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const unsubscribed = rows.filter(r => r.status === 'unsubscribed').length;
    return { active, pending, unsubscribed, total: rows.length };
  }, [rows]);

  const getStatusBadge = (subStatus: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      active: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
      pending: { bg: 'rgba(245,158,11,0.1)', color: '#b45309' },
      unsubscribed: { bg: 'rgba(148,163,184,0.1)', color: '#64748b' },
    };
    const style = styles[subStatus] || styles.pending;
    return (
      <span
        className="badge"
        style={{ background: style.bg, color: style.color }}
      >
        {subStatus}
      </span>
    );
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Audience</h1>
          <p className="admin-page-subtitle">{headline} in this workspace</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Total Subscribers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}
            >
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
          </div>
          <div className="stat-card-value">{stats.active}</div>
          <div className="stat-card-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}
            >
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
          </div>
          <div className="stat-card-value">{stats.pending}</div>
          <div className="stat-card-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div
              className="stat-card-icon"
              style={{ background: 'rgba(148,163,184,0.1)', color: '#64748b' }}
            >
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
            </div>
          </div>
          <div className="stat-card-value">{stats.unsubscribed}</div>
          <div className="stat-card-label">Unsubscribed</div>
        </div>
      </div>

      <div className="card">
        <div
          className="card-header"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              flex: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-lg)',
                flexShrink: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder="Search by email or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  minWidth: '200px',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <select
              className="form-input form-select"
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              style={{ width: 'auto', minWidth: '140px', flexShrink: 0 }}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt || 'all'} value={opt}>
                  {opt
                    ? opt.charAt(0).toUpperCase() + opt.slice(1)
                    : 'All Status'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h3>No subscribers found</h3>
              <p>
                Subscribers will appear here when people sign up to your mailing
                list
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Email & Name</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(sub => (
                    <tr key={sub.id}>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <div
                            className="avatar sm"
                            style={{
                              background: 'var(--primary-100)',
                              color: 'var(--primary)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            {(sub.name || sub.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                              }}
                            >
                              {sub.name || '-'}
                            </div>
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--text-tertiary)',
                              }}
                            >
                              {sub.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{getStatusBadge(sub.status)}</td>
                      <td
                        style={{
                          color: 'var(--text-tertiary)',
                          fontSize: '0.85rem',
                        }}
                      >
                        {new Date(sub.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
