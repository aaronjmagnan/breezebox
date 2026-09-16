/** Server-only surface of @breezebox/auth. */

export { serverClient } from './clients/server';
export { refreshSession } from './clients/middleware';
export { completeOAuthCallback, type CallbackResult } from './callback';
export { getSessionContext, type SessionContext } from './session';
