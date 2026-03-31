'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import api from '@/lib/api';

type MediaRecord = {
  id: string;
  cdn_url: string;
  filename: string;
  mime_type: string;
  created_at: string;
  uploaded_by_name?: string;
};

export default function MediaPickerModal({
  open,
  token,
  title = 'Media library',
  description = 'Upload a new image or pick an existing asset.',
  onClose,
  onSelectUrl,
}: {
  open: boolean;
  token: string;
  title?: string;
  description?: string;
  onClose: () => void;
  onSelectUrl: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [error, setError] = useState('');

  const canUse = open && Boolean(token);

  const sorted = useMemo(
    () =>
      [...media].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [media]
  );

  useEffect(() => {
    if (!canUse) {
      return;
    }

    setLoading(true);
    setError('');
    api
      .listMedia(token)
      .then((res: any) => setMedia(res.data ?? []))
      .catch((err: any) => {
        setMedia([]);
        setError(err?.message ?? 'Unable to load media');
      })
      .finally(() => setLoading(false));
  }, [canUse, token]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const presigned = (await api.createMediaPresignedUpload(token, {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      })) as any;

      const presignedUrl = presigned?.data?.presignedUrl ?? null;
      const cdnUrl = presigned?.data?.cdnUrl ?? null;

      if (presignedUrl && cdnUrl) {
        const putRes = await fetch(presignedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`S3 upload failed: ${putRes.status}`);
        }

        onSelectUrl(cdnUrl);
        onClose();
        return;
      }

      const local = (await api.uploadMediaFile(token, file)) as any;
      const localUrl = local?.data?.cdnUrl || local?.data?.cdn_url;
      if (localUrl) {
        onSelectUrl(localUrl);
        onClose();
        return;
      }

      const refresh = (await api.listMedia(token)) as any;
      setMedia(refresh.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="media-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="media-modal__backdrop"
        aria-label="Close media picker"
        onClick={onClose}
      />
      <div className="media-modal__panel">
        <div className="media-modal__header">
          <div>
            <p className="section-kicker">Assets</p>
            <h3>{title}</h3>
            <p className="media-modal__description">{description}</p>
          </div>

          <div className="media-modal__actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={event =>
                void handleUpload(event.target.files?.[0] ?? null)
              }
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            <button
              type="button"
              className="admin-primary-button"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>

        {error ? (
          <div className="admin-alert" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        ) : null}

        <div className="media-modal__body">
          {loading ? (
            <div className="media-modal__empty">Loading media…</div>
          ) : sorted.length === 0 ? (
            <div className="media-modal__empty">
              No uploads yet. Add your first image.
            </div>
          ) : (
            <div className="media-grid">
              {sorted.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="media-tile"
                  onClick={() => {
                    onSelectUrl(item.cdn_url);
                    onClose();
                  }}
                >
                  <Image
                    src={item.cdn_url}
                    alt={item.filename}
                    width={340}
                    height={240}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                    }}
                  />
                  <div className="media-tile__meta">
                    <span>{item.filename}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
