// src/themes.ts
// CSS custom properties for light / dark themes + theme switch (dark/light toggle).
// Exported as CSS variable maps so consumers can inject them into :root / [data-theme="dark"].

import { themes } from './colors';
import { spacing, spacingUnit, spacingCss } from './spacing';
import { typeScale, fonts, fontWeight } from './typography';

export type ThemeName = 'light' | 'dark';

// CSS variable name for each design token.
const VAR_PREFIX = 'nsc';

// Build a Record<cssVariable, value> for a theme.
export function themeVariables(theme: ThemeName): Record<string, string> {
  const colors = themes[theme];
  const vars: Record<string, string> = {
    // Spacing (px values + unit)
    [`--${VAR_PREFIX}-spacing-unit`]: `${spacingUnit}px`,
    ...Object.entries(spacing).reduce<Record<string, string>>(
      (acc, [token, mult]) => {
        acc[`--${VAR_PREFIX}-space-${token}`] = `${mult * spacingUnit}px`;
        return acc;
      },
      {}
    ),

    // Typography
    [`--${VAR_PREFIX}-font-sans`]: fonts.sans,
    [`--${VAR_PREFIX}-font-mono`]: fonts.mono,
    ...Object.entries(typeScale).reduce<Record<string, string>>(
      (acc, [token, spec]) => {
        acc[`--${VAR_PREFIX}-type-${token}-size`] = spec.size;
        acc[`--${VAR_PREFIX}-type-${token}-line-height`] = spec.lineHeight;
        acc[`--${VAR_PREFIX}-type-${token}-letter-spacing`] = spec.letterSpacing;
        return acc;
      },
      {}
    ),
    ...Object.entries(fontWeight).reduce<Record<string, string>>(
      (acc, [token, weight]) => {
        acc[`--${VAR_PREFIX}-font-weight-${token}`] = String(weight);
        return acc;
      },
      {}
    ),

    // Colors
    ...Object.entries(colors).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        acc[`--${VAR_PREFIX}-color-${key}`] = value;
        return acc;
      },
      {}
    ),
  };
  return vars;
}

// Serialize a theme variable map to a CSS declaration block string.
export function themeCssString(theme: ThemeName): string {
  const vars = themeVariables(theme);
  const declarations = Object.entries(vars)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');
  return `${theme === 'dark' ? '[data-theme="dark"]' : ':root'} {\n${declarations}\n}\n`;
}

// Light theme CSS block (inject into :root).
export const lightCss = themeCssString('light');
// Dark theme CSS block (inject into [data-theme="dark"]).
export const darkCss = themeCssString('dark');

// Runtime theme switch. Toggles a data-theme attribute on the document root.
// Persists choice in localStorage and respects prefers-color-scheme as fallback.
export class ThemeSwitcher {
  private root: Element;
  private storedTheme: ThemeName | null = null;

  constructor(root?: Element) {
    if (root) {
      this.root = root;
    } else if (typeof document !== 'undefined' && document.documentElement) {
      this.root = document.documentElement;
    } else {
      throw new Error('ThemeSwitcher requires a root Element or a DOM document.');
    }
  }

  /** Read the active theme from the DOM attribute. */
  get current(): ThemeName {
    const attr = this.root.getAttribute('data-theme');
    return (attr === 'light' || attr === 'dark') ? attr : 'light';
  }

  /** Set the theme, update the attribute, and persist to localStorage. */
  set(theme: ThemeName) {
    this.root.setAttribute('data-theme', theme);
    this.root.classList.toggle('theme-dark', theme === 'dark');
    this.root.classList.toggle('theme-light', theme === 'light');
    try {
      localStorage.setItem('nsc-theme', theme);
    } catch {
      // storage may be blocked; ignore
    }
  }

  /** Initialize: prefer stored choice, then OS preference, then light. */
  init(): ThemeName {
    let theme: ThemeName = 'light';
    try {
      const stored = localStorage.getItem('nsc-theme') as ThemeName | null;
      if (stored === 'light' || stored === 'dark') {
        theme = stored;
      } else if (typeof window !== 'undefined' && window.matchMedia) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
    } catch {
      theme = 'light';
    }
    this.set(theme);
    return theme;
  }

  /** Toggle between light and dark. Returns the new theme. */
  toggle(): ThemeName {
    const next = this.current === 'light' ? 'dark' : 'light';
    this.set(next);
    return next;
  }
}
