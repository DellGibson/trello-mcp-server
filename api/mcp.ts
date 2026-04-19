import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../src/server.js';
import { TrelloOAuthProvider } from '../src/oauth/provider.js';

const provider = new TrelloOAuthProvider();

function sendUnauthorized(res: VercelResponse): void {
  const issuer = process.env.OAUTH_ISSUER_URL?.replace(/\/$/, '') ?? '';
  const prm = `${issuer}/.well-known/oauth-protected-resource`;
  res.setHeader(
    'WWW-Authenticate',
    `Bearer realm="mcp", resource_metadata="${prm}"`,
  );
  res.status(401).json({ error: 'unauthorized' });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const apiKey = process.env.TRELLO_API_KEY;
  const trelloToken = process.env.TRELLO_TOKEN;
  if (!apiKey || !trelloToken || !process.env.OAUTH_JWT_SECRET || !process.env.OAUTH_ISSUER_URL) {
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }

  const authHeader = req.headers.authorization;
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token =
    headerValue && headerValue.startsWith('Bearer ')
      ? headerValue.slice('Bearer '.length).trim()
      : undefined;

  if (!token) {
    sendUnauthorized(res);
    return;
  }

  try {
    await provider.verifyAccessToken(token);
  } catch {
    sendUnauthorized(res);
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer(apiKey, trelloToken);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
