/**
 * @breezebox/auth
 *
 * All SSO logic for the platform (backbone §5). Tools never reimplement login;
 * they import from here.
 *
 * Because the shell and every tool share one origin per district, one session
 * covers every tool. There is no session hand-off between apps.
 *
 * Server-only entry points live in ./server, client-only ones in ./client, so
 * neither drags the other into a bundle.
 */

export {
  OAUTH_PROVIDERS,
  PROVIDER_LABELS,
  PROVIDER_SCOPES,
  AUTH_CALLBACK_PATH,
  SIGN_IN_PATH,
  SIGN_OUT_PATH,
  AUTH_DENIED_PATH,
  DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  INACTIVITY_WARNING_SECONDS,
  isOAuthProvider,
  safeNextPath,
  type OAuthProvider,
} from './config';

export {
  AUTH_DENIED_REASONS,
  deniedMessage,
  isAuthDeniedReason,
  reasonFromClaimError,
  type AuthDeniedReason,
} from './errors';
