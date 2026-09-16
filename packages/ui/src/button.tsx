import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * The only button in the platform (backbone §6).
 *
 * Every variant clears the 44px tap target. Hover is an enhancement only:
 * focus-visible and active carry the same information, so nothing is
 * discoverable by hover alone, which matters because most of our users are on
 * a touch screen with no hover at all.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BASE =
  'inline-flex min-h-tap items-center justify-center gap-2 rounded-bb px-4 text-base ' +
  'font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-focus focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  // Explicit tokens rather than an alpha of bb-text: see the note in
  // tokens.css about opacity modifiers silently producing nothing.
  primary:
    'bg-bb-invert text-bb-on-invert hover:bg-bb-invert-hover active:bg-bb-invert-active',
  secondary:
    'border border-bb-border bg-bb-surface text-bb-text hover:bg-bb-surface-subtle active:bg-bb-surface-subtle',
  ghost:
    'text-bb-text hover:bg-bb-surface-subtle active:bg-bb-surface-subtle',
};

type CommonProps = {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    href?: undefined;
  };

export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
    href: string;
  };

export function Button(props: ButtonProps | ButtonLinkProps) {
  const { variant = 'secondary', fullWidth, children, className, ...rest } = props;
  const classes = cn(BASE, VARIANTS[variant], fullWidth && 'w-full', className);

  if ('href' in rest && typeof rest.href === 'string') {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} className={classes}>
        {children}
      </a>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button {...buttonRest} type={buttonRest.type ?? 'button'} className={classes}>
      {children}
    </button>
  );
}
