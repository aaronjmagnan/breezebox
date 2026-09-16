/**
 * Breeze Box design tokens (backbone §6).
 *
 * The shell and every tool extend this preset rather than defining their own
 * scale, which is what keeps the "same OS feel" across tools.
 *
 * Two rules this file exists to enforce:
 *
 *  1. TWO FONT WEIGHTS ONLY. `fontWeight` is replaced, not extended, so
 *     `font-bold`, `font-light` and friends simply do not exist. If a design
 *     seems to need a third weight, it needs a size or color change instead.
 *
 *  2. THE FOUR ACCENTS ARE USED SPARINGLY, NEVER AS BACKGROUNDS. Tailwind
 *     generates `bg-accent-*` whether we like it or not, so this is a
 *     convention, not a compile error: accents are for an icon, a thin rule,
 *     a focus ring. Surfaces stay neutral. In the shell, Tile is the only
 *     component that touches an accent at all.
 *
 * Both are redefined under `prefers-color-scheme: dark` in tokens.css, so a
 * component never knows which mode it is in.
 *
 * Do NOT use an opacity modifier on these (`bg-bb-text/90`). The variables
 * hold hex, not channels, and Tailwind silently emits nothing rather than
 * warning. Hover and pressed states have their own tokens for that reason.
 *
 * Each accent comes in two tones:
 *   - the soft §6 tone, for decorative marks where contrast does not apply
 *   - `-ink`, darkened to at least 5.9:1 on white, for anything that carries
 *     meaning (icons, text). Use the soft tone for rules, ink for glyphs.
 */
module.exports = {
  theme: {
    // Replaced, not extended. See rule 1 above.
    fontWeight: {
      normal: '400',
      semibold: '600',
    },
    extend: {
      colors: {
        bb: {
          bg: 'var(--bb-bg)',
          surface: 'var(--bb-surface)',
          'surface-subtle': 'var(--bb-surface-subtle)',
          border: 'var(--bb-border)',
          text: 'var(--bb-text)',
          muted: 'var(--bb-text-muted)',
          focus: 'var(--bb-focus)',
          invert: 'var(--bb-invert)',
          'invert-hover': 'var(--bb-invert-hover)',
          'invert-active': 'var(--bb-invert-active)',
          'on-invert': 'var(--bb-on-invert)',
        },
        accent: {
          blue: 'var(--bb-accent-blue)',
          'blue-ink': 'var(--bb-accent-blue-ink)',
          teal: 'var(--bb-accent-teal)',
          'teal-ink': 'var(--bb-accent-teal-ink)',
          amber: 'var(--bb-accent-amber)',
          'amber-ink': 'var(--bb-accent-amber-ink)',
          coral: 'var(--bb-accent-coral)',
          'coral-ink': 'var(--bb-accent-coral-ink)',
        },
      },
      fontFamily: {
        // System stack on purpose: no webfont request, no layout shift, and
        // it already looks native inside the installed app on every platform.
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        bb: '0.75rem',
      },
      ringOffsetColor: {
        // Tailwind's default is a hard-coded white, which draws a white halo
        // around every focused control in dark mode.
        DEFAULT: 'var(--bb-bg)',
      },
      minHeight: {
        // §6: tap targets at least 44px. Never go below this on anything
        // interactive.
        tap: '2.75rem',
      },
      minWidth: {
        tap: '2.75rem',
      },
      screens: {
        // §6: everything works from a 360px phone up. This is the floor we
        // design to, not a breakpoint to hide things below.
        xs: '360px',
      },
    },
  },
  plugins: [],
};
