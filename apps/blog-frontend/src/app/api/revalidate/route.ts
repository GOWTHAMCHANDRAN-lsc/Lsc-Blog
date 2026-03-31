import { revalidateTag, revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTenantDomainKey } from '@/lib/api-proxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-webhook-signature');
    const secret = process.env.WEBHOOK_SECRET;

    if (!secret) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'Webhook secret not configured',
          },
        },
        { status: 500 }
      );
    }

    const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
    if (signature !== expected) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' },
        },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body) as {
      event: string;
      tenantId?: string;
      postId?: string;
      postSlug?: string;
    };

    const tenantKey = getTenantDomainKey(req) || 'unknown-tenant';
    const tenantPostsTag = `tenant-${tenantKey}-posts`;
    const tenantConfigTag = `tenant-${tenantKey}-config`;
    const tenantCategoriesTag = `tenant-${tenantKey}-categories`;

    switch (payload.event) {
      case 'post.published':
      case 'post.updated':
      case 'post.unpublished':
        revalidateTag(tenantPostsTag);
        if (payload.postSlug) {
          revalidateTag(`post-${tenantKey}-${payload.postSlug}`);
          revalidatePath(`/${payload.postSlug}`);
        }
        revalidatePath('/');
        break;

      case 'comment.approved':
        if (payload.postSlug) {
          revalidateTag(`post-${tenantKey}-${payload.postSlug}`);
          revalidateTag(`post-${tenantKey}-${payload.postSlug}-comments`);
          revalidatePath(`/${payload.postSlug}`);
        }
        break;

      case 'config.updated':
        revalidateTag(tenantConfigTag);
        revalidatePath('/', 'layout');
        break;

      case 'category.updated':
        revalidateTag(tenantCategoriesTag);
        revalidatePath('/categories');
        break;

      default:
        break;
    }

    return NextResponse.json({
      success: true,
      data: { revalidated: true, event: payload.event },
    });
  } catch (err) {
    console.error('Revalidation webhook error:', err);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal error' },
      },
      { status: 500 }
    );
  }
}
