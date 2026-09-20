/**
 * Tool declarations (backbone §7, §11).
 *
 * Kept in one small file so an audit can read a tool's category and offline
 * mode without opening anything else.
 */
export const TOOL = {
  slug: '__TOOL_SLUG__',
  name: '__TOOL_NAME__',

  /**
   * §7. One of:
   *   'data'     a scoped view into structured data the user enters
   *   'workflow' acts on data captured elsewhere; roles, status, assignment
   *   'impact'   tied to a named staff member over time; staff_id on every row
   */
  category: 'data',

  /**
   * §11. One of:
   *   'none'    the shell's offline page shows when there is no connection
   *   'capture' photos and forms queue in IndexedDB via @breezebox/pwa
   *
   * Default 'none'. Only choose 'capture' if someone genuinely works where
   * there is no signal; it brings the 72-hour expiry, the sign-out clear, and
   * the "never stored on our servers" conversation with it.
   */
  offline: 'none',
};
