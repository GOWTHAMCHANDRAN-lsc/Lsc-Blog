'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  FileText,
  MessageSquare,
  Users,
  Mail,
  Plus,
  CheckCircle,
  Image,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  LayoutGrid,
  Settings,
  Bell,
  Search,
} from 'lucide-react';

type DashboardStats = {
  posts: { total: number; published: number };
  comments: { total: number; pending: number };
  users: { total: number };
  subscribers: { total: number };
};

type RecentPost = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserName(user.name || 'there');
      } catch {
        /* ignore */
      }
    }

    const token = localStorage.getItem('access_token') ?? '';
    Promise.all([
      api.listPosts(token, { per_page: 5 }),
      api.listComments(token, { per_page: 5 }),
      api.listUsers(token),
      api.listSubscribers(token, {}),
    ])
      .then(([postsRes, commentsRes, usersRes, subsRes]: any[]) => {
        setStats({
          posts: {
            total: postsRes.meta?.total ?? 0,
            published:
              postsRes.data?.filter((p: any) => p.status === 'published')
                .length ?? 0,
          },
          comments: {
            total: commentsRes.meta?.total ?? 0,
            pending:
              commentsRes.data?.filter((c: any) => c.status === 'pending')
                .length ?? 0,
          },
          users: { total: usersRes.data?.length ?? 0 },
          subscribers: { total: subsRes.data?.length ?? 0 },
        });
        setRecent(postsRes.data ?? []);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const quickActions = [
    {
      href: '/dashboard/posts/new',
      label: 'Create Post',
      icon: Plus,
      color: '#dbeafe',
      text: '#2563eb',
    },
    {
      href: '/dashboard/posts',
      label: 'All Posts',
      icon: FileText,
      color: '#f1f5f9',
      text: '#475569',
    },
    {
      href: '/dashboard/approval',
      label: 'Review Queue',
      icon: CheckCircle,
      color: '#fef3c7',
      text: '#d97706',
      badge: stats?.comments.pending,
    },
    {
      href: '/dashboard/comments',
      label: 'Comments',
      icon: MessageSquare,
      color: '#f3e8ff',
      text: '#7c3aed',
    },
    {
      href: '/dashboard/media',
      label: 'Media',
      icon: Image,
      color: '#d1fae5',
      text: '#059669',
    },
    {
      href: '/dashboard/analytics',
      label: 'Analytics',
      icon: BarChart3,
      color: '#dbeafe',
      text: '#2563eb',
    },
  ];

  const statCards = [
    {
      label: 'Total Posts',
      value: stats?.posts.total || 0,
      sub: `${stats?.posts.published || 0} published`,
      icon: FileText,
      color: '#0080ff',
      bg: '#eff6ff',
    },
    {
      label: 'Comments',
      value: stats?.comments.total || 0,
      sub: `${stats?.comments.pending || 0} pending`,
      icon: MessageSquare,
      color: '#7c3aed',
      bg: '#f5f3ff',
    },
    {
      label: 'Team Members',
      value: stats?.users.total || 0,
      sub: 'Active collaborators',
      icon: Users,
      color: '#10b981',
      bg: '#ecfdf5',
    },
    {
      label: 'Subscribers',
      value: stats?.subscribers.total || 0,
      sub: 'Newsletter audience',
      icon: Mail,
      color: '#f59e0b',
      bg: '#fffbeb',
    },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      published: { bg: '#dcfce7', text: '#166534' },
      draft: { bg: '#f1f5f9', text: '#475569' },
      pending: { bg: '#fef3c7', text: '#92400e' },
      approved: { bg: '#dcfce7', text: '#166534' },
      rejected: { bg: '#fee2e2', text: '#991b1b' },
    };
    const s = styles[status] || styles.draft;
    return (
      <span
        style={{
          background: s.bg,
          color: s.text,
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'capitalize',
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <span className="page-badge">Dashboard</span>
          <h1 className="page-title">
            {getGreeting()},{' '}
            <span className="highlight">
              {userName ? userName.split(' ')[0] : 'there'}
            </span>
          </h1>
          <p className="page-subtitle">
            Monitor your content performance and manage your blog
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/dashboard/posts/new" className="btn btn-primary">
            <Plus size={18} />
            Create Post
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="stat-card"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="stat-card-left">
              <div
                className="stat-icon"
                style={{ background: stat.bg, color: stat.color }}
              >
                <stat.icon size={22} />
              </div>
            </div>
            <div className="stat-card-right">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
              <span className="stat-sub">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}

      {!loading && (
        <div className="dashboard-content">
          {/* Quick Actions */}
          <div className="section">
            <h2 className="section-title">Quick Actions</h2>
            <div className="quick-actions-grid">
              {quickActions.map((action, i) => (
                <Link key={i} href={action.href} className="quick-action-card">
                  <div
                    className="quick-action-icon"
                    style={{ background: action.color, color: action.text }}
                  >
                    <action.icon size={20} />
                  </div>
                  <div className="quick-action-info">
                    <span className="quick-action-label">{action.label}</span>
                    {action.badge ? (
                      <span className="quick-action-badge">
                        {action.badge} pending
                      </span>
                    ) : null}
                  </div>
                  <ArrowRight size={16} className="quick-action-arrow" />
                </Link>
              ))}
            </div>
          </div>

          {/* Content Grid */}
          <div className="content-grid">
            {/* Recent Posts */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Posts</h3>
                <Link href="/dashboard/posts" className="card-link">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {recent.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={40} strokeWidth={1} />
                    <p>No posts yet</p>
                    <Link
                      href="/dashboard/posts/new"
                      className="btn btn-primary btn-sm"
                    >
                      Create your first post
                    </Link>
                  </div>
                ) : (
                  <div className="posts-list">
                    {recent.map(post => (
                      <Link
                        key={post.id}
                        href={`/dashboard/posts/${post.id}`}
                        className="post-item"
                      >
                        <div className="post-icon">
                          <FileText size={18} />
                        </div>
                        <div className="post-info">
                          <span className="post-title">{post.title}</span>
                          <span className="post-date">
                            {new Date(post.updated_at).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }
                            )}
                          </span>
                        </div>
                        {getStatusBadge(post.status)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Getting Started */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Getting Started</h3>
              </div>
              <div className="card-body">
                <div className="guide-list">
                  {[
                    {
                      num: '1',
                      title: 'Create Post',
                      desc: 'Click "Create Post" to write your first article',
                      icon: Plus,
                    },
                    {
                      num: '2',
                      title: 'Add Media',
                      desc: 'Upload images to make your content engaging',
                      icon: Image,
                    },
                    {
                      num: '3',
                      title: 'Organize',
                      desc: 'Create categories to organize your posts',
                      icon: LayoutGrid,
                    },
                    {
                      num: '4',
                      title: 'Grow Audience',
                      desc: 'Enable subscribers to grow your reach',
                      icon: Users,
                    },
                  ].map((item, i) => (
                    <div key={i} className="guide-item">
                      <div className="guide-icon">{item.num}</div>
                      <div className="guide-content">
                        <span className="guide-title">{item.title}</span>
                        <span className="guide-desc">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard-page {
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          gap: 24px;
          flex-wrap: wrap;
        }

        .page-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #0080ff;
          background: #eff6ff;
          border-radius: 999px;
          margin-bottom: 12px;
        }

        .page-title {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }

        .page-title .highlight {
          background: linear-gradient(135deg, #0080ff 0%, #7c3aed 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .page-subtitle {
          color: #64748b;
          font-size: 15px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          gap: 16px;
          align-items: center;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: all 0.2s;
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          border-color: #cbd5e1;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-card-right {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }

        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          margin-top: 4px;
        }

        .stat-sub {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .section {
          margin-bottom: 32px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 16px;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
        }

        @media (max-width: 1024px) {
          .quick-actions-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 640px) {
          .quick-actions-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .quick-action-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: white;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s;
          text-decoration: none;
        }

        .quick-action-card:hover {
          border-color: #0080ff;
          box-shadow: 0 4px 12px rgba(0, 128, 255, 0.1);
          transform: translateY(-2px);
        }

        .quick-action-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .quick-action-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .quick-action-label {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }

        .quick-action-badge {
          font-size: 11px;
          color: #d97706;
          font-weight: 500;
        }

        .quick-action-arrow {
          color: #94a3b8;
          flex-shrink: 0;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        @media (max-width: 900px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background: white;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .card-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }

        .card-link {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 500;
          color: #0080ff;
        }

        .card-link:hover {
          color: #0066dd;
        }

        .card-body {
          padding: 24px;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
        }

        .empty-state p {
          margin: 12px 0 16px;
        }

        .posts-list {
          display: flex;
          flex-direction: column;
        }

        .post-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 24px;
          border-bottom: 1px solid #f1f5f9;
          text-decoration: none;
          transition: background 0.15s;
        }

        .post-item:hover {
          background: #f8fafc;
        }

        .post-item:last-child {
          border-bottom: none;
        }

        .post-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }

        .post-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .post-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .post-date {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .guide-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .guide-item {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .guide-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #0080ff 0%, #7c3aed 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .guide-content {
          display: flex;
          flex-direction: column;
        }

        .guide-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }

        .guide-desc {
          font-size: 12px;
          color: #64748b;
        }

        .loading {
          display: flex;
          justify-content: center;
          padding: 60px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #0080ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #0080ff 0%, #0066dd 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(0, 128, 255, 0.25);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 128, 255, 0.3);
        }

        .btn-sm {
          padding: 8px 14px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
