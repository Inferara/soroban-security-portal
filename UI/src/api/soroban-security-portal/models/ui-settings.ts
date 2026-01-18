/**
 * @deprecated This file is deprecated and will be removed in a future version.
 *
 * Migration guide:
 * - Replace `defaultUiSettings.editControlSize` with `formControlWidth` from 'theme/responsive'
 * - Replace `defaultUiSettings.editAreaStyle` with `editAreaStyle` from 'theme/responsive'
 * - Replace `defaultUiSettings.listAreaStyle` with `listAreaStyle` from 'theme/responsive'
 * - Move `allowedFileExtensions` to file-utils.ts or a constants file
 *
 * New imports:
 * ```typescript
 * import { formControlWidth, editAreaStyle, listAreaStyle } from '../../../theme';
 * ```
 *
 * @see theme/constants.ts for centralized theme constants
 * @see theme/responsive.ts for responsive SxProps utilities
 */
import { Layout, FormDimensions } from '../../../theme';

/**
 * @deprecated Use responsive utilities from theme/responsive.ts instead.
 */
class DefaultUiSettings {
  /**
   * @deprecated Use `formControlWidth` from theme/responsive instead for responsive behavior.
   */
  editControlSize: string = `${FormDimensions.controlWidth.lg}`;

  /**
   * @deprecated Use `editAreaStyle` from theme/responsive instead.
   */
  editAreaStyle: React.CSSProperties = {
    height: `calc(-${Layout.appBarOffset}px + 120vh)`,
    display: 'flow-root',
    position: 'relative'
  };

  /**
   * @deprecated Use `listAreaStyle` from theme/responsive instead.
   * Note: The 110vw width has been fixed to 100% to prevent horizontal scrolling.
   */
  listAreaStyle: React.CSSProperties = {
    height: `calc(-${Layout.appBarOffset}px + 120vh)`,
    display: 'flow-root',
    width: '100%'  // Changed from 110vw to fix horizontal scrolling
  };

  /**
   * Allowed file extensions for uploads.
   * TODO: Consider moving to utils/file-utils.ts or a dedicated config file.
   */
  allowedFileExtensions = [
    'png', 'jpg', 'bmp', 'pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md',
    'wav', 'wma', 'webm', 'mp3', 'cs', 'sql', 'js', 'ts', 'html',
    'json', 'xml', 'yml', 'yaml', 'py', 'zip'
  ];
}

/**
 * @deprecated Use theme utilities instead. See migration guide above.
 */
export const defaultUiSettings: DefaultUiSettings = new DefaultUiSettings();
