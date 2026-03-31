const sanitizeHtml = require('sanitize-html');

const RICH_TEXT_OPTIONS = {
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
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  selfClosing: ['img', 'br', 'hr'],
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || '';
      const isSafeHref = /^(https?:|mailto:|\/|#)/i.test(href);
      const nextAttribs = isSafeHref ? { href } : { href: '#' };

      if (/^https?:/i.test(href)) {
        nextAttribs.target = '_blank';
        nextAttribs.rel = 'noopener noreferrer';
      }

      return {
        tagName,
        attribs: nextAttribs,
      };
    },
    img: (tagName, attribs) => {
      const src = attribs.src || '';
      if (!/^(https?:|data:)/i.test(src)) {
        return {
          tagName: 'span',
          text: '',
        };
      }

      return {
        tagName,
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

const EMBED_MARKUP_OPTIONS = {
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
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        href: sanitizeExternalUrl(attribs.href) || '#',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
    iframe: (tagName, attribs) => {
      const src = sanitizeExternalUrl(attribs.src);
      if (!src) {
        return { tagName: 'span', text: '' };
      }

      return {
        tagName,
        attribs: {
          src,
          title: attribs.title || 'Embedded content',
          loading: 'lazy',
          allow: attribs.allow || '',
          allowfullscreen: 'true',
        },
      };
    },
  },
};

function sanitizeRichText(value = '') {
  return sanitizeHtml(value, RICH_TEXT_OPTIONS).trim();
}

function sanitizePlainText(value = '', maxLength = 500) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeExternalUrl(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return /^https?:\/\/[^\s]+$/i.test(value.trim()) ? value.trim() : null;
}

function sanitizeEmbedMarkup(value = '') {
  const sanitized = sanitizeHtml(value, EMBED_MARKUP_OPTIONS)
    .replace(/<span><\/span>/g, '')
    .trim();
  return sanitized || null;
}

module.exports = {
  sanitizeRichText,
  sanitizePlainText,
  sanitizeExternalUrl,
  sanitizeEmbedMarkup,
};
