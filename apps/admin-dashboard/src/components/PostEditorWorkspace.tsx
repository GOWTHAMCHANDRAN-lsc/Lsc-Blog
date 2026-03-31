'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import RichEditor from '@/components/RichEditor';
import MediaPickerModal from '@/components/MediaPickerModal';

export interface SEOSuggestion {
  type: 'error' | 'warning' | 'success' | 'suggestion';
  field: string;
  message: string;
  fix?: string;
}

export interface SEOAnalysis {
  score: number;
  suggestions: SEOSuggestion[];
}

export interface PostEditorForm {
  title: string;
  content: string;
  excerpt: string;
  featuredImageUrl: string;
  focusKeyword: string;
  metaTitle: string;
  metaDescription: string;
}

type Props = {
  title: string;
  description: string;
  status?: string;
  form: PostEditorForm;
  onFieldChange: (key: keyof PostEditorForm, value: string) => void;
  actions: ReactNode;
  seoAnalysis: SEOAnalysis | null;
  sidebarExtra?: ReactNode;
};

export default function PostEditorWorkspace({
  title,
  description,
  status,
  form,
  onFieldChange,
  actions,
  seoAnalysis,
  sidebarExtra,
}: Props) {
  const contentStats = summarizeContent(form.content);
  const excerptLength = form.excerpt.trim().length;
  const [mediaOpen, setMediaOpen] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    setToken(localStorage.getItem('access_token') ?? '');
  }, []);

  return (
    <div className="editor-workspace">
      <div className="editor-workspace__main">
        <header className="editor-workspace__header">
          <div>
            <p className="editor-eyebrow">Post Editor</p>
            <h1>{title}</h1>
            <p className="editor-workspace__description">
              {description}
              {status ? (
                <span
                  className="editor-status-pill"
                  style={statusStyles(status)}
                >
                  {status.replace(/_/g, ' ')}
                </span>
              ) : null}
            </p>
          </div>
          <div className="editor-workspace__actions">{actions}</div>
        </header>

        <section className="editor-surface">
          <div className="editor-surface__header">
            <div>
              <p className="section-kicker">Story Draft</p>
              <h2>Write your content</h2>
            </div>
            <div className="editor-stat-row">
              <span>{contentStats.words} words</span>
              <span>{contentStats.characters} chars</span>
              <span>
                {Math.max(1, Math.ceil(contentStats.words / 200))} min read
              </span>
            </div>
          </div>

          <input
            value={form.title}
            onChange={event => onFieldChange('title', event.target.value)}
            placeholder="Enter a compelling title for your post..."
            className="editor-title-input"
          />

          <RichEditor
            value={form.content}
            onChange={value => onFieldChange('content', value)}
          />
        </section>

        <section className="editor-support-card">
          <div className="editor-support-card__header">
            <div>
              <p className="section-kicker">Excerpt</p>
              <h3>Post Summary</h3>
            </div>
            <span
              className={`editor-counter ${excerptLength > 160 ? 'is-over' : ''}`}
            >
              {excerptLength}/160
            </span>
          </div>
          <textarea
            value={form.excerpt}
            onChange={event => onFieldChange('excerpt', event.target.value)}
            rows={4}
            className="admin-textarea"
            placeholder="Write a concise summary that appears in post listings and search results..."
          />
          <p className="editor-support-card__hint">
            A good excerpt improves click-through rates from search and social
            shares.
          </p>
        </section>
      </div>

      <aside className="editor-workspace__sidebar">
        <section className="editor-side-card">
          <div className="editor-side-card__header">
            <div>
              <p className="section-kicker">SEO Settings</p>
              <h3>Metadata</h3>
            </div>
          </div>

          <label className="admin-field">
            Focus Keyword
            <input
              value={form.focusKeyword}
              onChange={event =>
                onFieldChange('focusKeyword', event.target.value)
              }
              placeholder="e.g. next.js tutorial"
              className="admin-input"
            />
          </label>

          <label className="admin-field">
            SEO Title
            <input
              value={form.metaTitle}
              onChange={event => onFieldChange('metaTitle', event.target.value)}
              placeholder={form.title || 'SEO title'}
              className="admin-input"
            />
            <span
              className={`admin-field__hint ${form.metaTitle.length > 60 ? 'is-over' : ''}`}
            >
              {form.metaTitle.length || form.title.length}/60 chars
            </span>
          </label>

          <label className="admin-field">
            Meta Description
            <textarea
              value={form.metaDescription}
              onChange={event =>
                onFieldChange('metaDescription', event.target.value)
              }
              rows={4}
              placeholder={form.excerpt || 'Meta description'}
              className="admin-textarea"
            />
            <span
              className={`admin-field__hint ${form.metaDescription.length > 160 ? 'is-over' : ''}`}
            >
              {form.metaDescription.length}/160 chars
            </span>
          </label>

          <label className="admin-field">
            Featured Image
            <div className="admin-input-row">
              <input
                value={form.featuredImageUrl}
                onChange={event =>
                  onFieldChange('featuredImageUrl', event.target.value)
                }
                placeholder="https://..."
                className="admin-input"
              />
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => setMediaOpen(true)}
              >
                Browse
              </button>
            </div>
          </label>
        </section>

        {sidebarExtra}

        {seoAnalysis ? (
          <section className="editor-side-card">
            <div className="editor-side-card__header">
              <div>
                <p className="section-kicker">SEO Score</p>
                <h3>Optimization</h3>
              </div>
            </div>

            <div className="editor-score-panel">
              <div
                className="editor-score-ring"
                style={
                  {
                    '--score-color': scoreColor(seoAnalysis.score),
                    '--score-angle': `${seoAnalysis.score * 3.6}deg`,
                  } as CSSProperties
                }
              >
                <span>{seoAnalysis.score}</span>
              </div>

              <div>
                <strong>{labelForScore(seoAnalysis.score)}</strong>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.25rem',
                  }}
                >
                  Analysis based on content and metadata
                </p>
              </div>
            </div>

            <div className="editor-suggestion-list">
              {seoAnalysis.suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.field}-${index}`}
                  className={`editor-suggestion editor-suggestion--${suggestion.type}`}
                >
                  <strong>
                    {iconFor(suggestion.type)} {suggestion.message}
                  </strong>
                  {suggestion.fix ? <p>{suggestion.fix}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </aside>

      <MediaPickerModal
        open={mediaOpen}
        token={token}
        title="Featured Image"
        description="Choose an image for the post thumbnail and social sharing."
        onClose={() => setMediaOpen(false)}
        onSelectUrl={url => onFieldChange('featuredImageUrl', url)}
      />
    </div>
  );
}

function summarizeContent(html: string) {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text ? text.split(' ').length : 0;

  return {
    words,
    characters: text.length,
  };
}

function scoreColor(score: number) {
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function labelForScore(score: number) {
  if (score >= 75) return 'Good SEO';
  if (score >= 50) return 'Needs Work';
  return 'Poor SEO';
}

function iconFor(type: SEOSuggestion['type']) {
  return {
    error: '✗',
    warning: '⚠',
    success: '✓',
    suggestion: '💡',
  }[type];
}

function statusStyles(status: string): CSSProperties {
  switch (status) {
    case 'published':
      return {
        '--status-bg': 'rgba(16,185,129,0.12)',
        '--status-color': '#059669',
      } as CSSProperties;
    case 'pending_approval':
      return {
        '--status-bg': 'rgba(245,158,11,0.12)',
        '--status-color': '#d97706',
      } as CSSProperties;
    case 'approved':
      return {
        '--status-bg': 'rgba(59,130,246,0.12)',
        '--status-color': '#2563eb',
      } as CSSProperties;
    case 'scheduled':
      return {
        '--status-bg': 'rgba(139,92,246,0.12)',
        '--status-color': '#7c3aed',
      } as CSSProperties;
    case 'rejected':
      return {
        '--status-bg': 'rgba(239,68,68,0.12)',
        '--status-color': '#dc2626',
      } as CSSProperties;
    default:
      return {
        '--status-bg': 'rgba(71,85,105,0.12)',
        '--status-color': '#475569',
      } as CSSProperties;
  }
}
