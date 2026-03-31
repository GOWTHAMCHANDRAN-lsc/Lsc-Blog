'use client';

import { useState, useTransition } from 'react';
import type { Comment } from '@/lib/api';

type Props = {
  postSlug: string;
  moderationMode: 'off' | 'manual' | 'auto';
  initialComments: Comment[];
};

export default function CommentSection({ postSlug, initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    authorName: '',
    authorEmail: '',
    content: '',
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');

    startTransition(async () => {
      try {
        const res = await fetch(`/api/comments/${postSlug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok || !data.success)
          throw new Error(data.error?.message || 'Failed to submit');

        if (data.data?.comment) setComments(c => [...c, data.data.comment]);
        setMessage(data.data?.message || 'Comment submitted for review');
        setForm({ authorName: '', authorEmail: '', content: '' });
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Failed to submit');
      }
    });
  };

  return (
    <section className="comments-section">
      <h3>Comments ({comments.length})</h3>

      <form className="comment-form" onSubmit={submit}>
        <div className="comment-form-row">
          <div className="form-group">
            <label htmlFor="comment-author-name" className="visually-hidden">
              Your name
            </label>
            <input
              id="comment-author-name"
              type="text"
              placeholder="Your name"
              value={form.authorName}
              onChange={e =>
                setForm(f => ({ ...f, authorName: e.target.value }))
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="comment-author-email" className="visually-hidden">
              Your email
            </label>
            <input
              id="comment-author-email"
              type="email"
              placeholder="Your email"
              value={form.authorEmail}
              onChange={e =>
                setForm(f => ({ ...f, authorEmail: e.target.value }))
              }
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="comment-content" className="visually-hidden">
            Your comment
          </label>
          <textarea
            id="comment-content"
            placeholder="Write a comment..."
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            required
          />
        </div>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Submitting...' : 'Post Comment'}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'var(--bg-light)',
            borderRadius: 'var(--radius)',
          }}
        >
          {message}
        </p>
      )}

      <div className="comment-list">
        {comments.length === 0 ? (
          <p
            style={{
              color: 'var(--text-light)',
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-header">
                <span className="comment-author">{comment.author_name}</span>
                <span className="comment-date">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="comment-content">{comment.content}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
