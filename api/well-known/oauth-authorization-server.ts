import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const issuer = process.env.OAUTH_ISSUER_URL?.replace(/\/$/, '');
  if (!issuer) {
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }
  res.status(200).json({
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    revocation_endpoint_auth_methods_supported: [
      'client_secret_post',
      'client_secret_basic',
      'none',
    ],
    scopes_supported: ['trello:read', 'trello:write'],
  });
}
