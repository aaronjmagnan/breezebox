import type { AccentColor } from '@breezebox/db';
import { cn } from './cn';
import { Icon, isIconName } from './icon';

/**
 * A tool tile on the district landing page (backbone §8).
 *
 * The one place an accent appears in the shell, and it appears twice: as the
 * glyph color and as a thin rule down the left edge. The surface stays
 * neutral, per §6.
 *
 * The whole tile is the tap target, far above the 44px floor. Nothing is
 * revealed on hover: the name and description are always visible, so a touch
 * user sees exactly what a mouse user sees.
 */
export type TileProps = {
  href: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  accent?: AccentColor;
  className?: string;
};

const RULE: Record<AccentColor, string> = {
  blue: 'before:bg-accent-blue',
  teal: 'before:bg-accent-teal',
  amber: 'before:bg-accent-amber',
  coral: 'before:bg-accent-coral',
};

const GLYPH: Record<AccentColor, string> = {
  blue: 'text-accent-blue-ink',
  teal: 'text-accent-teal-ink',
  amber: 'text-accent-amber-ink',
  coral: 'text-accent-coral-ink',
};

/** First letter of the tool name, for a tool with no icon set. */
function monogram(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export function Tile({
  href,
  name,
  description,
  icon,
  accent = 'blue',
  className,
}: TileProps) {
  return (
    <a
      href={href}
      className={cn(
        'relative flex min-h-tap flex-col overflow-hidden rounded-bb border border-bb-border',
        'bg-bb-surface p-4 pl-5 no-underline',
        // The accent rule. before: rather than a border so it follows the
        // rounded corner cleanly.
        'before:absolute before:inset-y-0 before:left-0 before:w-1',
        RULE[accent],
        'transition-colors hover:bg-bb-surface-subtle active:bg-bb-surface-subtle',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-focus focus-visible:ring-offset-2',
        className,
      )}
    >
      <span className={cn('flex h-6 w-6 items-center justify-center', GLYPH[accent])}>
        {isIconName(icon) ? (
          <Icon name={icon} className="h-6 w-6" />
        ) : (
          <span aria-hidden="true" className="text-base font-semibold">
            {monogram(name)}
          </span>
        )}
      </span>

      <span className="mt-3 text-base font-semibold text-bb-text">{name}</span>

      {description ? (
        <span className="mt-1 text-sm leading-relaxed text-bb-muted">{description}</span>
      ) : null}
    </a>
  );
}
