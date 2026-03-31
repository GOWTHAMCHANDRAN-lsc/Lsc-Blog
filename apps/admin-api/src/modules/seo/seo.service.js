const db = require('../../config/database');
const { AppError } = require('../../utils/errors');

// Optional deps — graceful fallback if not installed
let readability;
try {
  readability = require('text-readability');
} catch {
  readability = null;
}

class SEOService {
  async analyzePost(postId, tenantId) {
    const post = await db.queryOne(
      `
      SELECT p.title, p.content, p.excerpt, p.word_count, p.slug, p.id,
             sm.meta_title, sm.meta_description, sm.focus_keyword,
             sm.og_title, sm.og_image_url
      FROM posts p
      LEFT JOIN seo_meta sm ON sm.post_id = p.id
      WHERE p.id = ? AND p.tenant_id = ?`,
      [postId, tenantId]
    );

    if (!post) throw new AppError('Post not found', 404);

    const plainText = this._stripHtml(post.content);
    const keyword = post.focus_keyword || '';
    const wordCount =
      post.word_count || plainText.split(/\s+/).filter(Boolean).length;

    const [title, meta, kwDensity, readable, headings, links, length] =
      await Promise.all([
        Promise.resolve(
          this._analyzeTitle(post.title, post.meta_title, keyword)
        ),
        Promise.resolve(
          this._analyzeMetaDescription(post.meta_description, keyword)
        ),
        Promise.resolve(this._analyzeKeywordDensity(plainText, keyword)),
        Promise.resolve(this._analyzeReadability(plainText)),
        Promise.resolve(this._analyzeHeadingStructure(post.content, keyword)),
        this._analyzeInternalLinks(post.content, tenantId, postId),
        Promise.resolve(this._analyzeContentLength(wordCount)),
      ]);

    const score = Math.round(
      title.score * 0.2 +
        meta.score * 0.15 +
        kwDensity.score * 0.15 +
        readable.score * 0.2 +
        headings.score * 0.15 +
        links.score * 0.1 +
        length.score * 0.05
    );

    await db.query(
      `UPDATE seo_meta SET seo_score = ?, readability_score = ?, keyword_density = ?
       WHERE post_id = ?`,
      [score, readable.fleschScore || 0, kwDensity.density || 0, postId]
    );

    return {
      score,
      suggestions: [
        ...title.suggestions,
        ...meta.suggestions,
        ...kwDensity.suggestions,
        ...readable.suggestions,
        ...headings.suggestions,
        ...links.suggestions,
        ...length.suggestions,
      ],
      details: {
        title,
        meta,
        keyword: kwDensity,
        readability: readable,
        headings,
        links,
        length,
      },
    };
  }

  async saveSeoMeta(postId, tenantId, data) {
    const fields = [
      'meta_title',
      'meta_description',
      'canonical_url',
      'og_title',
      'og_description',
      'og_image_url',
      'twitter_card',
      'focus_keyword',
      'robots',
      'schema_markup',
    ];
    const updates = [];
    const params = [];
    fields.forEach(f => {
      if (data[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(data[f]);
      }
    });
    if (!updates.length) return;
    params.push(postId, tenantId);
    await db.query(
      `UPDATE seo_meta SET ${updates.join(', ')} WHERE post_id = ? AND tenant_id = ?`,
      params
    );
  }

  // ── Analyzers ──────────────────────────────────────────────────────────────

  _analyzeTitle(rawTitle, metaTitle, keyword) {
    const title = metaTitle || rawTitle || '';
    const suggestions = [];
    let score = 100;

    if (!title)
      return {
        score: 0,
        suggestions: [
          {
            type: 'error',
            field: 'meta_title',
            message: 'SEO title is missing.',
            fix: 'Add an SEO title (50–60 chars).',
          },
        ],
      };

    if (title.length < 30) {
      suggestions.push({
        type: 'warning',
        field: 'meta_title',
        message: `Title too short (${title.length} chars). Aim for 50–60.`,
        fix: 'Expand the title with more descriptive keywords.',
      });
      score -= 20;
    } else if (title.length > 60) {
      suggestions.push({
        type: 'warning',
        field: 'meta_title',
        message: `Title too long (${title.length} chars). Google truncates after ~60.`,
        fix: `Shorten to: "${title.substring(0, 57)}..."`,
      });
      score -= 15;
    }

    if (keyword) {
      if (!title.toLowerCase().includes(keyword.toLowerCase())) {
        suggestions.push({
          type: 'error',
          field: 'meta_title',
          message: `Focus keyword "${keyword}" not in SEO title.`,
          fix: 'Place the keyword at the start of the title.',
        });
        score -= 30;
      } else if (title.toLowerCase().startsWith(keyword.toLowerCase())) {
        suggestions.push({
          type: 'success',
          field: 'meta_title',
          message: 'Focus keyword is at the start of the title. ✓',
        });
      }
    } else {
      score -= 10;
      suggestions.push({
        type: 'suggestion',
        field: 'focus_keyword',
        message: 'Set a focus keyword to unlock full SEO analysis.',
      });
    }

    if (!suggestions.some(s => s.type === 'error' || s.type === 'warning')) {
      suggestions.push({
        type: 'success',
        field: 'meta_title',
        message: 'Title looks great! ✓',
      });
    }

    return { score: Math.max(0, score), length: title.length, suggestions };
  }

  _analyzeMetaDescription(metaDesc, keyword) {
    const suggestions = [];
    let score = 100;

    if (!metaDesc || !metaDesc.trim()) {
      return {
        score: 0,
        suggestions: [
          {
            type: 'error',
            field: 'meta_description',
            message: 'Meta description is missing.',
            fix: 'Add a compelling meta description of 120–160 characters.',
          },
        ],
      };
    }

    const len = metaDesc.trim().length;
    if (len < 120) {
      suggestions.push({
        type: 'warning',
        field: 'meta_description',
        message: `Meta description too short (${len} chars). Aim for 120–160.`,
      });
      score -= 20;
    } else if (len > 160) {
      suggestions.push({
        type: 'warning',
        field: 'meta_description',
        message: `Meta description too long (${len} chars). Will be truncated in search results.`,
      });
      score -= 15;
    }

    if (keyword && !metaDesc.toLowerCase().includes(keyword.toLowerCase())) {
      suggestions.push({
        type: 'error',
        field: 'meta_description',
        message: `Focus keyword "${keyword}" not in meta description.`,
      });
      score -= 25;
    }

    const ctaPattern =
      /\b(learn|discover|find out|read|get|start|explore|see|understand)\b/i;
    if (!ctaPattern.test(metaDesc)) {
      suggestions.push({
        type: 'suggestion',
        field: 'meta_description',
        message:
          'Consider adding a call-to-action (e.g., "Learn how...", "Discover...").',
      });
      score -= 5;
    }

    if (score >= 85) {
      suggestions.push({
        type: 'success',
        field: 'meta_description',
        message: 'Meta description looks great! ✓',
      });
    }

    return { score: Math.max(0, score), length: len, suggestions };
  }

  _analyzeKeywordDensity(text, keyword) {
    if (!keyword)
      return { score: 50, density: 0, occurrences: 0, suggestions: [] };

    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const kWords = keyword.toLowerCase().split(/\s+/);
    let occurrences = 0;

    for (let i = 0; i <= words.length - kWords.length; i++) {
      if (kWords.every((kw, j) => words[i + j] === kw)) occurrences++;
    }

    const density = words.length > 0 ? (occurrences / words.length) * 100 : 0;
    const suggestions = [];
    let score = 100;

    if (density === 0) {
      suggestions.push({
        type: 'error',
        field: 'keyword',
        message: `Focus keyword "${keyword}" not found in content.`,
        fix: 'Use your focus keyword naturally throughout the article.',
      });
      score = 0;
    } else if (density < 0.5) {
      suggestions.push({
        type: 'warning',
        field: 'keyword',
        message: `Keyword density is low (${density.toFixed(2)}%). Use it a bit more.`,
      });
      score = 60;
    } else if (density > 3.0) {
      suggestions.push({
        type: 'error',
        field: 'keyword',
        message: `Keyword density too high (${density.toFixed(2)}%). Looks like keyword stuffing.`,
        fix: 'Use semantic synonyms and related phrases instead.',
      });
      score = 30;
    } else {
      suggestions.push({
        type: 'success',
        field: 'keyword',
        message: `Good keyword density: ${density.toFixed(2)}% (${occurrences} uses). ✓`,
      });
    }

    return {
      score,
      density: parseFloat(density.toFixed(2)),
      occurrences,
      suggestions,
    };
  }

  _analyzeReadability(text) {
    const suggestions = [];
    let fleschScore = 60; // default neutral

    if (readability) {
      try {
        fleschScore = readability.fleschReadingEase(text);
      } catch (err) {
        fleschScore = 60;
      }
    } else {
      // Simple estimate: penalize long sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgLen =
        sentences.reduce((s, c) => s + c.split(/\s+/).length, 0) /
        (sentences.length || 1);
      fleschScore = Math.max(0, Math.min(100, 100 - avgLen * 2));
    }

    let score;
    if (fleschScore >= 70) {
      score = 100;
      suggestions.push({
        type: 'success',
        field: 'readability',
        message: `Excellent readability (score: ${Math.round(fleschScore)}). Easy to read! ✓`,
      });
    } else if (fleschScore >= 50) {
      score = 70;
      suggestions.push({
        type: 'warning',
        field: 'readability',
        message: `Moderate readability (${Math.round(fleschScore)}). Simplify where possible.`,
        fix: 'Use shorter sentences and everyday vocabulary.',
      });
    } else {
      score = 40;
      suggestions.push({
        type: 'error',
        field: 'readability',
        message: `Low readability (${Math.round(fleschScore)}). Content may be too complex.`,
        fix: 'Break long paragraphs, use bullet points, simplify vocabulary.',
      });
    }

    return { score, fleschScore: Math.round(fleschScore), suggestions };
  }

  _analyzeHeadingStructure(html, keyword) {
    const headings = { h1: [], h2: [], h3: [] };
    const pattern = /<h([123])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let m;
    while ((m = pattern.exec(html)) !== null) {
      headings[`h${m[1]}`].push(this._stripHtml(m[2]));
    }

    const suggestions = [];
    let score = 100;

    if (headings.h1.length === 0) {
      suggestions.push({
        type: 'error',
        field: 'headings',
        message: 'No H1 heading found in content.',
        fix: 'Add exactly one H1 heading at the top of your post.',
      });
      score -= 40;
    } else if (headings.h1.length > 1) {
      suggestions.push({
        type: 'warning',
        field: 'headings',
        message: `Multiple H1 tags (${headings.h1.length}). Use only one per page.`,
      });
      score -= 20;
    }

    if (headings.h2.length === 0) {
      suggestions.push({
        type: 'warning',
        field: 'headings',
        message:
          'No H2 subheadings found. Add subheadings to structure your content.',
        fix: 'Break content into sections using H2 headings.',
      });
      score -= 20;
    } else if (keyword) {
      const kwInH2 = headings.h2.some(h =>
        h.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!kwInH2) {
        suggestions.push({
          type: 'suggestion',
          field: 'headings',
          message: `Focus keyword not in any H2 subheading.`,
          fix: 'Include your keyword in at least one H2 heading.',
        });
        score -= 10;
      }
    }

    if (headings.h3.length > 0 && headings.h2.length === 0) {
      suggestions.push({
        type: 'warning',
        field: 'headings',
        message: 'H3 used without H2 — maintain proper heading hierarchy.',
      });
      score -= 10;
    }

    if (score >= 85) {
      suggestions.push({
        type: 'success',
        field: 'headings',
        message: `Good heading structure: ${headings.h2.length} H2 subheadings. ✓`,
      });
    }

    return { score: Math.max(0, score), headings, suggestions };
  }

  async _analyzeInternalLinks(content, tenantId, postId) {
    const links = [];
    const pattern = /href=["']([^"']*?)["']/gi;
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const href = m[1];
      if (
        !href.startsWith('http') ||
        href.includes(process.env.PLATFORM_DOMAIN || 'platform.com')
      ) {
        links.push(href);
      }
    }

    const suggestions = [];
    let score = 100;

    if (links.length === 0) {
      score = 40;
      suggestions.push({
        type: 'warning',
        field: 'internal_links',
        message: 'No internal links found.',
        fix: 'Add 2–5 links to related posts to improve crawlability and time-on-site.',
      });

      const related = await db.query(
        `
        SELECT p.slug, p.title FROM posts p
        JOIN post_status ps ON ps.post_id = p.id AND ps.status = 'published'
          AND ps.id = (SELECT id FROM post_status WHERE post_id = p.id ORDER BY id DESC LIMIT 1)
        WHERE p.tenant_id = ? AND p.id != ?
        ORDER BY ps.published_at DESC LIMIT 5`,
        [tenantId, postId]
      );

      if (related.length) {
        suggestions.push({
          type: 'suggestion',
          field: 'internal_links',
          message: 'Posts you could link to:',
          relatedPosts: related,
        });
      }
    } else if (links.length < 2) {
      score = 70;
      suggestions.push({
        type: 'suggestion',
        field: 'internal_links',
        message: `Only ${links.length} internal link. Aim for 3–5.`,
      });
    } else {
      suggestions.push({
        type: 'success',
        field: 'internal_links',
        message: `${links.length} internal link${links.length !== 1 ? 's' : ''} found. ✓`,
      });
    }

    return { score, count: links.length, links, suggestions };
  }

  _analyzeContentLength(wordCount) {
    const suggestions = [];
    let score;

    if (wordCount < 300) {
      score = 20;
      suggestions.push({
        type: 'error',
        field: 'content_length',
        message: `Very short content (${wordCount} words). Add more depth.`,
        fix: 'Aim for at least 600 words. Longer posts tend to rank better.',
      });
    } else if (wordCount < 600) {
      score = 50;
      suggestions.push({
        type: 'warning',
        field: 'content_length',
        message: `Content is below recommended length (${wordCount} words).`,
        fix: 'Expand to 1,000+ words for better search visibility.',
      });
    } else if (wordCount >= 1500) {
      score = 100;
      suggestions.push({
        type: 'success',
        field: 'content_length',
        message: `Excellent content length: ${wordCount} words! ✓`,
      });
    } else {
      score = 80;
      suggestions.push({
        type: 'success',
        field: 'content_length',
        message: `Good content length: ${wordCount} words. ✓`,
      });
    }

    return { score, wordCount, suggestions };
  }

  _stripHtml(html) {
    return (html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = new SEOService();
