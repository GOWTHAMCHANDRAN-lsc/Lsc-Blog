'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import api from '@/lib/api';

type AnalyticsPoint = {
  date: string;
  views: number;
};

type TopPost = {
  title: string;
  slug: string;
  views: number;
};

type AnalyticsState = {
  total_views: number;
  by_day: AnalyticsPoint[];
  top_posts: TopPost[];
};

const BAR_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
];
const EMPTY_POINTS: AnalyticsPoint[] = [];
const EMPTY_TOP_POSTS: TopPost[] = [];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api
      .getAnalyticsOverview(token)
      .then((res: any) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const byDay = useMemo(() => data?.by_day ?? EMPTY_POINTS, [data?.by_day]);
  const topPosts = useMemo(
    () => data?.top_posts ?? EMPTY_TOP_POSTS,
    [data?.top_posts]
  );

  const metrics = useMemo(() => {
    const totalViews = data?.total_views ?? 0;
    const bestDay = byDay.reduce<AnalyticsPoint | null>((best, point) => {
      if (!best || point.views > best.views) {
        return point;
      }
      return best;
    }, null);
    const avgDaily = byDay.length ? Math.round(totalViews / byDay.length) : 0;

    return [
      { label: 'Total Views', value: totalViews.toLocaleString(), icon: 'eye' },
      {
        label: 'Daily Average',
        value: avgDaily.toLocaleString(),
        icon: 'trending',
      },
      {
        label: 'Best Day',
        value: bestDay?.views?.toLocaleString() ?? '0',
        icon: 'award',
      },
      { label: 'Top Posts', value: String(topPosts.length), icon: 'star' },
    ];
  }, [byDay, data?.total_views, topPosts.length]);

  const ICONS: Record<string, JSX.Element> = {
    eye: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    trending: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    award: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </svg>
    ),
    star: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  };

  const chartData = byDay.map(point => ({
    ...point,
    label: formatShortDate(point.date),
  }));

  if (loading) {
    return (
      <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: '#9ca3af' }}>
          Loading analytics...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Analytics</h1>
        <p className="admin-page-subtitle">
          Track your content performance and audience engagement
        </p>
      </div>

      <div className="stats-grid">
        {metrics.map(metric => (
          <div key={metric.label} className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon blue">{ICONS[metric.icon]}</div>
            </div>
            <div className="stat-card-value">{metric.value}</div>
            <div className="stat-card-label">{metric.label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Daily Pageviews</h3>
            </div>
          </div>
          <div className="card-body">
            {chartData.length === 0 ? (
              <div className="empty-state">
                <p>No pageview data available</p>
              </div>
            ) : (
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="viewsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#6366f1"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(0,0,0,0.06)"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                    />
                    <Tooltip content={<AnalyticsTooltip suffix="views" />} />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="url(#viewsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Most Viewed Posts</h3>
            </div>
          </div>
          <div className="card-body">
            {topPosts.length === 0 ? (
              <div className="empty-state">
                <p>No post views recorded yet</p>
              </div>
            ) : (
              <>
                <div className="analytics-chart analytics-chart--compact">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topPosts.slice(0, 6)}
                      layout="vertical"
                      margin={{ top: 8, right: 10, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="rgba(0,0,0,0.06)"
                      />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                      />
                      <Tooltip content={<AnalyticsTooltip suffix="views" />} />
                      <Bar dataKey="views" radius={[0, 6, 6, 0]}>
                        {topPosts.slice(0, 6).map((_, index) => (
                          <Cell
                            key={index}
                            fill={BAR_COLORS[index % BAR_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="analytics-top-list">
                  {topPosts.slice(0, 6).map((post, index) => (
                    <div key={post.slug} className="analytics-top-list__row">
                      <div>
                        <strong>
                          {index + 1}. {post.title}
                        </strong>
                        <span>/{post.slug}</span>
                      </div>
                      <em>{post.views.toLocaleString()} views</em>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTooltip({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="analytics-tooltip">
      <strong>{label}</strong>
      <span>
        {payload[0].value.toLocaleString()} {suffix}
      </span>
    </div>
  );
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
