'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type MediaItem = {
  id: string;
  filename: string;
  cdn_url: string;
  mime_type: string;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  created_at: string;
};

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    const token = localStorage.getItem('access_token') ?? '';
    try {
      const res = (await api.listMedia(token)) as any;
      setMedia(res.data || []);
    } catch (err: any) {
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const token = localStorage.getItem('access_token') ?? '';

    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        const res = (await api.uploadMediaFile(token, file)) as any;
        setMedia(prev => [res.data, ...prev]);
        successCount++;
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media file?')) return;
    const token = localStorage.getItem('access_token') ?? '';
    try {
      await api.deleteMedia(token, id);
      toast.success('Media deleted');
      setMedia(media.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredMedia = media.filter(
    m =>
      m.filename.toLowerCase().includes(filter.toLowerCase()) ||
      m.alt_text?.toLowerCase().includes(filter.toLowerCase())
  );

  const isImage = (mime: string) => mime.startsWith('image/');

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
          <h1 className="admin-page-title">Media Library</h1>
          <p className="admin-page-subtitle">
            Upload and manage your media files
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="search-box">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search media..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <div className="view-toggle">
            <button
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              onChange={handleUpload}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {media.length === 0 ? (
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
              style={{ margin: '0 auto 1rem' }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <h3 style={{ marginBottom: '0.5rem' }}>No Media Files</h3>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Upload your first file to get started
            </p>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              Upload Files
              <input
                type="file"
                multiple
                onChange={handleUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className="media-grid">
          {filteredMedia.map(m => (
            <div
              key={m.id}
              className={`media-item ${selected?.id === m.id ? 'selected' : ''}`}
              onClick={() => setSelected(m)}
            >
              <div className="media-thumb">
                {isImage(m.mime_type) ? (
                  <Image
                    src={m.cdn_url}
                    alt={m.alt_text || m.filename}
                    fill
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className="media-icon">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="media-info">
                <span className="media-name">{m.filename}</span>
                <span className="media-size">
                  {formatSize(m.file_size_bytes)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Dimensions</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedia.map(m => (
                  <tr
                    key={m.id}
                    className={selected?.id === m.id ? 'selected-row' : ''}
                  >
                    <td>
                      {isImage(m.mime_type) ? (
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            position: 'relative',
                            borderRadius: 6,
                            overflow: 'hidden',
                          }}
                        >
                          <Image
                            src={m.cdn_url}
                            alt={m.filename}
                            fill
                            style={{ objectFit: 'cover' }}
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            background: 'var(--bg-tertiary)',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--text-light)"
                            strokeWidth="1.5"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{m.filename}</td>
                    <td>
                      <span className="badge">{m.mime_type.split('/')[1]}</span>
                    </td>
                    <td>{formatSize(m.file_size_bytes)}</td>
                    <td>
                      {m.width && m.height ? `${m.width} x ${m.height}` : '-'}
                    </td>
                    <td>{new Date(m.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-icon"
                          onClick={() =>
                            navigator.clipboard.writeText(m.cdn_url)
                          }
                          title="Copy URL"
                        >
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
                        </button>
                        <button
                          className="btn-icon text-danger"
                          onClick={() => handleDelete(m.id)}
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
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selected.filename}</h3>
              <button className="btn-icon" onClick={() => setSelected(null)}>
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
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: '1rem',
                  position: 'relative',
                  height: 400,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {isImage(selected.mime_type) ? (
                  <Image
                    src={selected.cdn_url}
                    alt={selected.filename}
                    fill
                    style={{ objectFit: 'contain' }}
                    unoptimized
                  />
                ) : (
                  <div
                    style={{
                      padding: '3rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: 8,
                    }}
                  >
                    <svg
                      width="64"
                      height="64"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-light)"
                      strokeWidth="1.5"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">URL</span>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      value={selected.cdn_url}
                      readOnly
                      style={{ fontSize: '0.8rem' }}
                    />
                    <button
                      className="btn-icon"
                      onClick={() =>
                        navigator.clipboard.writeText(selected.cdn_url)
                      }
                    >
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
                    </button>
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Type</span>
                  <span>{selected.mime_type}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Size</span>
                  <span>{formatSize(selected.file_size_bytes)}</span>
                </div>
                {selected.width && selected.height && (
                  <div className="detail-item">
                    <span className="detail-label">Dimensions</span>
                    <span>
                      {selected.width} x {selected.height}
                    </span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">Uploaded</span>
                  <span>{new Date(selected.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(selected.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
