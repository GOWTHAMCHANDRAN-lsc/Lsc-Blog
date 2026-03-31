'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Campaign = {
  id: string;
  subject: string;
  preview_text: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count?: number;
  created_at: string;
};

export default function CampaignsPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: '', previewText: '', html: '' });
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    draft: 0,
    scheduled: 0,
  });

  const load = async (accessToken: string) => {
    setLoading(true);
    try {
      const res = (await api.listCampaigns(accessToken)) as any;
      const data = res.data ?? [];
      setCampaigns(data);
      setStats({
        total: data.length,
        sent: data.filter((c: Campaign) => c.status === 'sent').length,
        draft: data.filter((c: Campaign) => c.status === 'draft').length,
        scheduled: data.filter((c: Campaign) => c.status === 'scheduled')
          .length,
      });
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token') ?? '';
    setToken(accessToken);
    void load(accessToken);
  }, []);

  const createCampaign = async () => {
    if (!form.subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    setCreating(true);
    try {
      (await api.createCampaign(token, {
        subject: form.subject.trim(),
        preview_text: form.previewText.trim() || undefined,
        html: form.html || '<p>Write your newsletter content here.</p>',
      })) as any;
      toast.success('Campaign created');
      setShowCreate(false);
      setForm({ subject: '', previewText: '', html: '' });
      await load(token);
    } catch (err: any) {
      toast.error(err.message ?? 'Unable to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const sendCampaign = async (id: string) => {
    setSending(id);
    try {
      await api.sendCampaign(token, id);
      toast.success('Campaign queued for delivery');
      await load(token);
    } catch (err: any) {
      toast.error(err.message ?? 'Unable to send campaign');
    } finally {
      setSending(null);
    }
  };

  const sorted = useMemo(
    () =>
      [...campaigns].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [campaigns]
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'badge-success',
      sending: 'badge-primary',
      draft: 'badge-gray',
      scheduled: 'badge-warning',
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
          <h1 className="admin-page-title">Campaigns</h1>
          <p className="admin-page-subtitle">
            Create and send newsletters to your subscribers
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
          New Campaign
        </button>
      </div>

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
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Total Campaigns</div>
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
          <div className="stat-card-value">{stats.sent}</div>
          <div className="stat-card-label">Sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon gray">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="stat-card-value">{stats.draft}</div>
          <div className="stat-card-label">Drafts</div>
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
          <div className="stat-card-value">{stats.scheduled}</div>
          <div className="stat-card-label">Scheduled</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Campaigns</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="empty-state">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-light)"
                strokeWidth="1.5"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <h3>No campaigns yet</h3>
              <p>Create your first campaign to reach subscribers</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreate(true)}
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Preview</th>
                    <th>Status</th>
                    <th>Recipients</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(campaign => (
                    <tr key={campaign.id}>
                      <td style={{ fontWeight: 500 }}>{campaign.subject}</td>
                      <td
                        style={{
                          color: 'var(--text-light)',
                          fontSize: '0.85rem',
                          maxWidth: '200px',
                        }}
                      >
                        {campaign.preview_text || '-'}
                      </td>
                      <td>{getStatusBadge(campaign.status)}</td>
                      <td>{campaign.recipient_count ?? '-'}</td>
                      <td
                        style={{
                          color: 'var(--text-light)',
                          fontSize: '0.85rem',
                        }}
                      >
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        {campaign.status === 'sent' ||
                        campaign.status === 'sending' ? (
                          <span
                            style={{
                              color: 'var(--text-light)',
                              fontSize: '0.8rem',
                            }}
                          >
                            {campaign.status === 'sending'
                              ? 'Sending...'
                              : 'Delivered'}
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => sendCampaign(campaign.id)}
                            disabled={sending === campaign.id}
                          >
                            {sending === campaign.id
                              ? 'Sending...'
                              : 'Send Now'}
                          </button>
                        )}
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
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Campaign</h3>
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
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Subject Line</label>
                <input
                  className="form-input"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="Weekly Newsletter: New Features"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Preview Text (optional)</label>
                <input
                  className="form-input"
                  value={form.previewText}
                  onChange={e =>
                    setForm({ ...form, previewText: e.target.value })
                  }
                  placeholder="See what's new this week..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea
                  className="form-input"
                  rows={10}
                  value={form.html}
                  onChange={e => setForm({ ...form, html: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  placeholder="<h2>Hello!</h2><p>Write your newsletter content here...</p>"
                />
                <small style={{ color: 'var(--text-light)' }}>
                  HTML is supported
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => createCampaign()}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
