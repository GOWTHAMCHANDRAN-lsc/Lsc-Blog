'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import PostEditorWorkspace, {
  type SEOAnalysis,
  type PostEditorForm,
} from '@/components/PostEditorWorkspace';

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = typeof params?.id === 'string' ? params.id : '';

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seoLoading, setSeoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [status, setStatus] = useState('draft');
  const [scheduleAt, setScheduleAt] = useState('');
  const [seoAnalysis, setSeoAnalysis] = useState<SEOAnalysis | null>(null);
  const [readyToAutosave, setReadyToAutosave] = useState(false);
  const [form, setForm] = useState<PostEditorForm>({
    title: '',
    content: '',
    excerpt: '',
    featuredImageUrl: '',
    focusKeyword: '',
    metaTitle: '',
    metaDescription: '',
  });

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token') ?? '';
    setToken(accessToken);

    if (!accessToken || !postId) {
      setLoading(false);
      return;
    }

    api
      .getPost(accessToken, postId)
      .then((res: any) => {
        const post = res.data ?? {};
        setStatus(post.status ?? 'draft');
        setScheduleAt(
          post.scheduled_at ? toDatetimeLocal(post.scheduled_at) : ''
        );
        setForm({
          title: post.title ?? '',
          content: post.content ?? '',
          excerpt: post.excerpt ?? '',
          featuredImageUrl: post.featured_image_url ?? '',
          focusKeyword: post.focus_keyword ?? '',
          metaTitle: post.meta_title ?? '',
          metaDescription: post.meta_description ?? '',
        });
        setReadyToAutosave(true);
      })
      .catch(() => {
        toast.error('Post not found');
        router.push('/dashboard/posts');
      })
      .finally(() => setLoading(false));
  }, [postId, router]);

  const saveChanges = useCallback(
    async (silent = false) => {
      if (!form.title.trim() || !form.content.trim()) {
        if (!silent) toast.error('Title and content are required');
        throw new Error('Title and content are required');
      }

      setSaving(true);
      try {
        await api.updatePost(token, postId, {
          title: form.title,
          content: form.content,
          excerpt: form.excerpt,
          featuredImageUrl: form.featuredImageUrl,
        });
        if (!silent) toast.success('Changes saved');
      } catch (err: any) {
        if (!silent) toast.error(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [
      form.title,
      form.content,
      form.excerpt,
      form.featuredImageUrl,
      postId,
      token,
    ]
  );

  useEffect(() => {
    if (
      !readyToAutosave ||
      !token ||
      !postId ||
      !form.title.trim() ||
      !form.content.trim()
    )
      return;
    const timeout = window.setTimeout(() => {
      void saveChanges(true);
    }, 18000);
    return () => window.clearTimeout(timeout);
  }, [
    readyToAutosave,
    token,
    postId,
    form.title,
    form.content,
    form.excerpt,
    form.featuredImageUrl,
    saveChanges,
  ]);

  const setField = (key: keyof PostEditorForm, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const submitForApproval = async () => {
    setSubmitting(true);
    try {
      await saveChanges(true);
      await api.submitPost(token, postId);
      setStatus('pending_approval');
      toast.success('Post submitted for approval');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const publishPost = async () => {
    setPublishing(true);
    try {
      await saveChanges(true);
      await api.publishPost(token, postId);
      setStatus('published');
      toast.success('Post published');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const schedulePost = async () => {
    if (!scheduleAt) {
      toast.error('Choose a future date and time');
      return;
    }
    setScheduling(true);
    try {
      await saveChanges(true);
      const scheduledAt = new Date(scheduleAt);
      if (Number.isNaN(scheduledAt.getTime()))
        throw new Error('Invalid schedule time');
      await api.schedulePost(token, postId, scheduledAt.toISOString());
      setStatus('scheduled');
      toast.success(`Post scheduled for ${scheduledAt.toLocaleString()}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setScheduling(false);
    }
  };

  const runSEOAnalysis = async () => {
    setSeoLoading(true);
    try {
      await api.saveSEOMeta(token, postId, {
        focus_keyword: form.focusKeyword,
        meta_title: form.metaTitle || form.title,
        meta_description: form.metaDescription || form.excerpt,
      });
      const res = (await api.analyzeSEO(token, postId)) as any;
      setSeoAnalysis(res.data);
      toast.success('SEO analysis updated');
    } catch (err: any) {
      toast.error(`SEO analysis failed: ${err.message}`);
    } finally {
      setSeoLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-empty">Loading editor...</div>;
  }

  return (
    <PostEditorWorkspace
      title="Edit Post"
      description={`Make changes to your post.${status === 'scheduled' && scheduleAt ? ` Scheduled for ${new Date(scheduleAt).toLocaleString()}.` : ''}`}
      status={status}
      form={form}
      onFieldChange={setField}
      seoAnalysis={seoAnalysis}
      actions={
        <>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => void saveChanges()}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => void runSEOAnalysis()}
            disabled={seoLoading}
          >
            {seoLoading ? 'Analyzing...' : 'Analyze SEO'}
          </button>
          {(status === 'draft' || status === 'rejected') && (
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => void submitForApproval()}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
          {(status === 'approved' || status === 'scheduled') && (
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => void publishPost()}
              disabled={publishing}
            >
              {publishing ? 'Publishing...' : 'Publish Now'}
            </button>
          )}
        </>
      }
      sidebarExtra={
        status === 'approved' || status === 'scheduled' ? (
          <section className="editor-side-card">
            <div className="editor-side-card__header">
              <div>
                <p className="section-kicker">Publishing</p>
                <h3>Schedule</h3>
              </div>
            </div>
            <label className="admin-field">
              Publish at
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={event => setScheduleAt(event.target.value)}
                className="admin-input"
              />
            </label>
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => void schedulePost()}
              disabled={scheduling}
              style={{ marginTop: '0.5rem' }}
            >
              {scheduling
                ? 'Scheduling...'
                : status === 'scheduled'
                  ? 'Reschedule'
                  : 'Schedule'}
            </button>
          </section>
        ) : null
      }
    />
  );
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
