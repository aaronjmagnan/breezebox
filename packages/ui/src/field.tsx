import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { cn } from './cn';

/**
 * Form primitives (backbone §6).
 *
 * Every control here clears 44px, takes a 16px font so iOS does not zoom the
 * viewport on focus, and pairs with a real <label>. Hints and errors are
 * wired through aria-describedby rather than left as nearby text.
 */

const CONTROL =
  'min-h-tap w-full rounded-bb border border-bb-border bg-bb-surface px-3 text-base ' +
  'text-bb-text placeholder:text-bb-muted ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-focus ' +
  'disabled:opacity-60';

export type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy?: string }) => ReactNode;
  className?: string;
};

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-bb-text">
        {label}
        {required ? (
          <span className="font-normal text-bb-muted"> (required)</span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="text-sm leading-relaxed text-bb-muted">
          {hint}
        </p>
      ) : null}

      {children({ id, describedBy })}

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-accent-coral-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, className)} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(CONTROL, 'pr-8', className)}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={cn(CONTROL, 'min-h-[5.5rem] py-2 leading-relaxed', className)}
    />
  );
}
