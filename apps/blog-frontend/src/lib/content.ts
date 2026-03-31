import sanitizeHtml from 'sanitize-html';

export interface TableOfContentsItem {
  id: string;
  label: string;
  level: 2 | 3;
}

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'div',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'blockquote',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    h2: ['id'],
    h3: ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  selfClosing: ['img', 'br', 'hr'],
  transformTags: {
    a: (_tagName, attribs) => {
      const href = attribs.href || '';
      const safeHref = /^(https?:|mailto:|\/|#)/i.test(href) ? href : '#';
      const nextAttribs: Record<string, string> = { href: safeHref };

      if (/^https?:/i.test(safeHref)) {
        nextAttribs.target = '_blank';
        nextAttribs.rel = 'noopener noreferrer';
      }

      return { tagName: 'a', attribs: nextAttribs };
    },
    img: (_tagName, attribs) => {
      const src = attribs.src || '';
      if (!/^(https?:|data:)/i.test(src)) {
        return { tagName: 'span', attribs: {}, text: '' };
      }

      return {
        tagName: 'img',
        attribs: {
          src,
          alt: attribs.alt || '',
          title: attribs.title || '',
          loading: 'lazy',
        },
      };
    },
  },
};

const EMBED_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['div', 'span', 'p', 'a', 'noscript', 'iframe'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    iframe: [
      'src',
      'title',
      'width',
      'height',
      'loading',
      'allow',
      'allowfullscreen',
    ],
  },
  allowedSchemes: ['http', 'https'],
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        href: isSafeExternalLink(attribs.href) ? attribs.href : '#',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
    iframe: (_tagName, attribs) => {
      if (!isSafeExternalLink(attribs.src)) {
        return { tagName: 'span', attribs: {}, text: '' };
      }

      return {
        tagName: 'iframe',
        attribs: {
          src: attribs.src,
          title: attribs.title || 'Embedded content',
          loading: 'lazy',
          allow: attribs.allow || '',
          allowfullscreen: 'true',
        },
      };
    },
  },
};

export function prepareArticleContent(rawHtml: string) {
  const sanitized = sanitizeHtml(rawHtml || '', ARTICLE_SANITIZE_OPTIONS);
  const toc: TableOfContentsItem[] = [];
  const headingCounts = new Map<string, number>();

  const html = sanitized.replace(
    /<h([23])>([\s\S]*?)<\/h\1>/gi,
    (_match, level, innerHtml) => {
      const cleanText = stripHtml(innerHtml).trim();
      if (!cleanText) {
        return `<h${level}>${innerHtml}</h${level}>`;
      }

      const baseSlug = slugify(cleanText) || `section-${toc.length + 1}`;
      const nextCount = (headingCounts.get(baseSlug) ?? 0) + 1;
      headingCounts.set(baseSlug, nextCount);

      const id = nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;
      toc.push({
        id,
        label: cleanText,
        level: Number(level) as 2 | 3,
      });

      return `<h${level} id="${id}">${innerHtml}</h${level}>`;
    }
  );

  return { html, toc };
}

export function sanitizeEmbedMarkup(rawHtml: string | null | undefined) {
  if (!rawHtml) {
    return null;
  }

  const sanitized = sanitizeHtml(rawHtml, EMBED_SANITIZE_OPTIONS).trim();
  return sanitized || null;
}

export function stripHtml(value: string) {
  return sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSafeExternalLink(value: string | undefined | null) {
  return typeof value === 'string' && /^https?:\/\/[^\s]+$/i.test(value.trim());
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
