import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * A neutral surface (backbone §6). Never carries an accent: accents belong on
 * a glyph or a thin rule, not on a panel.
 */
export type CardProps = {
  as?: ElementType;
  padding?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>;

const PADDING = {
  sm: 'p-4',
  md: 'p-5',
} as const;

export function Card({
  as: Component = 'div',
  padding = 'md',
  children,
  className,
  ...rest
}: CardProps) {
  return (
    <Component
      {...rest}
      className={cn(
        'rounded-bb border border-bb-border bg-bb-surface',
        PADDING[padding],
        className,
      )}
    >
      {children}
    </Component>
  );
}
