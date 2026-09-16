import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * The district's identity at the top of every shell screen (backbone §8):
 * icon and name, with room for one or two actions.
 *
 * The icon is a plain <img>, not next/image: it is a district-supplied URL on
 * an arbitrary host, and routing it through the optimizer would mean
 * whitelisting every district's image domain.
 */
export type AppHeaderProps = {
  districtName: string;
  iconUrl?: string | null;
  actions?: ReactNode;
  /**
   * Render the district name as the page's h1. The landing page sets this,
   * because §8 makes the district name and icon the top of that page rather
   * than decoration above it.
   */
  asHeading?: boolean;
  className?: string;
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AppHeader({
  districtName,
  iconUrl,
  actions,
  asHeading = false,
  className,
}: AppHeaderProps) {
  const Name = asHeading ? 'h1' : 'span';
  return (
    <header
      className={cn(
        'flex items-center gap-3 border-b border-bb-border bg-bb-surface px-4 py-3',
        className,
      )}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bb-surface-subtle text-sm font-semibold text-bb-muted"
        >
          {initials(districtName)}
        </span>
      )}

      {/*
        Wraps to two lines rather than truncating. A district's name is its
        identity in the installed app, and "Demo Unified S..." on a 360px
        phone is the wrong thing to save four pixels on.
      */}
      <Name className="min-w-0 flex-1 text-balance text-base font-semibold leading-tight text-bb-text [overflow-wrap:anywhere]">
        {districtName}
      </Name>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
