// src/spacing.ts
// Spacing tokens built on the USWDS units() system (8px base unit).
// No magic numbers — every space value is a whole multiple of the unit.

export const spacingUnit = 8; // px

// Token name -> multiplier (in units). Value = multiplier * spacingUnit px.
export const spacing = {
  '1': 1,   // 8px
  '2': 2,   // 16px
  '3': 3,   // 24px
  '4': 4,   // 32px
  '5': 5,   // 40px
  '6': 6,   // 48px
  '8': 8,   // 64px
  '10': 10, // 80px
  '12': 12, // 96px
  '16': 16, // 128px
} as const;

export type SpacingToken = keyof typeof spacing;

// Resolve a spacing token to pixels.
export function spacingPx(token: SpacingToken): number {
  return spacing[token] * spacingUnit;
}

// Resolve a spacing token to a CSS value (px).
export function spacingCss(token: SpacingToken): string {
  return `${spacingPx(token)}px`;
}
