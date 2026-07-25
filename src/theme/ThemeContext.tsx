import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { themeTokens, ThemeTokens } from './tokens';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextValue {
  theme: ThemeTokens;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialMode = 'dark',
}) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = useMemo(
    () => ({
      theme: themeTokens,
      mode,
      setMode,
      toggleTheme,
      isDark: mode === 'dark',
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: themeTokens,
      mode: 'dark',
      setMode: () => {},
      toggleTheme: () => {},
      isDark: true,
    };
  }
  return context;
};
