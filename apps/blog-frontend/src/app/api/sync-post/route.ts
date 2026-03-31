import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'saas_blog',
};

async function query(sql: string, params: any[]) {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(DB_CONFIG);
  const [rows] = await connection.execute(sql, params);
  await connection.end();
  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');
    const tenantId = headersList.get('x-tenant-id');

    if (!apiKey || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    const tenants = (await query(
      'SELECT blog_api_key FROM tenants WHERE id = ?',
      [tenantId]
    )) as any[];

    if (!tenants.length || tenants[0].blog_api_key !== apiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const payload = await request.json();
    const {
      id,
      title,
      slug,
      content,
      excerpt,
      featured_image_url,
      status,
      published_at,
      categories: _categories,
      tags: _tags,
    } = payload;

    if (!id || !title || !slug || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const existingPosts = (await query(
      'SELECT id FROM posts WHERE tenant_id = ? AND (id = ? OR slug = ?)',
      [tenantId, id, slug]
    )) as any[];

    if (existingPosts.length > 0) {
      await query(
        `UPDATE posts SET 
          title = ?, content = ?, excerpt = ?, featured_image_url = ?, 
          status = ?, published_at = ?, updated_at = NOW()
         WHERE tenant_id = ? AND (id = ? OR slug = ?)`,
        [
          title,
          content,
          excerpt || '',
          featured_image_url || '',
          status,
          published_at,
          tenantId,
          id,
          slug,
        ]
      );
    } else {
      await query(
        `INSERT INTO posts (id, tenant_id, title, slug, content, excerpt, featured_image_url, status, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          tenantId,
          title,
          slug,
          content,
          excerpt || '',
          featured_image_url || '',
          status,
          published_at,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Post synced successfully',
      postId: id,
      slug,
    });
  } catch (error: any) {
    console.error('Sync post error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
