// src/typography.ts
// Type scale tokens (USWDS-aligned). Sizes in rem so they respect the user's
// browser font-size setting ($theme-respect-user-font-size).

export type TypeScaleToken = '1' | '2' | '3' | '4' | '5' | '6';

export const typeScale = {
  '1': { size: '0.75rem', lineHeight: '1rem', letterSpacing: '0.02em' },   // caption / overline
  '2': { size: '0.875rem', lineHeight: '1.25rem', letterSpacing: '0.01em' }, // small
  '3': { size: '1rem', lineHeight: '1.5rem', letterSpacing: '0' },          // body base
  '4': { size: '1.125rem', lineHeight: '1.75rem', letterSpacing: '0' },     // body large
  '5': { size: '1.25rem', lineHeight: '2rem', letterSpacing: '0' },         // heading small
  '6': { size: '1.5rem', lineHeight: '2.25rem', letterSpacing: '-0.01em' }, // heading
} as const;

export const fonts = {
  sans: '"Public Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"Source Code Code", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
