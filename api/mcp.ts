import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { timingSafeEqual } from 'node:crypto';
import { createServer } from '../src/server.js';

function constantTimeMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }
  const expected = `Bearer ${authToken}`;
  const provided = req.headers.authorization;
  if (!constantTimeMatch(Array.isArray(provided) ? provided[0] : provided, expected)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const apiKey = process.env.TRELLO_API_KEY;
  const trelloToken = process.env.TRELLO_TOKEN;
  if (!apiKey || !trelloToken) {
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer(apiKey, trelloToken);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
