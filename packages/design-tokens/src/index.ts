// src/index.ts
// @nettoscorp/design-tokens — public API.
// Design tokens exported as typed values + CSS custom properties (light/dark).

// Tokens
export { lightColors, darkColors, themes, contrastRatio } from './colors';
export type { ColorScale } from './colors';

export { spacing, spacingUnit, spacingPx, spacingCss } from './spacing';
export type { SpacingToken } from './spacing';

export { typeScale, fonts, fontWeight } from './typography';
export type { TypeScaleToken } from './typography';

// CSS custom properties + theme switch
export {
  themeVariables,
  themeCssString,
  lightCss,
  darkCss,
  ThemeSwitcher,
  type ThemeName,
} from './themes';
