import { NextRequest } from 'next/server';
import { proxyToAdminApi, createErrorResponse } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return createErrorResponse(
      'INVALID_PAYLOAD',
      'Invalid subscription payload',
      400
    );
  }

  return proxyToAdminApi({
    method: 'POST',
    path: '/api/v1/subscriptions/subscribe',
    request,
    body: payload,
  });
}
