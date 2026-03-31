'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Comment = {
  id: string;
  content: string;
  author_name: string;
  author_email: string;
  status: string;
  created_at: string;
  post_id: string;
  post_slug?: string;
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export default function CommentsPage() {
  const [token, setToken] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadComments = useCallback(
    (accessToken: string) => {
      setLoading(true);
      const params: Record<string, string | number> = {};
      if (filter !== 'all') params.status = filter;

      api
        .listComments(accessToken, params)
        .then((res: any) => setComments(res.data ?? []))
        .catch(() => setComments([]))
        .finally(() => setLoading(false));
    },
    [filter]
  );

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token') ?? '';
    setToken(accessToken);
    loadComments(accessToken);
  }, [loadComments]);

  const handleModerate = async (
    id: string,
    action: 'approve' | 'spam' | 'delete'
  ) => {
    try {
      if (action === 'approve') {
        await api.approveComment(token, id);
        toast.success('Comment approved');
      } else if (action === 'spam') {
        await api.rejectComment(token, id);
        toast.success('Marked as spam');
      } else {
        await api.deleteComment(token, id);
        toast.success('Comment deleted');
      }
      loadComments(token);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: 'badge-success',
      pending: 'badge-warning',
      rejected: 'badge-danger',
      spam: 'badge-danger',
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
          <h1 className="admin-page-title">Comments</h1>
          <p className="admin-page-subtitle">
            Manage and moderate user comments
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div
            className="tabs"
            style={{ marginBottom: 0, padding: 0, background: 'transparent' }}
          >
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`tab ${filter === f.id ? 'active' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : comments.length === 0 ? (
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
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>No comments found</h3>
              <p>Comments will appear here when users submit them</p>
            </div>
          ) : (
            <div className="comment-list">
              {comments.map((comment, i) => (
                <div
                  key={comment.id}
                  className="comment-item"
                  style={{
                    borderBottom:
                      i < comments.length - 1
                        ? '1px solid var(--border-light)'
                        : 'none',
                  }}
                >
                  <div className="comment-avatar">
                    {comment.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="comment-content" style={{ flex: 1 }}>
                    <div className="comment-header">
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {comment.author_name}
                        </span>
                        <span
                          style={{
                            color: 'var(--text-tertiary)',
                            fontSize: '0.8rem',
                            marginLeft: '0.5rem',
                          }}
                        >
                          {comment.author_email}
                        </span>
                      </div>
                      {getStatusBadge(comment.status)}
                    </div>
                    <p className="comment-text">{comment.content}</p>
                    <div className="comment-meta">
                      <span>
                        {new Date(comment.created_at).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </span>
                      {comment.post_slug && (
                        <Link
                          href={`/${comment.post_slug}`}
                          target="_blank"
                          style={{ color: 'var(--primary)' }}
                        >
                          View post →
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="comment-actions">
                    {comment.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleModerate(comment.id, 'approve')}
                          className="btn btn-success btn-sm"
                          title="Approve"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Approve
                        </button>
                        <button
                          onClick={() => handleModerate(comment.id, 'spam')}
                          className="btn btn-secondary btn-sm"
                          title="Spam"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M4 4l16 16M2 12l4-8h12l-4 8M4.5 20l4-12M19.5 20l-4-12" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleModerate(comment.id, 'delete')}
                      className="btn-icon text-danger"
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .comment-list {
          display: flex;
          flex-direction: column;
        }
        .comment-item {
          display: flex;
          gap: 1rem;
          padding: 1.25rem;
          background: var(--bg-primary);
          transition: background var(--transition-fast);
        }
        .comment-item:hover {
          background: var(--bg-hover);
        }
        .comment-avatar {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          color: white;
          flex-shrink: 0;
        }
        .comment-content {
          flex: 1;
          min-width: 0;
        }
        .comment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .comment-text {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 0.5rem;
          word-wrap: break-word;
        }
        .comment-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }
        .comment-meta a {
          color: var(--primary);
        }
        .comment-meta a:hover {
          text-decoration: underline;
        }
        .comment-actions {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
