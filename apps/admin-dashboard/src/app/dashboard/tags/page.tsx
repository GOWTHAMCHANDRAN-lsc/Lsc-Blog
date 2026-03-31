'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Tag = {
  id: string;
  name: string;
  slug: string;
  post_count?: number;
  created_at: string;
};

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', slug: '' });
  const [creating, setCreating] = useState(false);
  const [hasErrored, setHasErrored] = useState(false);

  const loadTags = useCallback(async () => {
    const token = localStorage.getItem('access_token') ?? '';
    try {
      const res = (await api.listTags(token)) as any;
      setTags(res.data || []);
      setHasErrored(false);
    } catch (err: any) {
      if (!hasErrored) {
        toast.error(
          'Failed to load tags. Please make sure the API is running.'
        );
        setHasErrored(true);
      }
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [hasErrored]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setNewTag({ name, slug: generateSlug(name) });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.name.trim()) return;

    setCreating(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      const res = (await api.createTag(token, {
        name: newTag.name,
        slug: newTag.slug || generateSlug(newTag.name),
      })) as any;
      toast.success('Tag created');
      setTags([res.data, ...tags]);
      setShowCreate(false);
      setNewTag({ name: '', slug: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    const token = localStorage.getItem('access_token') ?? '';
    try {
      (await api.deleteTag(token, id)) as any;
      toast.success('Tag deleted');
      setTags(tags.filter(t => t.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Tags</h1>
          <p className="admin-page-subtitle">Organize your posts with tags</p>
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
          Add Tag
        </button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : hasErrored ? (
            <div className="empty-state">
              <div
                className="empty-state-icon"
                style={{ background: '#fed7d7', color: '#c53030' }}
              >
                <svg
                  width="32"
                  height="32"
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
              <h3>Failed to Load Tags</h3>
              <p>Please check your API connection and try again</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setLoading(true);
                  setHasErrored(false);
                  void loadTags();
                }}
              >
                Retry
              </button>
            </div>
          ) : tags.length === 0 ? (
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
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </div>
              <h3>No tags yet</h3>
              <p>Create tags to organize your blog posts</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreate(true)}
              >
                Create Tag
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Posts</th>
                    <th>Created</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map(tag => (
                    <tr key={tag.id}>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              background: 'var(--warning-light)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--warning)"
                              strokeWidth="2"
                            >
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                              <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                          </div>
                          <span style={{ fontWeight: 600 }}>{tag.name}</span>
                        </div>
                      </td>
                      <td>
                        <code
                          style={{
                            background: 'var(--bg-tertiary)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                          }}
                        >
                          {tag.slug}
                        </code>
                      </td>
                      <td>
                        <span className="badge badge-gray">
                          {tag.post_count || 0}
                        </span>
                      </td>
                      <td
                        style={{
                          color: 'var(--text-tertiary)',
                          fontSize: '0.85rem',
                        }}
                      >
                        {new Date(tag.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="btn-icon text-danger"
                          onClick={() => handleDelete(tag.id)}
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
              <h3>Create Tag</h3>
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
                  <label className="form-label">Name</label>
                  <input
                    className="form-input"
                    value={newTag.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g., Technology"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input
                    className="form-input"
                    value={newTag.slug}
                    onChange={e =>
                      setNewTag({ ...newTag, slug: e.target.value })
                    }
                    placeholder="auto-generated-from-name"
                  />
                  <small
                    style={{
                      color: 'var(--text-tertiary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    Leave empty to auto-generate from name
                  </small>
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
                  {creating ? 'Creating...' : 'Create Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
