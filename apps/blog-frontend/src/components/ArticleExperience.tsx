'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  postId: string;
  path: string;
  title: string;
  shareUrl: string;
}

export default function ArticleExperience({
  postId,
  path,
  title,
  shareUrl,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const shareLinks = useMemo(
    () => [
      {
        label: 'Copy link',
        action: async () => {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        },
      },
      {
        label: 'LinkedIn',
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      },
      {
        label: 'X',
        href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
      },
    ],
    [shareUrl, title]
  );

  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      setProgress(
        scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0
      );
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      postId,
      path,
      referrer: document.referrer || undefined,
      deviceType:
        window.innerWidth < 720
          ? 'mobile'
          : window.innerWidth < 1100
            ? 'tablet'
            : 'desktop',
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/pageview', blob);
      return;
    }

    fetch('/api/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => null);
  }, [path, postId]);

  const nativeShare = async () => {
    if (!navigator.share) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      return;
    }

    try {
      await navigator.share({ title, url: shareUrl });
    } catch {}
  };

  return (
    <>
      <div className="reading-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="article-share-card">
        <p className="section-kicker">Share</p>
        <button
          type="button"
          className="article-share-card__primary"
          onClick={nativeShare}
        >
          Share this story
        </button>

        <div className="article-share-card__actions">
          {shareLinks.map(link =>
            'href' in link ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="article-share-card__link"
              >
                {link.label}
              </a>
            ) : (
              <button
                key={link.label}
                type="button"
                onClick={link.action}
                className="article-share-card__link"
              >
                {copied ? 'Copied' : link.label}
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}
