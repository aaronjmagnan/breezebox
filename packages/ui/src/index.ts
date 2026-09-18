/**
 * @breezebox/ui
 *
 * The shared design system (backbone §6). Every tool imports these rather than
 * restyling from scratch, which is what keeps the "same OS feel" across tools.
 *
 * What every component here holds to:
 *   - works from a 360px phone up to a laptop
 *   - tap targets at least 44px (`min-h-tap`)
 *   - nothing is revealed on hover alone
 *   - two font weights only, enforced by the Tailwind preset
 *   - the four accents appear on a glyph or a thin rule, never on a surface
 *
 * Design tokens live in ../tailwind-preset.cjs and ./tokens.css.
 */

export { cn } from './cn';
export { Button, type ButtonProps, type ButtonLinkProps, type ButtonVariant } from './button';
export { Card, type CardProps } from './card';
export { Tile, type TileProps } from './tile';
export { AppHeader, type AppHeaderProps } from './app-header';
export { Icon, ICON_NAMES, isIconName, type IconName } from './icon';
export { Field, TextInput, Select, Textarea, type FieldProps } from './field';
export {
  ChoiceGroup,
  type ChoiceGroupProps,
  type ChoiceOption,
} from './choice';
export {
  Table,
  type TableProps,
  type TableColumn,
  type SortDirection,
} from './table';
