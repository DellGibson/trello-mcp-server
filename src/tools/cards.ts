import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TrelloClient } from '../services/trello.js';
import { TrelloChecklist } from '../types.js';

export function registerCardTools(server: McpServer, client: TrelloClient): void {

  server.registerTool('trello_get_card', {
    title: 'Get Card Details',
    description: `Get full card details with optional comments and checklists.`,
    inputSchema: {
      card_id: z.string().min(1).describe("Trello card ID"),
      include_comments: z.boolean().default(true).describe("Include comments"),
      include_checklists: z.boolean().default(true).describe("Include checklists")
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ card_id, include_comments, include_checklists }) => {
    const [card, comments, checklists] = await Promise.all([
      client.getCard(card_id),
      include_comments ? client.getCardComments(card_id) : Promise.resolve([]),
      include_checklists ? client.getCardChecklists(card_id) : Promise.resolve([])
    ]) as [Awaited<ReturnType<TrelloClient['getCard']>>, Awaited<ReturnType<TrelloClient['getCardComments']>>, Awaited<ReturnType<TrelloClient['getCardChecklists']>>];
    const lines = [
      `**${card.name}**`, card.desc ? `\n${card.desc}` : '', `\nURL: ${card.url}`,
      card.due ? `Due: ${new Date(card.due).toLocaleDateString()}${card.dueComplete ? ' ✓' : ''}` : '',
      card.labels.length ? `Labels: ${card.labels.map((l: { name: string; color: string }) => l.name || l.color).join(', ')}` : ''
    ].filter(Boolean);
    if ((checklists as TrelloChecklist[]).length > 0) {
      lines.push('\n**Checklists:**');
      for (const cl of checklists as TrelloChecklist[]) {
        const done = cl.checkItems.filter(i => i.state === 'complete').length;
        lines.push(`  ${cl.name} (${done}/${cl.checkItems.length})`);
        for (const item of cl.checkItems) lines.push(`    ${item.state === 'complete' ? '☑' : '☐'} ${item.name}`);
      }
    }
    if (comments.length > 0) {
      lines.push('\n**Comments:**');
      for (const c of comments) { lines.push(`  [${new Date(c.date).toLocaleDateString()}] ${c.memberCreator.fullName}:`); lines.push(`  ${c.data.text}`); }
    }
    return { content: [{ type: 'text', text: lines.join('\n') }], structuredContent: { card, comments, checklists } };
  });

  server.registerTool('trello_get_list_cards', {
    title: 'Get Cards in a List',
    description: `Get all cards in a specific list by list_id.`,
    inputSchema: { list_id: z.string().min(1).describe("Trello list ID") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ list_id }) => {
    const cards = await client.getListCards(list_id);
    const text = cards.length === 0 ? 'No cards in this list.'
      : cards.map(c => [`• **${c.name}** (${c.id})`,
          c.desc ? `  ${c.desc.slice(0,100)}${c.desc.length > 100 ? '…' : ''}` : '',
          c.due ? `  Due: ${new Date(c.due).toLocaleDateString()}${c.dueComplete ? ' ✓' : ''}` : ''
        ].filter(Boolean).join('\n')).join('\n\n');
    return { content: [{ type: 'text', text }], structuredContent: { cards } };
  });

  server.registerTool('trello_create_card', {
    title: 'Create Trello Card',
    description: `Create a card in a list. due: ISO 8601. member_ids/label_ids: arrays of IDs.`,
    inputSchema: {
      list_id: z.string().min(1).describe("Target list ID"),
      name: z.string().min(1).max(16384).describe("Card title"),
      desc: z.string().max(16384).optional().describe("Description (Markdown)"),
      due: z.string().optional().describe("Due date ISO 8601"),
      member_ids: z.array(z.string()).optional().describe("Member IDs to assign"),
      label_ids: z.array(z.string()).optional().describe("Label IDs to apply"),
      pos: z.enum(['top','bottom']).default('bottom').describe("Position in list")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ list_id, name, desc, due, member_ids, label_ids, pos }) => {
    const card = await client.createCard(list_id, name, desc, due, member_ids, label_ids, pos);
    return { content: [{ type: 'text', text: `Created card "${card.name}" (${card.id})\n${card.shortUrl}` }], structuredContent: card };
  });

  server.registerTool('trello_update_card', {
    title: 'Update Trello Card',
    description: `Update card fields. Only provide fields to change. list_id moves the card.`,
    inputSchema: {
      card_id: z.string().min(1).describe("Card ID"),
      name: z.string().min(1).optional(),
      desc: z.string().optional(),
      due: z.string().nullable().optional().describe("ISO 8601 or null to clear"),
      due_complete: z.boolean().optional(),
      list_id: z.string().optional().describe("Move to this list"),
      member_ids: z.array(z.string()).optional(),
      label_ids: z.array(z.string()).optional(),
      closed: z.boolean().optional().describe("Archive/unarchive")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ card_id, name, desc, due, due_complete, list_id, member_ids, label_ids, closed }) => {
    const card = await client.updateCard(card_id, { name, desc, due, dueComplete: due_complete, idList: list_id, idMembers: member_ids, idLabels: label_ids, closed });
    return { content: [{ type: 'text', text: `Updated card "${card.name}" (${card.id})` }], structuredContent: card };
  });

  server.registerTool('trello_move_card', {
    title: 'Move Card to List',
    description: `Move a card to a different list. pos: 'top'|'bottom'.`,
    inputSchema: {
      card_id: z.string().min(1).describe("Card ID"),
      list_id: z.string().min(1).describe("Target list ID"),
      pos: z.enum(['top','bottom']).default('bottom')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ card_id, list_id, pos }) => {
    const card = await client.moveCard(card_id, list_id, pos);
    return { content: [{ type: 'text', text: `Moved "${card.name}" to list ${list_id}` }], structuredContent: card };
  });

  server.registerTool('trello_archive_card', {
    title: 'Archive Trello Card',
    description: `Archive a card (not deleted, just hidden). Use trello_update_card with closed=false to restore.`,
    inputSchema: { card_id: z.string().min(1).describe("Card ID to archive") },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, async ({ card_id }) => {
    const card = await client.archiveCard(card_id);
    return { content: [{ type: 'text', text: `Archived "${card.name}" (${card.id})` }], structuredContent: card };
  });

  server.registerTool('trello_add_comment', {
    title: 'Add Comment to Card',
    description: `Post a comment on a card. Markdown supported.`,
    inputSchema: {
      card_id: z.string().min(1).describe("Card ID"),
      text: z.string().min(1).max(16384).describe("Comment text")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ card_id, text }) => {
    const comment = await client.addComment(card_id, text);
    return { content: [{ type: 'text', text: `Comment added to card ${card_id}` }], structuredContent: comment };
  });

  server.registerTool('trello_add_checklist', {
    title: 'Add Checklist to Card',
    description: `Add a checklist to a card, optionally with initial items.`,
    inputSchema: {
      card_id: z.string().min(1).describe("Card ID"),
      name: z.string().min(1).describe("Checklist name"),
      items: z.array(z.string().min(1)).optional().describe("Initial checklist items")
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async ({ card_id, name, items }) => {
    const checklist = await client.createChecklist(card_id, name);
    if (items?.length) { for (const item of items) await client.addCheckItem(checklist.id, item); }
    const updated = await client.getCardChecklists(card_id);
    const created = updated.find(c => c.id === checklist.id) ?? checklist;
    return { content: [{ type: 'text', text: `Created checklist "${name}" with ${items?.length ?? 0} items` }], structuredContent: created };
  });

  server.registerTool('trello_update_check_item', {
    title: 'Update Checklist Item',
    description: `Mark a checklist item complete or incomplete.`,
    inputSchema: {
      card_id: z.string().min(1), checklist_id: z.string().min(1),
      check_item_id: z.string().min(1), state: z.enum(['complete','incomplete'])
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ card_id, checklist_id, check_item_id, state }) => {
    const result = await client.updateCheckItem(card_id, checklist_id, check_item_id, state);
    return { content: [{ type: 'text', text: `Check item marked as ${state}` }], structuredContent: result };
  });
}
