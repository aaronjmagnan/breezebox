import type { SVGProps } from 'react';

/**
 * The shared icon set (backbone §6). `tool_instances.icon` holds one of these
 * names; anything unrecognised falls back to a monogram drawn by Tile.
 *
 * Deliberately tiny and inline. An icon library would be a dependency, a
 * bundle, and a licence for six glyphs.
 *
 * All paths are drawn on a 24x24 grid with a 1.75 stroke so they sit evenly
 * next to each other at 24px and stay legible at 20px.
 */
const PATHS = {
  clipboard:
    'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Zm-2 2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1M9 12h6M9 16h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  camera:
    'M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  users:
    'M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 18.5V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  calendar:
    'M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Zm4-3v4m8-4v4M4 10h16',
  book:
    'M12 6.5C10.5 5 8.5 4.5 6 4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1c-2.5 0-4.5.5-6 2Zm0 0V20',
  check: 'M4 12.5 9.5 18 20 6',
} as const;

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function isIconName(value: string | null | undefined): value is IconName {
  return value != null && value in PATHS;
}

export function Icon({
  name,
  ...props
}: { name: IconName } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
