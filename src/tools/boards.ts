import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TrelloClient } from '../services/trello.js';

export function registerBoardTools(server: McpServer, client: TrelloClient): void {

  server.registerTool('trello_list_boards', {
    title: 'List My Trello Boards',
    description: `List all Trello boards. filter: 'open'|'closed'|'all'. Returns id, name, desc, url.`,
    inputSchema: { filter: z.enum(['open','closed','all']).default('open').describe("Board state filter") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ filter }) => {
    const boards = await client.getMyBoards(filter);
    const text = boards.length === 0 ? 'No boards found.'
      : boards.map(b => `• ${b.name} (${b.id})${b.desc ? ` — ${b.desc}` : ''}`).join('\n');
    return { content: [{ type: 'text', text }], structuredContent: { boards } };
  });

  server.registerTool('trello_get_board', {
    title: 'Get Board Details',
    description: `Get full details for a board: lists, members, labels. Requires board_id.`,
    inputSchema: { board_id: z.string().min(1).describe("Trello board ID") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ board_id }) => {
    const [board, lists, members, labels] = await Promise.all([
      client.getBoard(board_id), client.getBoardLists(board_id),
      client.getBoardMembers(board_id), client.getBoardLabels(board_id)
    ]);
    const text = [
      `**${board.name}**`, board.desc || '', `URL: ${board.url}`,
      `\nLists: ${lists.map(l => `${l.name} (${l.id})`).join(', ')}`,
      `Members: ${members.map(m => `${m.fullName} (${m.id})`).join(', ')}`,
      `Labels: ${labels.filter(l => l.name).map(l => `${l.name}/${l.color} (${l.id})`).join(', ')}`
    ].filter(Boolean).join('\n');
    return { content: [{ type: 'text', text }], structuredContent: { board, lists, members, labels } };
  });

  server.registerTool('trello_list_board_cards', {
    title: 'List All Cards on a Board',
    description: `Get all cards on a board. filter: 'open'|'closed'|'all'. Returns cards with list name, due, labels.`,
    inputSchema: {
      board_id: z.string().min(1).describe("Trello board ID"),
      filter: z.enum(['open','closed','all']).default('open').describe("Card state filter")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ board_id, filter }) => {
    const [cards, lists] = await Promise.all([client.getBoardCards(board_id, filter), client.getBoardLists(board_id, 'all')]);
    const listMap = new Map(lists.map(l => [l.id, l.name]));
    const text = cards.length === 0 ? 'No cards found.'
      : cards.map(c => [
          `• **${c.name}** (${c.id})`,
          `  List: ${listMap.get(c.idList) ?? c.idList}`,
          c.due ? `  Due: ${new Date(c.due).toLocaleDateString()}${c.dueComplete ? ' ✓' : ''}` : '',
          c.labels.length ? `  Labels: ${c.labels.map((l: { name: string; color: string }) => l.name || l.color).join(', ')}` : ''
        ].filter(Boolean).join('\n')).join('\n\n');
    return { content: [{ type: 'text', text }], structuredContent: { cards: cards.map(c => ({ ...c, listName: listMap.get(c.idList) })) } };
  });

  server.registerTool('trello_update_board', {
    title: 'Update Trello Board',
    description: `Update board fields: rename, change description, or archive/unarchive. Only provide fields to change. All fields optional except board_id.`,
    inputSchema: {
      board_id: z.string().min(1).describe("Trello board ID"),
      name: z.string().min(1).max(16384).optional().describe("New board name"),
      desc: z.string().max(16384).optional().describe("New description (Markdown supported)"),
      closed: z.boolean().optional().describe("Archive (true) or unarchive (false) the board")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ board_id, name, desc, closed }) => {
    const board = await client.updateBoard(board_id, { name, desc, closed });
    const changed = [
      name !== undefined ? `name→"${board.name}"` : '',
      desc !== undefined ? 'description' : '',
      closed === true ? 'archived' : '',
      closed === false ? 'unarchived' : ''
    ].filter(Boolean).join(', ');
    return { content: [{ type: 'text', text: `Updated board (${board.id})${changed ? `: ${changed}` : ''}` }], structuredContent: board };
  });

  server.registerTool('trello_create_list', {
    title: 'Create List on Board',
    description: `Add a new list to a board. pos: 'top'|'bottom'.`,
    inputSchema: {
      board_id: z.string().min(1).describe("Trello board ID"),
      name: z.string().min(1).max(512).describe("List name"),
      pos: z.enum(['top','bottom']).default('bottom').describe("Position on board")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ board_id, name, pos }) => {
    const list = await client.createList(board_id, name, pos);
    return { content: [{ type: 'text', text: `Created list "${list.name}" (${list.id})` }], structuredContent: list };
  });

  server.registerTool('trello_update_list', {
    title: 'Update Trello List',
    description: `Update list fields: rename, archive/unarchive, move to a different board, or reposition. Only provide fields to change. All fields optional except list_id.`,
    inputSchema: {
      list_id: z.string().min(1).describe("Trello list ID"),
      name: z.string().min(1).max(512).optional().describe("New list name"),
      closed: z.boolean().optional().describe("Archive (true) or unarchive (false) the list"),
      board_id: z.string().min(1).optional().describe("Move list to this board ID"),
      pos: z.enum(['top','bottom']).optional().describe("Reposition within board")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ list_id, name, closed, board_id, pos }) => {
    const list = await client.updateList(list_id, { name, closed, idBoard: board_id, pos });
    const changed = [
      name !== undefined ? `name→"${list.name}"` : '',
      closed === true ? 'archived' : '',
      closed === false ? 'unarchived' : '',
      board_id !== undefined ? `moved to board ${board_id}` : '',
      pos !== undefined ? `repositioned (${pos})` : ''
    ].filter(Boolean).join(', ');
    return { content: [{ type: 'text', text: `Updated list (${list.id})${changed ? `: ${changed}` : ''}` }], structuredContent: list };
  });

  server.registerTool('trello_get_board_activity', {
    title: 'Get Board Recent Activity',
    description: `Get recent actions on a board. limit: 1-100 (default 20).`,
    inputSchema: {
      board_id: z.string().min(1).describe("Trello board ID"),
      limit: z.number().int().min(1).max(100).default(20).describe("Number of actions")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ board_id, limit }) => {
    const actions = await client.getBoardActivity(board_id, limit);
    const text = actions.map(a => `[${new Date(a.date).toLocaleString()}] ${a.memberCreator.fullName}: ${a.type}`).join('\n');
    return { content: [{ type: 'text', text: text || 'No recent activity.' }], structuredContent: { actions } };
  });
}
