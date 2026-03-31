'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type ImportJob = {
  id: string;
  type: 'rss' | 'wxr';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export default function ImportsPage() {
  const [token, setToken] = useState('');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState<'rss' | 'wxr'>('rss');

  const load = async (accessToken: string) => {
    setLoading(true);
    try {
      const res = (await api.listImports(accessToken)) as any;
      setJobs(res.data ?? []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token') ?? '';
    setToken(accessToken);
    void load(accessToken);

    const interval = setInterval(() => {
      if (accessToken) {
        void load(accessToken);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = (await api.uploadImportFile(token, type, file)) as any;
      toast.success(`Import job queued: ${res.data.id}`);
      await load(token);
    } catch (err: any) {
      toast.error(err.message ?? 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      completed: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
      failed: { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' },
      processing: { bg: 'rgba(99,102,241,0.1)', color: '#4f46e5' },
      queued: { bg: 'rgba(148,163,184,0.1)', color: '#64748b' },
    };
    const style = styles[status] || styles.queued;
    return (
      <span
        className="badge"
        style={{ background: style.bg, color: style.color }}
      >
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Imports</h1>
        <p className="admin-page-subtitle">
          Import posts from RSS feeds or WordPress
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div
              className="form-group"
              style={{ marginBottom: 0, minWidth: '180px' }}
            >
              <label className="form-label">Import Type</label>
              <select
                className="form-input form-select"
                value={type}
                onChange={e => setType(e.target.value as any)}
              >
                <option value="rss">RSS Feed</option>
                <option value="wxr">WordPress (WXR)</option>
              </select>
            </div>

            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={e => void upload(e.target.files?.[0] ?? null)}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {uploading ? 'Uploading...' : 'Upload XML'}
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Import Jobs</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3>No imports yet</h3>
              <p>Upload an XML file to import posts from RSS or WordPress</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Updated</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id}>
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
                              background:
                                job.type === 'rss'
                                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                  : 'linear-gradient(135deg, #ec4899, #f43f5e)',
                            }}
                          >
                            {job.type === 'rss' ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M4 11a9 9 0 0 1 9 9" />
                                <path d="M4 4a16 16 0 0 1 16 16" />
                                <circle cx="5" cy="19" r="1" />
                              </svg>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div
                              className="font-semibold"
                              style={{
                                textTransform: 'uppercase',
                                fontSize: '0.75rem',
                              }}
                            >
                              {job.type}
                            </div>
                            <div
                              style={{ fontSize: '0.75rem', color: '#9ca3af' }}
                            >
                              {job.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{getStatusBadge(job.status)}</td>
                      <td>
                        {job.total ? (
                          <div>
                            <span style={{ fontWeight: 600 }}>
                              {job.progress}/{job.total}
                            </span>
                            <div
                              className="progress"
                              style={{ marginTop: '0.5rem', width: '100px' }}
                            >
                              <div
                                className="progress-bar"
                                style={{
                                  width: `${(job.progress / job.total) * 100}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                        {new Date(job.updated_at).toLocaleString()}
                      </td>
                      <td
                        style={{
                          color: job.error ? '#ef4444' : '#9ca3af',
                          fontSize: '0.85rem',
                          maxWidth: '200px',
                        }}
                      >
                        {job.error || '-'}
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
