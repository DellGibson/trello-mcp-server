import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TrelloClient } from './services/trello.js';
import { registerBoardTools } from './tools/boards.js';
import { registerCardTools } from './tools/cards.js';
import { registerSearchTools } from './tools/search.js';

export function createServer(apiKey: string, token: string): McpServer {
  const client = new TrelloClient(apiKey, token);
  const server = new McpServer({ name: 'trello-mcp-server', version: '1.0.0' });
  registerBoardTools(server, client);
  registerCardTools(server, client);
  registerSearchTools(server, client);
  return server;
}
