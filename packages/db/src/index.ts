/**
 * @breezebox/db
 *
 * Shared schema types for the one Supabase project every district lives in
 * (backbone §3). Every table here carries district_id and is scoped by RLS;
 * see supabase/migrations/*_rls_policies.sql.
 *
 * This package deliberately exports no client. Clients live in
 * @breezebox/auth so that session handling has exactly one owner (§5).
 */

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  FunctionReturns,
} from './types.js';

import type { Database, Tables, Enums } from './types.js';

// --- Row aliases ------------------------------------------------------------

export type District = Tables<'districts'>;
export type Site = Tables<'sites'>;
export type Staff = Tables<'staff'>;
export type ToolInstance = Tables<'tool_instances'>;
export type SupportTicket = Tables<'support_tickets'>;
export type AccessLogEntry = Tables<'access_log'>;
export type LearningCycleCheckIn = Tables<'learning_cycle_checkins'>;
export type LegalSource = Tables<'legal_sources'>;
export type LegalDocument = Tables<'legal_documents'>;
export type LegalChunk = Tables<'legal_chunks'>;

// --- Enum aliases -----------------------------------------------------------

export type DistrictStatus = Enums<'district_status'>;
export type SiteType = Enums<'site_type'>;
export type StaffRole = Enums<'staff_role'>;
export type StaffStatus = Enums<'staff_status'>;
export type StaffCreatedVia = Enums<'staff_created_via'>;
export type ToolType = Enums<'tool_type'>;
export type ToolInstanceStatus = Enums<'tool_instance_status'>;
export type AccentColor = Enums<'accent_color'>;
export type TicketSource = Enums<'ticket_source'>;
export type TicketStatus = Enums<'ticket_status'>;
export type LegalSourceKind = Enums<'legal_source_kind'>;
export type LegalSourceStatus = Enums<'legal_source_status'>;

/**
 * What get_district_branding() returns for a hostname: the only district
 * fields any anonymous visitor is ever shown (§8). Contract dates and the
 * inactivity timeout are deliberately not in here.
 */
export type DistrictBranding =
  Database['public']['Functions']['get_district_branding']['Returns'][number];

/**
 * One ranked passage from the legal library, as search_legal_chunks() returns
 * it. This is what the Ed Code Assistant puts in front of Claude and then
 * shows as a citation, so the two can never disagree.
 */
export type LegalPassage =
  Database['public']['Functions']['search_legal_chunks']['Returns'][number];

/** A whole section or policy, as lookup_legal_documents() returns it. */
export type LegalLookup =
  Database['public']['Functions']['lookup_legal_documents']['Returns'][number];

/** The four §6 accents, in the order the design tokens list them. */
export const ACCENT_COLORS = ['blue', 'teal', 'amber', 'coral'] as const;

/** Path segments the shell owns; a tool_slug may never take one (§8). */
export const RESERVED_TOOL_SLUGS = [
  'api',
  'auth',
  'manifest',
  'sw',
  'offline',
  'icons',
  'assets',
  'static',
  '_next',
  'signin',
  'sign-in',
  'signout',
  'sign-out',
  'support',
] as const;

/** Hostname labels that never resolve to a district (§8). */
export const RESERVED_SUBDOMAINS = [
  'www',
  'app',
  'api',
  'admin',
  'auth',
  'static',
  'assets',
  'cdn',
] as const;

/** §11 session safety: the default when a district sets no override. */
export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30;

export function isAccentColor(value: string): value is AccentColor {
  return (ACCENT_COLORS as readonly string[]).includes(value);
}

export function isReservedToolSlug(slug: string): boolean {
  return (RESERVED_TOOL_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

export function isReservedSubdomain(label: string): boolean {
  return (RESERVED_SUBDOMAINS as readonly string[]).includes(label.toLowerCase());
}
