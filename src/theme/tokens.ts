import { ViewStyle, TextStyle } from 'react-native';

export const colors = {
  // Dark-first palette
  background: '#0B0F19',
  surface: '#131C2E',
  surfaceHighlight: '#1E293B',
  surfaceSecondary: '#1E293B',
  
  // Brand / Clinical colors
  primary: '#0EA5E9',       // Primary cyan blue
  primaryActive: '#0284C7', // Primary active
  secondary: '#14B8A6',     // Secondary teal
  
  // Status & Feedback
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#0EA5E9',
  
  // Eye-specific OS / OD colors
  eyeOS: '#0EA5E9',         // Oculus Sinister (Left Eye)
  eyeOD: '#14B8A6',         // Oculus Dexter (Right Eye)
  
  // Text colors
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDisabled: '#475569',
  
  // Borders & Dividers
  border: '#1E293B',
  borderHighlight: '#334155',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  
  // Glassmorphism overlays
  glassBackground: 'rgba(19, 28, 46, 0.75)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassHeaderBg: 'rgba(11, 15, 25, 0.85)',
  glassOverlay: 'rgba(11, 15, 25, 0.85)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
  round: 9999,
} as const;

export const typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glowPrimary: {
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  glowSecondary: {
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;

export interface GlassmorphismStyles {
  glass: ViewStyle;
  glassHeader: ViewStyle;
  glassCard: ViewStyle;
  glassOverlay: ViewStyle;
}

export const glassmorphism: GlassmorphismStyles = {
  glass: {
    backgroundColor: 'rgba(19, 28, 46, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radii.lg,
  },
  glassHeader: {
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  glassCard: {
    backgroundColor: 'rgba(19, 28, 46, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
    borderRadius: radii.lg,
    ...shadows.md,
  },
  glassOverlay: {
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
  },
};

export const themeTokens = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  glassmorphism,
};

export const tokens = themeTokens;

export type ThemeTokens = typeof themeTokens;
