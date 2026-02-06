/**
 * Application constants
 *
 * IMPORTANT: Update TUNNEL_URL when restarting Cloudflare tunnel
 */

// Cloudflare tunnel URL - update this when tunnel restarts
const TUNNEL_URL = 'https://atomic-floyd-couple-portrait.trycloudflare.com';

// API base URL
export const API_URL = __DEV__
  ? `${TUNNEL_URL}/api`
  : 'https://api.ankora.study/api';

// Frontend web URL (for OAuth callbacks)
export const FRONTEND_URL = __DEV__
  ? 'http://localhost:5173'
  : 'https://ankora.study';

// OAuth deep link scheme
export const OAUTH_REDIRECT_SCHEME = 'ankora';
