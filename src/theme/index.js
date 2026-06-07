// ============================================================
// POSDEWA Global Design System
// Single source of truth for all UI tokens
// ============================================================

// ── Colors ──────────────────────────────────────────────────
export const Colors = {
  // Brand
  primary: '#03AC0E',         // Tokopedia Green
  primaryDark: '#028A0B',     // Pressed / active state
  primaryLight: '#E8F5E9',    // Chip / tag background
  secondary: '#0A84FF',       // Blue – links, info actions
  secondaryLight: '#E3F2FD',  // Light blue tint

  // Semantic status
  success: '#03AC0E',
  successLight: '#E8F5E9',
  warning: '#FF9500',
  warningLight: '#FFF3E0',
  danger: '#FF3B30',
  dangerLight: '#FFEBEE',
  info: '#0A84FF',
  infoLight: '#EEF5FF',

  // Text hierarchy  (4 levels)
  textPrimary: '#0F172A',     // Headlines, strong labels
  text: '#101828',            // Default body text
  textSecondary: '#374151',   // Sub-labels, card values
  muted: '#6B7280',           // Placeholder, captions
  placeholder: '#9CA3AF',     // Input placeholders

  // Surfaces
  background: '#F4F6F8',      // Screen background
  card: '#FFFFFF',            // Card / panel surface
  cardAlt: '#F9FAFB',         // Alternate card (e.g. inner blocks)
  lightBg: '#F8FAFC',         // Subtle section bg

  // Borders
  border: '#E5E7EB',          // Standard divider
  borderLight: '#F3F4F6',     // Subtle inner divider

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
  overlayLight: 'rgba(0,0,0,0.15)',

  // Backwards-compat aliases (keep so old code doesn't break)
  darkText: '#0F172A',
};

// ── Spacing (4-pt grid) ─────────────────────────────────────
export const Spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ── Border Radii ────────────────────────────────────────────
export const Radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// ── Shadows ─────────────────────────────────────────────────
export const Shadows = {
  // Subtle – list rows, inner cards
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  // Medium – floating panels, modals
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  // Strong – FABs, primary CTAs
  strong: {
    shadowColor: '#03AC0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
};

// ── Type Scale ──────────────────────────────────────────────
// Named by semantic role, not pixel size.
// Import { FontSize } from '../../theme' and use FontSize.body etc.
export const FontSize = {
  xxs: 9,   // micro badge text
  xs: 10,   // chip labels, tiny captions
  sm: 11,   // secondary captions, timestamps
  caption: 12,  // helper text, subtitles below labels
  body: 14,     // default body, list items
  bodyLg: 15,   // slightly larger body (e.g. card value)
  subtitle: 16, // section headers, dialog text
  title: 18,    // screen / card titles
  h3: 20,       // card headings
  h2: 24,       // dashboard stat numbers
  h1: 28,       // hero / landing headings
};

// ── Font Weights ─────────────────────────────────────────────
export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

// ── Pre-composed text styles ─────────────────────────────────
// Usage: import { TextStyles } from '../../theme'
// Then in StyleSheet: ...TextStyles.pageTitle
export const TextStyles = {
  // Screen / page
  pageTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },

  // Cards
  cardTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.regular,
    color: Colors.muted,
  },
  cardValue: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  cardValueLg: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
  },

  // Labels & body
  label: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  labelSm: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: Colors.muted,
  },
  body: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.regular,
    color: Colors.text,
  },
  bodySm: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.regular,
    color: Colors.muted,
  },
  caption: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    color: Colors.muted,
  },

  // Price / amount
  price: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  priceLg: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  profit: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.success,
  },

  // Buttons
  buttonText: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    textAlign: 'center',
  },
  buttonTextSm: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
    textAlign: 'center',
  },

  // Misc
  badge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  muted: {
    fontSize: FontSize.caption,
    color: Colors.muted,
  },
};

// ── Backwards-compat alias ───────────────────────────────────
// Screens that imported Typography will still work.
export const Typography = {
  heading: { fontSize: FontSize.h1, fontWeight: FontWeight.bold },
  subheading: { fontSize: FontSize.h3, fontWeight: FontWeight.semibold },
  label: { fontSize: FontSize.body, fontWeight: FontWeight.medium },
  body: { fontSize: FontSize.body },
  small: { fontSize: FontSize.caption },
};