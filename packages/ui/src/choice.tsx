'use client';

import { useId } from 'react';
import { cn } from './cn';

/**
 * Tap-to-select controls (backbone §6).
 *
 * Radio inputs under the surface rather than buttons with state, so arrow keys
 * work, a screen reader announces "2 of 3", and the browser handles grouping.
 * The visible chip is the label; the input itself is hidden but focusable, and
 * focus is drawn on the label through peer-focus-visible.
 *
 * Selection is shown by border weight and text colour, never by colour alone,
 * and never by hover.
 */

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  /** Optional short line under the label, e.g. what a level means. */
  hint?: string;
};

export type ChoiceGroupProps<T extends string> = {
  name: string;
  legend: string;
  /** Visually hide the legend when a Field label already says the same thing. */
  hideLegend?: boolean;
  options: ReadonlyArray<ChoiceOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  /** 'segmented' fills the row evenly; 'chips' wraps to content width. */
  variant?: 'segmented' | 'chips';
  disabled?: boolean;
  className?: string;
};

export function ChoiceGroup<T extends string>({
  name,
  legend,
  hideLegend,
  options,
  value,
  onChange,
  variant = 'chips',
  disabled,
  className,
}: ChoiceGroupProps<T>) {
  const id = useId();

  return (
    <fieldset className={cn('min-w-0', className)} disabled={disabled}>
      <legend className={cn('text-sm font-semibold text-bb-text', hideLegend && 'sr-only')}>
        {legend}
      </legend>

      <div
        className={cn(
          'mt-2 gap-2',
          variant === 'segmented' ? 'grid grid-cols-3' : 'flex flex-wrap',
        )}
      >
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const selected = value === option.value;

          return (
            <div key={option.value} className={variant === 'chips' ? '' : 'min-w-0'}>
              <input
                type="radio"
                id={optionId}
                name={`${name}-${id}`}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={optionId}
                className={cn(
                  'flex min-h-tap cursor-pointer select-none flex-col justify-center',
                  'rounded-bb border px-3 py-2 text-center text-base',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-bb-focus',
                  'peer-focus-visible:ring-offset-2',
                  selected
                    ? 'border-bb-text bg-bb-surface-subtle font-semibold text-bb-text'
                    : 'border-bb-border bg-bb-surface text-bb-muted',
                )}
              >
                <span>{option.label}</span>
                {option.hint ? (
                  <span className="mt-0.5 text-xs font-normal leading-snug text-bb-muted">
                    {option.hint}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
