import { NextRequest } from 'next/server';
import { proxyToAdminApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const urlParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    urlParams[key] = value;
  });

  return proxyToAdminApi({
    path: `/api/v1/posts/${params.slug}/comments`,
    request,
    queryParams: urlParams,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== 'object') {
    return proxyToAdminApi({
      path: `/api/v1/posts/${params.slug}/comments`,
      request,
      body: {
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Invalid comment payload' },
      },
    });
  }

  return proxyToAdminApi({
    method: 'POST',
    path: `/api/v1/posts/${params.slug}/comments`,
    request,
    body: payload,
  });
}
