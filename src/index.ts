import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TrelloClient } from './services/trello.js';
import { registerBoardTools } from './tools/boards.js';
import { registerCardTools } from './tools/cards.js';
import { registerSearchTools } from './tools/search.js';

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

async function main(): Promise<void> {
  const apiKey = getEnvOrThrow('TRELLO_API_KEY');
  const token = getEnvOrThrow('TRELLO_TOKEN');
  const client = new TrelloClient(apiKey, token);
  const server = new McpServer({ name: 'trello-mcp-server', version: '1.0.0' });
  registerBoardTools(server, client);
  registerCardTools(server, client);
  registerSearchTools(server, client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Trello MCP server running on stdio\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${String(error)}\n`);
  process.exit(1);
});
