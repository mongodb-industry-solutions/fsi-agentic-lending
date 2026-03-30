import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';

// Map CSS variable names to LeafyGreen palette values
// These are used in JS components; CSS variables remain in globals.css
export const colors = {
  bgVoid: palette.gray.light3,      // #F9FBFA
  bgBase: palette.white,            // #FFFFFF
  bgSurface: '#F1F5F9',             // Keep (no exact LeafyGreen equivalent)
  bgRaised: palette.gray.light2,    // #E8EDEB
  textPrimary: palette.gray.dark3,  // #001E2B
  textSecondary: palette.gray.dark1,// #5C6C75
  textDim: palette.gray.base,       // #89979B
  mongo: palette.green.dark1,       // #00684A
  mongoBright: palette.green.base,  // #00ED64
  danger: palette.red.base,         // #DB3030
  success: palette.green.dark1,     // #00684A
  headerBg: palette.green.dark2,    // #023430
};

// LeafyGreen spacing scale (from @leafygreen-ui/tokens)
export const sp = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48,
};

export { palette, spacing };
