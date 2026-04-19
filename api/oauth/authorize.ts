import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { TrelloOAuthProvider } from '../../src/oauth/provider.js';

let app: express.Express | undefined;
function getApp(): express.Express {
  if (app) return app;
  const a = express();
  a.use(express.urlencoded({ extended: false }));
  a.use(express.json());
  a.use(authorizationHandler({ provider: new TrelloOAuthProvider(), rateLimit: false }));
  app = a;
  return a;
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  getApp()(req as unknown as express.Request, res as unknown as express.Response);
}
