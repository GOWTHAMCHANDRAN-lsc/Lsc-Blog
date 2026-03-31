'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import MediaPickerModal from '@/components/MediaPickerModal';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

interface LinkModalProps {
  open: boolean;
  initialUrl: string;
  onClose: () => void;
  onConfirm: (url: string, openInNewTab: boolean) => void;
}

function LinkModal({ open, initialUrl, onClose, onConfirm }: LinkModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [newTab, setNewTab] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
    }
  }, [open, initialUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="link-modal-overlay" onClick={onClose}>
      <div className="link-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="link-modal-header">
          <h3>Insert Link</h3>
          <button type="button" className="link-modal-close" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="link-modal-body">
          <label className="link-modal-field">
            <span>URL</span>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
          </label>
          <label className="link-modal-checkbox">
            <input
              type="checkbox"
              checked={newTab}
              onChange={e => setNewTab(e.target.checked)}
            />
            <span>Open in new tab</span>
          </label>
        </div>
        <div className="link-modal-footer">
          <button
            type="button"
            className="admin-secondary-button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-primary-button"
            onClick={() => {
              if (url.trim()) {
                onConfirm(url.trim(), newTab);
              }
            }}
          >
            Insert Link
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RichEditor({
  value,
  onChange,
  placeholder = 'Start with a strong opening. Structure the story like a finished article, not raw notes.',
}: Props) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalUrl, setLinkModalUrl] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    setToken(localStorage.getItem('access_token') ?? '');
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        allowBase64: false,
      }),
      CharacterCount,
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: 'admin-rich-editor__content',
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = editor.getHTML();
    const normalizedIncoming = value || '<p></p>';
    if (current !== normalizedIncoming) {
      editor.commands.setContent(normalizedIncoming, false);
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="admin-rich-editor__loading">Loading editor...</div>;
  }

  const handleLinkClick = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkModalUrl(previousUrl);
    setLinkModalOpen(true);
  };

  const handleLinkConfirm = (url: string, newTab: boolean) => {
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          href: url,
          target: newTab ? '_blank' : undefined,
          rel: newTab ? 'noopener noreferrer' : undefined,
        })
        .run();
    }
    setLinkModalOpen(false);
  };

  const characterCount = editor.storage.characterCount.characters();
  const wordCount = editor.storage.characterCount.words();

  return (
    <div className="admin-rich-editor">
      <div className="admin-rich-editor__toolbar">
        <div className="admin-rich-editor__group">
          <ToolbarButton
            label="B"
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="I"
            title="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="S"
            title="Strike"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
        </div>

        <div className="admin-rich-editor__group">
          <ToolbarButton
            label="P"
            title="Paragraph"
            active={editor.isActive('paragraph')}
            onClick={() => editor.chain().focus().setParagraph().run()}
          />
          <ToolbarButton
            label="H2"
            title="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          />
          <ToolbarButton
            label="H3"
            title="Heading 3"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          />
        </div>

        <div className="admin-rich-editor__group">
          <ToolbarButton
            label="Bullet list"
            title="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="1. List"
            title="Ordered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="Quote"
            title="Blockquote"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
        </div>

        <div className="admin-rich-editor__group">
          <ToolbarButton
            label="Link"
            title="Insert link"
            active={editor.isActive('link')}
            onClick={handleLinkClick}
          />
          <ToolbarButton
            label="Image"
            title="Insert image"
            onClick={() => setMediaOpen(true)}
          />
          <ToolbarButton
            label="Code"
            title="Code block"
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
        </div>

        <div className="admin-rich-editor__group">
          <ToolbarButton
            label="Undo"
            title="Undo"
            disabled={!editor.can().chain().focus().undo().run()}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            label="Redo"
            title="Redo"
            disabled={!editor.can().chain().focus().redo().run()}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>
      </div>

      <EditorContent editor={editor} />

      <div className="admin-rich-editor__footer">
        <span>{wordCount} words</span>
        <span>{characterCount} characters</span>
      </div>

      <MediaPickerModal
        open={mediaOpen}
        token={token}
        title="Insert an image"
        description="Upload a new image or insert an existing one into the story."
        onClose={() => setMediaOpen(false)}
        onSelectUrl={url => {
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }}
      />

      <LinkModal
        open={linkModalOpen}
        initialUrl={linkModalUrl}
        onClose={() => setLinkModalOpen(false)}
        onConfirm={handleLinkConfirm}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`admin-rich-editor__button ${active ? 'is-active' : ''}`}
    >
      {label}
    </button>
  );
}
