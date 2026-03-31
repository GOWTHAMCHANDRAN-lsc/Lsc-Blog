'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import PostEditorWorkspace, {
  type SEOAnalysis,
  type PostEditorForm,
} from '@/components/PostEditorWorkspace';

const EMPTY_FORM: PostEditorForm = {
  title: '',
  content: '',
  excerpt: '',
  featuredImageUrl: '',
  focusKeyword: '',
  metaTitle: '',
  metaDescription: '',
};

export default function NewPostPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [user, setUser] = useState<{
    systemRole: string;
    tenantId: string;
  } | null>(null);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [saving, setSaving] = useState(false);
  const [seoLoading, setSeoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [seoAnalysis, setSeoAnalysis] = useState<SEOAnalysis | null>(null);
  const [form, setForm] = useState<PostEditorForm>(EMPTY_FORM);

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token') ?? '';
    const userData = localStorage.getItem('user');
    setToken(accessToken);

    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        setSelectedTenantId(parsed.tenantId || '');

        if (parsed.systemRole === 'super_admin') {
          api
            .listTenants(accessToken)
            .then((res: any) => {
              setTenants(res.data || []);
            })
            .catch(() => {});
        }
      } catch {}
    }
  }, []);

  const setField = (key: keyof PostEditorForm, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const saveDraft = useCallback(
    async (silent = false) => {
      if (!form.title.trim() || form.title.trim().length < 5) {
        if (!silent) toast.error('Title must be at least 5 characters');
        return null;
      }
      if (!form.content.trim()) {
        if (!silent) toast.error('Content is required');
        return null;
      }

      setSaving(true);
      try {
        if (!postId) {
          const res = (await api.createPost(token, {
            title: form.title,
            content: form.content,
            excerpt: form.excerpt,
            featuredImageUrl: form.featuredImageUrl,
          })) as any;

          const createdId = res.data.id as string;
          setPostId(createdId);

          if (!silent) {
            toast.success('Draft created');
          }
          return createdId;
        }

        await api.updatePost(token, postId, {
          title: form.title,
          content: form.content,
          excerpt: form.excerpt,
          featuredImageUrl: form.featuredImageUrl,
        });

        if (!silent) toast.success('Draft saved');
        return postId;
      } catch (err: any) {
        if (!silent) toast.error(err.message);
        return null;
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
    if (!postId || !token || !form.title.trim() || !form.content.trim()) return;
    const timeout = window.setTimeout(() => {
      void saveDraft(true);
    }, 18000);
    return () => window.clearTimeout(timeout);
  }, [
    postId,
    token,
    form.title,
    form.content,
    form.excerpt,
    form.featuredImageUrl,
    saveDraft,
  ]);

  const runSEOAnalysis = async () => {
    const targetPostId = postId ?? (await saveDraft(true));
    if (!targetPostId) {
      toast.error('Save the draft first to analyze SEO');
      return;
    }

    setSeoLoading(true);
    try {
      await api.saveSEOMeta(token, targetPostId, {
        focus_keyword: form.focusKeyword,
        meta_title: form.metaTitle || form.title,
        meta_description: form.metaDescription || form.excerpt,
      });
      const res = (await api.analyzeSEO(token, targetPostId)) as any;
      setSeoAnalysis(res.data);
      toast.success('SEO analysis updated');
    } catch (err: any) {
      toast.error(`SEO analysis failed: ${err.message}`);
    } finally {
      setSeoLoading(false);
    }
  };

  const submitForApproval = async () => {
    const targetPostId = postId ?? (await saveDraft(true));
    if (!targetPostId) {
      toast.error('Save the draft first before submitting');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitPost(token, targetPostId);
      toast.success('Post submitted for approval');
      router.push('/dashboard/posts');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PostEditorWorkspace
      title="Create New Post"
      description="Write your content, add metadata, and submit for review."
      form={form}
      onFieldChange={setField}
      seoAnalysis={seoAnalysis}
      actions={
        <>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => void saveDraft()}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => void runSEOAnalysis()}
            disabled={seoLoading}
          >
            {seoLoading ? 'Analyzing...' : 'Analyze SEO'}
          </button>
          {postId && (
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => void submitForApproval()}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </>
      }
      sidebarExtra={
        <section className="editor-side-card">
          <div className="editor-side-card__header">
            <div>
              <p className="section-kicker">Workflow</p>
              <h3>Next Steps</h3>
            </div>
          </div>
          <p className="editor-side-card__copy">
            After saving, you can edit metadata, submit for approval, and
            eventually publish.
          </p>
          <button
            type="button"
            className="admin-primary-button"
            onClick={async () => {
              const id = await saveDraft();
              if (id) {
                setPostId(id);
                router.push(`/dashboard/posts/${id}/edit`);
              }
            }}
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create Draft'}
          </button>
          {postId && (
            <button
              type="button"
              className="admin-primary-button"
              style={{ marginTop: '0.5rem', background: 'var(--success)' }}
              onClick={() => void submitForApproval()}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </section>
      }
    />
  );
}
