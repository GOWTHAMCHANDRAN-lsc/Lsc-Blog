import { NextRequest, NextResponse } from 'next/server';
import { getTenantDomainKey } from '@/lib/api-proxy';

const PLATFORM_API = process.env.PLATFORM_API_URL;
const API_TOKEN = process.env.PLATFORM_API_TOKEN;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const requestCounts = new Map<string, { count: number; expiresAt: number }>();

interface PageviewBody {
  postId?: string;
  path?: string;
  referrer?: string;
  deviceType?: string;
}

function getClientKey(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'anonymous';
  return `pageview:${ip}`;
}

function applyRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || entry.expiresAt <= now) {
    requestCounts.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

function isValidPath(path: string | undefined): boolean {
  return typeof path === 'string' && path.startsWith('/') && path.length <= 512;
}

function normalizeDeviceType(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return ['desktop', 'tablet', 'mobile'].includes(normalized)
    ? normalized
    : null;
}

export async function POST(req: NextRequest) {
  const limitKey = getClientKey(req);
  if (!applyRateLimit(limitKey)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many analytics events',
        },
      },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json()) as PageviewBody;
    if (!isValidPath(body.path)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PATH', message: 'Invalid path' },
        },
        { status: 400 }
      );
    }

    if (!PLATFORM_API || !API_TOKEN) {
      return NextResponse.json({ success: true, data: { skipped: true } });
    }

    const tenantDomain = getTenantDomainKey(req);

    try {
      await fetch(`${PLATFORM_API}/api/v1/analytics/pageview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-Token': API_TOKEN,
          ...(tenantDomain ? { 'X-Tenant-Domain': tenantDomain } : {}),
        },
        cache: 'no-store',
        body: JSON.stringify({
          postId: body.postId,
          path: body.path,
          referrer: body.referrer?.slice(0, 500) || null,
          deviceType: normalizeDeviceType(body.deviceType),
        }),
      });
    } catch {
      return NextResponse.json({ success: true, data: { forwarded: false } });
    }

    return NextResponse.json({ success: true, data: { forwarded: true } });
  } catch {
    return NextResponse.json({ success: true, data: {} });
  }
}
