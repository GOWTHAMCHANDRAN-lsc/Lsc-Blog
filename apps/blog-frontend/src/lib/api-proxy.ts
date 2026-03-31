import { NextRequest, NextResponse } from 'next/server';

const PLATFORM_API = process.env.PLATFORM_API_URL;
const API_TOKEN = process.env.PLATFORM_API_TOKEN;

export function getTenantDomainKey(request: NextRequest): string {
  const hostHeader =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    '';
  const host = hostHeader.toLowerCase().trim().split(',')[0]?.trim() ?? '';
  return host.replace(/:\d+$/, '');
}

export interface ProxyOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  request: NextRequest;
  body?: unknown;
  queryParams?: Record<string, string>;
}

export async function proxyToAdminApi({
  method = 'GET',
  path,
  request,
  body,
  queryParams,
}: ProxyOptions): Promise<NextResponse> {
  if (!PLATFORM_API) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Platform API is not configured',
        },
      },
      { status: 500 }
    );
  }

  const url = new URL(`${PLATFORM_API}${path}`);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const forwardHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (API_TOKEN) {
    forwardHeaders['X-API-Token'] = API_TOKEN;
  }

  const tenantDomain = getTenantDomainKey(request);
  if (tenantDomain) {
    forwardHeaders['X-Tenant-Domain'] = tenantDomain;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    forwardHeaders['X-Forwarded-For'] = forwardedFor;
  }

  const userAgent = request.headers.get('user-agent');
  if (userAgent) {
    forwardHeaders['User-Agent'] = userAgent;
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: forwardHeaders,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UPSTREAM_ERROR',
            message: 'Failed to parse upstream response',
          },
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: `Failed to reach platform API: ${message}`,
        },
      },
      { status: 502 }
    );
  }
}

export function createErrorResponse(
  code: string,
  message: string,
  status = 400
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export function createSuccessResponse(
  data: unknown,
  meta?: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(
    { success: true, data, ...(meta && { meta }) },
    { status }
  );
}
