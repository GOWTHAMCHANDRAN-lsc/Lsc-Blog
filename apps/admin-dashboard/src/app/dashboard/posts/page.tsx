'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

type Post = {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
  author: { name: string } | null;
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending' },
  { id: 'scheduled', label: 'Scheduled' },
];

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    if (!token) {
      router.push('/login');
      return;
    }

    const params: Record<string, string | number> = {};
    if (filter !== 'all') params.status = filter;
    if (search) params.search = search;

    api
      .listPosts(token, params)
      .then((res: any) => setPosts(res.data ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [filter, search, router]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      published: 'badge-success',
      draft: 'badge-gray',
      pending_approval: 'badge-warning',
      approved: 'badge-info',
      scheduled: 'badge-primary',
      rejected: 'badge-danger',
    };
    return (
      <span className={`badge ${styles[status] || 'badge-gray'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Posts</h1>
          <p className="admin-page-subtitle">
            Manage your blog posts and articles
          </p>
        </div>
        <Link href="/dashboard/posts/new" className="btn btn-primary">
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
          New Post
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <div
            className="tabs"
            style={{
              marginBottom: 0,
              padding: 0,
              background: 'transparent',
              flexWrap: 'wrap',
              gap: '0.25rem',
            }}
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
              placeholder="Search posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : posts.length === 0 ? (
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h3>No posts found</h3>
              <p>Create your first post to start publishing</p>
              <Link href="/dashboard/posts/new" className="btn btn-primary">
                Create Post
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => (
                    <tr key={post.id}>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            maxWidth: '300px',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {post.title}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {post.author?.name ?? '-'}
                      </td>
                      <td>{getStatusBadge(post.status ?? 'draft')}</td>
                      <td
                        style={{
                          color: 'var(--text-tertiary)',
                          fontSize: '0.85rem',
                        }}
                      >
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString()
                          : '-'}
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/posts/${post.id}/edit`}
                          className="btn btn-ghost btn-sm"
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
                          Edit
                        </Link>
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
