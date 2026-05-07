// Source of truth for visual tokens. Mirror at src/shared/theme.js (web).
// See docs/rfcs/0001-design-system.md in phytolens-frontendcd

export const palette = {
  bg:        '#000000',
  surface:   '#0a0a0a',
  card:      '#111111',
  cardHi:    '#161616',
  border:    'rgba(255,255,255,0.06)',
  borderHi:  'rgba(255,255,255,0.12)',

  green:     '#30d158',
  greenDim:  'rgba(48,209,88,0.06)',
  greenSoft: 'rgba(48,209,88,0.12)',
  greenGlow: 'rgba(48,209,88,0.25)',

  text:      '#f5f5f7',
  muted:     '#6e6e73',
  dim:       '#3d3d3f',

  warn:      '#FF9800',
  warnBg:    '#1a0f00',
  error:     '#f44336',

  hashBrown: '#a08060',
  otherBlue: '#5a9fd6',
  plantLime: '#9ccc65',
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 18,
};

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
};
