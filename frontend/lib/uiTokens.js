import { palette } from '@leafygreen-ui/palette';

export const uiTokens = {
  surface1: '#fff',
  railBg: '#FAFBFA',

  borderDefault: palette.gray.light2,
  borderStrong: palette.gray.light1,

  shadowCard: '0 1px 3px rgba(0, 0, 0, 0.04)',
  shadowHover: '0 4px 12px rgba(20, 23, 26, 0.06)',
  shadowSelected: '0 8px 24px rgba(0, 104, 74, 0.08)',
  shadowElevated: '0 4px 16px rgba(0, 0, 0, 0.06)',

  transitionFast: '150ms cubic-bezier(0.33, 1, 0.68, 1)',
  transitionMedium: '220ms cubic-bezier(0.33, 1, 0.68, 1)',
  transitionInteractive:
    'color 0.15s ease, background-color 0.15s ease, box-shadow 0.2s ease, border-color 0.15s ease, transform 0.2s ease',

  font: "'Euclid Circular A', sans-serif",
  monoFont: "'Source Code Pro', monospace",

  focusRing: `0 0 0 2px ${palette.blue.light2}`,

  captionSize: 11,
  bodySize: 13,
  labelSize: 12,
  displaySize: 16,
};
