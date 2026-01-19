/**
 * Shared styled avatar component with consistent branding.
 *
 * Replaces duplicate StyledAvatar implementations in:
 * - main-window.tsx
 * - admin-main-window.tsx
 * - profile.tsx
 *
 * @example
 * ```tsx
 * import { StyledAvatar } from '../../components/common/StyledAvatar';
 *
 * <StyledAvatar size="medium">JD</StyledAvatar>
 * <StyledAvatar size="large" src={avatarUrl} />
 * ```
 */
import { styled, Avatar, AvatarProps } from '@mui/material';
import { AccentColors } from '../../theme';

/**
 * Size variants for the StyledAvatar component.
 */
export type StyledAvatarSize = 'small' | 'medium' | 'large';

/**
 * Props for the StyledAvatar component.
 */
export interface StyledAvatarProps extends Omit<AvatarProps, 'size'> {
  /** Avatar size variant */
  size?: StyledAvatarSize;
}

/**
 * Size configuration for each variant.
 * - small: 34px - Used for compact lists
 * - medium: 40px - Default for toolbars and headers
 * - large: 80px - Profile pages
 */
const sizeConfig: Record<StyledAvatarSize, { width: number; height: number; fontSize: string }> = {
  small: { width: 34, height: 34, fontSize: '14px' },
  medium: { width: 40, height: 40, fontSize: '18px' },
  large: { width: 80, height: 80, fontSize: '24px' },
};

/**
 * Styled avatar with consistent brand styling.
 *
 * Features:
 * - WCAG AA compliant purple background (#6B5B95 - 4.7:1 contrast with white)
 * - Gold border matching navigation accent
 * - Three size variants (small, medium, large)
 * - Inherits all MUI Avatar props
 */
export const StyledAvatar = styled(Avatar, {
  shouldForwardProp: (prop) => prop !== 'size',
})<StyledAvatarProps>(({ size = 'medium' }) => ({
  width: sizeConfig[size].width,
  height: sizeConfig[size].height,
  backgroundColor: AccentColors.avatarBackground,
  border: `3px solid ${AccentColors.avatarBorder}`,
  fontSize: sizeConfig[size].fontSize,
  fontWeight: 'bold',
}));

export default StyledAvatar;
