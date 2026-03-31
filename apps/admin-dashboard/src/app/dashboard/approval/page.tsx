'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Post = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  author: { name: string; email: string };
  created_at: string;
  featured_image_url?: string;
  word_count?: number;
  reading_time_mins?: number;
};

export default function ApprovalPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api
      .listPosts(token, { status: 'pending_approval' })
      .then((res: any) => setPosts(res.data ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id: string, actionType: 'approve' | 'reject') => {
    setAction(id);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      if (actionType === 'approve') {
        await api.approvePost(token, id);
        toast.success('Post approved successfully');
      } else {
        await api.rejectPost(token, id, rejectReason || 'Post rejected');
        toast.success('Post rejected');
      }
      setPosts(posts.filter(p => p.id !== id));
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAction(null);
    }
  };

  const PostPreviewModal = ({
    post,
    onClose,
  }: {
    post: Post;
    onClose: () => void;
  }) => {
    const { html: safeArticleHtml } = (() => {
      const sanitizeHtml = (raw: string) => {
        return raw.replace(
          /<h([23])>([\s\S]*?)<\/h\1>/gi,
          (_match: string, level: string, inner: string) => {
            const text = inner.replace(/<[^>]*>/g, '').trim();
            const slug = text
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-');
            return `<h${level} id="${slug || 'section'}">${inner}</h${level}>`;
          }
        );
      };
      return { html: sanitizeHtml(post.content || '') };
    })();

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal blog-preview-modal"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(0,0,0,0.05)',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              zIndex: 10,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
            }}
          >
            ×
          </button>
          <div className="blog-preview-wrapper">
            <header className="blog-preview-header">
              <div className="blog-preview-inner">
                <div className="blog-brand">
                  <span className="blog-brand-logo">B</span>
                  <span className="blog-brand-name">Blog</span>
                </div>
                <nav className="blog-preview-nav">
                  <a href="#">Home</a>
                  <a href="#">Categories</a>
                </nav>
              </div>
            </header>

            <main className="blog-preview-main">
              <div className="article-layout">
                <div>
                  <div className="article-header">
                    <div className="article-breadcrumb">
                      <span>Home</span>
                      <span>/</span>
                      <span>{post.title}</span>
                    </div>
                    <h1 className="article-title">{post.title}</h1>
                    {post.excerpt && (
                      <p className="article-excerpt">{post.excerpt}</p>
                    )}
                    <div className="article-meta">
                      <div className="article-author">
                        <span className="article-avatar">
                          {post.author?.name?.charAt(0) || 'A'}
                        </span>
                        <div className="article-author-info">
                          <strong>{post.author?.name}</strong>
                          <span>
                            {new Date(post.created_at).toLocaleDateString(
                              'en-US',
                              {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              }
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="article-stats">
                        <span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {post.reading_time_mins || 1} min read
                        </span>
                        <span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M4 4h16v16H4z" />
                            <path d="M4 9h16M9 4v16" />
                          </svg>
                          {post.word_count || 0} words
                        </span>
                      </div>
                    </div>
                  </div>

                  {post.featured_image_url && (
                    <div className="article-cover">
                      <Image
                        src={post.featured_image_url}
                        alt={post.title}
                        width={800}
                        height={450}
                        style={{ width: '100%', height: 'auto' }}
                      />
                    </div>
                  )}

                  <div
                    className="article-body"
                    dangerouslySetInnerHTML={{ __html: safeArticleHtml }}
                  />
                </div>

                <aside className="blog-sidebar">
                  <div className="blog-widget">
                    <h3 className="blog-widget-title">Post Info</h3>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <p style={{ marginBottom: '0.5rem' }}>
                        <strong>Author:</strong> {post.author?.name}
                      </p>
                      <p style={{ marginBottom: '0.5rem' }}>
                        <strong>Email:</strong> {post.author?.email}
                      </p>
                      <p>
                        <strong>Submitted:</strong>{' '}
                        {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </main>

            <footer className="blog-preview-footer">
              <div className="blog-footer-inner">
                <p>
                  &copy; {new Date().getFullYear()} Blog. All rights reserved.
                </p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Approval Queue</h1>
          <p className="admin-page-subtitle">
            Review and approve posts from your team
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="loading">
            <div className="loading-spinner"></div>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div
              className="empty-state-icon"
              style={{
                background: 'var(--success-light)',
                color: 'var(--success)',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>All caught up!</h3>
            <p>No posts pending approval</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {posts.map(post => (
            <div key={post.id} className="card">
              <div className="card-body">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          background: 'var(--primary-50)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="2"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: '2px',
                          }}
                        >
                          {post.title}
                        </h3>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          By <strong>{post.author?.name}</strong> ·{' '}
                          {new Date(post.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                      }}
                    >
                      {post.excerpt ||
                        (post.content ? post.content.substring(0, 200) : '')}
                      ...
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      flexShrink: 0,
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      onClick={() => setViewingPost(post)}
                      className="btn btn-secondary"
                      disabled={action === post.id}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      View
                    </button>
                    <button
                      onClick={() => handleAction(post.id, 'approve')}
                      className="btn btn-success"
                      disabled={action === post.id}
                    >
                      <svg
                        width="16"
                        height="16"
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
                      onClick={() => setRejectingId(post.id)}
                      className="btn btn-danger"
                      disabled={action === post.id}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>

                {rejectingId === post.id && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: 'var(--danger-50)',
                      borderRadius: '8px',
                      borderLeft: '4px solid var(--danger)',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                        }}
                      >
                        Rejection Reason (optional)
                      </span>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Explain why this post is being rejected..."
                        style={{
                          padding: '0.75rem',
                          border: '1px solid var(--border-default)',
                          borderRadius: '6px',
                          fontFamily: 'inherit',
                          minHeight: '80px',
                          fontSize: '0.85rem',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleAction(post.id, 'reject')}
                          className="btn btn-danger"
                          disabled={action === post.id}
                        >
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason('');
                          }}
                          className="btn btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingPost && (
        <PostPreviewModal
          post={viewingPost}
          onClose={() => setViewingPost(null)}
        />
      )}
    </div>
  );
}
