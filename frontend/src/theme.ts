/** Single source of truth for the visual design language.
 *  Change `accent` (and only that) to retheme the entire app. */
export const theme = {
  bg:          '#000000',
  surface:     '#0a0a0a',
  surfaceHigh: '#111111',
  border:      '#1f1f1f',
  borderHigh:  '#2e2e2e',
  accent:      '#e8ff4d',
  accentDim:   'rgba(232,255,77,0.10)',
  accentHover: '#f5ff80',
  text:        '#f2f2f2',
  textMuted:   '#555555',
  textSub:     '#888888',
  radius:      '10px',
  radiusSm:    '6px',
  radiusLg:    '16px',
  shadow:      '0 4px 24px rgba(0,0,0,0.9)',
  shadowSm:    '0 1px 8px rgba(0,0,0,0.7)',
  transition:  '120ms cubic-bezier(0.4,0,0.2,1)',
} as const

export type Theme = typeof theme
