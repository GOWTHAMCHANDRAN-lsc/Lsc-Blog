import Link from 'next/link';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = String(searchParams.token || '').trim();
  const result = token
    ? await unsubscribe(token)
    : { ok: false, message: 'Missing token.' };

  return (
    <section className="empty-state" style={{ textAlign: 'left' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Unsubscribe</h1>
      <p style={{ marginTop: '0.5rem', color: 'var(--blog-muted)' }}>
        {result.ok ? result.message : result.message}
      </p>
      <p style={{ marginTop: '1.2rem' }}>
        <Link href="/" className="site-button">
          Back to homepage
        </Link>
      </p>
    </section>
  );
}

async function unsubscribe(token: string) {
  const apiUrl = process.env.PLATFORM_API_URL;
  if (!apiUrl) {
    return { ok: false, message: 'Platform API is not configured.' };
  }

  const hostHeader =
    headers().get('x-forwarded-host') || headers().get('host') || '';
  const tenantDomain =
    hostHeader
      .toLowerCase()
      .trim()
      .split(',')[0]
      ?.trim()
      .replace(/:\d+$/, '') || '';

  const url = new URL(`${apiUrl}/api/v1/subscriptions/unsubscribe`);
  url.searchParams.set('token', token);

  const res = await fetch(url.toString(), {
    headers: {
      ...(tenantDomain ? { 'X-Tenant-Domain': tenantDomain } : {}),
      ...(process.env.PLATFORM_API_TOKEN
        ? { 'X-API-Token': process.env.PLATFORM_API_TOKEN }
        : {}),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    return {
      ok: false,
      message: data?.error?.message ?? 'Unsubscribe failed.',
    };
  }
  return {
    ok: true,
    message: data?.data?.message ?? 'You have been unsubscribed.',
  };
}
