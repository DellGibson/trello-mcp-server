#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

async function main(): Promise<void> {
  const server = createServer(getEnvOrThrow('TRELLO_API_KEY'), getEnvOrThrow('TRELLO_TOKEN'));
  await server.connect(new StdioServerTransport());
  process.stderr.write('Trello MCP server running on stdio\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${String(error)}\n`);
  process.exit(1);
});
