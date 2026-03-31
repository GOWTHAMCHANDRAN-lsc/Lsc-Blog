'use client';

import { useState } from 'react';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your email');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message ?? 'Unable to subscribe');
      }
      setStatus('success');
      setMessage(data?.data?.message ?? 'Thanks for subscribing!');
      setEmail('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message ?? 'Unable to subscribe');
    }
  };

  return (
    <form
      onSubmit={submit}
      className="newsletter-form"
      aria-label="Subscribe to newsletter"
    >
      <label htmlFor="newsletter-email" className="visually-hidden">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Your email address"
        required
        aria-describedby="newsletter-message"
      />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
      </button>
      {message && (
        <p
          id="newsletter-message"
          style={{
            fontSize: '0.8rem',
            marginTop: '0.5rem',
            opacity: status === 'error' ? 1 : 0.9,
          }}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
    </form>
  );
}
