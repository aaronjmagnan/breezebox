/**
 * @breezebox/auth
 *
 * All SSO logic lives here (backbone §5). Tools never reimplement login.
 *
 * What lands in step 4:
 *   - Supabase Auth with Google and Microsoft OAuth
 *   - post-callback email-domain check against districts.sso_domain,
 *     backed by public.claim_staff_membership() in the database
 *   - first-login staff provisioning (created_via = 'sso_first_login')
 *   - redirect through the single Supabase callback, then back to the
 *     district origin
 *   - inactivity auto sign-out, default 30 minutes, per-district override
 */

export {};
