import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TrelloClient } from '../services/trello.js';

export function registerSearchTools(server: McpServer, client: TrelloClient): void {
  server.registerTool('trello_search', {
    title: 'Search Trello',
    description: `Search cards and/or boards. types: 'cards'|'boards'|'both'. limit: 1-20.`,
    inputSchema: {
      query: z.string().min(1).max(200).describe("Search query"),
      types: z.enum(['cards','boards','both']).default('both'),
      limit: z.number().int().min(1).max(20).default(10)
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ query, types, limit }) => {
    const modelTypes = types === 'both' ? ['cards','boards'] : [types];
    const results = await client.search(query, modelTypes, limit);
    const lines: string[] = [];
    if (results.boards?.length) {
      lines.push(`**Boards (${results.boards.length}):**`);
      for (const b of results.boards) lines.push(`  • ${b.name} (${b.id}) — ${b.url}`);
    }
    if (results.cards?.length) {
      lines.push(`\n**Cards (${results.cards.length}):**`);
      for (const c of results.cards) {
        lines.push(`  • ${c.name} (${c.id})`);
        if (c.desc) lines.push(`    ${String(c.desc).slice(0,80)}${String(c.desc).length > 80 ? '…' : ''}`);
        lines.push(`    ${c.url}`);
      }
    }
    if (!lines.length) lines.push(`No results found for "${query}"`);
    return { content: [{ type: 'text', text: lines.join('\n') }], structuredContent: results };
  });
}
