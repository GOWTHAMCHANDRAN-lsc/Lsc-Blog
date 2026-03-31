'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type SiteConfig = {
  site_name: string;
  site_tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  font_family: string;
  posts_per_page: number;
  enable_comments: boolean;
  comment_moderation: string;
  comments_per_page: number;
  comment_blocked_words: string | null;
  rss_enabled: boolean;
  analytics_id: string | null;
  header_scripts: string | null;
  footer_scripts: string | null;
  social_links: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    github?: string;
  } | null;
  webhook_urls: string[] | null;
  locale: string;
  timezone: string;
};

type SettingsTab =
  | 'general'
  | 'appearance'
  | 'comments'
  | 'social'
  | 'webhooks'
  | 'advanced'
  | 'security';

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [config, setConfig] = useState<SiteConfig>({
    site_name: '',
    site_tagline: '',
    logo_url: null,
    favicon_url: null,
    primary_color: '#3B82F6',
    font_family: 'Inter',
    posts_per_page: 12,
    enable_comments: true,
    comment_moderation: 'manual',
    comments_per_page: 10,
    comment_blocked_words: null,
    rss_enabled: true,
    analytics_id: null,
    header_scripts: null,
    footer_scripts: null,
    social_links: null,
    webhook_urls: null,
    locale: 'en',
    timezone: 'UTC',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    password: '',
    confirm: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  const [socialLinks, setSocialLinks] = useState({
    twitter: '',
    facebook: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    github: '',
  });
  const [webhooks, setWebhooks] = useState<string[]>(['']);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api
      .getSiteConfig(token)
      .then((res: any) => {
        const data = res.data;
        setConfig(data);
        if (data.social_links) {
          setSocialLinks({
            twitter: data.social_links.twitter || '',
            facebook: data.social_links.facebook || '',
            instagram: data.social_links.instagram || '',
            linkedin: data.social_links.linkedin || '',
            youtube: data.social_links.youtube || '',
            github: data.social_links.github || '',
          });
        }
        if (data.webhook_urls && Array.isArray(data.webhook_urls)) {
          setWebhooks(data.webhook_urls.length ? data.webhook_urls : ['']);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      const updateData = {
        ...config,
        social_links: socialLinks,
        webhook_urls: webhooks.filter(w => w.trim()),
      };
      (await api.updateSiteConfig(token, updateData)) as any;
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPasswordSaving(true);
    const token = localStorage.getItem('access_token') ?? '';
    try {
      (await api.changePassword(
        token,
        passwordForm.current,
        passwordForm.password
      )) as any;
      toast.success('Password changed');
      setPasswordForm({ current: '', password: '', confirm: '' });
      setPasswordMsg('Password updated successfully');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const addWebhook = () => setWebhooks([...webhooks, '']);
  const removeWebhook = (i: number) =>
    setWebhooks(webhooks.filter((_, idx) => idx !== i));
  const updateWebhook = (i: number, value: string) => {
    const updated = [...webhooks];
    updated[i] = value;
    setWebhooks(updated);
  };

  const tabs = [
    {
      id: 'general',
      label: 'General',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      id: 'comments',
      label: 'Comments',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'social',
      label: 'Social',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
    {
      id: 'webhooks',
      label: 'Webhooks',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      id: 'advanced',
      label: 'Advanced',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Security',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ] as const;

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
        <h1 className="admin-page-title">Settings</h1>
        <p className="admin-page-subtitle">Configure your blog platform</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div
            className="tabs"
            style={{
              marginBottom: 0,
              borderBottom: 'none',
              paddingBottom: 0,
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`tab ${tab === t.id ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body">
          {tab === 'general' && (
            <form onSubmit={handleSave} style={{ maxWidth: '600px' }}>
              <div className="form-group">
                <label className="form-label">Site Name</label>
                <input
                  className="form-input"
                  value={config.site_name}
                  onChange={e =>
                    setConfig({ ...config, site_name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tagline</label>
                <input
                  className="form-input"
                  value={config.site_tagline || ''}
                  onChange={e =>
                    setConfig({ ...config, site_tagline: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Logo URL</label>
                <input
                  className="form-input"
                  value={config.logo_url || ''}
                  onChange={e =>
                    setConfig({ ...config, logo_url: e.target.value || null })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Favicon URL</label>
                <input
                  className="form-input"
                  value={config.favicon_url || ''}
                  onChange={e =>
                    setConfig({
                      ...config,
                      favicon_url: e.target.value || null,
                    })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Posts Per Page</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '120px' }}
                    value={config.posts_per_page}
                    onChange={e =>
                      setConfig({
                        ...config,
                        posts_per_page: parseInt(e.target.value) || 12,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Locale</label>
                  <select
                    className="form-input form-select"
                    style={{ width: '150px' }}
                    value={config.locale}
                    onChange={e =>
                      setConfig({ ...config, locale: e.target.value })
                    }
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="pt">Portuguese</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Timezone</label>
                  <select
                    className="form-input form-select"
                    style={{ width: '200px' }}
                    value={config.timezone}
                    onChange={e =>
                      setConfig({ ...config, timezone: e.target.value })
                    }
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.rss_enabled}
                    onChange={e =>
                      setConfig({ ...config, rss_enabled: e.target.checked })
                    }
                  />
                  Enable RSS Feed
                </label>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'appearance' && (
            <form onSubmit={handleSave} style={{ maxWidth: '500px' }}>
              <div className="form-group">
                <label className="form-label">Primary Color</label>
                <div
                  style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}
                >
                  <input
                    type="color"
                    value={config.primary_color}
                    onChange={e =>
                      setConfig({ ...config, primary_color: e.target.value })
                    }
                    style={{
                      width: '60px',
                      height: '40px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  />
                  <input
                    className="form-input"
                    value={config.primary_color}
                    onChange={e =>
                      setConfig({ ...config, primary_color: e.target.value })
                    }
                    style={{ width: '150px' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Font Family</label>
                <select
                  className="form-input form-select"
                  value={config.font_family}
                  onChange={e =>
                    setConfig({ ...config, font_family: e.target.value })
                  }
                >
                  <option value="Inter">Inter</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Lato">Lato</option>
                  <option value="Montserrat">Montserrat</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Analytics ID</label>
                <input
                  className="form-input"
                  value={config.analytics_id || ''}
                  onChange={e =>
                    setConfig({
                      ...config,
                      analytics_id: e.target.value || null,
                    })
                  }
                  placeholder="GA-XXXXXXXXX"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'comments' && (
            <form onSubmit={handleSave} style={{ maxWidth: '500px' }}>
              <div className="form-group">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.enable_comments}
                    onChange={e =>
                      setConfig({
                        ...config,
                        enable_comments: e.target.checked,
                      })
                    }
                  />
                  <span className="form-label" style={{ marginBottom: 0 }}>
                    Enable Comments
                  </span>
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Moderation</label>
                <select
                  className="form-input form-select"
                  value={config.comment_moderation}
                  onChange={e =>
                    setConfig({ ...config, comment_moderation: e.target.value })
                  }
                >
                  <option value="auto">Auto-approve</option>
                  <option value="manual">Manual approval</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Comments Per Page</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '120px' }}
                  value={config.comments_per_page}
                  onChange={e =>
                    setConfig({
                      ...config,
                      comments_per_page: parseInt(e.target.value) || 10,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Blocked Words</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={config.comment_blocked_words || ''}
                  onChange={e =>
                    setConfig({
                      ...config,
                      comment_blocked_words: e.target.value || null,
                    })
                  }
                  placeholder="One word per line"
                />
                <small style={{ color: 'var(--text-light)' }}>
                  Comments containing these words will be marked as spam
                </small>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'social' && (
            <form onSubmit={handleSave} style={{ maxWidth: '600px' }}>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                Connect your social media profiles
              </p>
              <div className="social-field">
                <div className="social-icon twitter">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Twitter / X</label>
                  <input
                    className="form-input"
                    value={socialLinks.twitter}
                    onChange={e =>
                      setSocialLinks({
                        ...socialLinks,
                        twitter: e.target.value,
                      })
                    }
                    placeholder="@username"
                  />
                </div>
              </div>
              <div className="social-field">
                <div className="social-icon facebook">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Facebook</label>
                  <input
                    className="form-input"
                    value={socialLinks.facebook}
                    onChange={e =>
                      setSocialLinks({
                        ...socialLinks,
                        facebook: e.target.value,
                      })
                    }
                    placeholder="Page URL"
                  />
                </div>
              </div>
              <div className="social-field">
                <div className="social-icon instagram">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Instagram</label>
                  <input
                    className="form-input"
                    value={socialLinks.instagram}
                    onChange={e =>
                      setSocialLinks({
                        ...socialLinks,
                        instagram: e.target.value,
                      })
                    }
                    placeholder="@username"
                  />
                </div>
              </div>
              <div className="social-field">
                <div className="social-icon linkedin">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">LinkedIn</label>
                  <input
                    className="form-input"
                    value={socialLinks.linkedin}
                    onChange={e =>
                      setSocialLinks({
                        ...socialLinks,
                        linkedin: e.target.value,
                      })
                    }
                    placeholder="Profile URL"
                  />
                </div>
              </div>
              <div className="social-field">
                <div className="social-icon youtube">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">YouTube</label>
                  <input
                    className="form-input"
                    value={socialLinks.youtube}
                    onChange={e =>
                      setSocialLinks({
                        ...socialLinks,
                        youtube: e.target.value,
                      })
                    }
                    placeholder="Channel URL"
                  />
                </div>
              </div>
              <div className="social-field">
                <div className="social-icon github">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">GitHub</label>
                  <input
                    className="form-input"
                    value={socialLinks.github}
                    onChange={e =>
                      setSocialLinks({ ...socialLinks, github: e.target.value })
                    }
                    placeholder="@username"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'webhooks' && (
            <form onSubmit={handleSave} style={{ maxWidth: '700px' }}>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                Receive notifications when events happen in your blog
              </p>
              <div style={{ marginBottom: '1rem' }}>
                {webhooks.map((webhook, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      className="form-input"
                      value={webhook}
                      onChange={e => updateWebhook(i, e.target.value)}
                      placeholder="https://example.com/webhook"
                    />
                    {webhooks.length > 1 && (
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => removeWebhook(i)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--danger)"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addWebhook}
                style={{ marginBottom: '1rem' }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Webhook URL
              </button>
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                }}
              >
                <h4 style={{ marginBottom: '0.5rem' }}>Webhook Events</h4>
                <ul
                  style={{
                    color: 'var(--text-light)',
                    paddingLeft: '1.25rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <li>
                    <code>post.published</code> - When a post is published
                  </li>
                  <li>
                    <code>post.created</code> - When a new post is created
                  </li>
                  <li>
                    <code>comment.submitted</code> - When a new comment is
                    submitted
                  </li>
                  <li>
                    <code>user.registered</code> - When a new user registers
                  </li>
                  <li>
                    <code>subscriber.added</code> - When a new subscriber is
                    added
                  </li>
                </ul>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ marginTop: '1rem' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'advanced' && (
            <form onSubmit={handleSave} style={{ maxWidth: '700px' }}>
              <div className="form-group">
                <label className="form-label">Header Scripts</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={config.header_scripts || ''}
                  onChange={e =>
                    setConfig({
                      ...config,
                      header_scripts: e.target.value || null,
                    })
                  }
                  placeholder="<!-- Google Analytics, custom meta tags, etc. -->"
                />
                <small style={{ color: 'var(--text-light)' }}>
                  Scripts will be added to the {'<head>'} section
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Footer Scripts</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={config.footer_scripts || ''}
                  onChange={e =>
                    setConfig({
                      ...config,
                      footer_scripts: e.target.value || null,
                    })
                  }
                  placeholder="<!-- Chat widgets, tracking pixels, etc. -->"
                />
                <small style={{ color: 'var(--text-light)' }}>
                  Scripts will be added before {'</body>'}
                </small>
              </div>
              <div
                className="card"
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                }}
              >
                <h4
                  style={{
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
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
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Danger Zone
                </h4>
                <p
                  style={{
                    color: 'var(--text-light)',
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                  }}
                >
                  These actions are irreversible
                </p>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    alert('This would reset your site configuration')
                  }
                >
                  Reset Site Config
                </button>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ marginTop: '1rem' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'security' && (
            <form onSubmit={handlePasswordChange} style={{ maxWidth: '400px' }}>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                Change Password
              </h3>
              {passwordMsg && (
                <div
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(16,185,129,0.1)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    color: 'var(--success)',
                    fontSize: '0.875rem',
                  }}
                >
                  {passwordMsg}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.current}
                  onChange={e =>
                    setPasswordForm({
                      ...passwordForm,
                      current: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.password}
                  onChange={e =>
                    setPasswordForm({
                      ...passwordForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="Min 8 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.confirm}
                  onChange={e =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={passwordSaving}
              >
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
