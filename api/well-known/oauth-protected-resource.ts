import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const issuer = process.env.OAUTH_ISSUER_URL?.replace(/\/$/, '');
  if (!issuer) {
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }
  res.status(200).json({
    resource: `${issuer}/api/mcp`,
    authorization_servers: [issuer],
    scopes_supported: ['trello:read', 'trello:write'],
    resource_name: 'Trello MCP',
    bearer_methods_supported: ['header'],
  });
}
