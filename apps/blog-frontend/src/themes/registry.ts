export type ThemeId = 'classic' | 'slate' | 'premium';

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  vars: Record<string, string>;
};

export const THEMES: ThemeDefinition[] = [
  {
    id: 'classic',
    label: 'Classic Editorial',
    vars: {},
  },
  {
    id: 'slate',
    label: 'Slate Modern',
    vars: {
      '--blog-bg': '#0b1220',
      '--blog-bg-alt': '#0f172a',
      '--blog-paper': 'rgba(17, 24, 39, 0.72)',
      '--blog-paper-strong': '#111827',
      '--blog-line': 'rgba(226, 232, 240, 0.14)',
      '--blog-ink': '#e5e7eb',
      '--blog-muted': 'rgba(226, 232, 240, 0.72)',
      '--blog-soft': 'rgba(226, 232, 240, 0.52)',
      '--blog-shadow': '0 24px 70px rgba(0, 0, 0, 0.28)',
    },
  },
  {
    id: 'premium',
    label: 'Premium Light',
    vars: {
      '--blog-bg': '#f7f9fc',
      '--blog-bg-alt': '#ffffff',
      '--blog-paper': '#ffffff',
      '--blog-paper-strong': '#f1f5f9',
      '--blog-line': 'rgba(148, 163, 184, 0.2)',
      '--blog-ink': '#0f172a',
      '--blog-muted': '#334155',
      '--blog-soft': '#64748b',
      '--blog-shadow': '0 15px 35px rgba(15, 23, 42, 0.12)',
      '--btn-primary': '#2065d1',
      '--btn-primary-hover': '#184fb2',
      '--btn-secondary': '#64748b',
      '--btn-border': '#e2e8f0',
      '--brand-gradient': 'linear-gradient(135deg, #2065d1 0%, #5c7bff 100%)',
    },
  },
];

export function resolveTheme(
  themeId: string | null | undefined
): ThemeDefinition {
  const normalized = (themeId || 'premium').toLowerCase();
  return THEMES.find(theme => theme.id === normalized) ?? THEMES[0];
}
